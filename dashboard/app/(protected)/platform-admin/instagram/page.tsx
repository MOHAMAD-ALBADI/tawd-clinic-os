import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { IgAgentPanel, type Turn } from "@/components/platform/ig-agent-panel";
import { IgConnect, type ClinicOption } from "@/components/platform/ig-connect";

export const metadata = { title: "سُرى على إنستغرام — طود" };
export const dynamic = "force-dynamic";

/* Sura on Instagram — TAWD's own account, and any clinic's.

   The page used to load "the first agent row" and every conversation ever
   logged, which was right while exactly one account existed. With two it would
   have shown one account's settings above the other's messages. */
export default async function InstagramAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");
  const { account } = await searchParams;

  const sb = await createServiceRoleClient();
  const [{ data: agents }, { data: clinics }] = await Promise.all([
    sb.from("ig_agent")
      .select("ig_user_id, username, persona, is_active, paused, clinic_id, access_token, tawd_clinics!clinic_id(name_ar, name)")
      /* The platform's own account first — it is the one usually being read. */
      .order("clinic_id", { ascending: true, nullsFirst: true }).order("created_at"),
    sb.from("tawd_clinics").select("id, name, name_ar").is("deleted_at", null).order("name_ar"),
  ]);

  const clinicOptions: ClinicOption[] = (clinics ?? []).map((c) => ({
    id: c.id as string,
    label: (c.name_ar ?? c.name) as string,
  }));

  const list = agents ?? [];
  const agent = list.find((a) => a.ig_user_id === account) ?? list[0] ?? null;

  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="eyebrow">INSTAGRAM</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">
          سُرى على إنستغرام
        </h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ترد على من يراسل الحساب — شخصية وذاكرة مستقلة لكل حساب
        </p>
      </div>
      <IgConnect clinics={clinicOptions} />
    </div>
  );

  if (!agent) {
    return (
      <div className="space-y-4 animate-fade-in">
        {header}
        <div className="panel" style={{ padding: "1.5rem" }}>
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
            لا يوجد حساب إنستغرام مربوط بعد — اربط واحداً بالزر أعلاه.
          </p>
        </div>
      </div>
    );
  }

  const igUserId = agent.ig_user_id as string;

  /* This account's turns only, plus the diagnostic rows the webhook writes when
     something arrives and goes nowhere — those belong to no account by
     definition, and hiding them here would hide the one clue that explains a
     silent failure. */
  const { data: turns } = await sb.from("ig_conversations")
    .select("id, sender_id, direction, message_text, status, error, created_at")
    .in("ig_user_id", [igUserId, "__trace__"])
    .order("created_at", { ascending: false }).limit(200);

  const rows: Turn[] = (turns ?? []).map((t) => ({
    id: t.id as string,
    senderId: t.sender_id as string,
    direction: t.direction as string,
    text: t.message_text as string,
    status: t.status as string,
    error: (t.error as string | null) ?? null,
    at: t.created_at as string,
  }));

  const label = (a: (typeof list)[number]) => {
    const c = a.tawd_clinics as unknown as { name_ar?: string; name?: string } | null;
    if (c) return c.name_ar ?? c.name ?? "عيادة";
    return a.username ? `@${a.username}` : "حساب المنصّة";
  };

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      {header}

      {list.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {list.map((a) => {
            const on = a.ig_user_id === igUserId;
            return (
              <Link key={a.ig_user_id as string}
                href={`/platform-admin/instagram?account=${a.ig_user_id}`}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.03)",
                  color: on ? "var(--accent-1)" : "var(--text-3)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.3)" : "var(--hairline)"}`,
                }}>
                {label(a)}
                {!a.is_active && " · موقوف"}
              </Link>
            );
          })}
        </div>
      )}

      <IgAgentPanel
        agent={{
          igUserId,
          username: (agent.username as string | null) ?? null,
          persona: agent.persona as string,
          isActive: !!agent.is_active,
          paused: !!agent.paused,
        }}
        turns={rows}
        /* Reported per-variable so a missing one names itself instead of a
           blanket "not configured". The token is now per-account, so an account
           carrying its own is ready whatever the env var says. */
        ready={{
          token: !!agent.access_token || !!process.env.IG_ACCESS_TOKEN,
          verify: !!process.env.IG_VERIFY_TOKEN,
          secret: !!process.env.IG_APP_SECRET,
        }}
      />
    </div>
  );
}
