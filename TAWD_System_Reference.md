# TAWD — وثيقة المرجع الرئيسية للنظام (Master Reference for Claude Code)

> **هذا الملف هو المصدر الوحيد للحقيقة (Single Source of Truth).**
> أي قرار، أي جدول، أي workflow، أي تسمية — يجب أن يطابق هذا الملف.
> إذا وجدت تعارضاً بين هذا الملف والكود الموجود فعلياً → أوقف ونبّه المستخدم، لا تخمّن.
> **لا يوجد أي اسم "ClinicOS" في أي مكان — الاسم الوحيد هو TAWD.**

---

## ⚠️ 0. قرارات تحتاج تأكيد صريح من المؤسس قبل البدء

هذه نقاط حددتها بناءً على المحادثات السابقة، لكنها قرارات نهائية تستحق تأكيد سريع (نعم/لا) قبل أن يبدأ التنفيذ الفعلي، لتجنب أي إعادة بناء لاحقاً:

| # | القرار | الافتراض المعتمد في هذا الملف | يحتاج تأكيد؟ |
|---|---|---|---|
| 1 | اسم معرّف العيادة في كل الجداول | `clinic_id` (موحّد في كل مكان، بدون `tenant_id`) | نعم |
| 2 | عدد جداول Supabase الأساسية | **35 جدول** (تصحيح: ذُكر سابقاً 38 خطأً — العدد الصحيح بعد التجميع 35) | نعم |
| 3 | عدد الـ Workflows المستهدف | **23 workflow** موزعة على 8 مجموعات وظيفية | نعم |
| 4 | اسم الوكيل الذكي "لارا" | يبقى كما هو (اسم ميزة/شخصية AI، مستقل عن براند TAWD، كما "Siri" تحت Apple) | نعم |
| 5 | Supabase instance | إعادة استخدام المشروع الحالي (`pubmofuarplxjoyybubl`) مع تنظيف الـ Schema، **لا** إنشاء instance جديد | نعم |
| 6 | أسماء الـ Repos الحالية (`clinicos-web`, `clinicos-survey`, `clinicos-dashboard`) | تُعاد تسميتها إلى `tawd-web`, `tawd-survey`, `tawd-dashboard` (Clean Slate) | نعم |
| 7 | RBAC | **4 أدوار تشغيلية** على مستوى العيادة (Admin/Doctor/Receptionist/Accountant) + **1 دور منصة** (TAWD Platform Admin = أنت، صلاحية عبر كل العيادات) | نعم |
| 8 | عدد القنوات الحية الآن | 4 (WhatsApp, Instagram, Web Chat, SMS) — Voice AI يبقى Add-on مستقبلي | نعم |

---

## 1. الهوية والرؤية

**الاسم:** TAWD (طود)
**ماهو:** نظام تشغيل طبي ذكي متكامل (AI-Powered Clinic Operating System) — Multi-tenant SaaS
**يخدم:** عيادات القطاع الخاص (عيادات أسنان، جلدية، عامة، تجميل)
**السوق:** عُمان (أولوية مطلقة) → السعودية → الإمارات
**الفجوة السوقية المؤكدة (بعد بحث):**
- لا يوجد منافس عُماني محلي متخصص بعيادات + AI
- المنافسون الإقليميون (ClinicGateway، Cloudpital، Medinous) يقدمون reminders فقط عبر واتساب — **لا أحد منهم عنده وكيل AI كامل يحجز ويرد ويفهم نية المريض بالعربي على واتساب**
- لا أحد من المنافسين مرتبط بـ Thawani أو مهيأ لـ PDPL العُماني

**الفرق التنافسي الجوهري لـ TAWD:**
1. وكيل AI (لارا) يدير محادثة كاملة على واتساب — حجز، إلغاء، استفسار — لا مجرد تذكير
2. عربي خليجي أصيل، ليس مترجماً
3. Thawani + OMR كمواطن أول
4. PDPL + بنية بيانات محلية من اليوم الأول
5. بنية Integration-Ready لمنصة ضماني (دون انتظار اتفاقيات حكومية لإطلاق MVP)

---

## 2. البنية التقنية (Tech Stack)

