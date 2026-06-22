# تقرير تقدم TAWD — فحص مباشر شامل + حملة إصلاح معمارية

**تاريخ الإعداد الأول:** 2026-06-17 (الإصدار 1 — فحص أولي)  
**تاريخ المراجعة والإصلاح:** 2026-06-17 (الإصدار 2 — حملة Refactoring + تصحيح أخطاء الفحص الأول)  
**مُعِدّ التقرير:** Claude Code (Lead Systems Architect)  
**طريقة التحقق:** فحص مباشر عبر Supabase MCP (`execute_sql` + `list_tables`) + قراءة مباشرة لجميع ملفات JSON  
**Supabase Project Ref:** `jomsheslxqtgooyezgmk`  
**n8n Instance:** `https://n8n.srv1239666.hstgr.cloud` (v2.11.4 self-hosted)

> **قاعدة الدقة:** كل معلومة مصدرها فحص مباشر. أخطاء الإصدار الأول مُصحَّحة ومُوثَّقة صراحةً في هذا الإصدار.

---

## 1. ملخص تنفيذي

TAWD (طود) — نظام تشغيل عيادات مدعوم بالذكاء الاصطناعي، متعدد المستأجرين (Multi-tenant SaaS). المساعد الذكي **سُرى (Sura)** يستقبل رسائل المرضى عبر WhatsApp/Instagram/Web Chat ويدير دورة حياة الموعد كاملةً بالعربية.

### 🔴 تصحيحات حرجة مكتشفة في هذه الجلسة (كانت خاطئة في الإصدار 1)

| الخطأ السابق | الصواب المؤكد | الأثر |
|-------------|--------------|-------|
| `tawd_subscription_plans` جدول موجود | **غير موجود في DB** | تمت إزالته من التوثيق |
| 4 جداول غير موثّقة: `marketing_campaigns`, `campaign_logs`, `insurance_claims`, `patient_notes` | **جميعها موجودة وفيها RLS** | أُضيفت لهذا الإصدار |
| `appointment_slots.locked_by_session_id` TEXT | **`locked_by_session` UUID** | WF-24 القديم كان يكتب لحقل خاطئ باسم خاطئ ونوع خاطئ — مُصلَح |
| `patient_vitals.bmi` = GENERATED ALWAYS AS column | **`bmi` عمود عادي NUMERIC(4,2) nullable** | يجب حسابه وكتابته يدوياً |
| `doctor_schedules.day_of_week` INT | **ENUM: sunday/monday/…/saturday** | WF-04 SQL يأخذ هذا بعين الاعتبار |

### ما تم تنفيذه في جلسة الإصلاح (2026-06-17)

| المهمة | النتيجة |
|--------|---------|
| WF-24: إزالة "Unlock Slot" node المكسور + استبداله بـ `tawd_release_expired_locks()` | ✅ ملف مُحدَّث على القرص |
| WF-04 Slot Generator: بناء محرك توليد المواعيد التلقائي | ✅ ملف جديد على القرص |
| WF-05: إضافة GET verification لـ Meta webhook (إلغاء WF-00) | ✅ ملف مُحدَّث على القرص |
| WF-00: إنشاء ملف tombstone موثَّق على القرص | ✅ ملف جديد (لا يُرفع لـ n8n) |

> **تنبيه تشغيلي:** جميع الملفات مُحدَّثة على القرص. يلزم رفعها لـ n8n عبر REST API ثم تفعيل WF-04 و WF-24 يدوياً من n8n UI (القيد المعروف: REST API لا تملك endpoint لتفعيل workflow).

**بيانات حية مؤكدة في قاعدة البيانات (2026-06-17):**
- `tawd_clinics`: 1 | `tawd_clinic_settings`: 1 | `tawd_subscriptions`: 1
- `channel_configs`: 1 | `chat_sessions`: 1 | `chat_messages`: 9
- `patients`: 1 | `tawd_audit_logs`: 5
- باقي 34 جدول: 0 صفوف

---

## 2. قاعدة البيانات — تفصيل كامل

**الإجمالي المؤكد:** 42 جدول، جميعها `rls_enabled = true`، `rls_forced = false`.

**نمط RLS الموحد (`clinic_isolation` — PERMISSIVE، ALL commands):**
```sql
(public.is_platform_admin() OR (clinic_id = public.get_clinic_id()))
```
الجداول ذات `deleted_at` تُضيف: `AND deleted_at IS NULL`  
`medical_histories` و `patient_access_logs` و `prescription_items`: subquery pattern عبر patient_id  
`tawd_audit_logs`: policy `clinic_read` — SELECT فقط

---

### 2.1 Core / Clinic

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `tawd_clinics` | 1 | id UUID PK, name, slug UNIQUE, type ENUM (dental/dermatology/general/cosmetic), phone, email, address, city, country, is_active, created_at, updated_at |
| `tawd_clinic_settings` | 1 | id, clinic_id FK→tawd_clinics UNIQUE, language (ar/en/both), is_in_maintenance BOOL, maintenance_msg_ar, maintenance_msg_en, appointment_lock_minutes (default 15), currency (OMR/SAR/AED), emergency_keywords TEXT[], ai_model, updated_at |
| `tawd_subscriptions` | 1 | id, clinic_id FK→tawd_clinics, plan_id, status ENUM (active/cancelled/expired), started_at, expires_at, created_at |
| `tawd_staff_users` | 0 | id UUID PK (= auth.users.id), clinic_id FK (NULL = platform admin), full_name, role ENUM (owner/admin/doctor/receptionist/platform_admin), specialization, commission_rate NUMERIC(12,3), is_active, deleted_at, created_at, updated_at |

**⚠️ `tawd_subscription_plans` غير موجود في DB** — كان في الإصدار 1 خطأً.

**Triggers:**
- جميعها: `trg_set_updated_at` (BEFORE UPDATE)
- `tawd_staff_users`: + `trg_audit_tawd_staff_users` (AFTER INSERT/UPDATE/DELETE)

---

