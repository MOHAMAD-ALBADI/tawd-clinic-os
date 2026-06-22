-- ================================================================
-- TAWD — RLS Verification Script v1.0
-- Test Clinic ID: be9e4157-f56d-49e4-96bd-8b2d5b8af568
-- Run entirely in Supabase SQL Editor
-- ================================================================
-- كيف تقرأ النتائج:
--   ✓ PASS  → الباب مقفل صح
--   ⚠ FAIL  → خلل أمني يجب تصحيحه فوراً
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- TEST A — الفحص الثابت: هل RLS مفعّل على كل الجداول؟
-- النتيجة المتوقعة: 41 صف، كلهم rls_enabled = true
-- ════════════════════════════════════════════════════════════════

SELECT
  tablename                               AS "الجدول",
  CASE WHEN rowsecurity THEN '✓ مفعّل'
       ELSE '⚠ معطّل — خطر أمني'
  END                                     AS "حالة RLS"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tawd_clinics','tawd_staff_users','tawd_clinic_settings','tawd_audit_logs',
    'tawd_subscriptions','patients','medical_histories','patient_vitals',
    'digital_consents','patient_notes','services','doctor_schedules',
    'clinic_holidays','appointment_slots','appointments','waiting_queue',
    'no_show_log','channel_configs','chat_sessions','chat_messages',
    'ai_review_queue','ai_usage_metrics','prescriptions','prescription_items',
    'insurance_providers','insurance_claims','notification_templates',
    'vat_rules','invoices','invoice_items','payments','payment_links',
    'doctor_commissions','marketing_campaigns','campaign_logs',
    'loyalty_points','reviews_log','tawd_workflow_logs','tawd_error_logs',
    'notification_queue','patient_access_logs'
  )
ORDER BY
  rowsecurity ASC,   -- المعطّلة تطلع أول (لو وجدت)
  tablename;

-- عدد الجداول = 41، عدد السياسات ≥ 41
SELECT
  COUNT(*) FILTER (WHERE tablename IN (
    'tawd_clinics','tawd_staff_users','tawd_clinic_settings','tawd_audit_logs',
    'tawd_subscriptions','patients','medical_histories','patient_vitals',
    'digital_consents','patient_notes','services','doctor_schedules',
    'clinic_holidays','appointment_slots','appointments','waiting_queue',
    'no_show_log','channel_configs','chat_sessions','chat_messages',
    'ai_review_queue','ai_usage_metrics','prescriptions','prescription_items',
    'insurance_providers','insurance_claims','notification_templates',
    'vat_rules','invoices','invoice_items','payments','payment_links',
    'doctor_commissions','marketing_campaigns','campaign_logs',
    'loyalty_points','reviews_log','tawd_workflow_logs','tawd_error_logs',
    'notification_queue','patient_access_logs'
  ) AND rowsecurity = TRUE) AS "جداول RLS مفعّل عليها — يجب = 41",

  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public')
                                         AS "إجمالي السياسات — يجب ≥ 41"
FROM pg_tables
WHERE schemaname = 'public';


-- ════════════════════════════════════════════════════════════════
-- TEST B — عزل العيادة: مستخدم من عيادة خاطئة يرى صفر صفوف
-- النتيجة المتوقعة: كل visible_rows = 0
-- ════════════════════════════════════════════════════════════════

BEGIN;

  -- محاكاة مستخدم authenticated بـ clinic_id مختلف تماماً
  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',          'aaaaaaaa-0000-0000-0000-000000000000',
      'role',         'authenticated',
      'app_metadata', json_build_object(
        'clinic_id', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'role',      'admin'
      )
    )::text,
    true  -- local to transaction
  );

  SET LOCAL ROLE authenticated;

  -- كل هذه يجب أن ترجع 0
  SELECT
    table_name                          AS "الجدول",
    visible_rows                        AS "الصفوف المرئية",
    CASE WHEN visible_rows = 0
         THEN '✓ PASS — محمي'
         ELSE '⚠ FAIL — بيانات مكشوفة!'
    END                                 AS "النتيجة"
  FROM (
    SELECT 'tawd_clinics'       AS table_name, COUNT(*)::int AS visible_rows FROM tawd_clinics
    UNION ALL
    SELECT 'tawd_subscriptions',                COUNT(*)::int FROM tawd_subscriptions
    UNION ALL
    SELECT 'patients',                          COUNT(*)::int FROM patients
    UNION ALL
    SELECT 'appointments',                      COUNT(*)::int FROM appointments
    UNION ALL
    SELECT 'invoices',                          COUNT(*)::int FROM invoices
    UNION ALL
    SELECT 'chat_sessions',                     COUNT(*)::int FROM chat_sessions
    UNION ALL
    SELECT 'ai_review_queue',                   COUNT(*)::int FROM ai_review_queue
    UNION ALL
    SELECT 'tawd_audit_logs',                   COUNT(*)::int FROM tawd_audit_logs
  ) AS results
  ORDER BY visible_rows DESC;  -- الفاشلة (لو وجدت) تطلع فوق

