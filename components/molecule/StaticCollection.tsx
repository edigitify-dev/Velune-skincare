"use client";
import { COLLECTION, INGREDIENTS } from "@/lib/collection";
import { scrollToHash } from "@/lib/scroll";

/** Accessible, non-animated version (reduced motion or no WebGL). Same content, no 3D. */
export default function StaticCollection() {
  return (
    <section
      id="molecular"
      className="relative w-full bg-nude px-[5vw] py-[12vh]"
    >
      <h2 className="font-display max-w-[14ch] text-[clamp(38px,5.4vw,92px)] leading-[0.98]">
        From ingredient to formula.
      </h2>
      <ul className="mt-8 flex max-w-[900px] flex-wrap gap-2 text-[12px] tracking-[0.06em] text-muted">
        {INGREDIENTS.map((i) => (
          <li
            key={i.name}
            className="rounded-full border border-espresso/20 px-4 py-2"
          >
            {i.name}
          </li>
        ))}
      </ul>
      <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {COLLECTION.map((c) => (
          <li key={c.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image}
              alt={c.name}
              loading="lazy"
              className="mx-auto h-[38vh] w-auto object-contain"
            />
            <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted">
              {c.category}
            </div>
            <div className="font-display text-[26px] leading-tight">
              {c.name}
            </div>
            <div className="mt-1 text-[13px] text-muted">{c.line}</div>
          </li>
        ))}
      </ul>
      <button className="btn mt-14" onClick={() => scrollToHash("#shop")}>
        Discover the collection
      </button>
    </section>
  );
}