### 2.2 Audit / Monitoring

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `tawd_audit_logs` | 5 | id UUID PK, user_id FK→auth.users, clinic_id, action ENUM (INSERT/UPDATE/DELETE), table_name, record_id UUID, old_value JSONB, new_value JSONB, ip_address, created_at |
| `tawd_error_logs` | 0 | id, clinic_id, workflow_id, error_message, error_stack, severity ENUM (low/medium/high), context JSONB, created_at |
| `tawd_workflow_logs` | 0 | id, clinic_id, workflow_id, status TEXT, execution_time_ms INT, created_at |

**Triggers:**
- `tawd_audit_logs`: `trg_protect_audit_logs` (BEFORE UPDATE OR DELETE → EXCEPTION — immutable)

**RLS خاصة:** `tawd_audit_logs` → policy `clinic_read` SELECT فقط. الكتابة فقط عبر service_role.

**Indexes:** `tawd_audit_logs`: `(clinic_id, created_at DESC)`, `(table_name, record_id)`

---

### 2.3 Patient

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `patients` | 1 | id UUID PK, clinic_id, phone TEXT, name, dob DATE, gender ENUM (male/female/other), national_id, source_channel, deleted_at, created_at, updated_at |
| `patient_vitals` | 0 | id, patient_id FK→patients, clinic_id, weight_kg NUMERIC(5,2), height_cm NUMERIC(5,2), **bmi NUMERIC(4,2) nullable** (يُحسب ويُكتب يدوياً — ليس generated column)، blood_pressure_systolic INT, blood_pressure_diastolic INT, pulse_bpm INT, temperature_c NUMERIC(4,1), oxygen_saturation INT, recorded_by FK→tawd_staff_users, recorded_at TIMESTAMPTZ |
| `medical_histories` | 0 | id, patient_id FK→patients, clinic_id, condition_name, diagnosis_date, is_chronic BOOL, notes, created_at, updated_at |
| `digital_consents` | 0 | id, patient_id FK→patients, clinic_id, consent_type ENUM (pdpl_data_processing/marketing/telemedicine), signed_at TIMESTAMPTZ, ip_address, created_at |
| `patient_access_logs` | 0 | id, patient_id FK→patients, clinic_id, accessed_by FK→tawd_staff_users, access_reason, fields_accessed TEXT[], created_at |
| `patient_notes` | 0 | id, patient_id FK→patients, clinic_id, doctor_id FK→tawd_staff_users nullable, note_text TEXT NOT NULL, is_private BOOL (default false), created_at, updated_at |

**Triggers:** `patients`: `trg_set_updated_at` + `trg_audit_patients`

**Indexes:** `patients`: `(clinic_id, phone)` UNIQUE WHERE deleted_at IS NULL

---

### 2.4 Appointments / Scheduling

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `appointments` | 0 | id UUID PK, clinic_id, patient_id, doctor_id, slot_id FK→appointment_slots, service_id, slot_time TIMESTAMPTZ, duration_minutes INT, status ENUM (confirmed/cancelled/completed/no_show), type ENUM (in_person/telemedicine), source_channel, deleted_at, created_at, updated_at |
| `appointment_slots` | 0 | id UUID PK, clinic_id, doctor_id FK→tawd_staff_users, slot_time TIMESTAMPTZ NOT NULL, duration_minutes INT (default 30), is_locked BOOL (default false), locked_until TIMESTAMPTZ, **locked_by_session UUID** (ليس TEXT ولا `locked_by_session_id`)، is_booked BOOL (default false) |
| `doctor_schedules` | 0 | id, clinic_id, doctor_id FK→tawd_staff_users, **day_of_week ENUM** (sunday/monday/tuesday/wednesday/thursday/friday/saturday)، start_time TIME, end_time TIME, slot_duration_minutes INT (default 30), is_active BOOL (default true), effective_from DATE (default CURRENT_DATE), effective_until DATE nullable, created_at, updated_at |
| `clinic_holidays` | 0 | id, clinic_id, holiday_date DATE, name_ar, name_en, applies_to_all_doctors BOOL, doctor_id FK nullable, created_at |
| `waiting_queue` | 0 | id, clinic_id, appt_id FK→appointments, patient_id FK→patients, queue_position INT (default 0), status ENUM (waiting/in_progress/done/no_show), created_at, updated_at |
| `no_show_log` | 0 | id, appt_id FK→appointments, clinic_id, patient_id, risk_factors JSONB, created_at |

**Triggers:**
- `appointments`: `trg_set_updated_at` + `trg_book_slot_on_insert` (AFTER INSERT) + `trg_free_slot_on_cancel` (AFTER UPDATE) + `trg_audit_appointments`

**Indexes (appointment_slots):**
- `UNIQUE (clinic_id, doctor_id, slot_time)` — يُتيح ON CONFLICT DO NOTHING في WF-04
- `idx_slots_available`: `(clinic_id, slot_time) WHERE is_booked=false AND is_locked=false`
- `idx_slots_locked_cleanup`: `(locked_until) WHERE is_locked=true`

---

### 2.5 Services

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `services` | 0 | id UUID PK, clinic_id, name, name_ar, price NUMERIC(12,3), duration_minutes INT, vat_applicable BOOL (default true), is_active BOOL, deleted_at, created_at, updated_at |
| `doctor_services` | 0 | id, clinic_id, doctor_id FK→tawd_staff_users, service_id FK→services, is_active BOOL — (الجدول الـ 42، أُضيف في migration_002) |
| `insurance_providers` | 0 | id, clinic_id, name, provider_code, api_endpoint, is_active BOOL, created_at, updated_at |

---

### 2.6 Financial

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `invoices` | 0 | id UUID PK, clinic_id, invoice_number TEXT UNIQUE NOT NULL (INV-YYYYMMDD-RANDOM6), appt_id FK, patient_id FK, subtotal NUMERIC(12,3), vat_amount NUMERIC(12,3), total NUMERIC(12,3), status ENUM (pending/paid/cancelled), deleted_at, created_at, updated_at |
| `invoice_items` | 0 | id, invoice_id FK→invoices, clinic_id, service_id FK, description, description_ar, quantity INT (default 1), unit_price_snapshot NUMERIC(12,3), vat_rate_snapshot NUMERIC(5,2), vat_amount NUMERIC(12,3), total NUMERIC(12,3), sort_order INT (default 0), created_at |
| `payments` | 0 | id, invoice_id FK, clinic_id, gateway ENUM (thawani), transaction_id TEXT, currency ENUM (OMR/SAR/AED), amount NUMERIC(12,3), status ENUM (completed/failed/refunded), paid_at TIMESTAMPTZ, created_at |
| `payment_links` | 0 | id, clinic_id, appt_id FK, invoice_id FK, link_url TEXT, thawani_session_id TEXT UNIQUE, purpose ENUM (deposit/invoice), amount NUMERIC(12,3), currency ENUM, expires_at TIMESTAMPTZ, status ENUM (pending/paid/expired/cancelled), paid_at TIMESTAMPTZ, created_at |
| `vat_rules` | 0 | id, clinic_id, service_id FK, vat_rate NUMERIC(5,2), effective_from DATE, is_active BOOL, created_at |
| `doctor_commissions` | 0 | id, invoice_id FK, clinic_id, doctor_id FK, commission_rate NUMERIC(5,2), commission_amount NUMERIC(12,3), currency, status ENUM (pending/paid), created_at, updated_at |

