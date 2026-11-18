"use client";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { PRODUCTS } from "@/lib/products";
import { getLenis } from "@/lib/scroll";
// import Bottle from './Bottle';

export default function CartDrawer() {
  const { open, setOpen, lines, setQty, remove, subtotal, count } = useCart();
  const [note, setNote] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      getLenis()?.stop();
      closeRef.current?.focus();
    } else {
      getLenis()?.start();
      setNote("");
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[150] bg-charcoal/40 transition-opacity duration-500 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[160] flex h-full w-full max-w-[440px] flex-col bg-ivory px-8 py-7 shadow-2xl transition-transform duration-[700ms] ease-[cubic-bezier(.2,.7,.2,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px]">Your bag</h2>
          <button
            ref={closeRef}
            onClick={() => setOpen(false)}
            className="text-[13px] tracking-[0.06em] text-muted hover:text-espresso"
          >
            Close
          </button>
        </div>

        <div className="mt-8 flex-1 overflow-y-auto" data-lenis-prevent>
          {lines.length === 0 && (
            <p className="text-[14px] leading-relaxed text-muted">
              Your bag is empty. Choose a product from the shop to begin.
            </p>
          )}
          {lines.map((l) => {
            const p = PRODUCTS.find((x) => x.id === l.id)!;
            return (
              <div
                key={l.id}
                className="flex items-center gap-5 border-b border-espresso/10 py-5"
              >
                <div className="h-24 w-16 shrink-0">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-display text-[22px] leading-tight">
                    {p.name}
                  </div>
                  <div className="text-[12px] text-muted">{p.size}</div>
                  <div className="mt-3 flex items-center gap-3 text-[13px]">
                    <button
                      aria-label={`Decrease ${p.name}`}
                      onClick={() => setQty(l.id, l.qty - 1)}
                      className="h-7 w-7 rounded-full border border-espresso/25 hover:bg-espresso hover:text-ivory"
                    >
                      −
                    </button>
                    <span className="w-4 text-center tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      aria-label={`Increase ${p.name}`}
                      onClick={() => setQty(l.id, l.qty + 1)}
                      className="h-7 w-7 rounded-full border border-espresso/25 hover:bg-espresso hover:text-ivory"
                    >
                      +
                    </button>
                    <button
                      onClick={() => remove(l.id)}
                      className="ml-3 text-[12px] text-muted underline underline-offset-4 hover:text-espresso"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {p.price != null && (
                  <div className="text-[14px] tabular-nums">
                    ${p.price * l.qty}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted">Subtotal ({count})</span>
            <span className="font-display text-[30px] tabular-nums">
              ${subtotal}
            </span>
          </div>
          <button
            className="btn mt-5 w-full disabled:opacity-40"
            disabled={!lines.length}
            onClick={() =>
              setNote(
                "Checkout is not connected yet. Connect your payment provider to enable it.",
              )
            }
          >
            Checkout
          </button>
          {note && (
            <p className="mt-3 text-[12px] text-muted" role="status">
              {note}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
