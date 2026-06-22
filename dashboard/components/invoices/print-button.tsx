"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      <Printer className="w-4 h-4" />
      حفظ PDF / طباعة
    </button>
  );
}
