-- =========================================================
-- TAWD Migration 003: Feature Flags System
-- Created: 2026-06-18
-- Applied: 2026-06-18 via mcp__supabase__apply_migration
-- =========================================================
-- Table:    clinic_feature_flags (new)
-- Function: clinic_has_feature(clinic_id, feature_key) → BOOLEAN
-- RLS: platform_admin all; clinic staff read-own only
-- NOTE: Uses existing tawd_subscriptions for active-status check.
--       tawd_clinics is the correct clinics table name.
-- =========================================================

-- 1. clinic_feature_flags
--    One row per feature per clinic. feature_value is JSONB:
--    true (boolean) = enabled, false = disabled,
--    number > 0 = enabled with a numeric limit (e.g. max_staff_users = 5).
CREATE TABLE IF NOT EXISTS public.clinic_feature_flags (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID          NOT NULL
                REFERENCES    public.tawd_clinics(id) ON DELETE CASCADE,
  feature_key   TEXT          NOT NULL,
  feature_value JSONB         NOT NULL DEFAULT 'true'::jsonb,
  enabled_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, feature_key)
);

-- 3. Row Level Security
ALTER TABLE public.clinic_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_feature_flags  ENABLE ROW LEVEL SECURITY;

-- clinic_subscriptions: platform_admin can do everything; clinic reads own row
CREATE POLICY "clinic_isolation" ON public.clinic_subscriptions
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- clinic_feature_flags: platform_admin manages all; clinic can only read own
CREATE POLICY "platform_admin_all" ON public.clinic_feature_flags
  FOR ALL USING (public.is_platform_admin());

CREATE POLICY "clinic_read_own" ON public.clinic_feature_flags
  FOR SELECT USING (clinic_id = public.get_clinic_id());

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_subs_status
  ON public.clinic_subscriptions(status)
  WHERE status IN ('active', 'trial');

CREATE INDEX IF NOT EXISTS idx_clinic_features_lookup
  ON public.clinic_feature_flags(clinic_id, feature_key);

CREATE INDEX IF NOT EXISTS idx_clinic_features_expires
  ON public.clinic_feature_flags(expires_at)
  WHERE expires_at IS NOT NULL;

-- 5. Helper function: clinic_has_feature
--    Called by n8n workflows at entry points to gate execution.
--    Returns TRUE only when:
--      a) clinic has an active or trial subscription, AND
--      b) the feature flag exists, is not expired, and value = true or positive number
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
  v_sub_status  TEXT;
  v_value       JSONB;
  v_expires     TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_sub_status
  FROM   public.clinic_subscriptions
  WHERE  clinic_id = p_clinic_id;

  IF v_sub_status IS NULL OR v_sub_status NOT IN ('active', 'trial') THEN
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

-- =========================================================
-- Standard Feature Keys (reference — NOT enforced by DB)
-- =========================================================
-- sura_ai_enabled              BOOLEAN  Gemini AI in WF-05
-- reminders_enabled            BOOLEAN  WhatsApp reminders in WF-07
-- marketing_campaigns_enabled  BOOLEAN  Re-engagement campaigns in WF-19
-- booking_enabled              BOOLEAN  Online booking
-- insurance_enabled            BOOLEAN  Insurance claims module
-- reviews_enabled              BOOLEAN  Reviews routing WF-20
-- max_staff_users              NUMBER   Numeric limit on staff accounts
-- max_monthly_messages         NUMBER   Monthly WhatsApp message quota
-- =========================================================
