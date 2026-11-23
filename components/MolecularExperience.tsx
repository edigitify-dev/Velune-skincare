"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  gsap,
  ScrollTrigger,
  isMobile,
  prefersReducedMotion,
} from "@/lib/gsap";
import { scrollToHash } from "@/lib/scroll";
import { getTier } from "@/lib/quality";
import { COLLECTION, INGREDIENTS } from "@/lib/collection";
import type { CarouselState, ExpState, Mouse } from "./molecule/types";
import StaticCollection from "./molecule/StaticCollection";
import { preloadAtlas } from "./molecule/atlas";

const MolecularScene = dynamic(() => import("./molecule/MolecularScene"), {
  ssr: false,
});

const webglOK = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};
const ESP = [51, 36, 31],
  IVO = [245, 240, 233];

/** Left-hand stage captions. `b` is set in italic on the second line (desktop) / same line (mobile). */
const CAPS = [
  {
    k: "The Formula",
    a: "Nature,",
    b: "decoded.",
    s: "Every powerful ritual begins with a carefully chosen element.",
  },
  {
    k: "The Bonds",
    a: "Elements,",
    b: "connected.",
    s: "Connections form between them.",
  },
  {
    k: "The Formulation",
    a: "Many,",
    b: "made one.",
    s: "One structure, from many.",
  },
];

/**
 * THE MOLECULAR TRANSFORMATION — one pinned, scrubbed film:
 *  ingredients → bonds → molecular sphere → glass shatter → product reveal → interactive 3D carousel.
 * Everything in the scene is a pure function of the state object tweened below.
 */
