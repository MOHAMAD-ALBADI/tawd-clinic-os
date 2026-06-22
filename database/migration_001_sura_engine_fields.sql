-- ================================================================
-- TAWD — Migration 001: Sura Engine Fields
-- Date   : 2026-06-15
-- Author : Claude Code (Lead Engineer)
-- Target : Supabase SQL Editor — run once
-- ----------------------------------------------------------------
-- Changes:
--   1. tawd_clinic_settings → Maintenance Mode columns
--   2. tawd_clinic_settings → appointment_lock_minutes default 10→15
--   3. chat_sessions        → Booking Context Lock + Clarification
--   4. tawd_lock_slot()     → p_lock_minutes default 10→15
-- ================================================================

BEGIN;

-- ── 1. tawd_clinic_settings: Maintenance Mode ───────────────────

ALTER TABLE public.tawd_clinic_settings
  ADD COLUMN IF NOT EXISTS is_in_maintenance  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maintenance_msg_ar TEXT    NOT NULL
    DEFAULT 'عذراً، العيادة في وضع الصيانة حالياً. سنعود قريباً بإذن الله.',
  ADD COLUMN IF NOT EXISTS maintenance_msg_en TEXT    NOT NULL
    DEFAULT 'Sorry, the clinic is currently under maintenance. We will be back shortly.';

-- ── 2. tawd_clinic_settings: Unify lock duration to 15 min ──────
--    (Was 10 — now aligned with context lock duration)

ALTER TABLE public.tawd_clinic_settings
  ALTER COLUMN appointment_lock_minutes SET DEFAULT 15;

-- Update the seed row (and any row still carrying the old 10-min default)
UPDATE public.tawd_clinic_settings
SET    appointment_lock_minutes = 15
WHERE  appointment_lock_minutes = 10;

-- ── 3. chat_sessions: Booking Context Lock + Clarification ──────

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS booking_in_progress  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_slot_id      UUID
    REFERENCES public.appointment_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clarification_count  SMALLINT    NOT NULL DEFAULT 0;

-- Index: booking engine needs fast lookup of sessions currently in-flight
CREATE INDEX IF NOT EXISTS idx_chat_sessions_booking_active
  ON public.chat_sessions (clinic_id, booking_in_progress)
  WHERE booking_in_progress = TRUE;

-- ── 4. tawd_lock_slot(): update default from 10 → 15 min ────────

CREATE OR REPLACE FUNCTION public.tawd_lock_slot(
  p_slot_id      UUID,
  p_session_id   UUID,
  p_lock_minutes INTEGER DEFAULT 15      -- was 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.appointment_slots
  SET
    is_locked         = TRUE,
    locked_until      = NOW() + (p_lock_minutes || ' minutes')::INTERVAL,
    locked_by_session = p_session_id
  WHERE
    id           = p_slot_id
    AND is_booked  = FALSE
    AND (is_locked = FALSE OR locked_until < NOW());

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

COMMIT;

-- ================================================================
-- Verification — run after COMMIT to confirm all changes landed
-- ================================================================

-- 3a. New columns in tawd_clinic_settings
SELECT
  column_name                              AS "العمود",
  data_type                                AS "النوع",
  is_nullable                              AS "NULL مسموح",
  column_default                           AS "القيمة الافتراضية"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'tawd_clinic_settings'
  AND column_name  IN (
    'is_in_maintenance',
    'maintenance_msg_ar',
    'maintenance_msg_en',
    'appointment_lock_minutes'
  )
ORDER BY column_name;

-- 3b. New columns in chat_sessions
SELECT
  column_name                              AS "العمود",
  data_type                                AS "النوع",
  is_nullable                              AS "NULL مسموح",
  column_default                           AS "القيمة الافتراضية"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'chat_sessions'
  AND column_name  IN (
    'booking_in_progress',
    'booking_locked_until',
    'booking_slot_id',
    'clarification_count'
  )
ORDER BY column_name;

-- 3c. Updated lock function signature
SELECT
  p.proname                                AS "الدالة",
  pg_get_function_arguments(p.oid)         AS "المعاملات (يجب أن يكون 15 في الافتراضي)",
  p.prosecdef                              AS "SECURITY DEFINER"
FROM pg_proc   p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'tawd_lock_slot';

-- 3d. Partial index exists
SELECT
  indexname                                AS "اسم الـ Index",
  indexdef                                 AS "التعريف"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'chat_sessions'
  AND indexname  = 'idx_chat_sessions_booking_active';
