"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PRODUCTS, type Product } from "@/lib/products";
import { META } from "@/lib/shopMeta";
import { useAddToBag } from "@/components/useAddToBag";
import { getLenis } from "@/lib/scroll";
import Reveal from "@/components/Reveal";

const FILTERS = ["All", "Face", "Body"] as const;
type Filter = (typeof FILTERS)[number];
const SORTS = ["Featured", "A – Z", "Size"] as const;

const sizeNum = (s: string) => parseInt(s, 10);

function Card({ p, i, onOpen }: { p: Product; i: number; onOpen: (p: Product) => void }) {
  const addToBag = useAddToBag();
  const imgRef = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);

  const move = (e: React.PointerEvent) => {
    const r = card.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.current!.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    imgRef.current!.style.transform = `translate(${x * 16}px, ${y * 10}px) scale(1.06)`;
  };
  const leave = () => {
    card.current!.style.transform = "";
    imgRef.current!.style.transform = "";
  };

  const add = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await addToBag(p, imgRef.current!.getBoundingClientRect());
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }
  };

  return (
    <Reveal delay={(i % 3) * 0.08} className="group">
      <div
        ref={card}
        onPointerMove={move}
        onPointerLeave={leave}
        onClick={() => onOpen(p)}
        className="relative cursor-pointer overflow-hidden rounded-[28px] transition-transform duration-500 ease-out will-change-transform"
        style={{ background: p.bg }}
      >
        <span className="absolute left-5 top-5 z-[2] rounded-full bg-ivory/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted backdrop-blur">
          {META[p.id].step}
        </span>
        <div className="font-display pointer-events-none absolute inset-x-0 top-[8%] text-center text-[clamp(70px,9vw,140px)] leading-none text-espresso/[0.06] transition-transform duration-[1200ms] group-hover:scale-110">
          {p.name.split(" ")[0]}
        </div>
        <div ref={imgRef} className="relative mx-auto flex h-[400px] w-[62%] items-end justify-center pb-8 pt-14 transition-transform duration-500 ease-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.name} draggable={false} loading="lazy"
            className="h-full w-full object-contain object-bottom drop-shadow-[0_26px_24px_rgba(51,36,31,.18)]" />
        </div>
        <div className="absolute inset-x-5 bottom-5 z-[2] translate-y-[calc(100%+20px)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:translate-y-0 max-md:translate-y-0">
          <button onClick={add} className="btn w-full !h-[46px]">
            {added ? "Added ✓" : "Add to Bag"}
          </button>
        </div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-4 px-1">
        <div>
          <h3 className="font-display text-[26px] leading-tight">{p.name}</h3>
          <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-muted">{p.tagline}</p>
        </div>
        <div className="pt-1 text-right text-[13px] text-muted tabular-nums">
          {p.price != null && <div className="font-display text-[22px] text-espresso">${p.price}</div>}
          {p.size}
        </div>
      </div>
    </Reveal>
  );
}

