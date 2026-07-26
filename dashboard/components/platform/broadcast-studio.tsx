"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send, Users, AlertTriangle, CheckCircle2, Loader2, Filter, Eye,
  MessageCircle, History, ChevronDown, PhoneOff, FlaskConical,
} from "lucide-react";
import {
  previewAudience, sendBroadcast, sendBroadcastTest, broadcastDetail,
} from "@/app/actions/platform-broadcast";
import {
  type AudienceFilter, STATUS_AR, TOKENS, PRESETS, audienceLabel, resolveBody,
} from "@/lib/broadcast-audience";

export type PastBroadcast = {
  id: string; title: string; body: string; audience_label: string | null;
  total: number; sent_count: number; failed_count: number; created_at: string;
};

type PreviewRow = {
  clinicId: string; label: string; plan: string; status: string; daysLeft: number | null;
};

const STATUSES = ["trial", "active", "suspended"] as const;
const WHEN = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function BroadcastStudio({
  history, plans, myPhone,
}: { history: PastBroadcast[]; plans: string[]; myPhone: string | null }) {
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<AudienceFilter>({ statuses: ["active", "trial"] });

  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [noPhone, setNoPhone] = useState(0);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [showList, setShowList] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ sent: number; fails: { label: string; error?: string }[] } | null>(null);

  const [testPhone, setTestPhone] = useState(myPhone ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { clinic_label: string; sent: boolean; error: string | null }[]>>({});

  /* The audience is resolved on the server by the same function the send uses,
     so the number on the button is the number of messages that will go out. */
  useEffect(() => {
    let alive = true;
    setLoadingAudience(true);
    previewAudience(filter)
      .then((r) => { if (alive) { setRows(r.recipients); setNoPhone(r.skippedNoPhone); } })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoadingAudience(false); });
    return () => { alive = false; };
  }, [filter]);

  const count = rows?.length ?? 0;
  const sample = rows?.[0];
  const preview = useMemo(
    () => (sample
      ? resolveBody(body, { ...sample, phone: "" })
      : body.replaceAll("{{clinic}}", "عيادة النور").replaceAll("{{plan}}", "Pro").replaceAll("{{days}}", "٧")),
    [body, sample],
  );

  function toggle(key: "statuses" | "plans", value: string) {
    setFilter((f) => {
      const cur: string[] = f[key] ?? [];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...f, [key]: next.length ? next : undefined };
    });
  }

  function insertToken(t: string) {
    const el = boxRef.current;
    if (!el) { setBody((b) => b + t); return; }
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + t + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.length, s + t.length); });
  }

  function usePreset(p: (typeof PRESETS)[number]) {
    setTitle(p.label);
    setBody(p.body);
    setFilter(p.filter);
    setResult(null);
    setConfirm(false);
  }

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 5000); }

  function test() {
    setErr(null);
    start(async () => {
      const r = await sendBroadcastTest(body, testPhone);
      if (!r.ok) { setErr(r.reason); return; }
      ok("وصلت رسالة الاختبار — راجعها قبل الإرسال للعيادات");
    });
  }

  function send() {
    setErr(null); setResult(null);
    start(async () => {
      const r = await sendBroadcast({ title, body, filter });
      if (!r.ok) { setErr(r.reason); setConfirm(false); return; }
      setResult({
        sent: r.sentCount,
        fails: r.results.filter((x) => !x.sent).map((x) => ({ label: x.label, error: x.error })),
      });
      setConfirm(false);
      setBody(""); setTitle("");
    });
  }

  function openDetail(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (detail[id]) return;
    void broadcastDetail(id).then((r) => {
      setDetail((d) => ({
        ...d,
        [id]: r.targets.map((t) => ({
          clinic_label: t.clinic_label as string,
          sent: t.sent as boolean,
          error: (t.error as string | null) ?? null,
        })),
      }));
    });
  }

  return (
    <div className="space-y-4">
      {/* one click for the sends that actually get made */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => usePreset(p)} title={p.hint}
            className="text-[12px] font-bold px-3 py-2 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}>
            {p.label}
            <span className="block text-[10px] font-normal mt-0.5" style={{ color: "var(--text-4)" }}>{p.hint}</span>
          </button>
        ))}
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-[13px] px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* ── audience ── */}
        <div className="col-span-12 lg:col-span-5 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-1">
            <Filter className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الجمهور</h2>
          </div>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>{audienceLabel(filter)}</p>

          <Group label="الحالة">
            {STATUSES.map((s) => (
              <Chip key={s} on={!!filter.statuses?.includes(s)} onClick={() => toggle("statuses", s)}>
                {STATUS_AR[s]}
              </Chip>
            ))}
          </Group>

          {plans.length > 0 && (
            <Group label="الباقة">
              {plans.map((p) => (
                <Chip key={p} on={!!filter.plans?.includes(p)} onClick={() => toggle("plans", p)}>{p}</Chip>
              ))}
            </Group>
          )}

          <Group label="الاشتراك">
            {([[7, "ينتهي خلال ٧ أيام"], [30, "ينتهي خلال ٣٠ يوم"], [0, "منتهٍ فعلاً"]] as const).map(([d, label]) => (
              <Chip key={d} on={filter.expiringWithinDays === d}
                onClick={() => setFilter((f) => ({ ...f, expiringWithinDays: f.expiringWithinDays === d ? undefined : d }))}>
                {label}
              </Chip>
            ))}
          </Group>

          <Group label="الاستخدام">
            {([7, 14, 30] as const).map((d) => (
              <Chip key={d} on={filter.idleDays === d}
                onClick={() => setFilter((f) => ({ ...f, idleDays: f.idleDays === d ? undefined : d }))}>
                خاملة {d}+ يوم
              </Chip>
            ))}
            <Chip on={!!filter.whatsappLinkedOnly}
              onClick={() => setFilter((f) => ({ ...f, whatsappLinkedOnly: !f.whatsappLinkedOnly }))}>
              <MessageCircle className="w-3 h-3" /> واتساب مربوط
            </Chip>
          </Group>

          <div className="rounded-xl px-3.5 py-3 mt-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-2">
              {loadingAudience
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-3)" }} />
                : <Users className="w-4 h-4" style={{ color: "var(--accent-1)" }} />}
              <span className="text-[20px] font-black ltr-nums text-white">{count}</span>
              <span className="text-[12px]" style={{ color: "var(--text-2)" }}>عيادة ستستلم الرسالة</span>
            </div>
            {noPhone > 0 && (
              <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: "#fbbf24" }}>
                <PhoneOff className="w-3 h-3 shrink-0" />
                {noPhone} عيادة مستبعدة — بلا رقم هاتف. أضف الرقم من ملف العيادة
              </p>
            )}
            {count > 0 && (
              <button className="text-[11px] mt-2 underline" style={{ color: "var(--text-3)" }}
                onClick={() => setShowList((v) => !v)}>
                {showList ? "إخفاء القائمة" : "عرض من ستصلهم"}
              </button>
            )}
            {showList && rows && (
              <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
                {rows.map((r) => (
                  <div key={r.clinicId} className="flex items-center justify-between gap-2 text-[11.5px] px-2 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span className="truncate text-white">{r.label}</span>
                    <span className="shrink-0" style={{ color: "var(--text-4)" }}>
                      {r.plan}{r.daysLeft != null && <span className="ltr-nums"> · {r.daysLeft}ي</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── message ── */}
        <div className="col-span-12 lg:col-span-7 panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <Send className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الرسالة</h2>
          </div>

          <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>
            عنوان داخلي — لك أنت في السجل، لا يُرسل
          </label>
          <input className="field mb-3" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="تذكير تجديد — يوليو" />

          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>أدرج:</span>
            {TOKENS.map((t) => (
              <button key={t.token} onClick={() => insertToken(t.token)}
                className="text-[11px] font-bold px-2 py-1 rounded-lg"
                style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.22)", color: "var(--accent-1)" }}>
                {t.label}
              </button>
            ))}
          </div>
          <textarea ref={boxRef} className="field" rows={6} style={{ resize: "vertical" }}
            value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="مرحباً {{clinic}} 👋" />
          <p className="text-[10.5px] mt-1 ltr-nums text-end" style={{ color: body.length > 900 ? "#fbbf24" : "var(--text-4)" }}>
            {body.length} / 1024
          </p>

          {body.trim() && (
            <div className="rounded-xl px-3.5 py-3 mt-2"
              style={{ background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.18)" }}>
              <p className="flex items-center gap-1.5 text-[10.5px] mb-1.5" style={{ color: "var(--text-4)" }}>
                <Eye className="w-3 h-3" />
                كما ستصل {sample ? sample.label : "لعيادة"}
              </p>
              <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--text-1)" }}>{preview}</p>
            </div>
          )}

          {/* Send it to yourself first. Every token bug is invisible until a real
              message renders it. */}
          <div className="flex items-end gap-2 mt-3 flex-wrap">
            <div className="flex-1" style={{ minWidth: 160 }}>
              <label className="block text-[11.5px] mb-1.5" style={{ color: "var(--text-3)" }}>اختبار على رقمك</label>
              <input className="field ltr-nums" dir="ltr" value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)} placeholder="968xxxxxxxx" />
            </div>
            <button className="btn-ghost" disabled={pending || !body.trim() || !testPhone.trim()} onClick={test}>
              <FlaskConical className="w-3.5 h-3.5" /> إرسال تجريبي
            </button>
          </div>

          {result && (
            <div className="rounded-xl px-3.5 py-3 mt-3"
              style={{ background: "rgb(var(--accent-1-rgb) / 0.07)", border: "1px solid rgb(var(--accent-1-rgb) / 0.2)" }}>
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--accent-1)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> وصلت لـ {result.sent} عيادة
              </p>
              {result.fails.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.fails.map((f, i) => (
                    <p key={i} className="text-[11px]" style={{ color: "#fbbf24" }}>
                      {f.label} — {f.error ?? "لم تصل"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {confirm ? (
            <div className="rounded-xl px-3.5 py-3 mt-3"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)" }}>
              <p className="text-[12.5px] mb-3" style={{ color: "#fbbf24" }}>
                ستصل هذه الرسالة إلى <span className="font-black ltr-nums">{count}</span> صاحب عيادة الآن. لا يمكن سحبها.
              </p>
              <div className="flex items-center gap-2">
                <button className="btn-primary" disabled={pending} onClick={send}>
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {pending ? "جارٍ الإرسال…" : "نعم، أرسل"}
                </button>
                <button className="btn-ghost" disabled={pending} onClick={() => setConfirm(false)}>تراجع</button>
              </div>
            </div>
          ) : (
            <button className="btn-primary w-full mt-3" disabled={pending || !body.trim() || count === 0}
              onClick={() => setConfirm(true)}>
              <Send className="w-4 h-4" /> إرسال لـ {count} عيادة
            </button>
          )}

          <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-4)" }}>
            خارج نافذة ٢٤ ساعة قد تطلب Meta قالباً معتمداً — يظهر سبب كل رسالة لم تصل
          </p>
        </div>
      </div>

      {/* ── history ── */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-1">
          <History className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>ما أُرسل سابقاً</h2>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
          كل حملة ومن استلمها — الجواب على «هل أبلغناهم؟»
        </p>

        {history.length === 0 ? (
          <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>لم تُرسل حملات بعد</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <button className="w-full flex items-center gap-3 px-3.5 py-2.5 text-start"
                  onClick={() => openDetail(h.id)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{h.title}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                      {h.audience_label ?? "—"} · {WHEN.format(new Date(h.created_at))}
                    </p>
                  </div>
                  <span className="text-[11.5px] ltr-nums shrink-0" style={{ color: "var(--accent-1)" }}>
                    {h.sent_count}/{h.total}
                  </span>
                  {h.failed_count > 0 && (
                    <span className="badge badge-bad shrink-0 ltr-nums">{h.failed_count} فشل</span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
                    style={{ color: "var(--text-4)", transform: openId === h.id ? "rotate(180deg)" : undefined }} />
                </button>

                {openId === h.id && (
                  <div className="px-3.5 pb-3" style={{ borderTop: "1px solid var(--hairline-2)" }}>
                    <p className="text-[12px] whitespace-pre-wrap py-2.5" style={{ color: "var(--text-2)" }}>{h.body}</p>
                    {!detail[h.id] ? (
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>جارٍ التحميل…</p>
                    ) : (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {detail[h.id].map((t, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[11.5px] px-2 py-1 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.02)" }}>
                            <span className="truncate text-white">{t.clinic_label}</span>
                            <span className="shrink-0" style={{ color: t.sent ? "#34d399" : "#fda4b4" }}>
                              {t.sent ? "وصلت" : (t.error ?? "لم تصل")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] mb-1.5" style={{ color: "var(--text-4)" }}>{label}</p>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
      style={{
        background: on ? "rgb(var(--accent-1-rgb) / 0.13)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.34)" : "var(--hairline)"}`,
        color: on ? "var(--accent-1)" : "var(--text-3)",
      }}>
      {children}
    </button>
  );
}
