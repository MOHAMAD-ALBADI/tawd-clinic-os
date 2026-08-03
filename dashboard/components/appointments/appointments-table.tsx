"use client";

import { AppointmentStatusBadge } from "@/components/appointments/status-badge";
import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions";
import { formatDate, formatTime } from "@/lib/utils";
import { Calendar } from "lucide-react";
import type { AppointmentStatus } from "@/types/tawd";

type ApptRow = {
  id: string;
  slot_time: string;
  status: string;
  patient_name: string;
  service_name: string;
  doctor_name: string;
};

export function AppointmentsTable({ appts }: { appts: ApptRow[] }) {
  if (appts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgb(var(--accent-2-rgb) / 0.1)", border: "1px solid rgb(var(--accent-2-rgb) / 0.2)" }}
        >
          <Calendar className="w-8 h-8" style={{ color: "var(--accent-2)" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-white">لا توجد مواعيد</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
            اضغط «موعد جديد» لإضافة أول موعد
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── phone: one card per appointment ──────────────────────────
       *
       * The table is 580px wide. On a 390px screen it scrolled sideways,
       * which meant the doctor's name lived off the edge and the date
       * column was clipped to a single letter. A receptionist checking
       * the day from her phone should not have to drag a table around to
       * read it.
       *
       * Same data, stacked: who and when first, because that is what the
       * question always is. */}
      <div className="sm:hidden divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {appts.map((row) => (
          <div key={row.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{row.patient_name}</p>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                  {row.service_name}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <div className="text-[13px] font-medium ltr-nums text-white">{formatTime(row.slot_time)}</div>
                <div className="text-[11px] ltr-nums mt-0.5" style={{ color: "var(--text-3)" }}>
                  {formatDate(row.slot_time)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <AppointmentStatusBadge status={row.status as AppointmentStatus} />
                <span className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>
                  {row.doctor_name !== "—" ? `د. ${row.doctor_name}` : "—"}
                </span>
              </div>
              <AppointmentRowActions id={row.id} status={row.status} slotTime={row.slot_time} />
            </div>
          </div>
        ))}
      </div>

      {/* ── tablet and up: the table, unchanged ── */}
      <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            {["التاريخ والوقت", "المريض", "الخدمة", "الطبيب", "الحالة", ""].map((h, hi) => (
              <th
                key={hi}
                className="text-right py-3.5 px-5 text-[12px] font-semibold"
                style={{ color: "var(--text-3)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {appts.map((row, i) => (
            <tr
              key={row.id}
              className="transition-all duration-150 cursor-default"
              style={{ borderBottom: i < appts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgb(var(--accent-2-rgb) / 0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            >
              <td className="py-3.5 px-5">
                <div className="font-medium ltr-nums text-white">{formatDate(row.slot_time)}</div>
                <div className="text-xs ltr-nums mt-0.5" style={{ color: "var(--text-3)" }}>
                  {formatTime(row.slot_time)}
                </div>
              </td>
              <td className="py-3.5 px-5 font-semibold text-white">{row.patient_name}</td>
              <td className="py-3.5 px-5" style={{ color: "var(--text-2)" }}>{row.service_name}</td>
              <td className="py-3.5 px-5" style={{ color: "var(--text-2)" }}>
                {row.doctor_name !== "—" ? `د. ${row.doctor_name}` : "—"}
              </td>
              <td className="py-3.5 px-5">
                <AppointmentStatusBadge status={row.status as AppointmentStatus} />
              </td>
              <td className="py-3.5 px-4">
                <AppointmentRowActions id={row.id} status={row.status} slotTime={row.slot_time} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
