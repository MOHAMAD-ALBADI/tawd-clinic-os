-- ================================================================
-- TAWD — Hotfix: tawd_audit_trigger
-- المشكلة: مشغّل ? يعمل على JSONB فقط، لكن OLD/NEW هي RECORD
-- الحل: to_jsonb(OLD/NEW) أولاً، ثم نطبّق المشغّلات على النتيجة
-- شغّل هذا الملف في Supabase SQL Editor
-- ================================================================

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
  -- Convert RECORD → JSONB first (OLD/NEW are RECORD types, not JSONB)
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

-- تحقق من أن الدالة تُحدِّث بنجاح
SELECT
  routine_name                     AS "الدالة",
  routine_type                     AS "النوع",
  security_type                    AS "الأمان",
  'تم الإصلاح ✓'                  AS "الحالة"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'tawd_audit_trigger';
