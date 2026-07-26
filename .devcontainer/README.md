# تشغيل المشروع على GitHub Codespaces

الجهاز المحلي فيه ٣.٨ جيجا رام، وهذا أقل مما يحتاجه `tsc` على هذا المشروع —
ينهار قبل أن ينهي الفحص. الـ Codespace يعطي ١٦ جيجا، فيشتغل كل شيء طبيعي.

## الفتح

من صفحة المستودع على GitHub: **Code ← Codespaces ← Create codespace on main**.

أول مرة تأخذ ٢–٣ دقائق (تنزيل الصورة + `npm install`). بعدها تفتح خلال ثوانٍ.

## المفاتيح — خطوة إلزامية

`.env.local` غير مرفوع للمستودع (وهذا صحيح — فيه مفتاح خدمة يتجاوز كل قيود
الوصول). بدونه لن تعمل اللوحة داخل الـ Codespace.

اضبطها مرة واحدة كأسرار للمستودع:
`Settings ← Secrets and variables ← Codespaces ← New repository secret`

| المفتاح | من أين |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ← Project Settings ← API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | نفس الصفحة |
| `SUPABASE_SERVICE_ROLE_KEY` | نفس الصفحة — **لا تشاركه إطلاقاً** |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` للتطوير |
| `N8N_API_KEY` | n8n ← Settings ← API |
| `N8N_BASE_URL` | يجب أن ينتهي بـ `/api/v1` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog ← Project Settings |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |

الأسرار تصل كمتغيّرات بيئة تلقائياً في كل Codespace جديد. لو فضّلت الطريقة
اليدوية: انسخ محتوى `.env.local` من جهازك إلى `dashboard/.env.local` داخل
الـ Codespace (لن يُرفع — مستثنى في `.gitignore`).

## الأوامر

```bash
cd dashboard
npm run typecheck   # الفحص الذي يفشل محلياً
npm run dev         # خادم التطوير على المنفذ 3000
npm run build       # نفس ما يشغّله Vercel
```

المنفذ ٣٠٠٠ محوّل تلقائياً وخصوصي. **لا تجعله عاماً (public)** — اللوحة تصل
إلى قاعدة بيانات عيادة حقيقية، ورابط عام يعني وصولاً مفتوحاً لبيانات مرضى.

## التكلفة

الحساب الشخصي المجاني فيه رصيد ساعات شهري (يُحتسب بعدد الأنوية × الساعات)،
والـ Codespace يتوقف تلقائياً بعد ٣٠ دقيقة خمول. احذفه من
`github.com/codespaces` إذا ما راح تستعمله فترة، لأن التخزين يُحتسب أيضاً.
راجع رصيدك في `Settings ← Billing`.

## ملاحظة

هذا لا يلغي أن بناء Vercel يبقى بوابة الفحص عند كل دفعة — الـ Codespace يجعل
الفحص ممكناً *قبل* الدفع بدل الاعتماد على البناء وحده.
