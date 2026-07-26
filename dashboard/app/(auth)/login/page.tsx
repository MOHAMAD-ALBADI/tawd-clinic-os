import { TawdLogoMark } from "@/components/shell/tawd-logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "تسجيل الدخول — طود",
};

/* Rebuilt.
 *
 * The old version stacked a card inside a card, so the form sat in a narrow
 * boxed column with the outer shell doing nothing but adding a border. Around
 * it were five decorative layers — a mesh gradient, a dot grid, a glow disk
 * behind the logo, an inner shimmer, a top accent line and a divider — none of
 * which said anything, and all of which competed with the two fields that are
 * the entire point of the page.
 *
 * One surface now, wider and calmer. The single deliberate flourish is the
 * three ascending bars under the wordmark: that is the logo's own form, and
 * طَود means a mountain, so a rising silhouette is the one ornament here that
 * carries meaning instead of decoration.
 */
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full" style={{ maxWidth: 400 }}>
        {/* Brand, above the card — the card is for the task, not the identity */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="flex items-center justify-center mb-4"
            style={{
              width: 62,
              height: 62,
              borderRadius: 18,
              background: "rgb(var(--accent-2-rgb) / 0.1)",
              border: "1px solid rgb(var(--accent-1-rgb) / 0.24)",
            }}
          >
            <TawdLogoMark className="w-9 h-9" />
          </div>

          <h1
            className="font-black leading-none text-white"
            style={{ fontSize: 34, letterSpacing: "-0.04em" }}
          >
            طود
          </h1>

          {/* The mark's three bars, rising. The only ornament on the page. */}
          <div className="flex items-end gap-[3px] mt-3" aria-hidden>
            {[7, 12, 17].map((h, i) => (
              <span
                key={h}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  background: "var(--accent-1)",
                  opacity: 0.3 + i * 0.28,
                }}
              />
            ))}
          </div>

          <p className="text-[12px] mt-3" style={{ color: "var(--text-3)" }}>
            نظام إدارة العيادات
          </p>
        </div>

        <div className="panel" style={{ padding: "1.75rem" }}>
          <LoginForm />
        </div>

        <p className="text-[11px] text-center mt-5" style={{ color: "var(--text-4)" }}>
          مدعوم بـ سُرى — المساعدة الذكية للعيادات
        </p>
      </div>
    </main>
  );
}