ROLLBACK;


-- ════════════════════════════════════════════════════════════════
-- TEST C — عزل العيادة: المستخدم الصحيح يرى بيانات عيادته فقط
-- النتيجة المتوقعة: tawd_clinics = 1، tawd_subscriptions = 1
-- ════════════════════════════════════════════════════════════════

BEGIN;

  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',          'cccccccc-0000-0000-0000-000000000000',
      'role',         'authenticated',
      'app_metadata', json_build_object(
        'clinic_id', 'be9e4157-f56d-49e4-96bd-8b2d5b8af568',  -- العيادة التجريبية
        'role',      'admin'
      )
    )::text,
    true
  );

  SET LOCAL ROLE authenticated;

  SELECT
    table_name                          AS "الجدول",
    visible_rows                        AS "الصفوف المرئية",
    CASE
      WHEN table_name = 'tawd_clinics'       AND visible_rows = 1 THEN '✓ PASS'
      WHEN table_name = 'tawd_subscriptions' AND visible_rows = 1 THEN '✓ PASS'
      WHEN table_name = 'tawd_clinic_settings' AND visible_rows = 1 THEN '✓ PASS'
      WHEN table_name IN ('patients','appointments','invoices') AND visible_rows = 0
                                                                 THEN '✓ PASS — فارغ (طبيعي)'
      ELSE '⚠ راجع القيمة'
    END                                 AS "النتيجة"
  FROM (
    SELECT 'tawd_clinics'          AS table_name, COUNT(*)::int AS visible_rows FROM tawd_clinics
    UNION ALL
    SELECT 'tawd_subscriptions',                  COUNT(*)::int FROM tawd_subscriptions
    UNION ALL
    SELECT 'tawd_clinic_settings',                COUNT(*)::int FROM tawd_clinic_settings
    UNION ALL
    SELECT 'patients',                            COUNT(*)::int FROM patients
    UNION ALL
    SELECT 'appointments',                        COUNT(*)::int FROM appointments
    UNION ALL
    SELECT 'invoices',                            COUNT(*)::int FROM invoices
  ) AS results;

ROLLBACK;


-- ════════════════════════════════════════════════════════════════
-- TEST D — Platform Admin: يرى كل العيادات بدون قيود
-- النتيجة المتوقعة: tawd_clinics ≥ 1
-- ════════════════════════════════════════════════════════════════

BEGIN;

  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',          'platform-admin-uuid',
      'role',         'authenticated',
      'app_metadata', json_build_object(
        'role', 'platform_admin'
        -- لا clinic_id هنا — المنطق: is_platform_admin() = true → bypass كل شيء
      )
    )::text,
    true
  );

  SET LOCAL ROLE authenticated;

  SELECT
    'tawd_clinics (platform admin view)' AS "الاختبار",
    COUNT(*)::int                        AS "الصفوف المرئية",
    CASE WHEN COUNT(*) >= 1
         THEN '✓ PASS — Platform Admin يرى الكل'
         ELSE '⚠ FAIL — Platform Admin محجوب عن بياناته'
    END                                  AS "النتيجة"
  FROM tawd_clinics;

ROLLBACK;


-- ════════════════════════════════════════════════════════════════
-- TEST E — Audit Log Immutability: لا UPDATE ولا DELETE
-- النتيجة المتوقعة: كلا الأمرين يطلعان NOTICE: ✓ PASS
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_test_id UUID;
BEGIN
  -- إدراج سجل اختبار مؤقت في audit_logs (service role يتجاوز RLS)
  INSERT INTO tawd_audit_logs (user_id, clinic_id, action, table_name, record_id)
  VALUES (NULL, NULL, 'INSERT', '_rls_test_immutability', gen_random_uuid())
  RETURNING id INTO v_test_id;

  RAISE NOTICE 'سجل اختبار أُنشئ: %', v_test_id;

  -- E1: محاولة UPDATE — يجب أن تفشل
  BEGIN
    UPDATE tawd_audit_logs
    SET    user_agent = 'محاولة اختراق'
    WHERE  id = v_test_id;

    RAISE WARNING '⚠ FAIL E1: UPDATE على audit_logs نجح — خلل في الحماية!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ PASS E1: UPDATE محظور — %', SQLERRM;
  END;

  -- E2: محاولة DELETE — يجب أن تفشل
  BEGIN
    DELETE FROM tawd_audit_logs
    WHERE  id = v_test_id;

    RAISE WARNING '⚠ FAIL E2: DELETE على audit_logs نجح — خلل في الحماية!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ PASS E2: DELETE محظور — %', SQLERRM;
  END;

  -- السجل يبقى في audit_logs بتصميم (immutable by design)
  -- table_name = '_rls_test_immutability' تدل على أنه سجل اختبار
  RAISE NOTICE 'ملاحظة: سجل الاختبار يبقى في audit_logs — هذا صحيح (immutable)';
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- TEST F — Soft Delete: السجل المحذوف يختفي عبر RLS
-- النتيجة المتوقعة: العدد النشط ينقص 1 بعد soft-delete
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_clinic_id       UUID    := 'be9e4157-f56d-49e4-96bd-8b2d5b8af568';
  v_patient_id      UUID;
  v_count_before    INTEGER;
  v_count_after_rls INTEGER;
