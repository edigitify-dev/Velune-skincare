"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PRODUCTS } from "@/lib/products";
import { META } from "@/lib/shopMeta";
import { useAddToBag } from "@/components/useAddToBag";
import Reveal from "@/components/Reveal";
import Breathe from "./Breathe";

type Step = { id: string; title: string; text: string };
const byId = (id: string) => PRODUCTS.find((p) => p.id === id)!;

const RITUALS = {
  Morning: {
    kicker: "Wake the skin",
    line: "Light, fresh, protected.",
    steps: [
      { id: "cleanse", title: "Cleanse", text: "Work the cleanser over damp skin in slow circles. Rinse with lukewarm water and pat dry." },
      { id: "mist", title: "Refresh", text: "Close your eyes and mist from arm's length. Let it settle for a breath before the next step." },
      { id: "serum", title: "Hydrate", text: "Press a few drops into the face and neck. Pressing, not rubbing, is the whole technique." },
      { id: "veil", title: "Protect", text: "Finish with Daily Veil as the last step, every morning, before you step into the light." },
    ] as Step[],
  },
  Evening: {
    kicker: "Return to calm",
    line: "Slow, soft, restorative.",
    steps: [
      { id: "cleanse", title: "Cleanse", text: "Let the day dissolve. Massage gently for a full minute, then rinse and pat dry." },
      { id: "mist", title: "Refresh", text: "A veil of rosewater to soothe and prepare the skin." },
      { id: "serum", title: "Hydrate", text: "Press the serum in while the skin is still slightly damp." },
      { id: "oil", title: "Nourish", text: "Warm two drops between your palms and press them over the face. Breathe in." },
    ] as Step[],
  },
  Body: {
    kicker: "Soften the skin",
    line: "A moment for the whole self.",
    steps: [
      { id: "wash", title: "Cleanse", text: "Smooth the wash over damp skin and let the warmth do the rest." },
      { id: "lotion", title: "Soften", text: "Apply to slightly damp skin, from the shoulders down, in long slow strokes." },
    ] as Step[],
  },
} as const;
type Key = keyof typeof RITUALS;