**Indexes (payment_links):** `(thawani_session_id)` UNIQUE, `(status, expires_at)` للـ cleanup

---

### 2.7 Communication / AI

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `channel_configs` | 1 | id, clinic_id, channel ENUM (whatsapp/instagram/webchat/sms), phone_number_id, access_token TEXT, page_id, is_active BOOL, created_at, updated_at |
| `chat_sessions` | 1 | id UUID PK, clinic_id, patient_id FK, channel, external_user_id TEXT, status ENUM (active/closed/archived), language (ar/en), booking_state JSONB, clarification_count INT (default 0), session_data JSONB, created_at, updated_at |
| `chat_messages` | 9 | id UUID PK, session_id FK, clinic_id, sender ENUM (patient/sura/staff), message_text TEXT, message_type ENUM (text/image/audio default text), created_at |
| `notification_queue` | 0 | id, clinic_id, patient_id FK, channel ENUM, payload JSONB, status ENUM (pending/sent/failed), scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, created_at |
| `notification_templates` | 0 | id, clinic_id, template_key TEXT, title_ar, title_en, body_ar TEXT, body_en TEXT, channel ENUM, is_active BOOL, created_at, updated_at |
| `ai_review_queue` | 0 | id, session_id FK, clinic_id, patient_id FK, original_message TEXT, ai_draft_response TEXT, reason TEXT, priority ENUM (normal/high/critical), status ENUM (pending/reviewed/resolved), reviewed_by FK→tawd_staff_users, created_at, updated_at |
| `ai_usage_metrics` | 0 | id, clinic_id, session_id, model_name, tokens_input INT, tokens_output INT, tokens_total INT (مكتوب يدوياً — ليس generated column في DB الحالي)، cost_usd NUMERIC(10,6), workflow_id, created_at |

**Indexes:** `chat_sessions`: `(clinic_id, external_user_id, channel, status)`

---

### 2.8 Marketing / Insurance / Medical Records / Patient Notes

| الجدول | الصفوف | الأعمدة الرئيسية |
|--------|--------|-----------------|
| `marketing_campaigns` | 0 | id UUID PK, clinic_id, name TEXT NOT NULL, target_segment JSONB (default '{}'), channel ENUM, template_id FK→notification_templates nullable, template_body TEXT NOT NULL, template_body_ar TEXT, status ENUM (`campaign_status`: draft/scheduled/running/completed/cancelled), scheduled_at, started_at, completed_at, created_by FK→tawd_staff_users nullable, created_at, updated_at |
| `campaign_logs` | 0 | id UUID PK, campaign_id FK→marketing_campaigns NOT NULL, clinic_id, patient_id FK→patients NOT NULL, status TEXT (default 'pending'), sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, error_message TEXT, created_at |
| `insurance_claims` | 0 | id UUID PK, patient_id FK, clinic_id, appt_id FK nullable, provider_id FK→insurance_providers NOT NULL, status ENUM (`claim_status`: pending/submitted/approved/rejected/appealed), claim_ref TEXT, submitted_amount NUMERIC(12,3), approved_amount NUMERIC(12,3), currency ENUM (`currency_code`: OMR/SAR/AED default OMR), submitted_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, rejection_reason TEXT, raw_response JSONB, created_at, updated_at |
| `patient_notes` | 0 | id UUID PK, patient_id FK, clinic_id, doctor_id FK→tawd_staff_users nullable, note_text TEXT NOT NULL, is_private BOOL (default false), created_at, updated_at |
| `prescriptions` | 0 | id, clinic_id, patient_id FK, doctor_id FK, appt_id FK, diagnosis, notes, issued_at TIMESTAMPTZ, deleted_at, created_at, updated_at |
| `prescription_items` | 0 | id, prescription_id FK, clinic_id, drug_name, drug_name_ar, dosage, frequency, duration_days INT, instructions, instructions_ar, sort_order INT, created_at |
| `reviews_log` | 0 | id, clinic_id, patient_id FK, rating INT (1-5), comment TEXT, routed_to ENUM (google/admin), created_at |
| `loyalty_points` | 0 | id, patient_id FK, clinic_id, points INT NOT NULL, source TEXT NOT NULL, reference_id UUID nullable, note TEXT, created_at |

**RLS:** جميع الجداول في هذا القسم لها `clinic_isolation` (PERMISSIVE، ALL) — مؤكد عبر `pg_policies`.

---

## 3. الدوال (Database Functions)

**الإجمالي المؤكد:** 9 دوال في `public` schema. جميعها SECURITY DEFINER + `SET search_path = ''`.

| الدالة | Returns | الوظيفة | يُستدعى من |
|--------|---------|---------|-----------|
| `get_clinic_id()` | UUID | يستخرج clinic_id من JWT `app_metadata` | كل RLS policy |
| `is_platform_admin()` | BOOLEAN | يتحقق من `role='platform_admin'` في JWT | كل RLS policy |
| `tawd_audit_trigger()` | TRIGGER | يكتب في `tawd_audit_logs` عند INSERT/UPDATE/DELETE | 7 جداول |
| `tawd_book_slot_on_insert()` | TRIGGER | يُغلق slot عند INSERT في appointments | appointments AFTER INSERT |
| `tawd_free_slot_on_cancel()` | TRIGGER | يُحرر slot عند CANCEL في appointments | appointments AFTER UPDATE |
| `tawd_lock_slot(slot_id, session_id, minutes=15)` | BOOLEAN | يُغلق slot أتومياً (WHERE is_booked=FALSE AND lock expired) | WF-06 |
| `tawd_protect_audit_logs()` | TRIGGER | يرفع EXCEPTION على UPDATE/DELETE في audit_logs | tawd_audit_logs BEFORE UPDATE/DELETE |
| `tawd_release_expired_locks()` | INT | يُحرر slots WHERE is_locked=TRUE AND is_booked=FALSE AND locked_until < NOW()؛ يُرجع عدد الصفوف المُحررة | **WF-24 (Postgres node) — مُصلَح في 2026-06-17** |
| `tawd_set_updated_at()` | TRIGGER | يُحدّث updated_at = NOW() | جميع الجداول ذات updated_at |

