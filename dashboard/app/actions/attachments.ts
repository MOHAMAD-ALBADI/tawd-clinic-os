"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CATS = new Set(["xray", "report", "image", "document", "general"]);

/** Record an already-uploaded file's metadata (upload happens client-side via
    Storage RLS so the bytes go straight to the clinic's isolated folder). */
export async function recordAttachment(input: {
  patientId: string;
  filePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  category?: string;
}) {
  const claims = await getUserClaims();
  if (!claims || !["clinic_admin", "doctor"].includes(claims.role)) {
    return { ok: false as const, reason: "غير مصرح" };
  }
  /* the storage path MUST start with this clinic's id — defense in depth */
  if (!input.filePath.startsWith(`${claims.clinic_id}/`)) {
    return { ok: false as const, reason: "مسار الملف غير صالح" };
  }

  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("patient_attachments").insert({
    clinic_id: claims.clinic_id,
    patient_id: input.patientId,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes ?? null,
    category: CATS.has(input.category ?? "") ? input.category : "general",
    uploaded_by: claims.sub,
  });
  if (error) return { ok: false as const, reason: error.message };

  revalidatePath(`/doctor/patients/${input.patientId}`);
  revalidatePath(`/clinic-admin/patients/${input.patientId}`);
  return { ok: true as const };
}

/** Short-lived signed URL to view/download a private attachment. */
export async function getAttachmentUrl(attachmentId: string) {
  const claims = await getUserClaims();
  if (!claims) return { ok: false as const, reason: "غير مصرح" };

  const sb = await createServerSupabaseClient(); // RLS ensures it's this clinic's row
  const { data: att } = await sb
    .from("patient_attachments").select("file_path").eq("id", attachmentId).maybeSingle();
  if (!att) return { ok: false as const, reason: "الملف غير موجود" };

  const { data, error } = await sb.storage.from("patient-files").createSignedUrl(att.file_path, 300);
  if (error || !data) return { ok: false as const, reason: "تعذّر توليد الرابط" };
  return { ok: true as const, url: data.signedUrl };
}

/** Delete an attachment (row + object). */
export async function deleteAttachment(attachmentId: string) {
  const claims = await getUserClaims();
  if (!claims || !["clinic_admin", "doctor"].includes(claims.role)) {
    return { ok: false as const, reason: "غير مصرح" };
  }
  const sb = await createServerSupabaseClient();
  const { data: att } = await sb
    .from("patient_attachments").select("id, file_path, patient_id").eq("id", attachmentId).maybeSingle();
  if (!att) return { ok: false as const, reason: "غير موجود" };

  await sb.storage.from("patient-files").remove([att.file_path]);
  const { error } = await sb.from("patient_attachments").delete().eq("id", attachmentId);
  if (error) return { ok: false as const, reason: error.message };

  revalidatePath(`/doctor/patients/${att.patient_id}`);
  revalidatePath(`/clinic-admin/patients/${att.patient_id}`);
  return { ok: true as const };
}
