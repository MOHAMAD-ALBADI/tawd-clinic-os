import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InventoryBoard, type InvItem, type InvSupplier } from "@/components/inventory/inventory-board";
import { ServiceMaterialsEditor, type SvcOption, type BomRow } from "@/components/inventory/service-materials-editor";
import { PharmacyCounter, type Rx, type RxLine } from "@/components/inventory/pharmacy-counter";
import { Boxes, AlertTriangle, CalendarClock, Wallet } from "lucide-react";

export const metadata = { title: "المخزون والصيدلية — طود" };
export const dynamic = "force-dynamic";

type NameJoin = { name?: string; name_ar?: string } | null;

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v);

export default async function InventoryPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const soon = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);

  const [itemsRes, suppliersRes, expiringRes, servicesRes, bomRes, rxRes] = await Promise.all([
    sb.from("inventory_items")
      .select("id, name, name_ar, category, unit, current_stock, reorder_level, cost_price, tracks_expiry")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).is("deleted_at", null)
      .order("name"),
    sb.from("suppliers")
      .select("id, name").eq("clinic_id", claims.clinic_id).eq("is_active", true)
      .is("deleted_at", null).order("name"),
    sb.from("inventory_batches")
      .select("id, batch_number, qty_remaining, expiry_date, inventory_items!item_id(name, name_ar)")
      .eq("clinic_id", claims.clinic_id).gt("qty_remaining", 0)
      .not("expiry_date", "is", null).lte("expiry_date", soon)
      .order("expiry_date").limit(20),
    sb.from("services")
      .select("id, name, name_ar").eq("clinic_id", claims.clinic_id).eq("is_active", true)
      .order("name_ar"),
    sb.from("service_materials")
      .select("service_id, item_id, qty_per_use").eq("clinic_id", claims.clinic_id),
    /* Signed but not yet handed over — the pharmacy's actual queue. */
    sb.from("prescriptions")
      .select("id, status, created_at, patients!patient_id(name, name_ar), tawd_staff_users!doctor_id(name, name_ar), prescription_items(id, drug_name, drug_name_ar, dosage, frequency, duration, item_id, quantity, dispensed_qty, sort_order)")
      .eq("clinic_id", claims.clinic_id).eq("status", "signed").is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const items: InvItem[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id, name: i.name, name_ar: i.name_ar, category: i.category, unit: i.unit,
    current_stock: n(i.current_stock), reorder_level: n(i.reorder_level),
    cost_price: n(i.cost_price), tracks_expiry: !!i.tracks_expiry,
  }));
  const suppliers: InvSupplier[] = (suppliersRes.data ?? []) as InvSupplier[];
  const services: SvcOption[] = (servicesRes.data ?? []).map((s) => ({
    id: s.id, label: (s.name_ar ?? s.name) as string,
  }));
  const bom: BomRow[] = (bomRes.data ?? []).map((m) => ({
    service_id: m.service_id, item_id: m.item_id, qty_per_use: n(m.qty_per_use),
  }));

  /* Stock levels come from inventory_items, so the pharmacy can warn about a
     short line before the pharmacist reaches for the shelf. */
  const stockById = new Map(items.map((i) => [i.id, i.current_stock]));
  const itemLabel = new Map(items.map((i) => [i.id, i.name_ar || i.name]));

  const prescriptions: Rx[] = (rxRes.data ?? []).map((p) => {
    const pt = p.patients as unknown as NameJoin;
    const dc = p.tawd_staff_users as unknown as NameJoin;
    const rawLines = [...((p.prescription_items ?? []) as unknown as Record<string, unknown>[])]
      .sort((a, b) => (Number(a.sort_order ?? 0) || 0) - (Number(b.sort_order ?? 0) || 0));
    const lines: RxLine[] = rawLines.map((l) => {
      const itemId = (l.item_id as string) ?? null;
      return {
        id: l.id as string,
        drug_name: ((l.drug_name_ar as string) || (l.drug_name as string)) ?? "دواء",
        dosage: (l.dosage as string) ?? "",
        frequency: (l.frequency as string) ?? "",
        duration: (l.duration as string) ?? "",
        item_id: itemId,
        item_name: itemId ? (itemLabel.get(itemId) ?? "") : "",
        quantity: n(l.quantity),
        dispensed_qty: n(l.dispensed_qty),
        in_stock: itemId ? (stockById.get(itemId) ?? 0) : null,
      };
    });

    return {
      id: p.id as string,
      patient_name: pt?.name_ar ?? pt?.name ?? "مريض",
      doctor_name: dc?.name_ar ?? dc?.name ?? "طبيب",
      status: p.status as string,
      created_at: p.created_at as string,
      lines,
    };
  });

  const lowCount = items.filter((i) => i.reorder_level > 0 && i.current_stock <= i.reorder_level).length;
  const invValue = items.reduce((s, i) => s + i.current_stock * i.cost_price, 0);
  const expiring = (expiringRes.data ?? []).map((b) => {
    const it = b.inventory_items as unknown as { name?: string; name_ar?: string } | null;
    const days = Math.round((new Date(b.expiry_date as string).getTime() - Date.now()) / 86400_000);
    return { id: b.id, name: it?.name_ar ?? it?.name ?? "صنف", qty: n(b.qty_remaining), date: b.expiry_date as string, days };
  });

  const kpis = [
    { label: "إجمالي الأصناف", value: String(items.length), Icon: Boxes, color: "var(--accent-1)" },
    { label: "تحت حد الطلب", value: String(lowCount), Icon: AlertTriangle, color: lowCount > 0 ? "#fbbf24" : "var(--text-3)" },
    { label: "تنتهي خلال ٦٠ يوم", value: String(expiring.length), Icon: CalendarClock, color: expiring.length > 0 ? "#fbbf24" : "var(--text-3)" },
    { label: "وصفات بانتظار الصرف", value: String(prescriptions.length), Icon: Boxes, color: prescriptions.length > 0 ? "#38bdf8" : "var(--text-3)" },
    { label: "قيمة المخزون (ر.ع)", value: fmt(invValue), Icon: Wallet, color: "var(--accent-1)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">INVENTORY</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المخزون والصيدلية</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          الأصناف والاستلام والجرد والصلاحية، وصرف الوصفات — يُخصم المخزون تلقائياً مع كل خدمة وكل وصفة
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none text-white" style={{ fontSize: "1.9rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {expiring.length > 0 && (
        <div className="panel" style={{ padding: "1.1rem 1.25rem", border: "1px solid rgba(251,191,36,0.22)" }}>
          <div className="section-title mb-3">
            <CalendarClock className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <h2>دفعات تقترب من الانتهاء</h2>
          </div>
          <div className="space-y-1.5">
            {expiring.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[12px] px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <span className="font-bold text-white">{e.name}</span>
                <span style={{ color: "var(--text-3)" }} className="ltr-nums">
                  {fmt(e.qty)} · تنتهي {e.date}{" "}
                  <span style={{ color: e.days <= 14 ? "#fda4b4" : "#fbbf24" }}>
                    ({e.days <= 0 ? "منتهية" : `خلال ${e.days} يوم`})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PharmacyCounter prescriptions={prescriptions} items={items} />

      <InventoryBoard items={items} suppliers={suppliers} />

      {items.length > 0 && services.length > 0 && (
        <ServiceMaterialsEditor services={services} items={items} materials={bom} />
      )}
    </div>
  );
}
