"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useSite } from "@/components/site/lang";

/* The one thing this site is meant to be remembered by.

   Every reference site opens with a still screenshot of a dashboard. A
   screenshot proves a screen exists; it does not prove anything happens. So
   this opens with the thing actually happening: a patient's message is typed
   out, Sura answers it, and the appointment lands in the clinic's ledger as its
   consequence.

   It runs once on load and then waits. A hero that loops forever competes with
   the reader for the whole time they are on the page; the replay control gives
   it back to anyone who looked away. Reduced motion skips to the end state,
   which is the part that carries the meaning anyway. */

type Phase = 0 | 1 | 2 | 3 | 4;

/* Tomorrow, in the clinic's own timezone — the demo should never show a date
   that has already passed. */
function tomorrow(lang: "ar" | "en") {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Muscat",
  }).format(d);
}

export function Signature() {
  const { t, lang } = useSite();
  const h = t.home;

  const [phase, setPhase] = useState<Phase>(0);
  const [typed, setTyped] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };

  const run = useCallback(() => {
    clear();
    if (reduced) { setTyped(h.chatIn); setPhase(4); return; }

    setTyped(""); setPhase(0);

    /* Typed character by character, because that is how the message really
       arrives — and it makes the reader wait with the clinic. */
    const msg = h.chatIn;
    for (let i = 1; i <= msg.length; i++) {
      at(260 + i * 34, () => setTyped(msg.slice(0, i)));
    }
    const afterTyping = 260 + msg.length * 34;

    at(afterTyping + 380, () => setPhase(1));   // sent
    at(afterTyping + 900, () => setPhase(2));   // Sura typing
    at(afterTyping + 2100, () => setPhase(3));  // Sura replies
    at(afterTyping + 3500, () => setPhase(4));  // confirmed → ledger
  }, [h.chatIn, reduced]);

  /* Restarts when the language changes, so the text on screen is never half in
     one language and half in the other. */
  useEffect(() => { run(); return clear; }, [run, lang]);

  return (
    <div className="s-stage">
      <div className="s-chat">
        <div className="s-chat__bar">
          <span className="s-chat__dot" />
          {h.chatHeader}
        </div>

        <div className="s-chat__body">
          {(typed || phase >= 1) && (
            <div className="s-bubble s-bubble--in">
              {typed}
              {phase === 0 && <span className="s-caret" />}
            </div>
          )}

          {phase === 2 && (
            <div className="s-bubble s-bubble--out" aria-label={h.chatTyping}>
              <span className="s-typing"><i /><i /><i /></span>
            </div>
          )}

          {phase >= 3 && <div className="s-bubble s-bubble--out">{h.chatOut}</div>}
          {phase >= 4 && <div className="s-bubble s-bubble--in">{h.chatConfirm}</div>}
        </div>
      </div>

      {/* The consequence, not a second screenshot. */}
      <div className="s-ledger" data-on={phase >= 4} aria-live="polite">
        <span className="s-ledger__label">{h.ledgerLabel}</span>
        <div className="s-ledger__row">
          <span className="s-ledger__when">
            <span className="s-num">09:00</span> · {tomorrow(lang)}
          </span>
          <span className="s-ledger__ok"><Check size={13} /> {h.ledgerStatus}</span>
        </div>
        <p className="s-ledger__meta">{h.ledgerService} — {h.ledgerDoctor}</p>
      </div>

      {!reduced && (
        <button className="s-replay" onClick={run}>
          <RotateCcw size={11} />
          {h.replay}
        </button>
      )}
    </div>
  );
}
