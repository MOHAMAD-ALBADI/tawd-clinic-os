-- =========================================================
-- TAWD Migration 004: Subscription Dunning & Grace Period
-- Created: 2026-06-18
-- =========================================================
-- Adds 3 columns to tawd_subscriptions for dunning tracking.
-- Updates clinic_has_feature() to allow service during past_due.
-- Status flow: active → past_due (7d grace) → paused (suspended)
-- =========================================================

-- 1. Add dunning columns to tawd_subscriptions
ALTER TABLE public.tawd_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dunning_alerts_sent    INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dunning_alert_at  TIMESTAMPTZ;

-- 2. Index for WF-25 dunning engine query
CREATE INDEX IF NOT EXISTS idx_tawd_subs_dunning
  ON public.tawd_subscriptions(status, current_period_end, grace_period_ends_at)
  WHERE status IN ('active', 'past_due');

-- 3. Update clinic_has_feature to allow service during grace period
--    past_due = payment overdue but within 7-day grace, service CONTINUES
--    paused   = grace period expired, service STOPPED
CREATE OR REPLACE FUNCTION public.clinic_has_feature(
  p_clinic_id   UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub_status  public.subscription_status;
  v_value       JSONB;
  v_expires     TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_sub_status
  FROM   public.tawd_subscriptions
  WHERE  clinic_id = p_clinic_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- active + trial + past_due (grace period) = service allowed
  -- paused / cancelled = service BLOCKED
  IF v_sub_status IS NULL OR v_sub_status NOT IN ('active', 'trial', 'past_due') THEN
    RETURN FALSE;
  END IF;

  SELECT feature_value, expires_at
  INTO   v_value, v_expires
  FROM   public.clinic_feature_flags
  WHERE  clinic_id   = p_clinic_id
    AND  feature_key = p_feature_key;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_expires IS NOT NULL AND v_expires < NOW() THEN RETURN FALSE; END IF;

  RETURN (
    v_value = 'true'::jsonb
    OR (jsonb_typeof(v_value) = 'number' AND (v_value::text::numeric) > 0)
  );
END;
$$;