**الكود الفعلي لـ `tawd_release_expired_locks()`:**
```sql
UPDATE public.appointment_slots
SET is_locked = FALSE, locked_until = NULL, locked_by_session = NULL
WHERE is_locked = TRUE AND is_booked = FALSE AND locked_until < NOW();
GET DIAGNOSTICS v_rows = ROW_COUNT;
RETURN v_rows;
```

---

## 4. الـ Workflows — تفصيل كامل

**n8n v2.11.4 | timezone: Asia/Muscat على جميع الـ scheduled workflows**

**ملاحظة على حالة التفعيل:** Active status غير مؤكد لجميع الـ workflows (يحتاج API key). الاستثناءات المؤكدة:
- WF-24: ❌ غير مُفعَّل (يُفعَّل يدوياً من UI)
- WF-04: ❌ غير مُفعَّل بعد (جديد، لم يُرفع لـ n8n بعد)

**Credentials:**
- `TAWD Supabase` (id: `vvSpPqfrBDkrqjjc`) — Supabase nodes
- `TAWD Gemini API` (id: `s9N4V76Rwk6zW2lo`) — Gemini AI
- `TAWD Supabase Postgres` (id: `NDrVeK2iQy3c33J3`) — Postgres nodes + Chat Memory
- `TAWD WhatsApp API` — Header Auth Bearer

---

### Sub-workflows (S1–S7)

| ID | n8n ID | الملف | الوظيفة | Active |
|----|--------|-------|---------|--------|
| S1 | `0Aq11NOwPChsSzZ8` | s1-send-whatsapp.json | إرسال رسالة WhatsApp عبر Cloud API (6 nodes) | غير مؤكد |
| S2 | `kHOzzOVWCtyvB1I1` | s2-log-error.json | تسجيل أخطاء n8n في tawd_error_logs (3 nodes) | غير مؤكد |
| S3 | `44lmYECx1xkG0Cir` | s3-get-or-create-patient.json | جلب أو إنشاء مريض في patients (7 nodes) | غير مؤكد |
| S4 | `MSsHC3t4qbzqWzlk` | s4-get-clinic-context.json | جلب إعدادات العيادة من tawd_clinic_settings + tawd_clinics (4 nodes) | غير مؤكد |
| S5 | `LhLhOblkCwLWWQlt` | s5-get-chat-session.json | جلب أو إنشاء chat session في chat_sessions (7 nodes) | غير مؤكد |
| S6 | `F3YMSuQuGiknwoEH` | s6-save-message.json | حفظ رسالة في chat_messages (3 nodes) | غير مؤكد |
| S7 | `dK1T85wRcr8XPZSO` | s7-push-to-hitl.json | إدراج في ai_review_queue + إشعار الموظف عبر S1 (4 nodes) | غير مؤكد |

---

### Main Workflows

---

#### WF-00 — WhatsApp Webhook Verify [DEPRECATED — Merged into WF-05]
**n8n ID (تاريخي):** `CputKQi9Eu4NDcuI`  
**ملف:** `wf00-webhook-verify.json` ✅ موجود الآن (tombstone — لا يُرفع لـ n8n)  
**Active:** غير مؤكد (موجود في n8n لكن وظيفته انتقلت)  
**الحالة:** الـ GET verification لـ Meta (`hub.challenge` handshake) أُدمج في WF-05 (nodes wf05-n38/39/40) في 2026-06-17. WF-05 يعالج الآن GET + POST على `/sura-whatsapp`.

---

#### WF-02 — Channel Receiver Instagram
**n8n ID:** `D8S7xfDVpLaNWDES` | **ملف:** `wf02-channel-instagram.json`  
**Active:** غير مؤكد | **Webhook:** `/sura-instagram`  
**Nodes (8):** Instagram Webhook → Parse Instagram Message → Should Skip? → [Respond OK] / [Get Clinic Config (channel_configs) → Normalize Message → Call WF-05 → Respond After Process]

---

#### WF-03 — Channel Receiver Web Chat
**n8n ID:** `mDBPZb9EU5xKfI5u` | **ملف:** `wf03-channel-webchat.json`  
**Active:** غير مؤكد | **Webhook:** `/sura-webchat`  
**Nodes (7):** WebChat Webhook → Parse Web Message → Should Skip? → [Error 400] / [Call WF-05 → Extract Response → Respond with Sura Reply]

---

#### WF-04 — Appointment Slot Generator ⭐ جديد
**n8n ID:** غير مُرفوع بعد  
**ملف:** `wf04-slot-generator.json` ✅ جديد (2026-06-17)  
**Active:** ❌ لم يُرفع لـ n8n ولم يُفعَّل — **يحتاج رفع + تفعيل يدوي**  
**Schedule:** يومياً الساعة 2:00 صباحاً (Asia/Muscat)  
**Nodes (6):**

| Node | Type | الوظيفة |
|------|------|---------|
| Schedule Trigger | scheduleTrigger | 2 AM يومياً |
| Set Booking Window | code | يُعيّن نافذة 14 يوماً قادمة |
| Generate Slots | **postgres** | SQL يولّد slots: يقرأ `doctor_schedules`، يستثني `clinic_holidays`، يُدرج في `appointment_slots` مع ON CONFLICT DO NOTHING |
| Assess Result | code | يحسب slots_created من نتيجة SQL |
| Log Execution | supabase | يُسجّل في `tawd_workflow_logs` |
| Output | set | يُرجع ملخص التنفيذ |