| الطبقة | التقنية | ملاحظات |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | لوحات التحكم + بوابة المريض |
| Backend / DB | Supabase (PostgreSQL) — `jomsheslxqtgooyezgmk` | Auth + Storage + RLS + Realtime |
| الأتمتة | n8n v2.11.4 (self-hosted) | كل منطق الأعمال والتدفقات — 30 workflow فعلياً |
| الذكاء الاصطناعي | Google Gemini 2.0 Flash + Gemini 2.5 Pro Preview | Flash (temp=0.3) = استقبال سريع / Pro (temp=0.2) = HITL وقرارات حساسة |
| الدفع | Thawani Payment Gateway | OMR / SAR / AED |
| الاستضافة | Vercel | للواجهات الأمامية |
| القنوات | WhatsApp Business API (Meta Cloud), Instagram DM, Web Chat Widget, SMS | 4 قنوات حية |

---

## 3. البيئة والاتصالات الحالية (Environment — Operational IDs)

> ⚠️ **هذا القسم يحتوي معرّفات تشغيلية فقط — وليس مفاتيح سرية.**
> المفاتيح السرية (Service Role Key, Gemini API Key, WhatsApp Access Token, Thawani Secret Key) موجودة في `.env` / n8n Credentials Store ولا تُكتب هنا أو في أي كود مصدري. لا تطلب من Claude Code طباعتها أو تضمينها في ملفات.

| المعرّف | القيمة |
|---|---|
| Supabase Project Ref | `jomsheslxqtgooyezgmk` (URL: `https://jomsheslxqtgooyezgmk.supabase.co`) |
| n8n Instance URL | `https://n8n.srv1239666.hstgr.cloud` (v2.11.4 self-hosted) |
| WhatsApp Phone Number ID | `1050565764810212` |
| عيادة تجريبية (Test Clinic ID) | `be9e4157-f56d-49e4-96bd-8b2d5b8af568` (اسم: TAWD Test Clinic, plan: pro, status: trial) |
| العملات المدعومة | OMR (أساسي) · SAR · AED |
| لوحة التحكم الحالية | `clinicos-dashboard.vercel.app` → ستُعاد تسميتها إلى `tawd-dashboard` |
| ⚠️ المرجع القديم المُلغى | `pubmofuarplxjoyybubl` — مشروع Supabase القديم، محذوف. لا يُستخدم. |

---

## 4. القواعد المعمارية الثابتة (Non-Negotiable Rules)

هذه القواعد **لا تُكسر تحت أي ظرف**. أي workflow أو جدول أو واجهة جديدة يجب أن تلتزم بها.

