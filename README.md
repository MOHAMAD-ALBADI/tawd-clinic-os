# طود · TAWD Clinic OS

نظام إدارة عيادات ذكي متعدد المستأجرين (multi-tenant) — حجوزات، مرضى، فواتير، تقارير، وأتمتة، مع مساعد ذكي **سُرى**.

> Smart multi-tenant clinic management system — appointments, patients, billing, reports, and automation, with an AI assistant (**سُرى**).

## ✨ المزايا
- **لوحات حسب الدور**: مدير العيادة · الطبيب · الاستقبال · المحاسب · مدير المنصة.
- **المواعيد**: حجز، تأكيد، حضور، إعادة جدولة، إلغاء (حذف ناعم).
- **المرضى**: إضافة/تعديل/أرشفة، سجل، نقاط ولاء.
- **الفواتير**: إنشاء ببنود وضريبة، تغيير الحالة، فاتورة PDF قابلة للطباعة.
- **بحث ذكي** لحظي عبر المرضى/الخدمات/الفواتير.
- **سُرى** — مساعد ذكي مدمج.
- تصميم clinical موحّد (teal) · واجهة عربية RTL.

## 🛠 التقنيات
- **Next.js 16** (App Router) · React · TypeScript
- **Supabase** (Postgres + Auth + RLS) — عزل كامل لكل عيادة
- **Tailwind CSS v4** · lucide-react · recharts
- **Vercel** (استضافة + نشر) · **n8n** (أتمتة)

## 🚀 التشغيل محلياً
```bash
cd dashboard
npm install
npm run dev        # Turbopack
```
أنشئ `dashboard/.env.local` بالمتغيرات:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=...
```

## 📂 البنية
```
dashboard/        تطبيق Next.js (الواجهة + server actions)
database/         مخطط قاعدة البيانات والهجرات
n8n-workflows/    سير عمل الأتمتة
docs/             التوثيق
```

## 🔐 الأمان
- جميع الجداول محمية بـ RLS (عزل حسب `clinic_id`).
- **لا حذف نهائي** لأي سجل طبي أو مالي — أرشفة/حذف ناعم فقط.
- المفاتيح السرية في `.env` / متغيرات Vercel — لا تُرفع للمستودع أبداً.

---
<sub>© TAWD — جميع الحقوق محفوظة.</sub>