export default function MolecularExperience() {
  const root = useRef<HTMLElement>(null);
  const drag = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const shown = useRef(0); // last hovered ingredient, so the card keeps its content while it fades out
  const lastRef = useRef({ x: 0, t: 0 });
  const wheelAcc = useRef(0);

  const S = useMemo<ExpState>(
    () => ({
      p: 0,
      emerge: 1, // ingredients are already visible when the section pins (no empty first screen)
      bonds: 0,
      dense: 0,
      gather: 0,
      rot: 0,
      crack: 0,
      detach: 0,
      shatter: 0,
      frag: 0,
      dark: 0,
      prod: 0,
      camZ: 10.5,
      camY: 0,
      orbit: 0,
    }),
    [],
  );
  const car = useMemo<CarouselState>(
    () => ({
      pos: 1,
      target: 1,
      dragging: false,
      startPos: 0,
      startX: 0,
      vel: 0,
      active: 1,
      spacing: 2.35,
      interactive: false,
    }),
    [],
  );
  const mouse = useMemo<Mouse>(() => ({ x: 0, y: 0, sx: 0, sy: 0 }), []);

  const [mode, setMode] = useState<"pending" | "film" | "static">("pending");
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false); // scene code + hexagon sheet are downloaded and prepared
  const [visible, setVisible] = useState(false);
  const [lite, setLite] = useState(false);
  const [hover, setHover] = useState(-1);
  const [active, setActive] = useState(1);

  useEffect(() => {
    const tier = getTier();
    setMode(
      prefersReducedMotion() || !webglOK() || tier === "low"
        ? "static"
        : "film",
    );
    setLite(tier !== "high");

    // Warm the 3D chunk so it's cached before the section gets near the viewport
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const idle: (f: () => void) => void =
      w.requestIdleCallback || ((f: () => void) => setTimeout(f, 800));
    // …and prepare the hexagon picture sheet too (download + decode + paint). Only the real 3D film needs it.
    // When both are done the scene is allowed to mount (see `ready` below).
    if (prefersReducedMotion() || !webglOK() || tier === "low") {
      idle(() => {
        import("./molecule/MolecularScene");
      });
    } else {
      const lt = tier !== "high";
      const start = () => {
        Promise.all([import("./molecule/MolecularScene"), preloadAtlas(lt)])
          .catch(() => {})
          .then(() => setReady(true));
      };
      if (w.requestIdleCallback)
        w.requestIdleCallback(start, { timeout: 1200 });
      else setTimeout(start, 400);
    }
  }, []);

  const go = useCallback(
    (n: number) => {
      car.target = Math.min(
        COLLECTION.length - 1,
        Math.max(0, Math.round(car.target) + n),
      );
      setActive(car.target); // update the label right away; the 3D carousel follows on its own spring
    },
    [car],
  );

  useEffect(() => {
    if (mode !== "film") return;
    const el = root.current!;
    // `visible` (render loop on) keeps the old 2.5-screen lead; `near` (mount the canvas, compile shaders,
    // upload textures) now fires while the user is still in the hero, so the scene is fully warmed up and
    // already showing its tiles by the time this section arrives. Light-mode devices keep the short lead
    // (and free the canvas again when scrolled away) to save memory.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "250% 0px",
    });
    io.observe(el);
    const ioNear = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
        else if (lite) setNear(false);
      },
      { rootMargin: lite ? "250% 0px" : "1200% 0px" },
    );
    ioNear.observe(el);

    const onMove = (e: PointerEvent) => {
      mouse.sx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.sy = -((e.clientY / window.innerHeight) * 2 - 1);
      if (tip.current) {
        const w = tip.current.offsetWidth,
          h = tip.current.offsetHeight;
        let x = e.clientX + 22,
          y = e.clientY + 22;
        if (x + w > window.innerWidth - 12) x = e.clientX - 22 - w;
        if (y + h > window.innerHeight - 12) y = e.clientY - 22 - h;
        tip.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const onResize = () => {
      const a = window.innerWidth / window.innerHeight;
      car.spacing = a < 0.9 ? 1.45 : a < 1.3 ? 1.9 : 2.35;
    };
    onResize();
    window.addEventListener("resize", onResize);

    const ctx = gsap.context(() => {
      const mob = isMobile();
      gsap.set(".mol-cap", { autoAlpha: 0, y: 14 });
      gsap.set(".mol-cap-1", { autoAlpha: 1, y: 0 }); // caption 1 is visible from the very start
      gsap.set(".mol-ui", { autoAlpha: 0, y: 24 });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: mob ? "+=520%" : "+=720%",
          pin: true,
          anticipatePin: 1,
          scrub: 0.8,
          onUpdate: (st) => {
            const on = st.progress >= 0.9;
            if (car.interactive !== on) {
              car.interactive = on;
              if (drag.current)
                drag.current.style.pointerEvents = on ? "auto" : "none";
              if (actions.current)
                actions.current.style.pointerEvents = on ? "auto" : "none";
            }
          },
        },
        onUpdate: () => {
          const m = (i: number) =>
            Math.round(ESP[i] + (IVO[i] - ESP[i]) * Math.min(1, S.dark * 1.05));
          el.style.setProperty("--mol-ink", `rgb(${m(0)},${m(1)},${m(2)})`);
          if (darkRef.current)
            darkRef.current.style.opacity = String(Math.min(1, S.dark) * 0.94);
          if (tintRef.current)
            tintRef.current.style.opacity = String(S.prod * 0.85);
        },
      });
      const T = tl;
      // 0–15  ingredients are already out; just dolly the camera, then fade caption 1 away
      T.to(S, { p: 1, duration: 1 }, 0)
        .to(".mol-cap-1", { autoAlpha: 0, y: -10, duration: 0.03 }, 0.14)
        // 15–35  bonds form, web densifies
        .to(S, { bonds: 1, duration: 0.2, ease: "power1.inOut" }, 0.14)
        .to(S, { dense: 1, duration: 0.2, ease: "power1.inOut" }, 0.17)
        .to(
          ".mol-cap-2",
          { autoAlpha: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.17,
        )
        .to(".mol-cap-2", { autoAlpha: 0, y: -10, duration: 0.03 }, 0.32)
        // 35–55  everything flows inward and curves into the sphere; the world darkens
        .to(S, { gather: 1, duration: 0.21, ease: "power2.inOut" }, 0.34)
        .to(S, { dark: 1, duration: 0.14, ease: "power1.inOut" }, 0.3)
        .to(
          ".mol-cap-3",
          { autoAlpha: 1, y: 0, duration: 0.04, ease: "power2.out" },
          0.46,
        )
        .to(".mol-cap-3", { autoAlpha: 0, y: -10, duration: 0.03 }, 0.66)
        // camera: slow dolly, then close in on the sphere, orbit, then settle for the carousel
        .to(S, { camZ: 9.2, duration: 0.34 }, 0)
        .to(S, { camZ: 7.9, duration: 0.21, ease: "power2.inOut" }, 0.34)
        .to(S, { camZ: 7.1, duration: 0.15 }, 0.55)
        .to(S, { camZ: 7.7, duration: 0.14, ease: "power2.inOut" }, 0.76)
        .to(
          S,
          { orbit: 0.42, camY: 0.25, duration: 0.3, ease: "power1.inOut" },
          0.4,
        )
        .to(
          S,
          { orbit: 0, camY: 0, duration: 0.14, ease: "power2.inOut" },
          0.74,
        )
        // 55–70  majestic rotation, cracks travel across the glass, pieces lift off
        .to(S, { rot: 2.4, duration: 0.36 }, 0.34)
        .to(S, { rot: 3.2, duration: 0.3, ease: "power2.out" }, 0.7)
        .to(S, { crack: 1, duration: 0.13, ease: "power1.in" }, 0.55)
        .to(S, { detach: 1, duration: 0.08, ease: "power1.in" }, 0.62)
        // 70–80  the shatter: burst, then slow motion
        .to(S, { shatter: 1, duration: 0.22, ease: "power4.out" }, 0.69)
        .to(S, { frag: 1, duration: 0.12, ease: "power1.inOut" }, 0.78)
        .to(S, { dark: 0, duration: 0.14, ease: "power1.inOut" }, 0.72)
        // 80–90  the collection emerges from behind the glass
        .to(S, { prod: 1, duration: 0.12, ease: "power2.out" }, 0.77)
        .to(
          ".mol-ui",
          { autoAlpha: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.86,
        )
        // 90–100 hold: the carousel is live, the pin releases cleanly after this
        .to({}, { duration: 0.02 }, 0.98);
    }, el);

    // This trigger is created one render later than its siblings (mode check), so put every trigger back into
    // document order before measuring; otherwise pins that come after this section start too early.
    ScrollTrigger.sort((a: ScrollTrigger, b: ScrollTrigger) => {
      const A = a.trigger as Element | undefined,
        B = b.trigger as Element | undefined;
      if (!A || !B || A === B) return 0;
      return A.compareDocumentPosition(B) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    ScrollTrigger.refresh();

    return () => {
      io.disconnect();
      ioNear.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, [mode, lite, S, car, mouse]);

  // Static version has a different height than the pinned film: re-measure every trigger below it.
  useEffect(() => {
    if (mode !== "static") return;
    const id = requestAnimationFrame(() => {
      ScrollTrigger.sort((a: ScrollTrigger, b: ScrollTrigger) => {
        const A = a.trigger as Element | undefined,
          B = b.trigger as Element | undefined;
        if (!A || !B || A === B) return 0;
        return A.compareDocumentPosition(B) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [mode]);

  /* ───── carousel input: drag (mouse + touch), buttons, keys, horizontal trackpad ───── */
  const down = (e: React.PointerEvent) => {
    if (!car.interactive) return;
    car.dragging = true;
    car.startPos = car.pos;
    car.startX = e.clientX;
    car.vel = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    lastRef.current = { x: e.clientX, t: performance.now() };
  };
  const upUnit = () =>
    window.innerWidth < 768
      ? window.innerWidth * 0.5
      : window.innerWidth * 0.26;
  const move = (e: React.PointerEvent) => {
    if (!car.dragging) return;
    const u = upUnit();
    car.pos = Math.min(
      COLLECTION.length - 1 + 0.35,
      Math.max(-0.35, car.startPos - (e.clientX - car.startX) / u),
    );
    const now = performance.now(),
      dt = Math.max(1, now - lastRef.current.t);
    car.vel =
      car.vel * 0.7 +
      (-(e.clientX - lastRef.current.x) / u / (dt / 1000)) * 0.3;
    lastRef.current = { x: e.clientX, t: now };
  };
  const up = () => {
    if (!car.dragging) return;
    car.dragging = false;
    car.target = Math.min(
      COLLECTION.length - 1,
      Math.max(0, Math.round(car.pos + car.vel * 0.16)),
    );
  };
  const wheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) {
      wheelAcc.current += e.deltaX;
      if (Math.abs(wheelAcc.current) > 60) {
        go(wheelAcc.current > 0 ? 1 : -1);
        wheelAcc.current = 0;
      }
    }
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  if (mode === "static") return <StaticCollection />;
  if (hover >= 0) shown.current = hover;
  const ing = INGREDIENTS[shown.current];
  const on = hover >= 0;
  const item = COLLECTION[active];

  return (
    <section
      ref={root}
      id="molecular"
      className="relative h-screen w-full overflow-hidden bg-nude"
      style={{ ["--mol-ink" as string]: "rgb(51,36,31)" }}
    >
      {/* background: studio image, an espresso wash for the dark sphere stage, a product tint for the carousel */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/bg/golden-glass-waves.webp')" }}
      />
      <div
        ref={darkRef}
        aria-hidden
        className="absolute inset-0"
        style={{ background: "#29231F", opacity: 0 }}
      />
      <div
        ref={tintRef}
        aria-hidden
        className="absolute inset-0 transition-colors duration-700"
        style={{ backgroundColor: item.tint, opacity: 0 }}
      />

      {mode === "film" && near && ready && (
        <div className="absolute inset-0">
          <MolecularScene
            S={S}
            car={car}
            mouse={mouse}
            lite={lite}
            active={visible}
            onHover={setHover}
            onActive={setActive}
          />
        </div>
      )}

      {/* stage captions: bottom-left on every screen size, so the ingredient scene keeps the open space */}
      <div
        className="pointer-events-none absolute bottom-[7vh] left-[6vw] z-[6] grid max-w-[min(580px,80vw)] items-end md:bottom-[8vh] md:left-[5vw] md:max-w-[680px]"
        style={{ color: "var(--mol-ink)" }}
      >
        {CAPS.map((c, i) => (
          <div
            key={c.k}
            className={`mol-cap mol-cap-${i + 1} opacity-0 [grid-area:1/1]`}
          >
            <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.2em] opacity-80 md:text-[12px] md:tracking-[0.22em]">
              <span>
                0{i + 1} / {c.k}
              </span>
              <span className="hidden h-px w-14 bg-current opacity-50 md:block" />
            </div>
            <h2 className="font-display mt-2 text-[clamp(34px,9.5vw,48px)] leading-[0.98] tracking-[-0.015em] md:mt-4 md:text-[clamp(48px,4.4vw,80px)] md:leading-[1]">
              {c.a} <em className="italic">{c.b}</em>
            </h2>
            <p className="mt-2 max-w-[240px] text-[13px] leading-[1.45] opacity-75 md:mt-4 md:max-w-[420px] md:text-[clamp(15px,1.15vw,18px)] md:leading-[1.55]">
              {c.s}
            </p>
          </div>
        ))}
      </div>

      {/* scroll hint (desktop only, bottom-right so it never collides with the caption) */}
      <div
        className="mol-cap mol-cap-1 pointer-events-none absolute bottom-[8vh] right-[5vw] z-[6] hidden items-center gap-4 text-[11px] font-medium uppercase tracking-[0.2em] opacity-0 md:flex"
        style={{ color: "var(--mol-ink)" }}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full border border-current opacity-70">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 2v10M3 8l4 4 4-4" />
          </svg>
        </span>
        <span className="opacity-80">Scroll to explore</span>
      </div>

      {/* ingredient hover card (follows the pointer; content only changes when the hovered hexagon changes) */}
      <div
        ref={tip}
        className="pointer-events-none fixed left-0 top-0 z-[8]"
        style={{ willChange: "transform" }}
      >
        <div
          className={`relative flex items-center gap-4 overflow-hidden rounded-[28px] border border-[#E6C98F]/60 bg-gradient-to-br from-white/75 via-[#FBF3EA]/65 to-[#F1DDC6]/60 py-3 pl-3 pr-8 text-espresso shadow-[0_26px_50px_-16px_rgba(120,80,50,.5),0_0_44px_rgba(230,190,120,.4),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl transition-all duration-300 ease-out ${on ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"}`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ing.icon}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(201,161,94,.5)]"
          />
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.26em] text-[#A77C60]">
              <span>{String(shown.current + 1).padStart(2, "0")}</span>
              <span className="h-px w-5 bg-[#C9A15E]/70" />
              <span>{ing.role}</span>
            </div>
            <div className="font-display mt-1.5 text-[30px] italic leading-[1.02]">
              {ing.name}
            </div>
            <div className="mt-2.5 h-px w-full bg-gradient-to-r from-[#C9A15E]/70 via-[#C9A15E]/25 to-transparent" />
          </div>
        </div>
      </div>

      {/* product carousel input layer: only live once the film has finished */}
      <div
        ref={drag}
        role="group"
        aria-roledescription="carousel"
        aria-label="VELUNE collection"
        tabIndex={0}
        className="absolute inset-0 z-[5] cursor-grab touch-pan-y select-none outline-none active:cursor-grabbing"
        style={{ pointerEvents: "none" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onKeyDown={key}
      />

      {/* product information */}
      <div
        className="mol-ui pointer-events-none absolute inset-x-0 bottom-0 z-[7] flex flex-col justify-between gap-6 px-[5vw] pb-[6vh] md:flex-row md:items-end"
        style={{ color: "var(--mol-ink)" }}
      >
        <div className="max-w-[460px]">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {item.category} · {item.size}
          </div>
          <h3
            key={item.id}
            className="font-display mt-2 animate-[molIn_.7s_cubic-bezier(.2,.7,.2,1)] text-[clamp(32px,4.4vw,66px)] leading-[0.98]"
          >
            {item.name}
          </h3>
          <p
            key={item.id + "l"}
            className="mt-3 animate-[molIn_.9s_cubic-bezier(.2,.7,.2,1)] text-[13px] leading-[1.7] text-muted"
          >
            {item.line}
          </p>
        </div>
        <div
          ref={actions}
          className="flex flex-col items-start gap-5 md:items-end"
          style={{ pointerEvents: "none" }}
        >
          <div className="text-[12px] tabular-nums tracking-[0.12em] text-muted">
            {String(active + 1).padStart(2, "0")} /{" "}
            {String(COLLECTION.length).padStart(2, "0")}
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous product"
              onClick={() => go(-1)}
              disabled={active === 0}
              className="btn btn-ghost !h-[52px] !w-[52px] !p-0 disabled:opacity-30"
            >
              ←
            </button>
            <button
              aria-label="Next product"
              onClick={() => go(1)}
              disabled={active === COLLECTION.length - 1}
              className="btn btn-ghost !h-[52px] !w-[52px] !p-0 disabled:opacity-30"
            >
              →
            </button>
            <button className="btn" onClick={() => scrollToHash("#shop")}>
              Discover Product
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes molIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}