### 4.1 Multi-Tenancy & عزل البيانات (RLS)
- كل جدول تشغيلي (غير `tawd_*`) يحتوي حقل `clinic_id UUID NOT NULL`
- RLS مفعّل على **كل جدول بدون استثناء**
- سياسة موحدة:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation_policy ON <table_name>
FOR ALL
USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);
```
- ممنوع منطقياً: أي استعلام بدون فلتر `clinic_id` على الجداول التشغيلية، حتى من Service Role في الكود (إلا أدوات Platform Admin الموثقة).

### 4.2 RBAC — مصفوفة الصلاحيات

| الدور | المرضى/السجل الطبي | الوصفات | المالية/الفواتير | إعدادات وربط |
|---|---|---|---|---|
| **Clinic Admin** | قراءة/كتابة/تعديل | قراءة فقط | كامل + تقارير | كامل |
| **Doctor** | قراءة/كتابة (تشخيص فقط) | كامل (إصدار/إرسال) | قراءة فواتير مرضاه فقط | لا يوجد |
| **Receptionist** | قراءة أساسية فقط | لا يوجد | تسجيل دفع + إصدار فواتير | لا يوجد |
| **Accountant** | لا يوجد | لا يوجد | كامل + ضرائب/عمولات | بوابة الدفع فقط |
| **TAWD Platform Admin** (دورك أنت) | عبر كل العيادات — لمراقبة/دعم فقط، عبر دوال موثقة (Audit-logged) | — | — | كامل على مستوى المنصة |

### 4.3 بوابة التحقق البشري (HITL Gate)
- أي محتوى توليده AI (رد معقد، ملخص حالة، تذكير متابعة طبية) → يُكتب في جدول `ai_review_queue`
- لا يُرسل للمريض إلا بعد اعتماد موظف بشري (زر "اعتماد")
- استثناء: الردود البسيطة (تأكيد حجز، رد على FAQ ثابت) تمر مباشرة — القاعدة: **ثقة AI ≥ 85% وردّ غير حساس طبياً = مباشر، أي شيء أقل أو حساس = HITL**

### 4.4 سجل التدقيق (Audit Logs)
- جدول `tawd_audit_logs` — **immutable**: لا UPDATE ولا DELETE على مستوى DB (عبر REVOKE صلاحيات أو Trigger يرفضها)
- يُسجَّل عبر Database Trigger تلقائي على: `patients`, `prescriptions`, `invoices`, `staff_users`, `appointments`
- الحقول: `user_id, action, table_name, record_id, old_value, new_value, ip_address, created_at (ms precision)`

### 4.5 PDPL والتشفير
- بيانات حساسة (الرقم المدني، التشخيصات، نتائج الفحوصات) → AES-256 at rest
- بيانات المرضى لا تخرج من نطاق التخزين المتوافق مع PDPL العُماني
- "حق النسيان": يدعم `patients.is_archived` + جدول أرشفة منفصل، بدلاً من حذف فعلي

### 4.6 المصادقة الثنائية (MFA)
- **Toggle-based** — ليست إلزامية افتراضياً
- `tawd_clinic_settings.mfa_enforced (boolean)` — العيادة تفعّلها لكل موظفيها من لوحة التحكم
- عند التفعيل: TOTP (Google Authenticator) إلزامي لكل تسجيل دخول

### 4.7 قواعد التسمية (Naming Conventions)
- جداول **على مستوى المنصة** (عابرة لكل العيادات): بريفكس `tawd_` — مثل `tawd_clinics`, `tawd_audit_logs`, `tawd_workflow_logs`, `tawd_subscriptions`
- جداول **تشغيلية خاصة بعيادة**: بدون بريفكس، أسماء domain مباشرة — `patients`, `appointments`, `invoices`...
- لا يُستخدم `clinicos_` كبريفكس في أي مكان (قديم، ملغى)
- ملفات الكود: لا توجد كلمة `clinicos` في أي اسم ملف، متغير، أو تعليق جديد

---

## 5. مخطط قاعدة البيانات — 42 جدولاً في 8 مجموعات + جداول إضافية مؤكدة

> ⚠️ **تحديث 2026-06-17:** العدد الفعلي المؤكد من فحص مباشر للـ DB هو **42 جدول** (وليس 35 كما كان مكتوباً سابقاً). الجداول الإضافية السبعة موثّقة في نهاية هذا القسم.

### المجموعة ① — النواة والصلاحيات (Platform Core) — 4 جداول `tawd_*`

| الجدول | الحقول الأساسية |
|---|---|
| `tawd_clinics` | `id, name, plan, status, currency, vat_enabled, created_at` |
| `tawd_staff_users` | `id, clinic_id, role, name, email, phone, mfa_enabled` |
| `tawd_clinic_settings` | `id, clinic_id, mfa_enforced, working_hours, languages, channel_toggles (jsonb)` |
| `tawd_audit_logs` | `id, user_id, clinic_id, action, table_name, record_id, old_value, new_value, ip_address, created_at` |

### المجموعة ② — المرضى والملف الطبي — 5 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `patients` | `id, clinic_id, national_id, name, phone, dob, loyalty_points, is_archived` |
| `medical_histories` | `id, patient_id, blood_type, allergies (jsonb), chronic_diseases (jsonb)` |
| `patient_vitals` | `id, patient_id, weight, height, bp, pulse, recorded_at` |
| `digital_consents` | `id, patient_id, consent_type, signed_at, pdf_url` |
| `patient_notes` | `id, patient_id, doctor_id, note_text, created_at` |

### المجموعة ③ — المواعيد والطابور — 4 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `appointments` | `id, clinic_id, patient_id, doctor_id, slot_time, status, type, source_channel` |
| `appointment_slots` | `id, clinic_id, doctor_id, slot_time, is_locked, locked_until` (للقفل الذري) |
| `waiting_queue` | `id, clinic_id, appt_id, patient_id, queue_position, status` |
| `no_show_log` | `id, appt_id, patient_id, marked_at, risk_factors (jsonb)` |

### المجموعة ④ — القنوات والمحادثات — 4 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `chat_sessions` | `id, clinic_id, patient_id, channel, status, last_active_at` |
| `chat_messages` | `id, session_id, sender, message_text, tokens_used, created_at` |
| `channel_configs` | `id, clinic_id, channel, credentials_ref, is_active` |
| `ai_review_queue` | `id, clinic_id, session_id, ai_draft, confidence_score, status, reviewed_by` |

### المجموعة ⑤ — المالية والفوترة — 5 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `invoices` | `id, clinic_id, appt_id, patient_id, subtotal, vat_amount, total, status` |
| `payments` | `id, invoice_id, gateway, transaction_id, currency, amount, paid_at` |
| `payment_links` | `id, clinic_id, appt_id, link_url, purpose (deposit/invoice), status` |
| `doctor_commissions` | `id, invoice_id, doctor_id, commission_amount, status` |
| `vat_rules` | `id, clinic_id, service_id, vat_applicable (boolean), rate` |

### المجموعة ⑥ — الخدمات الطبية — 5 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `services` | `id, clinic_id, name, price, duration_minutes, vat_applicable` |
| `prescriptions` | `id, patient_id, doctor_id, status, pdf_url, signed_at` |
| `prescription_items` | `id, prescription_id, drug_name, dosage, instructions` |
| `insurance_providers` | `id, clinic_id, provider_name, is_active, dhamani_code` |
| `insurance_claims` | `id, patient_id, appt_id, provider_id, status, claim_ref` *(Integration-Ready — لا اتصال مباشر بضماني الآن)* |

### المجموعة ⑦ — التسويق والنمو — 4 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `marketing_campaigns` | `id, clinic_id, target_segment, channel, template_body, scheduled_at` |
| `campaign_logs` | `id, campaign_id, patient_id, status, sent_at` |
| `loyalty_points` | `id, patient_id, points, source, created_at` |
| `reviews_log` | `id, clinic_id, patient_id, rating, routed_to (google/admin), comment` |

### المجموعة ⑧ — النظام والمراقبة — 4 جداول

| الجدول | الحقول الأساسية |
|---|---|
| `tawd_workflow_logs` | `id, workflow_id, clinic_id, status, execution_time_ms, created_at` |
| `tawd_error_logs` | `id, workflow_id, clinic_id, error_message, severity, created_at` |
| `notification_queue` | `id, clinic_id, patient_id, channel, payload (jsonb), status, scheduled_at` |
| `tawd_subscriptions` | `id, clinic_id, plan, billing_cycle, status, renews_at` |

> **مؤجل (لا يُبنى الآن):** `lab_tests`, `lab_results`, `pharmacy_inventory`, `telehealth_sessions` — تُضاف فقط بعد أول 5 عيادات حقيقية.

### الجداول الإضافية الـ 7 (مؤكدة في DB — 2026-06-17)

| الجدول | الوصف | عدد الأعمدة |
|---|---|---|
| `ai_usage_metrics` | مقاييس استهلاك Gemini (tokens, cost) | 10 |
| `clinic_holidays` | أيام العطل والإجازات لمنع توليد slots خاطئة | 8 |
| `doctor_schedules` | جداول عمل الأطباء (day_of_week ENUM, start/end time) | 12 |
| `doctor_services` | ربط الأطباء بالخدمات التي يقدمونها | 6 |
| `invoice_items` | تفاصيل بنود الفاتورة مع snapshot للأسعار | 12 |
| `notification_templates` | قوالب الرسائل لكل قناة وغرض | 11 |
| `patient_access_logs` | سجل من اطّلع على ملف مريض (PDPL) | 8 |

> جميع الـ 42 جدول مؤكدة: RLS مفعّل ✓، policy `clinic_isolation` ✓ (إلا `tawd_audit_logs` = `clinic_read` SELECT فقط — صحيح بالتصميم).

---

## 6. القنوات (Channels) — التفاصيل

### 6.1 WhatsApp (القناة الأساسية — 90%+ من التفاعل)
```
مريض يرسل رسالة
  → Meta Cloud API Webhook
  → [WF: Channel Receiver - WhatsApp]
  → [Sub-workflow: Channel Normalizer] — يحول الرسالة لصيغة موحدة (channel-agnostic)
  → [Sub-workflow: Get Clinic] — تحديد العيادة من رقم الهاتف المستقبل
  → [WF: Lara Core Engine] — Gemini Intent → قرار → (مباشر | HITL Gate)
  → رد عبر WhatsApp API
