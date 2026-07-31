"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send, Check, Calendar, Sparkles,
  CalendarCheck, UserRound, BellRing, ReceiptText,
} from "lucide-react";
import { useSite } from "@/components/site/lang";
import { homeContent } from "@/lib/site/content/home";

/* Sura, drivable.

   Every other element on this page describes the product. This one hands it
   over: the visitor types, and the schedule behind the conversation changes —
   or does not, when the message was a question rather than a booking. That
   distinction is the entire argument for an agent over a chatbot, and it is
   far more convincing shown than claimed.

   Deliberately NOT wired to the live model. Three reasons, in order of weight:
   an open text box on a public page is an open invitation to burn the API key;
   a model call adds two seconds of latency to the one moment that has to feel
   instant; and a real model on a marketing page can say something about pricing
   or treatment that we would then have to stand behind. The intent matching
   below is small, honest about what it is, and answers from the same clinic
   data the rest of the page uses.

   Sura in production does call the model, with the clinic's full context. This
   is a demonstration of the shape of the interaction, not a stand-in for it. */

type Msg = { who: "them" | "sura"; text: string };
type Booking = { service: string; doctor: string; time: string; date: string } | null;

const KB = {
  ar: {
    hours: "دوامنا من الأحد إلى الخميس، ٩:٠٠ صباحاً حتى ٦:٠٠ مساءً.\n\nوسُرى تردّ في أي وقت — حتى بعد الإغلاق.",
    price: "التنظيف والتلميع ١٥ ر.ع، والكشف ٥ ر.ع.\n\nتحبّ أثبّت لك موعداً؟",
    where: "نستقبلك في العيادة، والموقع يوصلك على واتساب مع تأكيد الموعد.",
    greet: "أهلاً وسهلاً 👋\n\nأنا سُرى، مساعدة العيادة. تحبّ تحجز موعداً أو عندك سؤال؟",
    fallback: "أقدر أساعدك في الحجز، أوقات الدوام، والأسعار.\n\nوش تحتاج بالضبط؟",
    booked: (s: string, d: string, t: string) =>
      `تمام ✅\n\nثبّتّ لك ${s} مع ${d} الساعة ${t} صباحاً.\n\nبنرسل لك تذكيراً قبلها بيوم.`,
    services: [
      { k: ["تنظيف", "تلميع", "تنضيف"], n: "تنظيف وتلميع الأسنان", dr: "د. سارة البلوشي" },
      { k: ["حشو", "حشوة"], n: "حشوة الأسنان", dr: "د. محمد البادي" },
      { k: ["عصب", "لبّي", "لبي"], n: "علاج العصب", dr: "د. خالد الحارثي" },
      { k: ["خلع", "قلع"], n: "خلع الأسنان", dr: "د. خالد الحارثي" },
      { k: ["تبييض"], n: "تبييض الأسنان", dr: "د. سارة البلوشي" },
      { k: ["كشف", "فحص", "تقويم"], n: "كشف وتشخيص", dr: "د. محمد البادي" },
    ],
    bookWords: ["موعد", "احجز", "أحجز", "ابي", "أبي", "ابغى", "بكرة", "غدا", "غداً"],
    hourWords: ["دوام", "تفتح", "تفتحون", "ساعات", "متى"],
    priceWords: ["سعر", "كم", "تكلفة", "بكم"],
    whereWords: ["وين", "أين", "موقع", "عنوان"],
    greetWords: ["سلام", "هلا", "مرحبا", "أهلا", "اهلا", "صباح", "مساء"],
    defaultSvc: "كشف وتشخيص",
    defaultDr: "د. محمد البادي",
  },
  en: {
    hours: "We're open Sunday to Thursday, 9:00 AM to 6:00 PM.\n\nAnd Sura answers at any hour — including after we close.",
    price: "A scale and polish is OMR 15, and an exam is OMR 5.\n\nWould you like me to book you in?",
    where: "You're welcome at the clinic — the location comes through on WhatsApp with your confirmation.",
    greet: "Hello 👋\n\nI'm Sura, the clinic's assistant. Would you like to book, or do you have a question?",
    fallback: "I can help with booking, opening hours and prices.\n\nWhat do you need?",
    booked: (s: string, d: string, t: string) =>
      `Done ✅\n\nI've booked your ${s} with ${d} at ${t} AM.\n\nWe'll send a reminder the day before.`,
    services: [
      { k: ["clean", "polish", "hygien", "scale"], n: "Scale & polish", dr: "Dr. Sara Al Balushi" },
      { k: ["filling", "cavity"], n: "Dental filling", dr: "Dr. Mohammed Al Badi" },
      { k: ["root", "canal", "endo"], n: "Root canal", dr: "Dr. Khalid Al Harthy" },
      { k: ["extract", "pull", "remov"], n: "Extraction", dr: "Dr. Khalid Al Harthy" },
      { k: ["whiten", "bleach"], n: "Whitening", dr: "Dr. Sara Al Balushi" },
      { k: ["check", "exam", "consult", "ortho"], n: "Exam & diagnosis", dr: "Dr. Mohammed Al Badi" },
    ],
    bookWords: ["book", "appointment", "slot", "tomorrow", "schedule", "reserve"],
    hourWords: ["hour", "open", "close", "when are you"],
    priceWords: ["price", "cost", "how much", "fee"],
    whereWords: ["where", "location", "address", "find you"],
    greetWords: ["hi", "hello", "hey", "salam", "good morning", "good evening"],
    defaultSvc: "Exam & diagnosis",
    defaultDr: "Dr. Mohammed Al Badi",
  },
} as const;

