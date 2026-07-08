"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { PatientImport } from "./patient-import";

/** Button + modal wrapper — used in clinic patients page and platform clinic file. */
export function ImportTrigger({ clinicId, label = "استيراد Excel/CSV" }: { clinicId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        <FileSpreadsheet className="w-4 h-4" />
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl p-5" style={{ background: "#131315", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}>
            <PatientImport clinicId={clinicId} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