```
- Rate Limiting: 15 رسالة/دقيقة/مستخدم
- الذاكرة: `chat_sessions` + `chat_messages` عبر `session_id`
- عربي/إنجليزي تلقائي بحسب لغة رسالة المريض

### 6.2 Instagram DM
- نفس الـ pipeline، عبر `[WF: Channel Receiver - Instagram]` → يمر بنفس `Channel Normalizer`

### 6.3 Web Chat Widget
- مدمج في موقع العيادة (تحت تجزئة domain العيادة) → نفس الـ pipeline

### 6.4 SMS
- للتذكيرات والإشعارات أساساً (خروج Notification Queue)، استقبال محدود

### 6.5 Voice AI (🔜 Add-on مستقبلي — ليس في Core)
- Twilio + Gemini Audio — يُباع كباقة Premium للعيادات الكبيرة فقط، لا يُفعّل افتراضياً

---

## 7. محرك الذكاء الاصطناعي — سُرى (Sura)

> ⚠️ **تحديث 2026-06-17:** الاسم الرسمي للوكيل هو **سُرى / Sura** في الكود. اسم "لارا / Lara" مُلغى نهائياً ولا يُذكر في أي كود أو توثيق أو تسمية.

| العنصر | التفاصيل |
|---|---|
| النموذج السريع | `gemini-2.0-flash` (temp=0.3) — لفهم النية (Intent) والردود الفورية |
| النموذج التحليلي | `gemini-2.5-pro-preview-06-05` (temp=0.2) — HITL Refine Agent لتحليل الحالات الحساسة |
| الذاكرة | `chat_sessions` + `chat_messages` — Postgres Chat Memory عبر n8n |
| HITL Threshold | confidence ≥ 0.85 AND NOT sensitive AND NOT requires_hitl → مباشر؛ أي شيء أقل → HITL |
| كشف الطوارئ | كلمات/سياق محدد → تصعيد فوري لـ `ai_review_queue` بأولوية عالية |
| اللغة | عربي خليجي + إنجليزي، تلقائي حسب رسالة المريض |
| القاعدة الذهبية | **سُرى لا تتخذ قراراً نهائياً حساساً بمفردها — كل شيء حساس يمر عبر HITL Gate** |

---

## 8. المحرك المالي

| الوظيفة | الآلية |
|---|---|
| بوابة الدفع | Thawani — OMR/SAR/AED |
| VAT | ديناميكي عبر `vat_rules` لكل خدمة — 5% حسب نوع الخدمة (تجميلي/جلدية خاضع، علاجي أساسي معفى) |
| عربون الموعد (No-Show Prevention) | `payment_links` → رابط Thawani يُرسل واتساب تلقائياً |
| الفوترة | `invoices` تلقائية بعد كل زيارة → PDF → واتساب/إيميل |
| عمولات الأطباء | `doctor_commissions` تُحسب تلقائياً بعد كل دفعة ناجحة |

---

## 9. خريطة الـ Workflows

### 9.1 المخزون الفعلي في n8n — 30 workflow مؤكدة (فحص مباشر 2026-06-17)

#### Sub-Workflows (7) — كلها Active
| n8n ID | الاسم | الملف |
|---|---|---|
| `0Aq11NOwPChsSzZ8` | [SUB] S1 Send WhatsApp | s1-send-whatsapp.json |
| `kHOzzOVWCtyvB1I1` | [SUB] S2 Log Error | s2-log-error.json |
| `44lmYECx1xkG0Cir` | [SUB] S3 Get or Create Patient | s3-get-or-create-patient.json |
| `MSsHC3t4qbzqWzlk` | [SUB] S4 Get Clinic Context | s4-get-clinic-context.json |
| `LhLhOblkCwLWWQlt` | [SUB] S5 Get or Create Chat Session | s5-get-chat-session.json |
| `F3YMSuQuGiknwoEH` | [SUB] S6 Save Message | s6-save-message.json |
| `dK1T85wRcr8XPZSO` | [SUB] S7 Push to HITL | s7-push-to-hitl.json |

#### Main Workflows (23) — Active إلا ما هو محدد
| n8n ID | الاسم | الملف | الحالة |
|---|---|---|---|
| `CputKQi9Eu4NDcuI` | WF-00 Webhook GET Verify (WhatsApp) | wf00-webhook-verify.json | Active ⚠️ تعارض مع n38 في WF-05 |
| `D8S7xfDVpLaNWDES` | WF-02 Channel Receiver Instagram | wf02-channel-instagram.json | Active |
| `mDBPZb9EU5xKfI5u` | WF-03 Channel Receiver Web Chat | wf03-channel-webchat.json | Active |
| `lgH5XJyOv1XpJfcf` | WF-04 Slot Generator (Nightly 2AM) | wf04-slot-generator.json | **⚠️ INACTIVE — يحتاج تفعيل يدوي من n8n UI** |
| `arZRfHPPTytcMSR5` | WF-05 Sura Core Engine (WhatsApp) | wf05-sura-core-engine.json | Active (40 node) |
| `pxPgMdVxdZmuVlYQ` | WF-06 Smart Booking Engine | wf06-smart-booking-engine.json | Active |
| `S237WFJ4ZB3sh2q2` | WF-07 Reminder Engine (24h+2h) | wf07-reminder-engine.json | Active |
| `nMzV4wxrURtNOtfZ` | WF-08 Queue Manager (15min) | wf08-queue-manager.json | Active |
| `r8pWM464TFDJ5nUs` | WF-09 No-Show Handler (30min) | wf09-noshow-handler.json | Active |
| `Znp4oWRosfaBPatu` | WF-10 Patient Profile Sync | wf10-patient-profile-sync.json | Active |
| `1vkJuEKKHQCDSRGY` | WF-11 Consent & PDPL Manager | wf11-consent-manager.json | Active |
| *(لا يوجد)* | WF-12 E-Prescription Generator | — | **مؤجل بقرار — يُبنى لاحقاً** |
| `lzNvi3fCIBjrfCk5` | WF-13 Service Catalog Sync | wf13-service-catalog-sync.json | Active |
| `LVizXPb2HP2o1eVW` | WF-14 Insurance Pre-check (Stub) | wf14-insurance-precheck.json | Active |
| `MEW9s9F5IUd5gXn6` | WF-15 Invoice Generator + VAT | wf15-invoice-generator.json | Active |
| `J5Xo1PwbIWIi5oX2` | WF-16 Thawani Payment Processor | wf16-thawani-payment.json | Active |
| `MWuHI0l11A46keAp` | WF-17 Payment Link Generator | wf17-payment-link-generator.json | Active |
| `6K0O4YNt2nMt6PtS` | WF-18 Doctor Commission Calculator | wf18-doctor-commission.json | Active |
| `yuvFcZgDnBXZMwxB` | WF-19 Re-engagement Campaign Engine | wf19-reengagement-campaign.json | Active |
| `V0GrBmakIru6s5Qk` | WF-20 Reviews Router | wf20-reviews-router.json | Active |
| `WJE1JkLPkwCctd8D` | WF-21 Audit Logger | wf21-audit-logger.json | Active |
| `d3a7Esig0glU7A9B` | WF-22 MFA Enforcer (Stub) | wf22-mfa-enforcer.json | Active |
| `BCL1vP4d3khMinjJ` | WF-23 Workflow Health Monitor | wf23-health-monitor.json | Active |
| `ijOOJ75qBU4kUyJ8` | WF-24 Expired Payment Cleanup (5min) | wf24-expired-payment-cleanup.json | **⚠️ INACTIVE — يحتاج تفعيل يدوي من n8n UI** |

### 9.2 الهيكل المستهدف — 23 Workflow في 8 مجموعات

| # | الاسم | المجموعة | الحالة المستهدفة |
|---|---|---|---|
| 1 | Channel Receiver – WhatsApp | A. الاستقبال | موجود (WF-00) — يُحسّن |
| 2 | Channel Receiver – Instagram | A. الاستقبال | يُبنى/يُدقق ضمن WF-01→18 |
| 3 | Channel Receiver – Web Chat | A. الاستقبال | يُبنى/يُدقق |
| 4 | Channel Normalizer (Sub-workflow مشترك) | A. الاستقبال | موجود ضمن WF-00 — يُفرّز كـ sub-workflow مستقل |
| 5 | Lara Core Engine (Intent + Response + HITL Routing) | A. الاستقبال | قيد البناء (Gemini Intent) |
| 6 | Smart Booking Engine (قفل ذري) | B. المواعيد | يُبنى/يُدقق |
| 7 | Reminder Engine (24h + 2h) | B. المواعيد | يُبنى/يُدقق |
| 8 | Queue Manager | B. المواعيد | يُبنى/يُدقق |
| 9 | Cancellation & No-Show Handler | B. المواعيد | يُبنى/يُدقق |
| 10 | Patient Registration & Profile Sync | C. المرضى | يُبنى/يُدقق |
| 11 | Consent & PDPL Manager | C. المرضى | يُبنى/يُدقق |
| 12 | E-Prescription Generator (داخلي) | D. الخدمات الطبية | يُبنى لاحقاً (بعد Core) |
| 13 | Service Catalog Sync | D. الخدمات الطبية | يُبنى/يُدقق |
| 14 | Insurance Pre-check (Dhamani-Ready Stub) | D. الخدمات الطبية | بنية جاهزة، بدون اتصال فعلي |
| 15 | Invoice Generator + VAT | E. المالية | يُبنى/يُدقق |
| 16 | Thawani Payment Processor | E. المالية | أولوية عالية — مطلوب Live |
| 17 | Deposit / No-Show Payment Link Generator | E. المالية | يُبنى بعد #16 |
| 18 | Doctor Commission Calculator | E. المالية | يُبنى بعد #15،16 |
| 19 | Re-engagement Campaign Engine | F. التسويق | يُبنى لاحقاً |
| 20 | Reviews Router | F. التسويق | يُبنى لاحقاً |
| 21 | Audit Logger (Trigger-based) | G. الحوكمة | أولوية عالية — أمني |
| 22 | MFA Enforcer (Toggle) | G. الحوكمة | يُبنى بعد Core |
| 23 | Workflow Health Monitor | H. المراقبة | يُبنى أخيراً |

ملاحظة: **WF-15 Content Creator** الموجود مسبقاً = جزء من المجموعة F (التسويق) — يُدمج كأحد مكونات #19/#20 أو يبقى مستقلاً، يُقرَّر بعد التدقيق.

---

## 10. لقطة الحالة الحالية (Current Status Snapshot — مُحدَّثة 2026-06-17)

### ✅ مكتمل ومؤكد من فحص مباشر
- **قاعدة البيانات:** 42 جدول، جميعها RLS مفعّل، 9 دوال SQL، triggers كاملة
- **n8n:** 30 workflow (7 sub + 23 main)، 28 منها Active
- **WF-05 Sura Core Engine:** 40 node — يعالج POST (رسائل WhatsApp) + GET (Meta verify)
- **WF-00:** Active — GET /sura-whatsapp (handler الفعلي للتحقق من Meta)
- **WF-06 → WF-24:** بُني وأُطلق — Active (عدا WF-04, WF-24 INACTIVE)
- **S1→S7:** Sub-workflows جميعها Active
- **RLS + Audit Triggers + Slot Management Triggers:** مؤكدة ✓
- **بيانات اختبار:** عيادة واحدة، مريض واحد، 9 رسائل تستدل على محادثة واتساب كاملة

### ⚠️ يحتاج تفعيل يدوي من n8n UI (لا يمكن برمجياً)
- **WF-04** (`lgH5XJyOv1XpJfcf`) — Slot Generator — INACTIVE → يُفعّل يدوياً
- **WF-24** (`ijOOJ75qBU4kUyJ8`) — Expired Payment Cleanup — INACTIVE → يُفعّل يدوياً

### ⚠️ تعارض يحتاج قرار
- **WF-00 + WF-05 GET** — كلاهما يحاول تسجيل GET /sura-whatsapp. WF-00 هو الـ active handler الفعلي. بعد تأكيد أن WF-05 GET nodes تعمل، يُعطّل WF-00 يدوياً من UI.

### ❌ فجوات البيانات (لا كود — يحتاج إدخال بيانات)
- `tawd_staff_users`: 0 صفوف — لا أطباء مضافون → WF-06 لا يجد slots
- `doctor_schedules`: 0 صفوف → WF-04 يولّد 0 slots (لا جداول = لا مواعيد)
- `services`: 0 صفوف → WF-13 لا يجد خدمات
- `notification_templates`: 0 صفوف → WF-07 Reminders لا يجد قوالب
- `appointment_slots`: 0 صفوف ← نتيجة طبيعية لعدم doctor_schedules

### 🔜 ما تبقى من بناء
- **TECH-DEBT-001:** clinicMap hardcoded في WF-05 (node wf05-n03) → يجب الترحيل لـ `channel_configs` قبل عيادة ثانية
- **WF-12 E-Prescription Generator** — مؤجل بقرار، يُبنى بعد 5 عيادات حقيقية
- **إعادة تسمية Repos:** `clinicos-web`, `clinicos-survey`, `clinicos-dashboard` → `tawd-web`, `tawd-survey`, `tawd-dashboard`
- **أول عيادة حقيقية تدفع:** onboarding + بيانات تشغيلية حقيقية

---

## 11. خارطة الطريق التنفيذية (ترتيب الأولويات)

```
المرحلة 0 — التدقيق (قبل أي كود جديد)
  → فحص وتوثيق الـ 16 workflow المجهولة
  → فحص الـ 35 جدول الحالية مقابل القسم 5، تحديد الفروقات