/* Tomorrow in the clinic's timezone — a demo must never offer a past date. */
function tomorrow(lang: "ar" | "en") {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Muscat",
  }).format(d);
}

export function SuraDemo() {
  const { lang } = useSite();
  const c = homeContent[lang].demo;
  const kb = KB[lang];

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [booking, setBooking] = useState<Booking>(null);
  const [slot, setSlot] = useState(9);
  const box = useRef<HTMLDivElement | null>(null);

  const has = (t: string, words: readonly string[]) =>
    words.some((w) => t.includes(w.toLowerCase()));

  function answer(raw: string): { reply: string; book: Booking } {
    const t = raw.toLowerCase();

    if (has(t, kb.bookWords)) {
      const svc = kb.services.find((s) => s.k.some((k) => t.includes(k)));
      const name = svc?.n ?? kb.defaultSvc;
      const dr = svc?.dr ?? kb.defaultDr;
      /* Each booking takes the next slot, so a second request does not hand out
         the same time — the clash check is the product's whole point. */
      const hh = String(slot).padStart(2, "0") + ":00";
      setSlot((s) => (s >= 12 ? 9 : s + 1));
      return {
        reply: kb.booked(name, dr, hh),
        book: { service: name, doctor: dr, time: hh, date: tomorrow(lang) },
      };
    }
    if (has(t, kb.hourWords))  return { reply: kb.hours, book: null };
    if (has(t, kb.priceWords)) return { reply: kb.price, book: null };
    if (has(t, kb.whereWords)) return { reply: kb.where, book: null };
    if (has(t, kb.greetWords)) return { reply: kb.greet, book: null };
    return { reply: kb.fallback, book: null };
  }

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    setInput("");
    setMsgs((m) => [...m, { who: "them", text: q }]);
    setTyping(true);
    requestAnimationFrame(() => box.current?.scrollTo({ top: 9e5, behavior: "smooth" }));

    /* A beat before replying. Instant is not more impressive — it reads as a
       lookup table, which is exactly what we do not want it mistaken for. */
    setTimeout(() => {
      const { reply, book } = answer(q);
      setTyping(false);
      setMsgs((m) => [...m, { who: "sura", text: reply }]);
      if (book) setBooking(book);
      requestAnimationFrame(() => box.current?.scrollTo({ top: 9e5, behavior: "smooth" }));
    }, 900);
  }

  const chips = lang === "ar"
    ? ["أبي موعد تنظيف بكرة", "متى تفتحون؟", "كم سعر التنظيف؟"]
    : ["Book me a cleaning tomorrow", "What are your hours?", "How much is a cleaning?"];

  const ar = lang === "ar";

  /* The chain a single booking sets off. This is the actual argument of the
     section: a chatbot writes a reply, an agent writes to four places. Each
     step lights up in turn rather than all at once, because the sequence is
     the thing being demonstrated. */
  const CHAIN = ar
    ? [
        { i: CalendarCheck, t: "الموعد كُتب في جدول الطبيب", s: "بعد فحص التعارض والدوام" },
        { i: UserRound, t: "ملفّ المريض حُدّث", s: "أو أُنشئ إن كان أول مرّة" },
        { i: BellRing, t: "التذكير جُدول", s: "يصله قبل الموعد بيوم" },
        { i: ReceiptText, t: "الخدمة جاهزة للفوترة", s: "بسعرها من جدول خدماتك" },
      ]
    : [
        { i: CalendarCheck, t: "Written into the doctor's calendar", s: "after checking clashes and hours" },
        { i: UserRound, t: "Patient record updated", s: "or created, on a first visit" },
        { i: BellRing, t: "Reminder scheduled", s: "reaches them the day before" },
        { i: ReceiptText, t: "Service queued for invoicing", s: "at the price in your own list" },
      ];

  return (
    <section className="sec">
      <div className="wrap">
        <div style={{ maxWidth: "58ch", marginBottom: "2.6rem" }}>
          <span className="pill"><Sparkles size={13} /> {c.tag}</span>
          <h2 className="h2" style={{ marginTop: "1.1rem" }}>{c.title}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{c.lede}</p>
        </div>

        <div className="demo">
          {/* ── the conversation, as a real thread ── */}
          <div className="demo__chat">
            <div className="demo__head">
              <span className="demo__av">س</span>
              <span className="demo__who">
                <b>{ar ? "سُرى · عيادة الواحة" : "Sura · Al Waha Clinic"}</b>
                <em><span className="demo__dot" /> {ar ? "تردّ الآن" : "Online now"}</em>
              </span>
              <span className="demo__ch">{ar ? "واتساب" : "WhatsApp"}</span>
            </div>

            <div className="demo__body" ref={box}>
              {/* Sura opens the thread, so the panel is never an empty box —
                  and an empty box is what a visitor reads as "unfinished". */}
              <div className="bub bub--sura">
                {kb.greet}
                <span className="bub__t">{ar ? "الآن" : "now"}</span>
              </div>

              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  className={m.who === "them" ? "bub bub--them" : "bub bub--sura"}
                >
                  {m.text}
                  <span className="bub__t">
                    {ar ? "الآن" : "now"}
                    {m.who === "them" && <Check size={11} className="bub__tick" />}
                  </span>
                </motion.div>
              ))}

              {typing && (
                <div className="bub bub--sura bub--typing" aria-label={c.thinking}>
                  <span className="dots"><i /><i /><i /></span>
                </div>
              )}
            </div>

            <div className="demo__chips">
              {chips.map((x) => (
                <button key={x} className="chip" onClick={() => send(x)} disabled={typing}>{x}</button>
              ))}
            </div>

            <form className="demo__bar" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input
                className="demo__inp"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
              />
              <button className="demo__send" type="submit" disabled={!input.trim() || typing} aria-label={c.send}>
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* ── what the system did about it ── */}
          <div className="demo__sys">
            <div className="demo__sysh">
              <Calendar size={14} /> {c.ledgerT}
            </div>

            <AnimatePresence mode="wait">
              {booking ? (
                <motion.div key={booking.time + booking.service} className="demo__stack"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: .97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 170, damping: 20 }}
                    className="demo__row"
                  >
                    <div className="demo__rowtop">
                      <span className="demo__time">{booking.time}</span>
                      <span className="demo__ok"><Check size={12} /> {ar ? "مؤكّد" : "Confirmed"}</span>
                    </div>
                    <p className="demo__svc">{booking.service}</p>
                    <p className="demo__meta">{booking.doctor} · {booking.date}</p>
                  </motion.div>

                  <div className="demo__chain">
                    {CHAIN.map((s, i) => (
                      <motion.div
                        key={s.t} className="demo__step"
                        initial={{ opacity: 0, x: ar ? 14 : -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.18 + i * 0.13, type: "spring", stiffness: 220, damping: 24 }}
                      >
                        <span className="demo__stepic"><s.i size={14} /></span>
                        <span className="demo__steptx"><b>{s.t}</b><em>{s.s}</em></span>
                        <Check size={13} className="demo__stepok" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* Not blank while waiting: the day's real schedule, so the
                   panel reads as a system with a state rather than a hole. */
                <motion.div key="idle" className="demo__stack"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="demo__empty">{c.empty}</p>
                  <div className="demo__chain demo__chain--idle">
                    {(ar
                      ? [["٠٩:٠٠", "كشف وتشخيص"], ["١٠:٠٠", "حشوة الأسنان"], ["١١:٠٠", "تبييض الأسنان"]]
                      : [["09:00", "Exam & diagnosis"], ["10:00", "Dental filling"], ["11:00", "Whitening"]]
                    ).map(([t, s]) => (
                      <div key={t} className="demo__slot">
                        <span className="demo__slott">{t}</span>
                        <span className="demo__slots">{s}</span>
                      </div>
                    ))}
                    <div className="demo__slot demo__slot--free">
                      <span className="demo__slott">{ar ? "١٢:٠٠" : "12:00"}</span>
                      <span className="demo__slots">{ar ? "شاغر" : "Free"}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
