"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { BookingModal } from "@/components/appointments/booking-modal";

type Patient = { id: string; name: string; phone?: string };
type Service = { id: string; name: string; price?: number };
type Doctor  = { id: string; name: string; name_ar?: string };

interface BookingTriggerProps {
  patients: Patient[];
  services: Service[];
  doctors:  Doctor[];
}

export function BookingTrigger({ patients, services, doctors }: BookingTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
        style={{
          background: "linear-gradient(135deg, #0d9488, #0f766e)",
          boxShadow: "0 4px 16px rgba(20,184,166,0.3)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(20,184,166,0.45)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,184,166,0.3)"; }}
      >
        <PlusCircle className="w-4 h-4" />
        حجز موعد جديد
      </button>

      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        patients={patients}
        services={services}
        doctors={doctors}
      />
    </>
  );
}
