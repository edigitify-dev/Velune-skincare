"use client";
import { useRef, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { useAddToBag } from "./useAddToBag";

export default function Products() {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const addToBag = useAddToBag();
  const p = PRODUCTS[index];

  const go = (n: number) =>
    setIndex((i) => Math.min(PRODUCTS.length - 1, Math.max(0, i + n)));

  return (
    <section
      id="shop"
      className="relative min-h-screen w-full overflow-hidden transition-colors duration-[1100ms]"
      style={{ background: p.bg }}
    >
      <div
        key={p.id}
        className="font-display pointer-events-none absolute inset-x-0 top-[14vh] select-none text-center text-[clamp(90px,20vw,340px)] leading-none text-espresso/[0.07] animate-[fadeIn_1.1s_ease]"
      >
        {p.name.split(" ")[0]}
      </div>

      <div
        className="carousel relative mx-auto h-[62vh] cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => dragging && setDx(e.clientX - startX.current)}
        onPointerUp={() => {
          setDragging(false);
          if (dx < -60) go(1);
          else if (dx > 60) go(-1);
          setDx(0);
        }}
        onPointerCancel={() => {
          setDragging(false);
          setDx(0);
        }}
      >
        {PRODUCTS.map((item, i) => {
          const k = i - index;
          const isActive = k === 0;
          return (
            <div
              key={item.id}
              {...(isActive ? { "data-active-bottle": "" } : {})}
              className={`absolute left-1/2 top-[8vh] flex h-[50vh] w-[26vh] -translate-x-1/2 items-end justify-center ${dragging ? "" : "transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)]"}`}
              style={{
                transform: `translateX(calc(-50% + var(--step) * ${k} + ${dx}px)) scale(${isActive ? 1.12 : 0.66})`,
                opacity: Math.abs(k) > 1 ? 0 : isActive ? 1 : 0.5,
                zIndex: isActive ? 2 : 1,
              }}
              aria-hidden={!isActive}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.name}
                draggable={false}
                className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[0_30px_30px_rgba(51,36,31,.16)]"
              />
            </div>
          );
        })}
      </div>

      <div className="relative z-[3] mx-[5vw] flex flex-col justify-between gap-8 pb-[8vh] md:flex-row md:items-end">
        <div className="max-w-[420px]">
          <h3 className="font-display text-[clamp(38px,5vw,76px)] leading-none">
            {p.name}
          </h3>
          <p className="mt-3 text-[12px] uppercase tracking-[0.18em] text-muted">
            {p.tagline}
          </p>
          <p className="mt-4 text-[14px] leading-[1.7] text-muted">{p.desc}</p>
        </div>
        <div className="flex flex-col items-start gap-5 md:items-end">
          <div className="font-display text-[34px] tabular-nums">
            {p.price != null && <>${p.price} </>}
            <span className="font-sans text-[13px] text-muted">{p.size}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous product"
              onClick={() => go(-1)}
              disabled={index === 0}
              className="btn btn-ghost !h-[52px] !w-[52px] !p-0 disabled:opacity-30"
            >
              ←
            </button>
            <button
              aria-label="Next product"
              onClick={() => go(1)}
              disabled={index === PRODUCTS.length - 1}
              className="btn btn-ghost !h-[52px] !w-[52px] !p-0 disabled:opacity-30"
            >
              →
            </button>
            <button
              className="btn"
              onClick={() => {
                const el = document.querySelector(
                  "[data-active-bottle]",
                ) as HTMLElement | null;
                if (el) addToBag(p, el.getBoundingClientRect());
              }}
            >
              Add to Bag
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}
