import Link from "next/link";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";

/* Public legal pages.

   Meta requires a reachable privacy policy and terms URL before it will review
   an app for advanced WhatsApp access, and a clinic's own legal team asks for
   the same before signing. They live outside (protected) on purpose — a policy
   behind a login is a policy nobody can check. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      <header
        className="flex items-center justify-between gap-4 px-5 py-4"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <TawdBarsGlyph size={18} />
          <span className="font-black text-white tracking-tight">طَود</span>
        </Link>
        <nav className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-3)" }}>
          <Link href="/legal/privacy">سياسة الخصوصية</Link>
          <Link href="/legal/terms">شروط الاستخدام</Link>
        </nav>
      </header>

      <main
        className="mx-auto px-5 py-10 legal-doc"
        style={{ maxWidth: 780, color: "var(--text-2)" }}
      >
        {children}
      </main>

      <footer
        className="px-5 py-6 text-center text-[11px]"
        style={{ borderTop: "1px solid var(--hairline)", color: "var(--text-4)" }}
      >
        طَود — نظام إدارة العيادات · سلطنة عُمان
      </footer>
    </div>
  );
}
