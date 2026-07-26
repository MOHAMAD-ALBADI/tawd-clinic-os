"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { saveMyAvatar, removeMyAvatar } from "@/app/actions/profile";

const MAX_EDGE = 512;   // an avatar is never rendered larger than ~96px
const QUALITY = 0.82;

/** Downscale and re-encode in the browser before uploading.

    A phone photo is 4–8MB of 4000px JPEG for something displayed at 40px. Doing
    this client-side means the clinic's connection carries ~40KB instead, the
    upload finishes instantly on a weak link, and the bucket never fills with
    originals nobody will ever see at full size. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/webp", QUALITY)
  );
  if (!blob) return file;
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

export function AvatarPicker({
  currentUrl, name,
}: { currentUrl: string | null; name: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // shown immediately so the face changes the moment the file is chosen
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? currentUrl;
  const initial = (name || "؟").trim().charAt(0);

  async function onPick(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const small = await shrink(file);
      setPreview(URL.createObjectURL(small));
      const fd = new FormData();
      fd.append("avatar", small);
      const r = await saveMyAvatar(fd);
      if (!r.ok) { setErr(r.reason); setPreview(null); return; }
      router.refresh();
    } catch {
      setErr("تعذّر تجهيز الصورة");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setErr(null);
    start(async () => {
      try {
        const r = await removeMyAvatar();
        if (!r.ok) { setErr(r.reason); return; }
        setPreview(null);
        router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const working = busy || pending;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <div
          className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-black"
          style={{
            background: "rgb(var(--accent-1-rgb) / 0.12)",
            border: "1px solid rgb(var(--accent-1-rgb) / 0.28)",
            color: "var(--accent-1)",
          }}
        >
          {shown
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={shown} alt="" className="w-full h-full object-cover" />
            : initial}
        </div>
        {working && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent-1)" }} />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn-ghost" disabled={working}
            onClick={() => inputRef.current?.click()}>
            <Camera className="w-3.5 h-3.5" /> {shown ? "تغيير الصورة" : "رفع صورة"}
          </button>
          {shown && (
            <button type="button" className="btn-ghost" disabled={working} onClick={remove}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} /> حذف
            </button>
          )}
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>
          JPG أو PNG أو WEBP — تُصغَّر تلقائياً قبل الرفع
        </p>
        {err && (
          <p className="flex items-center gap-1.5 text-[11.5px] mt-1.5" style={{ color: "#fda4b4" }}>
            <AlertTriangle className="w-3 h-3 shrink-0" /> {err}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // reset so re-picking the same file still fires onChange
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />
    </div>
  );
}