**SQL الجوهري:**
```sql
WITH slot_series AS (
  SELECT ds.clinic_id, ds.doctor_id, ds.slot_duration_minutes,
    (gen_date::DATE + ds.start_time) AT TIME ZONE 'Asia/Muscat'
      + (slot_n * ds.slot_duration_minutes * INTERVAL '1 minute') AS slot_time
  FROM public.doctor_schedules ds,
       generate_series(CURRENT_DATE + INTERVAL '1 day',
                       CURRENT_DATE + INTERVAL '14 days',
                       INTERVAL '1 day') AS gen_date,
       generate_series(0, 47) AS slot_n
  WHERE ds.is_active = TRUE
    AND (ds.effective_until IS NULL OR ds.effective_until >= gen_date::DATE)
    AND gen_date::DATE >= ds.effective_from
    AND ds.day_of_week::TEXT = LOWER(TRIM(TO_CHAR(gen_date::DATE, 'Day')))
    AND slot_n < FLOOR(EXTRACT(EPOCH FROM (ds.end_time - ds.start_time))
                       / (ds.slot_duration_minutes * 60))::INT
    AND NOT EXISTS (
          SELECT 1 FROM public.clinic_holidays ch
          WHERE ch.clinic_id = ds.clinic_id
            AND ch.holiday_date = gen_date::DATE
            AND (ch.applies_to_all_doctors OR ch.doctor_id = ds.doctor_id))
),
inserted AS (
  INSERT INTO public.appointment_slots
    (clinic_id, doctor_id, slot_time, duration_minutes, is_booked, is_locked)
  SELECT clinic_id, doctor_id, slot_time, slot_duration_minutes, FALSE, FALSE
  FROM slot_series
  WHERE slot_time > NOW()
  ON CONFLICT (clinic_id, doctor_id, slot_time) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) AS slots_created FROM inserted;
```

---

#### WF-05 — Sura Core Engine (WhatsApp) — محدَّث
**n8n ID:** `arZRfHPPTytcMSR5` | **ملف:** `wf05-sura-core-engine.json` ✅ مُحدَّث 2026-06-17  
**Active:** غير مؤكد | **يحتاج رفع لـ n8n بعد التعديلات**

**التحديثات في 2026-06-17:**
1. إضافة GET verification handler (nodes wf05-n38/n39/n40) — يستوعب وظيفة WF-00
2. توثيق TECH-DEBT-001 في Parse Request node (clinicMap hardcoded)

**Nodes (38 nodes — 35 سابقة + 3 جديدة):**

| المرحلة | Nodes |
|---------|-------|
| **Meta Verification (جديد)** | Meta Verify Webhook (GET) → Verify Token (code: checks TAWD_SURA_2026 + hub.mode=subscribe) → Respond Challenge (200 + hub.challenge plain text) |
| Receive & ACK | WhatsApp Webhook (POST) → Respond 200 |
| Parse & Validate | Parse Request **[TECH-DEBT-001: clinicMap hardcoded]** → Valid Message? |
| Clinic Context | S4 Clinic Context → Maintenance Mode? → [S1 Maintenance Msg] |
| Patient & Session | S3 Get Patient → S5 Get Session → Set Sender User → S6 Save User Msg |
| AI Processing | Build AI Context (15 intent labels) → سُرى Agent (Gemini Flash 2.0, temp=0.3, Chat Memory Postgres) → Parse AI Output |
| HITL Gate | confidence ≥ 0.85 AND NOT sensitive AND NOT requires_hitl |
| Auto-Reply | Is Booking? → [WF-06 path] / [S6 + S1 path] |
| Clarification | ≤ 2 attempts → Increment clarification_count → S6 → S1 |
| HITL Path | Get Clinic Admin Phone (tawd_staff_users, role=admin) → Prepare HITL Input → HITL Refine Agent (Gemini Pro 2.5, temp=0.2) → Merge Refined → S7 Push HITL |

**TECH-DEBT-001 (موثَّق في الكود):**
```javascript
// TECH-DEBT-001: clinicMap is hardcoded for single-clinic MVP.
// Migration path: replace with dynamic lookup from channel_configs
// WHERE phone_number_id = phoneNumberId AND channel = 'whatsapp' AND is_active = true.
// Must be executed before onboarding a second clinic.
const clinicMap = { '1050565764810212': 'be9e4157-f56d-49e4-96bd-8b2d5b8af568' };
```

---

#### WF-06 — Smart Booking Engine
**n8n ID:** `pxPgMdVxdZmuVlYQ` | **ملف:** `wf06-smart-booking-engine.json`  
**Active:** غير مؤكد  
**Nodes (10):** Trigger → Get Available Slots (appointment_slots، is_booked=false) → Get Doctor Services (doctor_services) → Check & Pick Slot (code: filter by doctor/service، exclude locked، pick earliest) → Has Slots? → [No Slots Available] / [Lock Slot → Create Appointment → Add to Queue → Output Confirmation Arabic]

**ملاحظة:** يعمل بشكل صحيح الآن لأن WF-04 يُولّد appointment_slots تلقائياً.

---

#### WF-07 — Reminder Engine (24h + 2h)
**n8n ID:** `S237WFJ4ZB3sh2q2` | **ملف:** `wf07-reminder-engine.json`  
**Active:** غير مؤكد | **Schedule:** كل ساعة  
**Nodes (10):** Schedule → Calc Time Windows (24h±1h, 2h±1h) → Get Confirmed Appointments → Filter Due Reminders → Has Reminders? → [Skip] / [Get Patient → Build Reminder Message → Send (S1) → Log Notification (notification_queue، status=sent)]

---

#### WF-08 — Queue Manager
**n8n ID:** `nMzV4wxrURtNOtfZ` | **ملف:** `wf08-queue-manager.json`  
**Active:** غير مؤكد | **Schedule:** كل 15 دقيقة  
**Nodes (7):** Schedule → Calc Today Range → Get Today's Confirmed Appointments → Sort & Assign Positions → Has Appointments? → [Skip] / [Update Queue Position (waiting_queue)]

---