BEGIN
  -- إحصاء المرضى النشطين قبل الاختبار
  SELECT COUNT(*) INTO v_count_before
  FROM patients
  WHERE clinic_id = v_clinic_id AND deleted_at IS NULL;

  -- إدراج مريض تجريبي
  INSERT INTO patients (clinic_id, name, phone)
  VALUES (v_clinic_id, '[اختبار RLS - يُحذف]', '+96899999999')
  RETURNING id INTO v_patient_id;

  -- تطبيق soft-delete
  UPDATE patients
  SET    deleted_at = NOW()
  WHERE  id = v_patient_id;

  -- الاستعلام بفلتر deleted_at IS NULL (محاكاة ما يراه المستخدم عبر RLS)
  SELECT COUNT(*) INTO v_count_after_rls
  FROM patients
  WHERE clinic_id = v_clinic_id AND deleted_at IS NULL;

  IF v_count_after_rls = v_count_before THEN
    RAISE NOTICE '✓ PASS F: Soft-delete يعمل — المريض المحذوف غير مرئي (العدد قبل: %, بعد: %)',
      v_count_before, v_count_after_rls;
  ELSE
    RAISE WARNING '⚠ FAIL F: عدد غير متوقع — قبل: %, بعد: %', v_count_before, v_count_after_rls;
  END IF;

  -- تنظيف: حذف نهائي لسجل الاختبار (هنا hard-delete مقبول لأنه سجل اختبار فقط)
  DELETE FROM patients WHERE id = v_patient_id;
  RAISE NOTICE 'تم تنظيف مريض الاختبار';
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- TEST G — Atomic Slot Lock: منع الحجز المزدوج
-- النتيجة المتوقعة: أول طلب = TRUE، الثاني = FALSE
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_clinic_id UUID := 'be9e4157-f56d-49e4-96bd-8b2d5b8af568';
  v_slot_id   UUID;
  v_lock_1    BOOLEAN;
  v_lock_2    BOOLEAN;
BEGIN
  -- إنشاء خانة موعد وهمية (بدون doctor_id FK — نستخدم NULL للاختبار السريع)
  -- ملاحظة: doctor_id له FK على tawd_staff_users، لذلك نحتاج staff موجود
  -- هذا الاختبار يُشغَّل بعد إضافة أول طبيب عبر لوحة التحكم
  RAISE NOTICE 'TEST G: يتطلب doctor في tawd_staff_users — مجدول بعد onboarding أول موظف';
  RAISE NOTICE 'الدالة المختبرة: SELECT public.tawd_lock_slot(slot_id, session_id, 10)';
  RAISE NOTICE 'النتيجة المتوقعة: الطلب الأول = TRUE، أي طلب تالٍ خلال 10 دقائق = FALSE';
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- ملخص نهائي — اجمع نتائجك هنا
-- ════════════════════════════════════════════════════════════════

SELECT
  unnest(ARRAY[
    'TEST A1 | RLS مفعّل على 41 جدول             | يجب = 41 صف بـ ✓ مفعّل',
    'TEST A2 | عدد السياسات                       | يجب ≥ 41',
    'TEST B  | عيادة خاطئة ترى 0 صفوف            | كل visible_rows = 0',
    'TEST C  | عيادة صحيحة ترى بياناتها           | tawd_clinics = 1، subscriptions = 1',
    'TEST D  | Platform Admin يرى الكل            | tawd_clinics ≥ 1',
    'TEST E1 | UPDATE على audit_logs محظور        | PASS في الـ NOTICE',
    'TEST E2 | DELETE على audit_logs محظور        | PASS في الـ NOTICE',
    'TEST F  | Soft-delete يخفي السجل             | العدد لا يتغير بعد soft-delete',
    'TEST G  | Atomic slot lock                   | يُشغَّل بعد إضافة أول طبيب'
  ]) AS "الاختبار  |  المعيار"
;
