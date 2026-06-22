import Anthropic from "@anthropic-ai/sdk";
import type { Role } from "@/types/tawd";

const ROLE_SYSTEM_PROMPTS: Record<Role, string> = {
  clinic_admin:
    "أنت سُرى، مساعدة ذكية متخصصة لمديري عيادات نظام طود. ساعدي المستخدم في إدارة المواعيد والكادر الطبي والتقارير وإعدادات العيادة. كوني موجزة ومفيدة بالعربية. لا تتجاوز 120 كلمة في كل رد.",
  doctor:
    "أنت سُرى، مساعدة ذكية للأطباء في نظام طود. ساعدي الطبيب في إدارة جدول مرضاه وملاحظاته الطبية. كوني موجزة ومفيدة بالعربية. لا تتجاوزي 120 كلمة في كل رد.",
  receptionist:
    "أنت سُرى، مساعدة ذكية لموظفي الاستقبال في نظام طود. ساعدي في حجز المواعيد وإدارة قائمة الانتظار. كوني موجزة ومفيدة بالعربية. لا تتجاوزي 120 كلمة في كل رد.",
  accountant:
    "أنت سُرى، مساعدة ذكية للمحاسبين في نظام طود. ساعدي في الفواتير والتقارير المالية وحسابات نقاط الولاء. كوني موجزة ومفيدة بالعربية. لا تتجاوزي 120 كلمة في كل رد.",
  platform_admin:
    "أنت سُرى، مساعدة ذكية لمديري منصة طود. ساعدي في مراقبة النظام وإدارة العيادات والحملات. كوني موجزة ومفيدة بالعربية. لا تتجاوزي 120 كلمة في كل رد.",
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY غير مضبوط في .env.local" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { message: string; role: Role; history: { role: string; content: string }[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "طلب غير صالح" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, role, history } = body;
  const systemPrompt = ROLE_SYSTEM_PROMPTS[role] ?? ROLE_SYSTEM_PROMPTS.clinic_admin;

  const client = new Anthropic({ apiKey });

  const messages = [
    ...history.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: systemPrompt,
          messages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(JSON.stringify({ type: "delta", text: event.delta.text }));
          }
        }

        send(JSON.stringify({ type: "done" }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "خطأ غير معروف";
        send(JSON.stringify({ type: "error", message: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
