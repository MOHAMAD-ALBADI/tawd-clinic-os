-- ============================================================
-- TAWD — Master Database Schema
-- Version : 1.0.0
-- Date    : 2026-06-15
-- Tables  : 41  |  Groups: 11  |  Full RLS  |  Indexes  |  Audit System
-- Reference: TAWD_System_Reference.md (Single Source of Truth)
-- ============================================================
-- EXECUTION: Paste into Supabase SQL Editor and run once on a fresh project.
-- IMPORTANT : Never expose Service Role Key or any secret in this file.
-- ============================================================

-- ============================================================
-- SECTION 0 — Extensions
-- ============================================================

-- pgcrypto provides gen_random_uuid() on Supabase (PG 13+ has it built-in too)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SECTION 1 — Custom Types (ENUMs)
-- ============================================================

CREATE TYPE clinic_plan               AS ENUM ('starter', 'growth', 'pro', 'enterprise');
CREATE TYPE clinic_status             AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE staff_role                AS ENUM ('admin', 'doctor', 'receptionist', 'accountant', 'platform_admin');
CREATE TYPE channel_type              AS ENUM ('whatsapp', 'instagram', 'web_chat', 'sms', 'voice');
CREATE TYPE appointment_status        AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE appointment_type          AS ENUM ('new_patient', 'follow_up', 'consultation', 'procedure', 'emergency');
CREATE TYPE invoice_status            AS ENUM ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE payment_status            AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE payment_gateway           AS ENUM ('thawani', 'cash', 'bank_transfer', 'insurance');
CREATE TYPE payment_purpose           AS ENUM ('deposit', 'invoice', 'partial');
CREATE TYPE claim_status              AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'cancelled');
CREATE TYPE queue_status              AS ENUM ('waiting', 'called', 'in_room', 'done', 'left');
CREATE TYPE ai_review_status          AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE notification_status       AS ENUM ('pending', 'sent', 'failed', 'cancelled');
CREATE TYPE consent_type              AS ENUM ('general_treatment', 'data_processing', 'marketing', 'specific_procedure');
CREATE TYPE campaign_status           AS ENUM ('draft', 'scheduled', 'running', 'completed', 'cancelled');
CREATE TYPE commission_status         AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE billing_cycle             AS ENUM ('monthly', 'annual');
CREATE TYPE subscription_status       AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'paused');
CREATE TYPE severity_level            AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE audit_action              AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE prescription_status       AS ENUM ('draft', 'signed', 'dispensed', 'cancelled');
CREATE TYPE session_status            AS ENUM ('active', 'paused', 'closed', 'escalated');
CREATE TYPE review_route              AS ENUM ('google', 'admin', 'suppressed');
CREATE TYPE blood_type                AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown');
CREATE TYPE currency_code             AS ENUM ('OMR', 'SAR', 'AED', 'USD');
CREATE TYPE day_of_week_type          AS ENUM ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
CREATE TYPE gemini_model              AS ENUM ('gemini-1.5-flash', 'gemini-1.5-pro');
CREATE TYPE notification_template_type AS ENUM (
  'appointment_reminder_24h',
  'appointment_reminder_2h',
  'appointment_confirmation',
  'appointment_cancellation',
  'invoice_ready',
  'payment_received',
  'no_show_followup',
  'sura_welcome',
  'custom'
);


-- ============================================================
-- SECTION 2 — RLS Helper Functions (public schema)
-- ============================================================

-- Returns TRUE if the current JWT belongs to the TAWD Platform Admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'platform_admin',
    FALSE
  );
$$;

-- Returns the clinic_id stored in the current user's JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_clinic_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'app_metadata' ->> 'clinic_id'),
    ''
  )::UUID;
$$;


-- ============================================================
-- SECTION 3 — Tables (41 tables, strict dependency order)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 3.1  PLATFORM CORE  (4 tables — tawd_* prefix)
-- ──────────────────────────────────────────────────────────

-- Table 1: tawd_clinics
CREATE TABLE tawd_clinics (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT          NOT NULL,
  name_ar      TEXT,
  plan         clinic_plan   NOT NULL DEFAULT 'starter',
  status       clinic_status NOT NULL DEFAULT 'trial',
  currency     currency_code NOT NULL DEFAULT 'OMR',
  vat_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
  vat_number   TEXT,
  country_code CHAR(2)       NOT NULL DEFAULT 'OM',
  timezone     TEXT          NOT NULL DEFAULT 'Asia/Muscat',
  logo_url     TEXT,
  phone        TEXT,
  address      TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Table 2: tawd_staff_users
-- id = auth.users.id (Standard Supabase Pattern — required for RLS with auth.uid())
-- Workflow: create auth user first, then INSERT here with same UUID.
-- commission_rate: fixed % of invoice total per doctor (Q3 decision).
CREATE TABLE tawd_staff_users (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id       UUID        REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  role            staff_role  NOT NULL,
  name            TEXT        NOT NULL,
  name_ar         TEXT,
  email           TEXT        NOT NULL,
  phone           TEXT,
  mfa_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00
                  CONSTRAINT chk_commission_range CHECK (commission_rate BETWEEN 0 AND 100),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_staff_clinic_required
    CHECK (role = 'platform_admin' OR clinic_id IS NOT NULL)
);

-- Table 3: tawd_clinic_settings
-- One row per clinic. working_hours uses Gulf weekly pattern (Fri off by default).
CREATE TABLE tawd_clinic_settings (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 UUID    NOT NULL UNIQUE REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  mfa_enforced              BOOLEAN NOT NULL DEFAULT FALSE,
  working_hours             JSONB   NOT NULL DEFAULT '{
    "sun": {"open": "08:00", "close": "22:00"},
    "mon": {"open": "08:00", "close": "22:00"},
    "tue": {"open": "08:00", "close": "22:00"},
    "wed": {"open": "08:00", "close": "22:00"},
    "thu": {"open": "08:00", "close": "22:00"},
    "fri": {"closed": true},
    "sat": {"open": "08:00", "close": "22:00"}
  }'::jsonb,
  languages                 TEXT[]  NOT NULL DEFAULT ARRAY['ar', 'en'],
  channel_toggles           JSONB   NOT NULL DEFAULT '{
    "whatsapp": false,
    "instagram": false,
    "web_chat": false,
    "sms": false,
    "voice": false
  }'::jsonb,
  booking_slot_duration_min INTEGER NOT NULL DEFAULT 30,
  advance_booking_days      INTEGER NOT NULL DEFAULT 30,
  appointment_lock_minutes  INTEGER NOT NULL DEFAULT 15,
  is_in_maintenance         BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_msg_ar        TEXT    NOT NULL DEFAULT 'عذراً، العيادة في وضع الصيانة حالياً. سنعود قريباً بإذن الله.',
  maintenance_msg_en        TEXT    NOT NULL DEFAULT 'Sorry, the clinic is currently under maintenance. We will be back shortly.',
  sura_personality_override JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 4: tawd_audit_logs