#### WF-09 — No-Show Handler
**n8n ID:** `r8pWM464TFDJ5nUs` | **ملف:** `wf09-noshow-handler.json`  
**Active:** غير مؤكد | **Schedule:** كل 30 دقيقة  
**Nodes (9):** Schedule → Calc Cutoff (now - 20 min) → Get Overdue Confirmed Appointments → Filter Valid → Any No-Shows? → [Skip] / [Mark No-Show (appointments) → Log No-Show (no_show_log) → Update Queue (waiting_queue status=no_show)]

---

#### WF-10 — Patient Profile Sync
**n8n ID:** `Znp4oWRosfaBPatu` | **ملف:** `wf10-patient-profile-sync.json`  
**Active:** غير مؤكد  
**Nodes (6):** Trigger → Prepare Update Fields → Has Fields? → [No Update] / [Update Patient (patients) → Output]

---

#### WF-11 — Consent & PDPL Manager
**n8n ID:** `1vkJuEKKHQCDSRGY` | **ملف:** `wf11-consent-manager.json`  
**Active:** غير مؤكد  
**Nodes (10):** Trigger → Check Existing Consent (digital_consents) → Already Consented? → [Already Exists] / [Prepare Request → Consent Given? → [Awaiting] / [Record Consent → Output OK]]

---

#### WF-12 — E-Prescription Generator
**n8n ID:** غير موجود | **ملف:** غير موجود  
**⛔ لم يُبنَ — مؤجل بعد Core**

---

#### WF-13 — Service Catalog Sync
**n8n ID:** `lzNvi3fCIBjrfCk5` | **ملف:** `wf13-service-catalog-sync.json`  
**Active:** غير مؤكد  
**Nodes (6):** Trigger → Validate Service → Is Valid? → [Invalid] / [Create Service (services) → Output]

---

#### WF-14 — Insurance Pre-check (Dhamani Stub)
**n8n ID:** `LVizXPb2HP2o1eVW` | **ملف:** `wf14-insurance-precheck.json`  
**Active:** غير مؤكد | **⚠️ Stub — لا Dhamani integration**  
**Nodes (3):** Trigger → Get Provider (insurance_providers) → Stub Check (يُرجع check_pending)

---

#### WF-15 — Invoice Generator + VAT
**n8n ID:** `MEW9s9F5IUd5gXn6` | **ملف:** `wf15-invoice-generator.json`  
**Active:** غير مؤكد | **تم إصلاحه في 2026-06-17 (جلسة سابقة)**  
**Nodes (7):** Trigger → [Get VAT Rule + Get Service] → Calculate VAT (INV-YYYYMMDD-RANDOM6) → Create Invoice (invoices) → Create Invoice Item (invoice_items) → Output

---

#### WF-16 — Thawani Payment Processor
**n8n ID:** `J5Xo1PwbIWIi5oX2` | **ملف:** `wf16-thawani-payment.json`  
**Active:** غير مؤكد | **Webhook:** `/thawani-webhook`  
**Nodes (10):** Thawani Webhook → Parse Webhook → Is Paid? → [Ignore] / [Find Payment Link → Resolve Invoice → Link Found? → [Record Payment → Mark Invoice Paid → Update Link Status] → Respond 200]

---

#### WF-17 — Payment Link Generator
**n8n ID:** `MWuHI0l11A46keAp` | **ملف:** `wf17-payment-link-generator.json`  
**Active:** غير مؤكد | **⚠️ Thawani UAT — ليس production**  
**Nodes (6):** Trigger → Prep Payment Data (deposit=20%، invoice=100%، +30min expiry) → Create Thawani Session (UAT endpoint) → Extract Payment URL → Save Payment Link (payment_links) → Output

---

#### WF-18 — Doctor Commission Calculator
**n8n ID:** `6K0O4YNt2nMt6PtS` | **ملف:** `wf18-doctor-commission.json`  
**Active:** غير مؤكد  
**Nodes (8):** Trigger → [Get Paid Invoice + Get Doctor] → Calc Commission (DB rate أو 10% افتراضي) → Should Skip? → [Skip] / [Create Commission (doctor_commissions، status=pending) → Output]

---

#### WF-19 — Re-engagement Campaign Engine
**n8n ID:** `yuvFcZgDnBXZMwxB` | **ملف:** `wf19-reengagement-campaign.json`  
**Active:** غير مؤكد | **Schedule:** أسبوعياً | **تم إصلاحه في 2026-06-17**  
**Nodes (15+):** Schedule → Calc Cutoff (60 يوم) → [Get Completed + Get NoShow] → Dedupe → Collect → [رسالة "نشتاق لك" للـ completed] / [رسالة اعتذار للـ no_show] → S1 لكل مريض

---

#### WF-20 — Reviews Router
**n8n ID:** `V0GrBmakIru6s5Qk` | **ملف:** `wf20-reviews-router.json`  
**Active:** غير مؤكد  
**Nodes (4):** Trigger → Calc Route (rating ≥ 4 → google; < 4 → admin) → Log Review (reviews_log) → Output

---

#### WF-21 — Audit Logger
**n8n ID:** `WJE1JkLPkwCctd8D` | **ملف:** `wf21-audit-logger.json`  
**Active:** غير مؤكد | **Webhook:** `/tawd-audit`  
**Nodes (4):** Audit Webhook → Parse Audit Event (يُقيّد action إلى INSERT/UPDATE/DELETE) → Store Audit Log (tawd_audit_logs) → Respond 200

---

#### WF-22 — MFA Enforcer (Stub)
**n8n ID:** `d3a7Esig0glU7A9B` | **ملف:** `wf22-mfa-enforcer.json`  
**Active:** غير مؤكد | **⚠️ Stub — لا MFA حقيقي**  
**Nodes (2):** Trigger → MFA Check Stub (يُرجع mfa_required=true لـ owner/admin/doctor)

---

#### WF-23 — Workflow Health Monitor
**n8n ID:** `BCL1vP4d3khMinjJ` | **ملف:** `wf23-health-monitor.json`  
**Active:** غير مؤكد | **Schedule:** يومياً (24h)  
**Nodes (5):** Schedule → Calc Window → Get Critical Errors (tawd_error_logs، severity=high) → Assess Health (0=healthy، 1-4=warning، 5+=critical) → Log Health (tawd_workflow_logs)

---

