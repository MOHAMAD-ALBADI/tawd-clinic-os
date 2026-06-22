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
          style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}
        >
          <Calendar className="w-8 h-8" style={{ color: "#14b8a6" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-white">لا توجد مواعيد</p>
          <p className="text-sm mt-1" style={{ color: "rgba(148,163,184,0.6)" }}>
            اضغط "موعد جديد" لإضافة أول موعد
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            {["التاريخ والوقت", "المريض", "الخدمة", "الطبيب", "الحالة", ""].map((h, hi) => (
              <th
                key={hi}
                className="text-right py-3.5 px-5 text-[12px] font-semibold"
                style={{ color: "rgba(148,163,184,0.6)" }}
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
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            >
              <td className="py-3.5 px-5">
                <div className="font-medium ltr-nums text-white">{formatDate(row.slot_time)}</div>
                <div className="text-xs ltr-nums mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>
                  {formatTime(row.slot_time)}
                </div>
              </td>
              <td className="py-3.5 px-5 font-semibold text-white">{row.patient_name}</td>
              <td className="py-3.5 px-5" style={{ color: "rgba(148,163,184,0.7)" }}>{row.service_name}</td>
              <td className="py-3.5 px-5" style={{ color: "rgba(148,163,184,0.7)" }}>
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
  );
}
