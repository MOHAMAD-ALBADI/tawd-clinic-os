"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Stethoscope, FileText, Building2, Users, Loader2 } from "lucide-react";
import { globalSearch, type SearchResult } from "@/app/actions/search";

const ICONS = { patient: User, service: Stethoscope, invoice: FileText, clinic: Building2, staff: Users };
const KIND_LABEL = { patient: "مريض", service: "خدمة", invoice: "فاتورة", clinic: "عيادة", staff: "موظف" };

export function GlobalSearch({ placeholder = "ابحث عن مريض، خدمة، فاتورة..." }: { placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (q.trim().length < 1) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(q);
        setResults(r);
        setOpen(true);
      });
    }, 90);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) {
    setOpen(false); setQ("");
    router.push(href);
  }

  return (
    <div className="relative hidden md:block w-64" ref={boxRef}>
      <div className="relative flex items-center">
        {pending
          ? <Loader2 className="absolute end-3 w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-brand-400)" }} />
          : <Search className="absolute end-3 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-4)" }} />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={placeholder}
          className="field h-8 pe-9 ps-3 text-[13px]"
        />
      </div>

      {open && q.trim().length >= 1 && (
        <div className="absolute top-10 inset-x-0 z-50 panel py-1.5 max-h-96 overflow-y-auto animate-scale-in" style={{ background: "rgba(10,16,26,0.99)" }}>
          {results.length === 0 ? (
            <p className="text-[13px] text-center py-6" style={{ color: "var(--text-3)" }}>
              {pending ? "جارٍ البحث..." : "لا توجد نتائج"}
            </p>
          ) : (
            results.map((r) => {
              const Icon = ICONS[r.kind];
              return (
                <button key={`${r.kind}-${r.id}`} onClick={() => go(r.href)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-right transition-colors hover:bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.18)" }}>
                    <Icon className="w-4 h-4" style={{ color: "var(--color-brand-300)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate">{r.title}</p>
                    <p className="text-[11px] ltr-nums truncate" style={{ color: "var(--text-3)" }}>{r.subtitle}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                    {KIND_LABEL[r.kind]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
