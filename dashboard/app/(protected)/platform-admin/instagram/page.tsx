import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { IgAgentPanel, type Turn } from "@/components/platform/ig-agent-panel";

export const metadata = { title: "سُرى على إنستغرام — طود" };
export const dynamic = "force-dynamic";

/* Sura on TAWD's own Instagram.

   Someone messaging the TAWD account had nobody answering, and there was nowhere
   for those messages to land. This is where her voice is edited and every
   conversation she has had can be read back. */
export default async function InstagramAgentPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  const sb = await createServiceRoleClient();
  const [{ data: agent }, { data: turns }] = await Promise.all([
    sb.from("ig_agent")
      .select("ig_user_id, username, persona, is_active, paused")
      .order("created_at").limit(1).maybeSingle(),
    sb.from("ig_conversations")
      .select("id, sender_id, direction, message_text, status, error, created_at")
      .order("created_at", { ascending: false }).limit(200),
  ]);

  if (!agent) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-black text-white tracking-tight">سُرى على إنستغرام</h1>
        <div className="panel" style={{ padding: "1.5rem" }}>
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
            لا يوجد حساب إنستغرام مربوط بعد.
          </p>
        </div>
      </div>
    );
  }

  const rows: Turn[] = (turns ?? []).map((t) => ({
    id: t.id as string,
    senderId: t.sender_id as string,
    direction: t.direction as string,
    text: t.message_text as string,
    status: t.status as string,
    error: (t.error as string | null) ?? null,
    at: t.created_at as string,
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">INSTAGRAM</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">
          سُرى على إنستغرام
        </h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ترد على من يراسل حساب طَود — شخصية وذاكرة مستقلة عن سُرى العيادات
        </p>
      </div>

      <IgAgentPanel
        agent={{
          igUserId: agent.ig_user_id as string,
          username: (agent.username as string | null) ?? null,
          persona: agent.persona as string,
          isActive: !!agent.is_active,
          paused: !!agent.paused,
        }}
        turns={rows}
        /* Reported per-variable so a missing one names itself instead of a
           blanket "not configured". */
        ready={{
          token: !!process.env.IG_ACCESS_TOKEN,
          verify: !!process.env.IG_VERIFY_TOKEN,
          secret: !!process.env.IG_APP_SECRET,
        }}
      />
    </div>
  );
}
