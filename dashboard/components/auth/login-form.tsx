"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/lib/auth/role-redirect";
import type { Role } from "@/types/tawd";

/* No card here. The page provides one; this used to add a second inside it,
   which is why the form looked boxed-in and cramped. */

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      /* Deliberately does not say which of the two was wrong: telling an
         attacker that an email exists is how you hand them half the answer. */
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    const role = (data.user.app_metadata?.role ?? "clinic_admin") as Role;
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
          البريد الإلكتروني
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@clinic.om"
          required
          dir="ltr"
          autoComplete="email"
          className="field ltr-nums"
          style={{ height: 44 }}
        />
      </label>

      <label className="block">
        <span className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
          كلمة المرور
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          dir="ltr"
          autoComplete="current-password"
          className="field"
          style={{ height: 44 }}
        />
      </label>

      {error && (
        <div
          className="flex items-center gap-2 text-[12.5px] px-3.5 py-2.5 rounded-xl"
          role="alert"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fda4b4" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* .btn-primary rather than an inline background. The old inline style
          referenced var(--color-tawd-600) — a token from a naming scheme that
          no longer exists, so it resolved to nothing and the most important
          button in the product rendered with no fill at all. */}
      <button type="submit" disabled={loading} className="btn-primary w-full" style={{ height: 46 }}>
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحقق…</>
        ) : (
          <>دخول <ArrowLeft className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );
}