function QuickView({ p, onClose }: { p: Product | null; onClose: () => void }) {
  const addToBag = useAddToBag();
  const img = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState<Product | null>(p);
  useEffect(() => { if (p) setLast(p); }, [p]);
  useEffect(() => {
    if (!p) return;
    getLenis()?.stop();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => { getLenis()?.start(); window.removeEventListener("keydown", k); };
  }, [p, onClose]);

  const q = last;
  const open = !!p;
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-[140] bg-charcoal/50 backdrop-blur-sm transition-opacity duration-500 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <div role="dialog" aria-modal="true" aria-hidden={!open}
        className={`fixed left-1/2 top-1/2 z-[145] grid w-[min(960px,92vw)] max-h-[90vh] -translate-x-1/2 overflow-hidden rounded-[32px] bg-ivory shadow-2xl transition-all duration-[700ms] ease-[cubic-bezier(.2,.7,.2,1)] md:grid-cols-2 ${open ? "-translate-y-1/2 opacity-100" : "pointer-events-none -translate-y-[42%] opacity-0"}`}>
        {q && (
          <>
            <div ref={img} className="relative flex min-h-[320px] items-end justify-center px-10 pb-8 pt-10 transition-colors duration-700" style={{ background: q.bg }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.image} alt={q.name} className="h-[340px] object-contain drop-shadow-[0_26px_24px_rgba(51,36,31,.2)] md:h-[460px]" style={{ animation: "floaty 6s ease-in-out infinite" }} />
            </div>
            <div className="flex flex-col justify-center overflow-y-auto p-8 md:p-12" data-lenis-prevent>
              <button onClick={onClose} className="absolute right-6 top-5 text-[13px] tracking-[0.06em] text-muted hover:text-espresso">Close</button>
              <p className="text-[11px] uppercase tracking-[0.22em] text-clay">{META[q.id].cat} · {META[q.id].step}</p>
              <h3 className="font-display mt-3 text-[clamp(34px,4vw,52px)] leading-none">{q.name}</h3>
              <p className="mt-2 text-[12px] uppercase tracking-[0.16em] text-muted">{q.tagline} · {q.size}</p>
              <p className="mt-6 text-[14px] leading-[1.8] text-muted">{q.desc}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {META[q.id].notes.map((n) => (
                  <span key={n} className="rounded-full bg-nude px-4 py-1.5 text-[12px] text-espresso">{n}</span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button className="btn" onClick={() => { const r = img.current!.getBoundingClientRect(); onClose(); addToBag(q, r); }}>Add to Bag</button>
                <Link href="/rituals" className="btn btn-ghost">See it in a ritual</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function ShopView() {
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Featured");
  const [view, setView] = useState<Product | null>(null);
  const [anim, setAnim] = useState(0);

  const list = useMemo(() => {
    let l = PRODUCTS.filter((p) => filter === "All" || META[p.id].cat === filter);
    if (sort === "A – Z") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Size") l = [...l].sort((a, b) => sizeNum(a.size) - sizeNum(b.size));
    return l;
  }, [filter, sort]);

  return (
    <>
      <section className="relative overflow-hidden px-[5vw] pb-[8vh] pt-[22vh]">
        <div aria-hidden className="pointer-events-none absolute -right-[10vw] top-[8vh] h-[60vw] w-[60vw] max-w-[760px] max-h-[760px] rounded-full bg-nude/70 blur-3xl" style={{ animation: "floaty 9s ease-in-out infinite" }} />
        <Reveal><p className="text-[11px] uppercase tracking-[0.3em] text-clay">The Collection</p></Reveal>
        <Reveal delay={0.1}>
          <h1 className="font-display mt-5 max-w-[14ch] text-[clamp(52px,9vw,150px)] leading-[0.92]">
            Seven small <em className="text-clay">rituals.</em>
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-[460px] text-[15px] leading-[1.8] text-muted">
            Whole-plant skincare for face and body — made to be used slowly, and enjoyed.
          </p>
        </Reveal>
      </section>

      <section className="sticky top-[76px] z-[50] bg-ivory/80 px-[5vw] py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-espresso/10 py-4">
          <div className="flex gap-2" role="group" aria-label="Filter products">
            {FILTERS.map((f) => (
              <button key={f} className="chip" aria-pressed={filter === f} onClick={() => { setFilter(f); setAnim((a) => a + 1); }}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="hidden sm:inline">Sort</span>
            <div className="flex gap-2">
              {SORTS.map((s) => (
                <button key={s} className="chip !h-9 !px-4 !text-[12px]" aria-pressed={sort === s} onClick={() => { setSort(s); setAnim((a) => a + 1); }}>
                  {s}
                </button>
              ))}
            </div>
            <span className="tabular-nums">{list.length} items</span>
          </div>
        </div>
      </section>

      <section key={anim} className="grid gap-x-8 gap-y-16 px-[5vw] py-[8vh] sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <Card key={p.id} p={p} i={i} onOpen={setView} />
        ))}
      </section>

      <section className="mx-[5vw] mb-[12vh] overflow-hidden rounded-[44px] bg-charcoal px-[6vw] py-[12vh] text-ivory">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.3em] text-clay">Not sure where to begin?</p>
          <h2 className="font-display mt-5 max-w-[16ch] text-[clamp(38px,6vw,96px)] leading-[0.98]">
            Let the ritual <em className="text-clay">guide you.</em>
          </h2>
          <Link href="/rituals" className="btn mt-10 !bg-ivory !text-espresso hover:!bg-clay hover:!text-ivory">Explore rituals</Link>
        </Reveal>
      </section>

      <QuickView p={view} onClose={() => setView(null)} />
    </>
  );
}
