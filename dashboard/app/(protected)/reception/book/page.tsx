import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { Calendar } from "lucide-react";

export const metadata = { title: "حجز موعد — طود" };

export default async function BookPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "receptionist") redirect("/login");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>حجز موعد</h2>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>إضافة موعد جديد للمريض</p>
      </div>

      <div
        className="rounded-2xl flex flex-col items-center justify-center py-24 gap-4"
        style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "#F0FDF4" }}>
          <Calendar className="w-8 h-8" style={{ color: "#14b8a6" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>نموذج الحجز</p>
          <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>سيتوفر قريباً</p>
        </div>
      </div>
    </div>
  );
}