export default function RitualsView() {
  const [key, setKey] = useState<Key>("Morning");
  const [active, setActive] = useState(0);
  const [prog, setProg] = useState(0);
  const addToBag = useAddToBag();
  const stepsRef = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const r = RITUALS[key];
  const night = key === "Evening";

  // switch ritual: reset position
  useEffect(() => setActive(0), [key]);

  // which step is under the middle of the screen + progress line
  useEffect(() => {
    const els = Array.from(stepsRef.current?.querySelectorAll<HTMLElement>("[data-step]") ?? []);
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => {
      const c = stepsRef.current;
      if (!c) return;
      const b = c.getBoundingClientRect();
      setProg(Math.max(0, Math.min(1, (innerHeight * 0.5 - b.top) / b.height)));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); };
  }, [key]);

  const addAll = () => {
    const from = stage.current!.getBoundingClientRect();
    r.steps.forEach((s, i) => setTimeout(() => addToBag(byId(s.id), from), i * 350));
  };

  const cur = byId(r.steps[Math.min(active, r.steps.length - 1)].id);

  return (
    <>
      <section className="relative px-[5vw] pb-[10vh] pt-[22vh]">
        <Reveal><p className="text-[11px] uppercase tracking-[0.3em] text-clay">The Rituals</p></Reveal>
        <Reveal delay={0.1}>
          <h1 className="font-display mt-5 max-w-[13ch] text-[clamp(52px,9vw,150px)] leading-[0.92]">
            Care, in <em className="text-clay">order.</em>
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-[480px] text-[15px] leading-[1.8] text-muted">
            Choose a moment of your day. Each ritual is a few quiet steps — scroll to move through them.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="mt-10 flex flex-wrap gap-2">
          {(Object.keys(RITUALS) as Key[]).map((k) => (
            <button key={k} className="chip" aria-pressed={key === k} onClick={() => setKey(k)}>{k}</button>
          ))}
        </Reveal>
      </section>

      {/* themed stage */}
      <section className={`relative px-[5vw] py-[10vh] transition-colors duration-[1200ms] ${night ? "bg-charcoal text-ivory" : key === "Body" ? "bg-nude text-espresso" : "bg-sand/40 text-espresso"}`}>
        <div className="mb-[8vh] flex flex-wrap items-end justify-between gap-6">
          <div key={key} style={{ animation: "pageIn .9s cubic-bezier(.2,.7,.2,1) both" }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-clay">{key} ritual · {r.steps.length} steps</p>
            <h2 className="font-display mt-3 text-[clamp(38px,6vw,92px)] leading-none">{r.kicker}</h2>
            <p className={`mt-3 text-[15px] ${night ? "text-ivory/60" : "text-muted"}`}>{r.line}</p>
          </div>
          <button onClick={addAll} className={`btn ${night ? "!bg-ivory !text-espresso hover:!bg-clay hover:!text-ivory" : ""}`}>Add full ritual to Bag</button>
        </div>

        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-[6vw]">
          {/* sticky product stage */}
          <div className="md:sticky md:top-[14vh] md:h-[72vh]">
            <div ref={stage} className="relative h-[46vh] overflow-hidden rounded-[36px] md:h-full" style={{ background: night ? "rgba(245,240,233,.06)" : cur.bg, transition: "background 1s" }}>
              <div aria-hidden className="font-display absolute inset-x-0 top-[6%] text-center text-[clamp(80px,12vw,200px)] leading-none opacity-[0.07]">
                {String(active + 1).padStart(2, "0")}
              </div>
              {r.steps.map((s, i) => {
                const p = byId(s.id);
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={key + s.id} src={p.image} alt={i === active ? p.name : ""} draggable={false}
                    className="absolute inset-x-0 bottom-[6%] mx-auto h-[78%] object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,.22)]"
                    style={{
                      opacity: i === active ? 1 : 0,
                      transform: i === active ? "translateY(0) scale(1)" : `translateY(${i < active ? -40 : 40}px) scale(.9)`,
                      transition: "opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1)",
                    }} />
                );
              })}
              <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[12px] uppercase tracking-[0.18em] opacity-70">
                <span>{cur.name}</span><span>{cur.size}</span>
              </div>
            </div>
          </div>

          {/* steps */}
          <div ref={stepsRef} className="relative pl-10 md:pl-14">
            <span aria-hidden className="absolute bottom-0 left-[11px] top-0 w-px bg-current opacity-15 md:left-[15px]" />
            <span aria-hidden className="absolute left-[11px] top-0 w-px origin-top bg-clay md:left-[15px]" style={{ height: "100%", transform: `scaleY(${prog})`, transition: "transform .2s linear" }} />
            {r.steps.map((s, i) => {
              const p = byId(s.id);
              const on = i === active;
              return (
                <div key={key + s.id} data-step={i} className="relative flex min-h-[62vh] flex-col justify-center py-10 transition-opacity duration-700" style={{ opacity: on ? 1 : 0.3 }}>
                  <span aria-hidden className={`absolute -left-10 top-1/2 h-[23px] w-[23px] -translate-y-1/2 rounded-full border border-clay transition-all duration-700 md:-left-14 md:h-[31px] md:w-[31px] ${on ? "scale-100 bg-clay" : "scale-50 bg-transparent"}`} />
                  <p className="text-[11px] uppercase tracking-[0.3em] text-clay">Step {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="font-display mt-3 text-[clamp(44px,6vw,92px)] leading-none">{s.title}</h3>
                  <p className={`mt-6 max-w-[440px] text-[15px] leading-[1.9] ${night ? "text-ivory/70" : "text-muted"}`}>{s.text}</p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-4 py-2 text-[12px] ${night ? "bg-ivory/10" : "bg-ivory/70"}`}>{p.name} · {p.size}</span>
                    <button className={`text-[13px] underline underline-offset-4 ${night ? "text-ivory/80 hover:text-clay" : "text-muted hover:text-espresso"}`}
                      onClick={(e) => addToBag(p, (e.currentTarget.closest("[data-step]") as HTMLElement).getBoundingClientRect())}>
                      Add to Bag
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Breathe />

      <section className="px-[5vw] py-[14vh] text-center">
        <Reveal>
          <h2 className="font-display mx-auto max-w-[14ch] text-[clamp(38px,6vw,96px)] leading-[0.98]">
            Make it <em className="text-clay">yours.</em>
          </h2>
          <Link href="/shop" className="btn mt-10">Shop the collection</Link>
        </Reveal>
      </section>
    </>
  );
}
