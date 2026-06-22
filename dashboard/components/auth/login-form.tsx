"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/lib/auth/role-redirect";
import type { Role } from "@/types/tawd";

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

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    const role = (data.user.app_metadata?.role ?? "clinic_admin") as Role;
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  return (
    <div
      className="rounded-2xl border p-8 shadow-2xl backdrop-blur-sm"
      style={{
        background: "rgba(255,255,255,0.06)",
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <h2 className="text-white text-xl font-semibold text-center mb-6">
        تسجيل الدخول
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-teal-100">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@clinic.com"
            required
            dir="ltr"
            className="w-full h-10 px-3 rounded-lg text-sm text-white placeholder:text-white/30 outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-tawd-500)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-teal-100">
            كلمة المرور
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full h-10 px-3 rounded-lg text-sm text-white placeholder:text-white/30 outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--color-tawd-500)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")
            }
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl text-white font-semibold text-sm transition-all mt-2 disabled:opacity-60"
          style={{ background: "var(--color-tawd-600)" }}
          onMouseEnter={(e) =>
            !loading && (e.currentTarget.style.background = "var(--color-tawd-700)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--color-tawd-600)")
          }
        >
          {loading ? "جاري التحقق..." : "دخول →"}
        </button>
      </form>
    </div>
  );
}
