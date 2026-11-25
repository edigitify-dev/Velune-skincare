"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { INGREDIENTS } from "@/lib/collection";
import Reveal from "@/components/Reveal";

const MANIFESTO =
  "We believe skin care is not a routine to rush through. It is a pause between breath and beauty — a few quiet minutes, a plant-led formula, and the patience to let both do their work.";

const PRINCIPLES = [
  { n: "01", t: "Whole-plant", d: "Formulas begin with botanicals — aloe, green tea, centella, rose — chosen for what they bring to the skin." },
  { n: "02", t: "Unhurried", d: "Fewer, better steps. Textures made to be pressed, warmed and breathed in, never rushed." },
  { n: "03", t: "Intentional", d: "Every product has a place in the ritual, and every ritual has a reason. Nothing is here to fill a shelf." },
];

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const words = MANIFESTO.split(" ");
  useEffect(() => {
    const on = () => {
      const b = ref.current!.getBoundingClientRect();
      setP(Math.max(0, Math.min(1, (innerHeight * 0.85 - b.top) / (b.height + innerHeight * 0.25))));
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return (
    <section className="px-[5vw] py-[18vh]">
      <p className="text-[11px] uppercase tracking-[0.3em] text-clay">Our philosophy</p>
      <div ref={ref}>
        <p className="font-display mt-8 max-w-[22ch] text-[clamp(32px,4.6vw,76px)] leading-[1.08] md:max-w-[24ch]">
          {words.map((w, i) => {
            const t = Math.max(0, Math.min(1, p * (words.length + 6) - i));
            return (
              <span key={i} className="inline-block pr-[0.25em] transition-colors duration-300" style={{ color: `rgba(51,36,31,${0.14 + t * 0.86})` }}>
                {w}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}

function Principles() {
  const [open, setOpen] = useState(0);
  return (
    <section className="px-[5vw] pb-[16vh]">
      <div className="flex min-h-[64vh] flex-col gap-3 md:flex-row">
        {PRINCIPLES.map((x, i) => {
          const on = open === i;
          return (
            <button key={x.n} onMouseEnter={() => setOpen(i)} onFocus={() => setOpen(i)} onClick={() => setOpen(i)} aria-expanded={on}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[32px] p-8 text-left transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] md:p-10 ${on ? "md:flex-[2.4]" : "md:flex-1"} ${on ? "bg-charcoal text-ivory" : "bg-nude text-espresso"} max-md:min-h-[120px]`}>
              <span className="font-display text-[22px] text-clay">{x.n}</span>
              <div>
                <h3 className="font-display text-[clamp(36px,4.4vw,68px)] leading-none">{x.t}</h3>
                <div className={`grid transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] ${on ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <p className="max-w-[380px] overflow-hidden text-[14px] leading-[1.8] text-ivory/70">{x.d}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Ingredients() {
  const [sel, setSel] = useState(0);
  const cur = INGREDIENTS[sel];
  return (
    <section className="bg-charcoal px-[5vw] py-[14vh] text-ivory">
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.3em] text-clay">The elements</p>
        <h2 className="font-display mt-4 max-w-[14ch] text-[clamp(38px,6vw,96px)] leading-[0.98]">
          Nature, <em className="text-clay">decoded.</em>
        </h2>
      </Reveal>
      <div className="mt-[8vh] grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-center">
        <div className="relative flex aspect-square max-h-[520px] items-center justify-center rounded-full bg-ivory/[0.05]">
          <span aria-hidden className="absolute inset-[8%] rounded-full border border-clay/40" style={{ animation: "breatheRing 6s ease-in-out infinite" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={cur.name} src={cur.icon} alt={cur.name} className="h-[52%] w-[52%] object-contain" style={{ animation: "pageIn .7s cubic-bezier(.2,.7,.2,1) both" }} />
          <div key={cur.name + "t"} className="absolute -bottom-2 text-center" style={{ animation: "pageIn .7s .1s cubic-bezier(.2,.7,.2,1) both" }}>
            <div className="font-display text-[34px] leading-none">{cur.name}</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-clay">{cur.role}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {INGREDIENTS.map((g, i) => (
            <button key={g.name} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onClick={() => setSel(i)} aria-label={g.name} aria-pressed={sel === i}
              className={`aspect-square rounded-2xl p-3 transition-all duration-500 hover:-translate-y-1 ${sel === i ? "bg-clay/30 ring-1 ring-clay" : "bg-ivory/[0.06] hover:bg-ivory/10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.icon} alt="" className="h-full w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AboutView() {
  const bg = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      if (bg.current && scrollY < innerHeight * 1.2) bg.current.style.transform = `translateY(${scrollY * 0.25}px) scale(1.12)`;
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  return (
    <>
      <section className="relative flex min-h-screen items-end overflow-hidden px-[5vw] pb-[12vh] pt-[22vh]">
        <div ref={bg} aria-hidden className="absolute inset-0 bg-cover bg-center will-change-transform" style={{ backgroundImage: "url(/bg/golden-glass-waves.webp)" }} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/30 to-transparent" />
        <div className="relative">
          <Reveal><p className="text-[11px] uppercase tracking-[0.3em] text-espresso/70">About VELUNE</p></Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display mt-5 max-w-[12ch] text-[clamp(52px,9.5vw,160px)] leading-[0.9]">
              A slower kind of <em className="text-clay">care.</em>
            </h1>
          </Reveal>
        </div>
      </section>

      <Manifesto />
      <Principles />
      <Ingredients />

      <section className="px-[5vw] py-[16vh] text-center">
        <Reveal>
          <h2 className="font-display mx-auto max-w-[14ch] text-[clamp(38px,6vw,96px)] leading-[0.98]">
            Honour the <em className="text-clay">pause.</em>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="btn">Shop the collection</Link>
            <Link href="/rituals" className="btn btn-ghost">Explore rituals</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
