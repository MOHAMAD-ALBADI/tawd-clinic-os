import { TawdLogoMark } from "@/components/shell/tawd-logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "تسجيل الدخول — طود",
};

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#0A0D16" }}
    >
      {/* Mesh gradient depth layers */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "radial-gradient(ellipse 70% 55% at 50% -10%, rgb(var(--accent-2-rgb) / 0.055) 0%, transparent 100%)",
            "radial-gradient(ellipse 60% 50% at 15% 110%, rgba(99,102,241,0.04) 0%, transparent 100%)",
            "radial-gradient(ellipse 40% 40% at 85% 90%, rgb(var(--accent-2-rgb) / 0.025) 0%, transparent 100%)",
          ].join(", "),
          pointerEvents: "none",
        }}
      />

      {/* Fine dot grid overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[420px] rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgb(var(--accent-2-rgb) / 0.06)",
        }}
      >
        {/* Top gold line accent */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgb(var(--accent-2-rgb) / 0.45), transparent)",
          }}
        />

        <div className="px-8 pt-10 pb-8">
          {/* Logo area */}
          <div className="flex flex-col items-center mb-10">
            {/* Ambient glow disk behind logo */}
            <div className="relative flex items-center justify-center mb-5">
              {/* Outer diffuse glow */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "radial-gradient(ellipse, rgb(var(--accent-2-rgb) / 0.13) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* Logo container */}
              <div
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(145deg, rgb(var(--accent-2-rgb) / 0.1) 0%, rgba(13,13,15,0.8) 100%)",
                  border: "1px solid rgb(var(--accent-2-rgb) / 0.22)",
                  boxShadow: [
                    "0 0 0 1px rgb(var(--accent-2-rgb) / 0.08)",
                    "0 0 32px rgb(var(--accent-2-rgb) / 0.15)",
                    "0 8px 32px rgba(0,0,0,0.5)",
                    "inset 0 1px 0 rgb(var(--accent-1-rgb) / 0.1)",
                  ].join(", "),
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Inner top shimmer */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "45%",
                    background: "linear-gradient(180deg, rgb(var(--accent-1-rgb) / 0.07) 0%, transparent 100%)",
                    borderRadius: "22px 22px 0 0",
                    pointerEvents: "none",
                  }}
                />
                <TawdLogoMark className="w-12 h-[52px] relative z-10" />
              </div>
            </div>

            {/* System name */}
            <h1
              className="font-black leading-none mb-1"
              style={{
                fontSize: 40,
                letterSpacing: "-0.05em",
                background: "linear-gradient(135deg, #cbf6ef 0%, var(--accent-1) 35%, var(--accent-2) 70%, var(--accent-2) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              طود
            </h1>

            <p
              className="text-[12.5px] font-medium mt-1"
              style={{
                color: "var(--text-3)",
                letterSpacing: "0.025em",
              }}
            >
              نظام إدارة العيادات الذكي
            </p>

            {/* Divider */}
            <div
              className="w-24 mt-5"
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, rgb(var(--accent-2-rgb) / 0.2), transparent)",
              }}
            />
          </div>

          {/* Login form */}
          <LoginForm />
        </div>

        {/* Footer */}
        <div
          className="px-8 py-3.5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-4)" }}>
            مدعوم بـ سُرى AI
          </p>
          <p
            className="text-[10px] font-bold tracking-[0.15em]"
            style={{ color: "rgb(var(--accent-2-rgb) / 0.2)" }}
          >
            TAWD OS
          </p>
        </div>
      </div>
    </main>
  );
}