#### WF-24 — Expired Payment Link Cleanup ⭐ مُعاد هيكلته
**n8n ID:** `ijOOJ75qBU4kUyJ8` | **ملف:** `wf24-expired-payment-cleanup.json` ✅ مُحدَّث 2026-06-17  
**Active:** ❌ غير مُفعَّل — يحتاج تفعيل يدوي من n8n UI | **Schedule:** كل 5 دقائق

**التحديثات في 2026-06-17 (Architectural Refactoring):**
- ❌ حُذف: "Unlock Slot" node (كان UPDATE مباشر على appointment_slots بعمود خاطئ `locked_by_session_id` TEXT — الاسم الحقيقي هو `locked_by_session` UUID)
- ✅ أُضيف: "Release Expired Locks" Postgres node في البداية: `SELECT public.tawd_release_expired_locks()` — يُحرّر ALL expired locks أتومياً على مستوى DB قبل أي منطق تطبيقي

**Nodes (11 — نفس العدد، تركيبة مختلفة):**

| Node | الوظيفة |
|------|---------|
| Schedule Trigger | كل 5 دقائق |
| **Release Expired Locks (Postgres)** | `SELECT tawd_release_expired_locks()` — يُحرر كل slots منتهية الصلاحية عبر DB |
| Get Expired Links | payment_links WHERE status=pending AND expires_at < now |
| Has Expired Links? | filter node |
| Has Appointment Link? | if appt_id not empty |
| Get Appointment | appointments WHERE id = appt_id |
| Evaluate Appointment | code: cancellable = status=confirmed |
| Cancellable? | if |
| Cancel Appointment | appointments UPDATE status=cancelled، cancellation_reason=deposit_payment_timeout |
| Expire Link | payment_links UPDATE status=expired |
| Output | set |

**lineage:** Release Expired Locks (DB) → Get Expired Links → [per link: Cancel Appointment if needed] → Expire Link

---

## 5. التدفق الكامل (End-to-End Flow)

### تدفق الحجز عبر WhatsApp

```
Meta GET /sura-whatsapp → WF-05 Verify Token → Respond hub.challenge (مرة واحدة عند setup)

مريض يُرسل رسالة WhatsApp POST →
WF-05: Respond 200 فوراً (Meta ACK) → Parse Request [TECH-DEBT-001] → Valid Message?
    ↓
    S4 Clinic Context → Maintenance Mode?
    ↓ (not in maintenance)
    S3 Get Patient → S5 Get Session → S6 Save Patient Msg
    ↓
    Build AI Context → سُرى Agent (Gemini Flash 2.0, temp=0.3) → Parse AI Output
    ↓
    HITL Gate (confidence ≥ 0.85 AND NOT sensitive AND NOT requires_hitl)?
    │
    ├─ YES → Is Booking?
    │           ├─ YES → WF-06: Get Slots → Pick → Lock (tawd_lock_slot) → Create Appt → Queue → Confirm Arabic → S6 → S1
    │           └─ NO  → S6 Save Sura Reply → S1 Send
    │
    └─ NO  → Clarification OK? (< 2 times)
                ├─ YES → Increment clarification_count → S6 → S1 Send Clarification
                └─ NO  → Get Admin Phone → Prepare HITL → HITL Refine (Gemini Pro 2.5) → S7 Queue + Notify Staff
```

### تدفق توليد المواعيد (WF-04 — جديد)
```
2:00 AM يومياً →
Set Booking Window (14 يوم) →
Generate Slots (Postgres SQL):
  - يقرأ doctor_schedules (is_active=true، في نافذة effective_from→until)
  - يُطابق day_of_week ENUM مع التاريخ (LOWER(TRIM(TO_CHAR(date, 'Day'))))
  - يستثني clinic_holidays (للكل أو للطبيب المحدد)
  - INSERT ... ON CONFLICT (clinic_id, doctor_id, slot_time) DO NOTHING
→ Assess Result → Log Execution (tawd_workflow_logs) → Output
```

### تدفق انتهاء روابط الدفع (WF-24 — مُصلَح)
```
كل 5 دقائق →
Release Expired Locks (DB): tawd_release_expired_locks() → يُحرر ALL expired slot locks
→ Get Expired payment_links (status=pending، expires_at < now)
→ لكل رابط: إن كان له appointment → Cancel (status=cancelled، reason=deposit_payment_timeout)
→ Expire Link (payment_links status=expired)
```

---

## 6. الفجوات والنواقص المؤكدة

