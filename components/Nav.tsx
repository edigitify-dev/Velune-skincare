"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { scrollToHash } from "@/lib/scroll";

const LINKS = [
  { label: "Home", href: "#top" },
  { label: "Shop", href: "#shop" },
  { label: "Rituals", href: "#film" },
  { label: "About", href: "#formulation" },
];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export default function Nav() {
  const { count, setOpen } = useCart();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const [current, setCurrent] = useState("#top");

  useEffect(() => {
    const onScroll = () => {
      setSolid(window.scrollY > 60);
      // highlight the section currently under the header
      let cur = "#top";
      for (const l of LINKS) {
        const el = document.querySelector(l.href) as HTMLElement | null;
        if (
          el &&
          el.getBoundingClientRect().top <= window.innerHeight * 0.5 &&
          l.href !== "#top"
        )
          cur = l.href;
      }
      setCurrent(window.scrollY < window.innerHeight * 0.5 ? "#top" : cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setMenu(false);
    setTimeout(() => scrollToHash(href), 50);
  };

  const ink = menu ? "text-ivory" : "text-[#3B2A1D]";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] grid h-[76px] grid-cols-[1fr_auto_1fr] items-center px-[5vw] transition-all duration-500 ${
          solid ? "bg-ivory/60 backdrop-blur-md" : ""
        } ${menu ? "!bg-transparent !backdrop-blur-0" : ""}`}
      >
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            go("#top");
          }}
          aria-label="VELUNE home"
          className={`flex flex-col items-start leading-none transition-colors ${ink}`}
        >
          <span className="font-display text-[28px] tracking-[0.3em]">
            VELUNE
          </span>
          <span className="mt-[5px] pl-[2px] text-[8px] tracking-[0.42em] opacity-80">
            SKIN RITUALS
          </span>
        </a>

        <nav
          className="hidden items-center gap-12 md:flex"
          aria-label="Primary"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => {
                e.preventDefault();
                go(l.href);
              }}
              aria-current={current === l.href ? "page" : undefined}
              className="group relative text-[14px] tracking-[0.03em] text-[#3B2A1D]"
            >
              {l.label}
              <span
                className={`absolute -bottom-[7px] left-0 h-px w-full origin-left bg-[#3B2A1D] transition-transform duration-500 ${
                  current === l.href
                    ? "scale-x-100"
                    : "scale-x-0 bg-[#A97956] group-hover:scale-x-100"
                }`}
              />
            </a>
          ))}
        </nav>

        <div className="col-start-3 flex items-center justify-end gap-5">
          <button
            aria-label="Search"
            className={`hidden transition-colors hover:text-[#A97956] sm:block ${ink}`}
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" {...stroke}>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </button>
          <button
            aria-label="Account"
            className={`hidden transition-colors hover:text-[#A97956] sm:block ${ink}`}
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" {...stroke}>
              <circle cx="12" cy="8.5" r="3.8" />
              <path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
            </svg>
          </button>
          <button
            data-bag-target
            onClick={() => setOpen(true)}
            aria-label={`Open bag, ${count} items`}
            className={`relative transition-colors hover:text-[#A97956] ${ink}`}
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" {...stroke}>
              <path d="M5.5 8h13l-1 12h-11z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
            <span
              className={`absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] leading-none transition-colors ${
                count ? "bg-[#A97956] text-ivory" : "bg-[#3B2A1D] text-ivory"
              }`}
            >
              {count}
            </span>
          </button>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label="Menu"
            className={`relative z-10 flex h-8 w-8 flex-col items-end justify-center gap-[6px] md:hidden ${ink}`}
          >
            <span
              className={`h-px bg-current transition-all ${menu ? "w-6 translate-y-[3.5px] rotate-45" : "w-6"}`}
            />
            <span
              className={`h-px bg-current transition-all ${menu ? "w-6 -translate-y-[3.5px] -rotate-45" : "w-4"}`}
            />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[90] flex flex-col justify-center bg-charcoal px-[8vw] transition-opacity duration-500 md:hidden ${
          menu ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!menu}
      >
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={(e) => {
              e.preventDefault();
              go(l.href);
            }}
            className="font-display py-3 text-[11vw] leading-none text-ivory"
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  );
}
