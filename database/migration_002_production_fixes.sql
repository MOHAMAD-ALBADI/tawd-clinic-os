-- ================================================================
-- TAWD — Migration 002: Production Fixes
-- Date   : 2026-06-16
-- Author : Claude Code (Lead Engineer)
-- Target : Supabase SQL Editor — run once
-- ----------------------------------------------------------------
-- Changes:
--   1. gemini_model ENUM → add gemini-2.0-flash (actual model in use)
--   2. waiting_queue.queue_position → DEFAULT 0 (prevents NOT NULL failure)
--   3. doctor_services junction table + RLS (missing from schema)
-- NOTE: ALTER TYPE ADD VALUE cannot run in a transaction block.
--       Run this entire file at once in Supabase SQL Editor.
-- ================================================================

-- ── 1. Add gemini-2.0-flash to gemini_model ENUM ────────────────
-- Must be outside BEGIN/COMMIT in PostgreSQL

ALTER TYPE public.gemini_model ADD VALUE IF NOT EXISTS 'gemini-2.0-flash';
ALTER TYPE public.gemini_model ADD VALUE IF NOT EXISTS 'gemini-2.5-flash';

-- ── 2. waiting_queue.queue_position — default 0 ─────────────────
-- Prevents NOT NULL insertion failure in WF-06
-- WF-08 Queue Manager re-sequences properly every 15 minutes

ALTER TABLE public.waiting_queue
  ALTER COLUMN queue_position SET DEFAULT 0;

-- ── 3. doctor_services junction table ───────────────────────────
-- Tracks which services each doctor is licensed to provide.
-- Used by WF-06 to filter slots by service compatibility.

CREATE TABLE IF NOT EXISTS public.doctor_services (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        NOT NULL REFERENCES public.tawd_clinics(id)     ON DELETE CASCADE,
  doctor_id  UUID        NOT NULL REFERENCES public.tawd_staff_users(id) ON DELETE CASCADE,
  service_id UUID        NOT NULL REFERENCES public.services(id)         ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, doctor_id, service_id)
);

ALTER TABLE public.doctor_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_isolation ON public.doctor_services;
CREATE POLICY clinic_isolation ON public.doctor_services
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE INDEX IF NOT EXISTS idx_doctor_services_doctor
  ON public.doctor_services (clinic_id, doctor_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_doctor_services_service
  ON public.doctor_services (clinic_id, service_id, is_active)
  WHERE is_active = TRUE;

-- ================================================================
-- Verification
-- ================================================================

-- 1. ENUM values
SELECT enumlabel AS "gemini_model values"
FROM pg_enum
JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
WHERE pg_type.typname = 'gemini_model'
ORDER BY enumsortorder;

-- 2. queue_position default
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'waiting_queue'
  AND column_name  = 'queue_position';

-- 3. doctor_services table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'doctor_services';