المرحلة 1 — الأساس الأمني (Core Security)
  → RLS على كل جدول (القسم 4.1)
  → tawd_audit_logs + Trigger (القسم 4.4)
  → إكمال Lara Core Engine + ai_review_queue (HITL)

المرحلة 2 — التشغيل الأساسي
  → Smart Booking + Reminders + Queue (#6-9)
  → Patient Registration + Consents (#10-11)

المرحلة 3 — المالية (إيراد حقيقي)
  → Invoice + VAT (#15)
  → Thawani Live (#16)
  → Payment Links + Commissions (#17-18)

المرحلة 4 — الواجهات
  → 4 Dashboards (Developer / Owner / Doctor / Patient Portal)
  → إعادة تسمية كل شيء إلى TAWD

المرحلة 5 — أول عميل حقيقي
  → onboarding أول عيادة فعلية تدفع

المرحلة 6 — لاحقاً
  → E-Prescription، Insurance Pre-check، Marketing Engines، MFA، Monitoring
  → ضماني الفعلي، Voice AI، Lab/Pharmacy (بعد 5 عيادات)
```

---

## 12. قواعد العمل مع Claude Code (Working Rules)

1. **الاسم:** TAWD فقط — في كل ملف، متغير، تعليق، اسم جدول، اسم repo، رسالة commit. ممنوع ذكر "ClinicOS" نهائياً.
2. **اللغة التقنية:** أكواد ومتغيرات بالإنجليزية، تعليقات وتوثيق يمكن أن تكون عربي/إنجليزي مختلط.
3. **بيئة المستخدم:** Windows + PowerShell — أي أمر terminal يُكتب بصيغة PowerShell متوافقة، لا bash مباشر بدون تنويه.
4. **الملفات الكاملة:** عند إنشاء/تعديل ملف، يُسلَّم كاملاً وجاهزاً للنشر — لا "snippets" أو "...rest of code".
5. **الاستقلالية:** تعمل كـ Lead Engineer/CTO — تتخذ القرارات التقنية الصغيرة بنفسك ضمن حدود هذا الملف، وتسأل فقط عند:
   - تعارض مع هذا الملف
   - عملية لا يمكن التراجع عنها (DROP TABLE، حذف بيانات، إعادة كتابة Schema بالكامل)
   - قرار يغيّر القسم 0 (القرارات المؤكدة)
6. **التدقيق أولاً:** أي workflow أو جدول موجود فعلاً → يُفحص قبل التعديل/البناء فوقه (انظر القسم 9.1).
7. **RLS لا يُتجاوز:** أي جدول جديد بدون RLS = خطأ يجب تصحيحه فوراً قبل المتابعة.
8. **التقارير:** بعد كل مهمة كبيرة (workflow، جدول، شاشة)، تقرير مختصر: ما تم، ما الحالة، ما المتبقي — بالعربي.

---

## 13. ملحق — السوق والمنافسون (ملخص)

- السوق الإقليمي لحلول الرعاية الصحية الذكية في نمو سنوي ~13% حتى 2030
- المنافسون الإقليميون (السعودية بشكل أساسي) يقدمون: Scheduling + Billing + Reminders + Insurance — لكن بدون AI receptionist عربي تفاعلي على واتساب
- عُمان: لا منافس محلي مباشر مكتشف في هذا التخصص
- الميزة الزمنية: TAWD يدخل سوقاً فارغاً محلياً، مع قابلية توسع إقليمي مبنية من اليوم الأول (multi-currency, multi-language)

---

**نهاية الملف. أي تحديث على هذا المستند = نسخة جديدة، ويُشار إليها بالتاريخ.**