-- IMMUTABLE — no UPDATE or DELETE ever (enforced by trigger in Section 7).
-- Written only by SECURITY DEFINER trigger on sensitive tables.
-- Records SELECT-level access for patients is handled separately in patient_access_logs.
CREATE TABLE tawd_audit_logs (
  id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id  UUID           REFERENCES tawd_clinics(id) ON DELETE SET NULL,
  action     audit_action   NOT NULL,
  table_name TEXT           NOT NULL,
  record_id  UUID           NOT NULL,
  old_value  JSONB,
  new_value  JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.2  SAAS SUBSCRIPTIONS  (1 table)
-- ──────────────────────────────────────────────────────────

-- Table 5: tawd_subscriptions
CREATE TABLE tawd_subscriptions (
  id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID                NOT NULL UNIQUE REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  plan                    clinic_plan         NOT NULL DEFAULT 'starter',
  billing_cycle           billing_cycle       NOT NULL DEFAULT 'monthly',
  status                  subscription_status NOT NULL DEFAULT 'trial',
  price_omr               NUMERIC(10,3)       NOT NULL DEFAULT 0.000,
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  current_period_end      TIMESTAMPTZ,
  renews_at               TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  thawani_subscription_id TEXT,
  created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.3  PATIENTS & MEDICAL RECORDS  (5 tables)
-- ──────────────────────────────────────────────────────────

-- Table 6: patients
-- national_id stored AES-256 encrypted at application layer.
-- UNIQUE on phone per clinic for channel-based deduplication.
-- is_archived: PDPL "right to be forgotten" (anonymise, keep structure).
-- deleted_at: operational soft-delete.
CREATE TABLE patients (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  national_id    TEXT,
  name           TEXT         NOT NULL,
  name_ar        TEXT,
  phone          TEXT         NOT NULL,
  email          TEXT,
  dob            DATE,
  gender         TEXT         CHECK (gender IN ('male', 'female', 'other')),
  nationality    TEXT,
  loyalty_points INTEGER      NOT NULL DEFAULT 0,
  is_archived    BOOLEAN      NOT NULL DEFAULT FALSE,
  archive_reason TEXT,
  archived_at    TIMESTAMPTZ,
  source_channel channel_type,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, phone)
);

-- Table 7: medical_histories
-- One row per patient (1-to-1). JSONB arrays for extensibility.
CREATE TABLE medical_histories (
  id                  UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID       NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  blood_type          blood_type NOT NULL DEFAULT 'unknown',
  allergies           JSONB      NOT NULL DEFAULT '[]'::jsonb,
  chronic_diseases    JSONB      NOT NULL DEFAULT '[]'::jsonb,
  current_medications JSONB      NOT NULL DEFAULT '[]'::jsonb,
  notes               TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 8: patient_vitals
-- BMI auto-calculated as stored generated column.
CREATE TABLE patient_vitals (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id                UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  weight_kg                NUMERIC(5,2),
  height_cm                NUMERIC(5,2),
  bmi                      NUMERIC(4,2) GENERATED ALWAYS AS (
    CASE
      WHEN height_cm > 0 AND weight_kg > 0
      THEN ROUND((weight_kg / POWER(height_cm / 100.0, 2))::NUMERIC, 2)
      ELSE NULL
    END
  ) STORED,
  blood_pressure_systolic  INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse_bpm                INTEGER,
  temperature_c            NUMERIC(4,1),
  oxygen_saturation        INTEGER CHECK (oxygen_saturation BETWEEN 0 AND 100),
  recorded_by              UUID        REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  recorded_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 9: digital_consents
-- PDPL-compliant signed consent records with PDF evidence.
CREATE TABLE digital_consents (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id    UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  consent_type consent_type NOT NULL,
  signed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  pdf_url      TEXT,
  ip_address   INET,
  channel      channel_type,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  expires_at   TIMESTAMPTZ
);

-- Table 10: patient_notes
-- Doctor's clinical notes. is_private hides from receptionist/accountant.
CREATE TABLE patient_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id  UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  doctor_id  UUID        REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  note_text  TEXT        NOT NULL,
  is_private BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.4  SERVICES & SCHEDULING  (3 tables)
-- services created here because appointments.service_id references it.
-- ──────────────────────────────────────────────────────────

-- Table 11: services
-- The clinic's service catalogue. Price is in clinic's default currency.
-- deleted_at: soft-delete; discontinued services preserve historical invoice data.
CREATE TABLE services (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID          NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  name_ar          TEXT,
  description      TEXT,
  price            NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  currency         currency_code NOT NULL DEFAULT 'OMR',
  duration_minutes INTEGER       NOT NULL DEFAULT 30,
  vat_applicable   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  category         TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Table 12: doctor_schedules
-- Recurring weekly availability per doctor.
-- The slot generation engine (WF-06) reads this to auto-create appointment_slots.
-- effective_from/effective_until allows schedule changes without history loss.
CREATE TABLE doctor_schedules (
  id                    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID             NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  doctor_id             UUID             NOT NULL REFERENCES tawd_staff_users(id) ON DELETE CASCADE,
  day_of_week           day_of_week_type NOT NULL,
  start_time            TIME             NOT NULL,
  end_time              TIME             NOT NULL,
  slot_duration_minutes INTEGER          NOT NULL DEFAULT 30,
  is_active             BOOLEAN          NOT NULL DEFAULT TRUE,
  effective_from        DATE             NOT NULL DEFAULT CURRENT_DATE,
  effective_until       DATE,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_schedule_times CHECK (end_time > start_time),
  UNIQUE (clinic_id, doctor_id, day_of_week, effective_from)
);

-- Table 13: clinic_holidays
-- Gulf-context mandatory. Prevents slot generation on Eid, National Day,
-- and individual doctor leave days.
-- applies_to_all_doctors = TRUE  → full clinic closure
-- applies_to_all_doctors = FALSE → doctor_id must be set
CREATE TABLE clinic_holidays (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  holiday_date           DATE        NOT NULL,
  name                   TEXT        NOT NULL,
  name_ar                TEXT,
  applies_to_all_doctors BOOLEAN     NOT NULL DEFAULT TRUE,
  doctor_id              UUID        REFERENCES tawd_staff_users(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_holiday_doctor_logic
    CHECK (applies_to_all_doctors = TRUE OR doctor_id IS NOT NULL),
  UNIQUE (clinic_id, holiday_date, doctor_id)
);


-- ──────────────────────────────────────────────────────────
-- 3.5  APPOINTMENTS & QUEUE  (4 tables)
-- ──────────────────────────────────────────────────────────

-- Table 14: appointment_slots
-- Individual available time slots per doctor.
-- Atomic locking: tawd_lock_appointment_slot() in Section 6.
-- is_locked + locked_until prevent double-booking during concurrent requests.
CREATE TABLE appointment_slots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  doctor_id         UUID        NOT NULL REFERENCES tawd_staff_users(id) ON DELETE CASCADE,
  slot_time         TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER     NOT NULL DEFAULT 30,
  is_locked         BOOLEAN     NOT NULL DEFAULT FALSE,
  locked_until      TIMESTAMPTZ,
  locked_by_session UUID,
  is_booked         BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (clinic_id, doctor_id, slot_time)
);

-- Table 15: appointments
-- service_id → main service booked (Q2: one primary service per appointment).
-- Additional services added during visit go into invoice_items directly.
-- deleted_at: soft-delete only — medical records never hard-deleted.
CREATE TABLE appointments (
  id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID               NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id          UUID               NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id           UUID               NOT NULL REFERENCES tawd_staff_users(id) ON DELETE RESTRICT,
  service_id          UUID               REFERENCES services(id) ON DELETE SET NULL,
  slot_id             UUID               REFERENCES appointment_slots(id) ON DELETE SET NULL,
  slot_time           TIMESTAMPTZ        NOT NULL,
  duration_minutes    INTEGER            NOT NULL DEFAULT 30,
  status              appointment_status NOT NULL DEFAULT 'scheduled',
  type                appointment_type   NOT NULL DEFAULT 'new_patient',
  source_channel      channel_type,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID               REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  deposit_required    BOOLEAN            NOT NULL DEFAULT FALSE,
  deposit_paid        BOOLEAN            NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Table 16: waiting_queue
-- Real-time queue tracking on the day of visit.
CREATE TABLE waiting_queue (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  appt_id                UUID         NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id             UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  queue_position         INTEGER      NOT NULL,
  status                 queue_status NOT NULL DEFAULT 'waiting',
  check_in_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  called_at              TIMESTAMPTZ,
  done_at                TIMESTAMPTZ,
  estimated_wait_minutes INTEGER
);

-- Table 17: no_show_log
-- Recorded by staff or automatically after appointment window passes.
CREATE TABLE no_show_log (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appt_id                 UUID        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id              UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id               UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  marked_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by               UUID        REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  risk_factors            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  automated_followup_sent BOOLEAN     NOT NULL DEFAULT FALSE
);


-- ──────────────────────────────────────────────────────────
-- 3.6  CHANNELS & AI (SURA)  (5 tables)
-- ──────────────────────────────────────────────────────────

-- Table 18: channel_configs
-- credentials_ref points to the n8n credential name / vault path.
-- The actual secret never enters the database.
CREATE TABLE channel_configs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  channel         channel_type NOT NULL,
  credentials_ref TEXT         NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
  config          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, channel)
);

-- Table 19: chat_sessions
-- One session per conversation thread per patient per channel.
-- external_user_id: WhatsApp phone number, Instagram user ID, etc.
CREATE TABLE chat_sessions (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID           NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id            UUID           REFERENCES patients(id) ON DELETE SET NULL,
  channel               channel_type   NOT NULL,
  external_user_id      TEXT,
  status                session_status NOT NULL DEFAULT 'active',
  language              TEXT           NOT NULL DEFAULT 'ar',
  last_active_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  -- Booking context lock (WF-05 Sura Engine)
  booking_in_progress   BOOLEAN        NOT NULL DEFAULT FALSE,
  booking_locked_until  TIMESTAMPTZ,
  booking_slot_id       UUID           REFERENCES appointment_slots(id) ON DELETE SET NULL,
  clarification_count   SMALLINT       NOT NULL DEFAULT 0
);

-- Table 20: chat_messages
-- Full conversation history. tokens_used + gemini_model feed ai_usage_metrics.
CREATE TABLE chat_messages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  clinic_id    UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  sender       TEXT         NOT NULL CHECK (sender IN ('patient', 'sura', 'staff', 'system')),
  message_text TEXT,
  message_type TEXT         NOT NULL DEFAULT 'text'
               CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template')),
  media_url    TEXT,
  tokens_used  INTEGER      NOT NULL DEFAULT 0,
  gemini_model gemini_model,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table 21: ai_review_queue
-- HITL Gate. confidence_score < 0.85 or medically sensitive → status = 'pending'.
-- priority 5 = emergency escalation (detected by Sura's keyword/context rules).
CREATE TABLE ai_review_queue (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID             NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  session_id       UUID             REFERENCES chat_sessions(id) ON DELETE SET NULL,
  patient_id       UUID             REFERENCES patients(id) ON DELETE SET NULL,
  ai_draft         TEXT             NOT NULL,
  ai_intent        TEXT,
  confidence_score NUMERIC(4,3)     NOT NULL
                   CHECK (confidence_score BETWEEN 0 AND 1),
  status           ai_review_status NOT NULL DEFAULT 'pending',
  priority         INTEGER          NOT NULL DEFAULT 1
                   CHECK (priority BETWEEN 1 AND 5),
  reviewed_by      UUID             REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  reviewer_note    TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Table 22: ai_usage_metrics
-- Per-request AI token tracking for quota enforcement per clinic/plan.
-- tokens_total is auto-computed as a generated column.
CREATE TABLE ai_usage_metrics (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  workflow_id   TEXT,
  model         gemini_model NOT NULL,
  channel       channel_type,
  tokens_input  INTEGER      NOT NULL DEFAULT 0,
  tokens_output INTEGER      NOT NULL DEFAULT 0,
  tokens_total  INTEGER      GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  session_id    UUID         REFERENCES chat_sessions(id) ON DELETE SET NULL,
  recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.7  CLINICAL SERVICES & PRESCRIPTIONS  (5 tables)
-- ──────────────────────────────────────────────────────────

-- Table 23: prescriptions
-- deleted_at: soft-delete. Medical records must never be hard-deleted.
CREATE TABLE prescriptions (
  id         UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID                NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id  UUID                NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  doctor_id  UUID                NOT NULL REFERENCES tawd_staff_users(id) ON DELETE RESTRICT,
  appt_id    UUID                REFERENCES appointments(id) ON DELETE SET NULL,
  status     prescription_status NOT NULL DEFAULT 'draft',
  diagnosis  TEXT,
  notes      TEXT,
  pdf_url    TEXT,
  signed_at  TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Table 24: prescription_items
-- sort_order for correct print order in PDF.
CREATE TABLE prescription_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID    NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_name       TEXT    NOT NULL,
  drug_name_ar    TEXT,
  dosage          TEXT    NOT NULL,
  frequency       TEXT,
  duration        TEXT,
  instructions    TEXT,
  instructions_ar TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Table 25: insurance_providers
-- Dhamani-Ready: dhamani_code stored but no live API connection yet.
CREATE TABLE insurance_providers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  provider_name    TEXT        NOT NULL,
  provider_name_ar TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  dhamani_code     TEXT,
  contact_email    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 26: insurance_claims
-- Integration-Ready Stub — no live Dhamani connection in MVP.
CREATE TABLE insurance_claims (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID          NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id        UUID          NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  appt_id          UUID          REFERENCES appointments(id) ON DELETE SET NULL,
  provider_id      UUID          NOT NULL REFERENCES insurance_providers(id) ON DELETE RESTRICT,
  status           claim_status  NOT NULL DEFAULT 'pending',
  claim_ref        TEXT,
  submitted_amount NUMERIC(12,3),
  approved_amount  NUMERIC(12,3),
  currency         currency_code NOT NULL DEFAULT 'OMR',
  submitted_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  raw_response     JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Table 27: notification_templates
-- Per-clinic customisable message templates.
-- body_ar + body_en for bilingual support.
-- variables: JSONB array of placeholder names, e.g. ["patient_name", "slot_time"]
CREATE TABLE notification_templates (
  id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID                       NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  template_type notification_template_type NOT NULL,
  channel       channel_type               NOT NULL,
  name          TEXT                       NOT NULL,
  body_ar       TEXT                       NOT NULL,
  body_en       TEXT,
  variables     JSONB                      NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN                    NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, template_type, channel)
);


-- ──────────────────────────────────────────────────────────
-- 3.8  FINANCE & BILLING  (6 tables)
-- ──────────────────────────────────────────────────────────

-- Table 28: vat_rules
-- service_id = NULL → default clinic-level VAT rule.
-- service_id = specific UUID → per-service override.
CREATE TABLE vat_rules (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID          NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  service_id     UUID          REFERENCES services(id) ON DELETE CASCADE,
  vat_applicable BOOLEAN       NOT NULL DEFAULT FALSE,
  rate           NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
  rule_name      TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Table 29: invoices
-- deleted_at: soft-delete. Financial records must never be hard-deleted.
CREATE TABLE invoices (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID           NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  appt_id         UUID           REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id      UUID           NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  invoice_number  TEXT           NOT NULL,
  subtotal        NUMERIC(12,3)  NOT NULL DEFAULT 0.000,
  discount_amount NUMERIC(12,3)  NOT NULL DEFAULT 0.000,
  vat_amount      NUMERIC(12,3)  NOT NULL DEFAULT 0.000,
  total           NUMERIC(12,3)  NOT NULL DEFAULT 0.000,
  currency        currency_code  NOT NULL DEFAULT 'OMR',
  status          invoice_status NOT NULL DEFAULT 'draft',
  due_date        DATE,
  notes           TEXT,
  pdf_url         TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, invoice_number)
);

-- Table 30: invoice_items
-- Price and VAT snapshotted at invoice creation time.
-- This preserves financial history even if service prices change later.
CREATE TABLE invoice_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  clinic_id           UUID          NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  service_id          UUID          REFERENCES services(id) ON DELETE SET NULL,
  description         TEXT          NOT NULL,
  description_ar      TEXT,
  quantity            NUMERIC(8,2)  NOT NULL DEFAULT 1,
  unit_price_snapshot NUMERIC(12,3) NOT NULL,
  vat_rate_snapshot   NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
  vat_amount          NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  total               NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  sort_order          INTEGER       NOT NULL DEFAULT 0
);

-- Table 31: payments
-- Records each payment transaction. One invoice may have multiple partial payments.
CREATE TABLE payments (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID            NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  clinic_id        UUID            NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  gateway          payment_gateway NOT NULL DEFAULT 'thawani',
  transaction_id   TEXT,
  gateway_ref      TEXT,
  currency         currency_code   NOT NULL DEFAULT 'OMR',
  amount           NUMERIC(12,3)   NOT NULL,
  status           payment_status  NOT NULL DEFAULT 'pending',
  paid_at          TIMESTAMPTZ,
  gateway_response JSONB,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Table 32: payment_links
-- Thawani payment links sent via WhatsApp for deposits and invoices.
CREATE TABLE payment_links (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID            NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  appt_id            UUID            REFERENCES appointments(id) ON DELETE SET NULL,
  invoice_id         UUID            REFERENCES invoices(id) ON DELETE SET NULL,
  link_url           TEXT            NOT NULL,
  thawani_session_id TEXT,
  purpose            payment_purpose NOT NULL,
  amount             NUMERIC(12,3)   NOT NULL,
  currency           currency_code   NOT NULL DEFAULT 'OMR',
  status             TEXT            NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expires_at         TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Table 33: doctor_commissions
-- commission_rate snapshot from tawd_staff_users.commission_rate at invoice time.
CREATE TABLE doctor_commissions (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID              NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  clinic_id         UUID              NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  doctor_id         UUID              NOT NULL REFERENCES tawd_staff_users(id) ON DELETE RESTRICT,
  commission_rate   NUMERIC(5,2)      NOT NULL,
  commission_amount NUMERIC(12,3)     NOT NULL,
  currency          currency_code     NOT NULL DEFAULT 'OMR',
  status            commission_status NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.9  MARKETING & LOYALTY  (4 tables)
-- ──────────────────────────────────────────────────────────

-- Table 34: marketing_campaigns
-- template_id links to notification_templates for reusable clinic-customised messages.
CREATE TABLE marketing_campaigns (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID            NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  name             TEXT            NOT NULL,
  target_segment   JSONB           NOT NULL DEFAULT '{}'::jsonb,
  channel          channel_type    NOT NULL,
  template_id      UUID            REFERENCES notification_templates(id) ON DELETE SET NULL,
  template_body    TEXT            NOT NULL,
  template_body_ar TEXT,
  status           campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID            REFERENCES tawd_staff_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Table 35: campaign_logs
-- One row per patient per campaign send attempt.
CREATE TABLE campaign_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID        NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  clinic_id     UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id    UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 36: loyalty_points
-- Append-only ledger. Net balance = SUM(points) per patient.
-- Negative points = redemption.
CREATE TABLE loyalty_points (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id    UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  points       INTEGER     NOT NULL,
  source       TEXT        NOT NULL
               CHECK (source IN ('visit', 'referral', 'review', 'campaign', 'manual', 'redemption')),
  reference_id UUID,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 37: reviews_log
-- rating >= 4 → routed to Google; rating <= 3 → routed to admin for resolution.
CREATE TABLE reviews_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID         NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id   UUID         REFERENCES patients(id) ON DELETE SET NULL,
  appt_id      UUID         REFERENCES appointments(id) ON DELETE SET NULL,
  rating       INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  routed_to    review_route NOT NULL DEFAULT 'admin',
  comment      TEXT,
  channel      channel_type,
  is_published BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────
-- 3.10  SYSTEM, MONITORING & COMPLIANCE  (4 tables)
-- ──────────────────────────────────────────────────────────

-- Table 38: tawd_workflow_logs
-- n8n writes one row per workflow execution.
CREATE TABLE tawd_workflow_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       TEXT        NOT NULL,
  workflow_name     TEXT,
  clinic_id         UUID        REFERENCES tawd_clinics(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL
                    CHECK (status IN ('success', 'error', 'partial', 'timeout')),
  execution_time_ms INTEGER,
  input_summary     JSONB,
  output_summary    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 39: tawd_error_logs
-- Structured error tracking with severity. resolved = TRUE closes the incident.
CREATE TABLE tawd_error_logs (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   TEXT,
  clinic_id     UUID           REFERENCES tawd_clinics(id) ON DELETE SET NULL,
  error_message TEXT           NOT NULL,
  error_stack   TEXT,
  severity      severity_level NOT NULL DEFAULT 'medium',
  context       JSONB,
  resolved      BOOLEAN        NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Table 40: notification_queue
-- Outbound notification scheduler with retry logic.
-- template_id links to stored template; template_name for legacy/n8n references.
CREATE TABLE notification_queue (
  id            UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID                NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id    UUID                REFERENCES patients(id) ON DELETE CASCADE,
  channel       channel_type        NOT NULL,
  template_name TEXT,
  template_id   UUID                REFERENCES notification_templates(id) ON DELETE SET NULL,
  payload       JSONB               NOT NULL,
  status        notification_status NOT NULL DEFAULT 'pending',
  retry_count   INTEGER             NOT NULL DEFAULT 0,
  max_retries   INTEGER             NOT NULL DEFAULT 3,
  scheduled_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Table 41: patient_access_logs
-- PDPL compliance — logs every READ of a patient record by staff.
-- IMPORTANT: PostgreSQL triggers do not fire on SELECT.
-- This table must be written EXPLICITLY by the application layer (n8n / API)
-- every time patient data is accessed. It is not automatic.
CREATE TABLE patient_access_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES tawd_clinics(id) ON DELETE CASCADE,
  patient_id  UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  accessed_by UUID        NOT NULL REFERENCES tawd_staff_users(id) ON DELETE CASCADE,
  access_type TEXT        NOT NULL
              CHECK (access_type IN (
                'view_profile',
                'view_medical_history',
                'view_prescriptions',
                'view_invoices',
                'view_notes',
                'export'
              )),
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 4 — Row Level Security (RLS)
-- Standard policy: clinic_isolation
--   → Platform Admin bypasses all policies (via public.is_platform_admin())
--   → All other users see only their clinic_id data
-- Soft-delete: tables with deleted_at exclude deleted rows by default
-- ============================================================

-- ── 4.1  Platform Core ─────────────────────────────────────

ALTER TABLE tawd_clinics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tawd_staff_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tawd_clinic_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tawd_audit_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON tawd_clinics
  FOR ALL USING (
    public.is_platform_admin() OR id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON tawd_staff_users
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

CREATE POLICY clinic_isolation ON tawd_clinic_settings
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- Audit logs: SELECT only, no INSERT/UPDATE/DELETE via RLS
CREATE POLICY clinic_read ON tawd_audit_logs
  FOR SELECT USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.2  SaaS ──────────────────────────────────────────────

ALTER TABLE tawd_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON tawd_subscriptions
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.3  Patients & Medical ────────────────────────────────

ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_histories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_consents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_notes       ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON patients
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

CREATE POLICY clinic_isolation ON medical_histories
  FOR ALL USING (
    public.is_platform_admin()
    OR patient_id IN (
      SELECT id FROM patients
      WHERE clinic_id = public.get_clinic_id() AND deleted_at IS NULL
    )
  );

CREATE POLICY clinic_isolation ON patient_vitals
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON digital_consents
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON patient_notes
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.4  Services & Schedule ───────────────────────────────

ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_holidays  ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON services
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

CREATE POLICY clinic_isolation ON doctor_schedules
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON clinic_holidays
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.5  Appointments & Queue ──────────────────────────────

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_log       ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON appointment_slots
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON appointments
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

CREATE POLICY clinic_isolation ON waiting_queue
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON no_show_log
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.6  Channels & AI ─────────────────────────────────────

ALTER TABLE channel_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_metrics  ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON channel_configs
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON chat_sessions
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON chat_messages
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON ai_review_queue
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON ai_usage_metrics
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.7  Clinical ──────────────────────────────────────────

ALTER TABLE prescriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_providers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON prescriptions
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

-- prescription_items has no clinic_id → join through prescriptions
CREATE POLICY clinic_isolation ON prescription_items
  FOR ALL USING (
    public.is_platform_admin()
    OR prescription_id IN (
      SELECT id FROM prescriptions
      WHERE clinic_id = public.get_clinic_id() AND deleted_at IS NULL
    )
  );

CREATE POLICY clinic_isolation ON insurance_providers
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON insurance_claims
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON notification_templates
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.8  Finance ───────────────────────────────────────────

ALTER TABLE vat_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON vat_rules
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON invoices
  FOR ALL USING (
    public.is_platform_admin()
    OR (clinic_id = public.get_clinic_id() AND deleted_at IS NULL)
  );

-- invoice_items has clinic_id directly (denormalized for RLS performance)
CREATE POLICY clinic_isolation ON invoice_items
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON payments
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON payment_links
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON doctor_commissions
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.9  Marketing & Loyalty ───────────────────────────────

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews_log         ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON marketing_campaigns
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON campaign_logs
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON loyalty_points
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON reviews_log
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

-- ── 4.10  System & Compliance ──────────────────────────────

ALTER TABLE tawd_workflow_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tawd_error_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON tawd_workflow_logs
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON tawd_error_logs
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON notification_queue
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );

CREATE POLICY clinic_isolation ON patient_access_logs
  FOR ALL USING (
    public.is_platform_admin() OR clinic_id = public.get_clinic_id()
  );


-- ============================================================
-- SECTION 5 — Indexes
-- Partial indexes on active (non-deleted) records for hot-path performance.
-- ============================================================

-- Platform Core
CREATE INDEX idx_staff_clinic          ON tawd_staff_users(clinic_id, role)    WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_clinic_created  ON tawd_audit_logs(clinic_id, created_at DESC);
CREATE INDEX idx_audit_table_record    ON tawd_audit_logs(table_name, record_id);

-- SaaS
CREATE INDEX idx_subscriptions_status  ON tawd_subscriptions(status, renews_at);

-- Patients
CREATE INDEX idx_patients_clinic_active ON patients(clinic_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_phone         ON patients(clinic_id, phone)  WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_archived      ON patients(clinic_id, is_archived) WHERE deleted_at IS NULL;
CREATE INDEX idx_vitals_patient         ON patient_vitals(patient_id, recorded_at DESC);
CREATE INDEX idx_vitals_clinic          ON patient_vitals(clinic_id);
CREATE INDEX idx_consents_patient       ON digital_consents(patient_id, is_active);
CREATE INDEX idx_notes_patient          ON patient_notes(patient_id, created_at DESC);

-- Services & Schedule
CREATE INDEX idx_services_clinic_active ON services(clinic_id)         WHERE deleted_at IS NULL AND is_active = TRUE;
CREATE INDEX idx_doctor_schedules_doc   ON doctor_schedules(clinic_id, doctor_id, day_of_week) WHERE is_active = TRUE;
CREATE INDEX idx_holidays_clinic_date   ON clinic_holidays(clinic_id, holiday_date);

-- Appointments
CREATE INDEX idx_slots_clinic_doc_time  ON appointment_slots(clinic_id, doctor_id, slot_time);
CREATE INDEX idx_slots_available        ON appointment_slots(clinic_id, slot_time) WHERE is_booked = FALSE AND is_locked = FALSE;
CREATE INDEX idx_slots_locked_cleanup   ON appointment_slots(locked_until)         WHERE is_locked = TRUE;
CREATE INDEX idx_appts_clinic_active    ON appointments(clinic_id, slot_time)      WHERE deleted_at IS NULL;
CREATE INDEX idx_appts_patient          ON appointments(patient_id)                WHERE deleted_at IS NULL;
CREATE INDEX idx_appts_doctor_time      ON appointments(doctor_id, slot_time)      WHERE deleted_at IS NULL;
CREATE INDEX idx_appts_status           ON appointments(clinic_id, status)         WHERE deleted_at IS NULL;
CREATE INDEX idx_queue_clinic_status    ON waiting_queue(clinic_id, status);
CREATE INDEX idx_no_show_patient        ON no_show_log(patient_id, marked_at DESC);

-- Channels & AI
CREATE INDEX idx_sessions_clinic        ON chat_sessions(clinic_id, status);
CREATE INDEX idx_sessions_patient       ON chat_sessions(patient_id);
CREATE INDEX idx_sessions_external      ON chat_sessions(clinic_id, channel, external_user_id);
CREATE INDEX idx_sessions_booking_active ON chat_sessions(clinic_id, booking_in_progress) WHERE booking_in_progress = TRUE;
CREATE INDEX idx_messages_session       ON chat_messages(session_id, created_at DESC);
CREATE INDEX idx_review_queue_pending   ON ai_review_queue(clinic_id, status, priority DESC) WHERE status = 'pending';
CREATE INDEX idx_ai_usage_clinic        ON ai_usage_metrics(clinic_id, recorded_at DESC);
CREATE INDEX idx_ai_usage_model         ON ai_usage_metrics(clinic_id, model, recorded_at DESC);

-- Clinical
CREATE INDEX idx_prescriptions_patient  ON prescriptions(patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_prescriptions_clinic   ON prescriptions(clinic_id)                   WHERE deleted_at IS NULL;
CREATE INDEX idx_claims_clinic_status   ON insurance_claims(clinic_id, status);

-- Finance
CREATE INDEX idx_invoices_clinic_active ON invoices(clinic_id, status)     WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_patient       ON invoices(patient_id)             WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_items_invoice  ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_clinic   ON invoice_items(clinic_id);
CREATE INDEX idx_payments_invoice       ON payments(invoice_id, status);
CREATE INDEX idx_payment_links_clinic   ON payment_links(clinic_id, status);
CREATE INDEX idx_commissions_doctor     ON doctor_commissions(doctor_id, status);
CREATE INDEX idx_commissions_clinic     ON doctor_commissions(clinic_id, status);

-- Marketing & Loyalty
CREATE INDEX idx_campaigns_clinic       ON marketing_campaigns(clinic_id, status);
CREATE INDEX idx_campaign_logs_campaign ON campaign_logs(campaign_id, status);
CREATE INDEX idx_loyalty_patient        ON loyalty_points(patient_id, created_at DESC);
CREATE INDEX idx_reviews_clinic_rating  ON reviews_log(clinic_id, rating);

-- System
CREATE INDEX idx_wf_logs_clinic         ON tawd_workflow_logs(clinic_id, created_at DESC);
CREATE INDEX idx_wf_logs_status         ON tawd_workflow_logs(workflow_id, status);
CREATE INDEX idx_err_logs_open          ON tawd_error_logs(clinic_id, severity) WHERE resolved = FALSE;
CREATE INDEX idx_notif_queue_pending    ON notification_queue(clinic_id, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_access_logs_patient    ON patient_access_logs(patient_id, created_at DESC);
CREATE INDEX idx_access_logs_staff      ON patient_access_logs(accessed_by, created_at DESC);


-- ============================================================
-- SECTION 6 — Functions
-- ============================================================

-- ── 6.1  updated_at auto-stamp ─────────────────────────────

CREATE OR REPLACE FUNCTION public.tawd_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 6.2  Atomic slot locking (race-condition safe) ──────────
-- Returns TRUE if lock was acquired, FALSE if slot was already locked/booked.
-- Called by WF-06 (Smart Booking Engine) before confirming an appointment.

CREATE OR REPLACE FUNCTION public.tawd_lock_slot(
  p_slot_id      UUID,
  p_session_id   UUID,
  p_lock_minutes INTEGER DEFAULT 15
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
    id        = p_slot_id
    AND is_booked = FALSE
    AND (is_locked = FALSE OR locked_until < NOW());

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ── 6.3  Release expired slot locks ────────────────────────
-- Called by a scheduled n8n maintenance workflow (every 5 min).

CREATE OR REPLACE FUNCTION public.tawd_release_expired_locks()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.appointment_slots
  SET
    is_locked         = FALSE,
    locked_until      = NULL,
    locked_by_session = NULL
  WHERE
    is_locked = TRUE
    AND is_booked = FALSE
    AND locked_until < NOW();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ── 6.4  Audit trigger function ────────────────────────────
-- Fires on INSERT/UPDATE/DELETE on the 5 sensitive tables.

CREATE OR REPLACE FUNCTION public.tawd_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinic_id UUID;
  v_record_id UUID;
  v_old_data  JSONB;
  v_new_data  JSONB;
BEGIN
  -- Convert RECORD → JSONB first; OLD/NEW are RECORD types, not JSONB directly.
  v_old_data := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new_data := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

  IF TG_OP = 'DELETE' THEN
    v_clinic_id := (v_old_data ->> 'clinic_id')::UUID;
    v_record_id := (v_old_data ->> 'id')::UUID;
  ELSE
    v_clinic_id := (v_new_data ->> 'clinic_id')::UUID;
    v_record_id := (v_new_data ->> 'id')::UUID;
  END IF;

  INSERT INTO public.tawd_audit_logs (
    user_id,
    clinic_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    ip_address
  ) VALUES (
    auth.uid(),
    v_clinic_id,
    TG_OP::public.audit_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old_data,
    v_new_data,
    inet_client_addr()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── 6.5  Audit log immutability protection ─────────────────

CREATE OR REPLACE FUNCTION public.tawd_protect_audit_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'tawd_audit_logs is immutable. UPDATE and DELETE are strictly prohibited.';
END;
$$;

-- ── 6.6  Free slot on appointment cancel / soft-delete ─────

CREATE OR REPLACE FUNCTION public.tawd_free_slot_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    NEW.status IN ('cancelled', 'no_show')
    OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  ) THEN
    IF NEW.slot_id IS NOT NULL THEN
      UPDATE public.appointment_slots
      SET
        is_booked         = FALSE,
        is_locked         = FALSE,
        locked_until      = NULL,
        locked_by_session = NULL
      WHERE id = NEW.slot_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6.7  Mark slot as booked on appointment INSERT ─────────

CREATE OR REPLACE FUNCTION public.tawd_book_slot_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL AND NEW.deleted_at IS NULL
     AND NEW.status NOT IN ('cancelled', 'no_show') THEN
    UPDATE public.appointment_slots
    SET
      is_booked         = TRUE,
      is_locked         = FALSE,
      locked_until      = NULL,
      locked_by_session = NULL
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- SECTION 7 — Triggers
-- ============================================================

-- ── 7.1  updated_at triggers ───────────────────────────────

CREATE TRIGGER trg_updated_at_clinics
  BEFORE UPDATE ON tawd_clinics
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_staff
  BEFORE UPDATE ON tawd_staff_users
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_settings
  BEFORE UPDATE ON tawd_clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_subscriptions
  BEFORE UPDATE ON tawd_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_patients
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_medical_histories
  BEFORE UPDATE ON medical_histories
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_patient_notes
  BEFORE UPDATE ON patient_notes
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_services
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_doctor_schedules
  BEFORE UPDATE ON doctor_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_channel_configs
  BEFORE UPDATE ON channel_configs
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_prescriptions
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_insurance_claims
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_notif_templates
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_vat_rules
  BEFORE UPDATE ON vat_rules
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_payments
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

CREATE TRIGGER trg_updated_at_campaigns
  BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tawd_set_updated_at();

-- ── 7.2  Audit triggers (5 sensitive tables per spec §4.4) ─

CREATE TRIGGER trg_audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION public.tawd_audit_trigger();

CREATE TRIGGER trg_audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.tawd_audit_trigger();

CREATE TRIGGER trg_audit_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tawd_audit_trigger();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tawd_audit_trigger();

CREATE TRIGGER trg_audit_staff_users
  AFTER INSERT OR UPDATE OR DELETE ON tawd_staff_users
  FOR EACH ROW EXECUTE FUNCTION public.tawd_audit_trigger();

-- ── 7.3  Audit log immutability ────────────────────────────

CREATE TRIGGER trg_protect_audit_logs
  BEFORE UPDATE OR DELETE ON tawd_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tawd_protect_audit_logs();

-- ── 7.4  Appointment slot management ──────────────────────

CREATE TRIGGER trg_book_slot_on_insert
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.tawd_book_slot_on_insert();

CREATE TRIGGER trg_free_slot_on_cancel
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.tawd_free_slot_on_cancel();


-- ============================================================
-- SECTION 8 — Seed Data (Test Clinic)
-- Run once on a fresh Supabase project.
-- No auth user is created here — add staff after creating auth accounts.
-- ============================================================

DO $$
DECLARE
  v_clinic_id UUID := gen_random_uuid();
BEGIN

  INSERT INTO public.tawd_clinics (
    id, name, name_ar, plan, status,
    currency, vat_enabled, country_code, timezone
  ) VALUES (
    v_clinic_id,
    'TAWD Test Clinic',
    'عيادة طود التجريبية',
    'pro',
    'trial',
    'OMR',
    FALSE,
    'OM',
    'Asia/Muscat'
  );

  INSERT INTO public.tawd_clinic_settings (clinic_id)
  VALUES (v_clinic_id);

  INSERT INTO public.tawd_subscriptions (
    clinic_id, plan, status, trial_ends_at
  ) VALUES (
    v_clinic_id,
    'pro',
    'trial',
    NOW() + INTERVAL '30 days'
  );

  RAISE NOTICE '✓ Test clinic created — ID: %', v_clinic_id;
  RAISE NOTICE '  Store this ID in your .env as TAWD_TEST_CLINIC_ID';

END;
$$;


-- ============================================================
-- END OF TAWD MASTER SCHEMA — 41 TABLES
-- ============================================================
-- Summary:
--   Tables  : 41
--   ENUMs   : 28
--   Functions: 7
--   Triggers : 24 (18 updated_at + 5 audit + 1 protect + 2 slot)
--   Policies : 41 (one clinic_isolation per table)
--   Indexes  : 52
-- ============================================================
