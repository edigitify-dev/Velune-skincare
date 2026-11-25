"use client";
import { useEffect, useState } from "react";

const PHASES = [
  { label: "Inhale", s: 4, scale: 1 },
  { label: "Hold", s: 2, scale: 1 },
  { label: "Exhale", s: 6, scale: 0.55 },
] as const;

/** A guided breath — the "pause" before the ritual begins. */
export default function Breathe() {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(2);
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    if (!on) { setI(2); return; }
    setI(0);
    let step = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        step = (step + 1) % PHASES.length;
        if (step === 0) setCycles((c) => c + 1);
        setI(step);
        next();
      }, PHASES[step].s * 1000);
    };
    next();
    return () => clearTimeout(t);
  }, [on]);

  const ph = PHASES[i];
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-nude px-[5vw] py-[12vh] text-center">
      <p className="text-[11px] uppercase tracking-[0.3em] text-clay">The pause</p>
      <h2 className="font-display mt-4 max-w-[18ch] text-[clamp(36px,5.4vw,84px)] leading-[1]">
        Before you begin, <em className="text-clay">breathe.</em>
      </h2>

      <div className="relative mt-14 flex h-[min(60vw,340px)] w-[min(60vw,340px)] items-center justify-center">
        {[1, 0.78, 0.58].map((s, k) => (
          <span key={k} aria-hidden className="absolute inset-0 rounded-full border border-clay"
            style={{
              transform: `scale(${on ? ph.scale * s : 0.55 * s})`,
              transition: `transform ${on ? ph.s : 1.2}s ${on && i === 0 ? "ease-out" : "ease-in-out"} ${k * 0.12}s`,
              opacity: 0.25 + k * 0.2,
            }} />
        ))}
        <span aria-hidden className="absolute inset-[22%] rounded-full bg-clay/25 blur-xl"
          style={{ transform: `scale(${on ? ph.scale : 0.55})`, transition: `transform ${on ? ph.s : 1.2}s ease-in-out` }} />
        <button onClick={() => setOn((v) => !v)} aria-pressed={on} aria-label={on ? "Stop breathing exercise" : "Start breathing exercise"}
          className="font-display relative z-[2] text-[clamp(24px,3vw,38px)] text-espresso">
          {on ? ph.label : "Begin"}
        </button>
      </div>
      <p className="mt-10 h-5 text-[13px] text-muted" role="status">
        {on ? (cycles > 0 ? `${cycles} ${cycles === 1 ? "breath" : "breaths"} complete` : "Follow the circle") : "Tap the circle. One minute is enough."}
      </p>
    </section>
  );
}