| # | الفجوة | الخطورة | الحالة |
|---|--------|---------|--------|
| 1 | **WF-04 لم يُرفع لـ n8n ولم يُفعَّل** | 🔴 | يحتاج رفع عبر REST API ثم تفعيل يدوي من UI |
| 2 | **WF-24 غير مُفعَّل** | 🔴 | يحتاج تفعيل يدوي من n8n UI |
| 3 | **WF-05 يحتاج رفع لـ n8n** (تحديثات: GET verification) | 🔴 | يحتاج PUT إلى n8n ID `arZRfHPPTytcMSR5` |
| 4 | **TECH-DEBT-001: WF-05 clinicMap hardcoded** | 🟠 | يحتاج migration إلى dynamic lookup قبل الـ clinic الثانية |
| 5 | **WF-12 E-Prescription لم يُبنَ** | 🟡 | مؤجل — لا إمكانية إصدار وصفات |
| 6 | **WF-22 stub فقط** | 🟡 | MFA يُرجع mfa_required=true فقط — لا تحقق حقيقي |
| 7 | **WF-14 stub فقط** | 🟡 | Dhamani integration معلّق |
| 8 | **WF-17 يستخدم Thawani UAT** | 🟠 | يحتاج production endpoint قبل الإطلاق |
| 9 | **patient_vitals.bmi يُحسب يدوياً** | 🟡 | ليس generated column — خطر inconsistency إذا لم يُحسب صح |
| 10 | **لا workflow يكتب في loyalty_points** | 🟢 | Phase 2.5 |
| 11 | **لا workflow يكتب في patient_vitals** | 🟢 | Phase 2.5 |
| 12 | **لا workflow يستخدم marketing_campaigns / campaign_logs** | 🟡 | جداول جاهزة، لا WF بعد |
| 13 | **لا workflow يستخدم insurance_claims** | 🟡 | WF-14 stub — لا claims lifecycle |
| 14 | **لا workflow يستخدم patient_notes** | 🟢 | يُكتب من dashboard مباشرةً |
| 15 | **WF-20 Google review URL هو placeholder** | 🟢 | `https://g.page/r/tawd-clinic/review` مؤقت |
| 16 | **Active status جميع الـ workflows غير مؤكد** | 🟡 | يحتاج API key للتحقق |
| 17 | **`_s2-live.json` ملف غير موثَّق في n8n-workflows/** | 🟢 | فحص محتواه مطلوب |

---

## 7. القرارات المعمارية المتراكمة

### 7.1 مبادئ هوية النظام
- **الاسم:** TAWD فقط — لا "ClinicOS" في أي مكان
- **المساعد:** سُرى (`sura` في الكود — ليس `lara`)
- **اللغة:** Arabic (خليجي) للمرضى، English للكود والمتغيرات

### 7.2 قاعدة البيانات
- **Multi-tenancy:** `clinic_id` UUID على كل جدول + RLS عبر `get_clinic_id()` من JWT
- **Platform bypass:** `is_platform_admin()` يتجاوز RLS لعمليات platform-level
- **Hard delete محظور:** soft-delete (`deleted_at`) على جميع السجلات الطبية والمالية
- **النقود:** `NUMERIC(12,3)` لـ OMR (فلوس = 3 decimal)
- **Financial snapshot:** `invoice_items` يحفظ الأسعار عند الإصدار — لا تأثر بالتغييرات اللاحقة
- **Atomic slot locking:** `tawd_lock_slot()` مع WHERE guard يمنع double-booking في التزامن
- **Audit immutability:** `trg_protect_audit_logs` يمنع UPDATE/DELETE على tawd_audit_logs
- **UNIQUE constraint (clinic_id, doctor_id, slot_time):** يُتيح safe upsert في WF-04
- **day_of_week كـ ENUM:** الإدراج الأتوماتيكي يستخدم `LOWER(TRIM(TO_CHAR(date, 'Day')))` للمطابقة

### 7.3 قرارات مالية
- Deposit: 20% من إجمالي الخدمة
- Commission: يُحسب بعد الدفع، يبقى pending حتى الصرف اليدوي
- Payment Gateway: Thawani — UAT حالياً

### 7.4 n8n Architecture
- **Sub-workflows S1-S7:** وحدات إعادة استخدام — context propagation عبر `...t` spread
- **HITL threshold:** confidence ≥ 0.85 AND NOT sensitive AND NOT requires_hitl → auto
- **AI models:** Flash 2.0 (main, temp=0.3) / Pro 2.5 Preview (HITL refinement, temp=0.2)
- **Chat memory:** Postgres keyed by session_id (TAWD Supabase Postgres credential)
- **DB is Single Source of Truth للقفل:** WF-24 يستدعي `tawd_release_expired_locks()` — لا application-level lock management
- **PowerShell push:** `[System.IO.File]::ReadAllText(path, UTF8)` دائماً — `Get-Content` يُفسد العربية

### 7.5 خريطة Webhook الموحّدة (بعد دمج WF-00 في WF-05)
| Path | Method | Handler | الغرض |
|------|--------|---------|-------|
| `/sura-whatsapp` | GET | WF-05 (n38-n39-n40) | Meta webhook verification |
| `/sura-whatsapp` | POST | WF-05 (n01-n02+) | Inbound WhatsApp messages |
| `/sura-instagram` | POST | WF-02 | Inbound Instagram messages |
| `/sura-webchat` | POST | WF-03 | Inbound Web Chat messages |
| `/thawani-webhook` | POST | WF-16 | Payment status events |
| `/tawd-audit` | POST | WF-21 | Audit log ingestion |

---

## 8. القيود البيئية المكتشفة

| القيد | التأثير | الحل المُطبَّق |
|-------|---------|---------------|
| n8n REST API لا تملك endpoint لتفعيل workflow | لا تفعيل برمجي — يدوي من UI | توثيق صريح في كل workflow جديد |
| PowerShell shell state لا يستمر بين tool calls | `$apiKey` يختفي بين الاستدعاءات | يُعرَّف دائماً داخل نفس command block |
| `Get-Content` يُفسد العربية في JSON | n8n يُرجع 500 | `[System.IO.File]::ReadAllText(path, UTF8)` |
| Supabase MCP يحتاج مصادقة خارجية | لا يُضاف عبر tool call | `.mcp.json` + `claude /mcp` + restart VSCode |
| `information_schema.tables.row_security` لا يعمل | Query RLS يفشل | `pg_class.relrowsecurity` بدلاً منه |
| Gemini 1.5x → 404 | لا يعمل مع API key الحالي | Flash 2.0 + Pro 2.5 Preview |
| n8n Postgres node: multi-statement queries | بعض الإصدارات لا تدعمها | استخدام CTE واحدة شاملة |
| doctor_schedules.day_of_week هو ENUM وليس INT | لا يمكن مقارنته مباشرةً مع EXTRACT(DOW) | `ds.day_of_week::TEXT = LOWER(TRIM(TO_CHAR(date, 'Day')))` |
| appointment_slots.locked_by_session هو UUID | WF-24 القديم كان يكتب TEXT في اسم حقل خاطئ | مُصلَح في الإصدار الجديد (الحقل حُذف من الـ application layer — DB function يعالجه) |

---

### خريطة رفع الـ Workflows المُحدَّثة لـ n8n

تحتاج العمليات التالية بعد هذا التقرير:

```powershell
# 1. رفع WF-05 المُحدَّث (PUT على الـ ID الموجود)
# PUT https://n8n.srv1239666.hstgr.cloud/api/v1/workflows/arZRfHPPTytcMSR5

# 2. رفع WF-24 المُحدَّث (PUT على الـ ID الموجود)
# PUT https://n8n.srv1239666.hstgr.cloud/api/v1/workflows/ijOOJ75qBU4kUyJ8

# 3. رفع WF-04 جديد (POST — يُنشئ ID جديد)
# POST https://n8n.srv1239666.hstgr.cloud/api/v1/workflows

# 4. تفعيل WF-04 و WF-24 يدوياً من n8n UI
# (REST API لا تملك endpoint لتفعيل workflow)
```

---

*نهاية التقرير — إصدار 2 | تاريخ الفحص والإصلاح: 2026-06-17*
