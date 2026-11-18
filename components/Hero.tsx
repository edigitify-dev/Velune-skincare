"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { gsap, isMobile, prefersReducedMotion } from "@/lib/gsap";
import { scrollToHash } from "@/lib/scroll";
import type { LiquidState } from "./HeroLiquid";

const HeroLiquid = dynamic(() => import("./HeroLiquid"), { ssr: false });

/* ───────────────────────── config – tune these when your real images arrive ───────────────────────── */

const ASSETS = {
  bottle: "/hero/bottle.webp", // transparent PNG of the serum bottle (optional – a drawn placeholder is used until it exists)
  face: "/hero/face.webp", // close-up of the woman's face (optional – frame f_085 is used, colour-graded, until it exists)
  faceFallback: "/sequence/f_085.webp",
  flower: "/hero/flower.webp", // transparent PNG of a white blossom (optional – SVG blossoms are used until it exists)
};
// where the droplet lands, as a fraction of the viewport (x from left, y from top).
// For /hero/face.jpg this is recomputed on every resize from the cheekbone's position inside the photo (see placeFace).
const CHEEK = { x: 0.24, y: 0.42 };
const CHEEK_FALLBACK = { x: 0.5, y: 0.62 }; // for the temporary frame
// /hero/face.jpg: pixel size + the cheekbone contact point as a fraction of the photo
const FACE_PHOTO = { w: 1920, h: 819, cx: 0.19, cy: 0.47 };
const FACE_H = 1.24; // face layer height in viewport heights (it hangs 24vh above the viewport once risen)

// scroll choreography: the timeline is D units long, every beat is placed as a fraction of it
const D = 16;
const at = (p: number) => p * D;

const INK = "#3B2A1D";

/* ───────────────────────── small pieces ───────────────────────── */

function useAsset(src: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setOk(true);
    i.onerror = () => setOk(false);
    i.src = src;
    return () => {
      i.onload = null;
      i.onerror = null;
    };
  }, [src]);
  return ok;
}

const PETAL = "M0 0 C-30 -20 -46 -64 -14 -92 Q0 -83 14 -92 C46 -64 30 -20 0 0Z";

function PetalGradient({ id }: { id: string }) {
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2="0"
      y2="-1"
      gradientUnits="objectBoundingBox"
    >
      <stop offset="0" stopColor="#EBC98F" />
      <stop offset=".28" stopColor="#FFF8EE" />
      <stop offset=".8" stopColor="#FFFDF9" />
      <stop offset="1" stopColor="#F4E1D0" />
    </linearGradient>
  );
}

/** single loose petal */
function Petal({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const id = "p" + useId().replace(/:/g, "");
  return (
    <svg
      viewBox="-50 -96 100 100"
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        <PetalGradient id={id} />
      </defs>
      <path
        d={PETAL}
        fill={`url(#${id})`}
        stroke="#E9CFB5"
        strokeWidth=".8"
        strokeOpacity=".6"
      />
      <path
        d="M0 -6 C2 -34 1 -58 0 -80"
        stroke="#E9CFB5"
        strokeWidth=".8"
        fill="none"
        strokeOpacity=".7"
      />
    </svg>
  );
}

/** five-petal blossom with gold stamens (swapped for /hero/flower.png when that file exists) */
function Flower({
  className,
  style,
  photo,
}: {
  className?: string;
  style?: React.CSSProperties;
  photo?: boolean;
}) {
  const id = "f" + useId().replace(/:/g, "");
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={ASSETS.flower}
        alt=""
        className={className}
        style={style}
        draggable={false}
      />
    );
  }
  return (
    <svg
      viewBox="-110 -110 220 220"
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        <PetalGradient id={id} />
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`rotate(${i * 72 + (i % 2) * 4})`}>
          <path
            d={PETAL}
            fill={`url(#${id})`}
            stroke="#EAD3BC"
            strokeWidth=".9"
            strokeOpacity=".7"
          />
          <path
            d="M0 -8 C2 -34 1 -58 0 -78"
            stroke="#E9CFB5"
            strokeWidth=".8"
            fill="none"
            strokeOpacity=".7"
          />
        </g>
      ))}
      <circle r="9" fill="#F0C46C" opacity=".9" />
      {Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2,
          l = 24 + (i % 3) * 7;
        return (
          <g key={i}>
            <line
              x1="0"
              y1="0"
              x2={Math.cos(a) * l}
              y2={Math.sin(a) * l}
              stroke="#E3A33B"
              strokeWidth="1.2"
            />
            <circle
              cx={Math.cos(a) * l}
              cy={Math.sin(a) * l}
              r="2.6"
              fill="#E8A92E"
            />
          </g>
        );
      })}
    </svg>
  );
}

const Icon = {
  leaf: (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
      <path d="M5 19c3-5 6-8 10-10" />
    </svg>
  ),
  drop: (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3c3.5 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.5-6.5 6-11Z" />
      <path d="M9.5 14.5a2.6 2.6 0 0 0 2 2.4" />
    </svg>
  ),
  spark: (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 4c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6Z" />
      <path d="M18 14c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  ),
  arrow: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  down: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  ),
};

const FEATURES = [
  { icon: Icon.leaf, label: "Deep\nHydration" },
  { icon: Icon.drop, label: "Restores\nSkin Barrier" },
  { icon: Icon.spark, label: "Natural\nRadiance" },
];

// loose petals drifting through the scene (x/y in %, w in vw)
const PETALS = [
  { x: 79, y: 9, w: 6.5, r: 28, d: 0, t: 9, z: "a" },
  { x: 90, y: 4, w: 4.5, r: -40, d: 1.2, t: 11, z: "b" },
  { x: 66, y: 24, w: 2.8, r: 110, d: 2.4, t: 8, z: "b" },
  { x: 94, y: 38, w: 3.6, r: 160, d: 0.6, t: 10, z: "a" },
  { x: 49, y: 70, w: 3.2, r: 70, d: 1.8, t: 12, z: "a" },
  { x: 88, y: 64, w: 5, r: -20, d: 3, t: 9.5, z: "b" },
  { x: 7, y: 30, w: 3, r: 200, d: 2, t: 10.5, z: "a" },
  { x: 36, y: 12, w: 2.4, r: -75, d: 0.3, t: 7.5, z: "b" },
  { x: 58, y: 86, w: 4, r: 130, d: 1, t: 11.5, z: "b" },
];

/* ───────────────────────── hero ───────────────────────── */

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<LiquidState>({
    ph: 0,
    def: 0,
    break: 0,
    gone: 0,
    spread: 0,
    conv: 0,
    lift: 0,
    fall: 0,
    splat: 0,
    fade: 0,
    bottle: 1,
  });
  const [active, setActive] = useState(true);
  const [mobile, setMobile] = useState(false);
  const hasFace = useAsset(ASSETS.face);
  const hasFlower = useAsset(ASSETS.flower);
  // one mutable object: placeFace() updates it in place, HeroLiquid reads it every frame
  const cheek = useRef({ ...CHEEK_FALLBACK }).current;

  // position the face photo + the droplet's landing point so the droplet always hits the cheekbone, at any aspect ratio
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const place = () => {
      const img = el.querySelector<HTMLImageElement>(".h-face-img");
      const cam = el.querySelector<HTMLElement>(".h-face-cam");
      const skin = el.querySelector<HTMLElement>(".h-skin");
      const vw = window.innerWidth,
        vh = window.innerHeight;
      if (hasFace) {
        const eh = vh * FACE_H;
        const sc = Math.max(vw / FACE_PHOTO.w, eh / FACE_PHOTO.h);
        const W = FACE_PHOTO.w * sc,
          H = FACE_PHOTO.h * sc;
        const wide = vw / vh >= 1.25;
        const px = wide
          ? 0.1
          : Math.min(
              1,
              Math.max(0, (FACE_PHOTO.cx * W - vw * 0.5) / Math.max(1, W - vw)),
            );
        const offX = (W - vw) * px,
          offY = (H - eh) * 0.6;
        cheek.x = (FACE_PHOTO.cx * W - offX) / vw;
        cheek.y = (vh - eh + FACE_PHOTO.cy * H - offY) / vh;
        if (img) img.style.objectPosition = `${px * 100}% 60%`;
      } else {
        cheek.x = CHEEK_FALLBACK.x;
        cheek.y = CHEEK_FALLBACK.y;
      }
      // camera push-in pivots on the cheek, so the contact point never slides
      if (cam)
        cam.style.transformOrigin = `${cheek.x * 100}% ${((cheek.y * vh + (vh * FACE_H - vh)) / (vh * FACE_H)) * 100}%`;
      if (skin) {
        skin.style.left = `${cheek.x * 100}%`;
        skin.style.top = `${cheek.y * 100}%`;
      }
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [hasFace, cheek]);

  useEffect(() => {
    setMobile(isMobile());
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      rootMargin: "10% 0px",
    });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!root.current) return;
    const reduced = prefersReducedMotion();
    let onMove: ((e: PointerEvent) => void) | null = null;

    const ctx = gsap.context(() => {
      // cursor parallax on the floating petals / blossoms (two depths)
      if (!reduced) {
        const ax = gsap.quickTo(".h-par-a", "x", {
          duration: 1.6,
          ease: "power3.out",
        });
        const ay = gsap.quickTo(".h-par-a", "y", {
          duration: 1.6,
          ease: "power3.out",
        });
        const bx = gsap.quickTo(".h-par-b", "x", {
          duration: 1.2,
          ease: "power3.out",
        });
        const by = gsap.quickTo(".h-par-b", "y", {
          duration: 1.2,
          ease: "power3.out",
        });
        onMove = (e) => {
          const nx = e.clientX / window.innerWidth - 0.5,
            ny = e.clientY / window.innerHeight - 0.5;
          ax(nx * -16);
          ay(ny * -10);
          bx(nx * -34);
          by(ny * -22);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
      }
      if (reduced) {
        // no scroll film: keep the hero as a still frame
        gsap.set(".h-face, .h-final, .h-skin, .h-scrim", { autoAlpha: 0 });
        return;
      }

      gsap.set(".h-face", { yPercent: 100 });
      gsap.set(".h-final, .h-scrim", { autoAlpha: 0 });
      gsap.set(".h-line", { yPercent: 112 });
      gsap.set(".h-sub, .h-cta", { autoAlpha: 0, y: 18 });
      gsap.set(".h-glow", { autoAlpha: 0, scale: 0.15 });

      const S = state.current;
      const end = isMobile() ? "+=440%" : "+=600%";
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end,
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
        },
      });

      // everything below is a tween of one scrubbed timeline: forward scroll plays it, reverse scroll rewinds it,
      // and nothing advances on its own. (ph = overall progress, used as the phase for ripples / drift.)
      tl.to(S, { ph: 1, duration: D }, 0)

        // 0–6 ▸ the hero UI leaves almost immediately: gone after roughly a third of a screen of scrolling
        .to(".h-scroll", { autoAlpha: 0, duration: 0.5 }, 0)
        .to(
          ".h-copy",
          {
            autoAlpha: 0,
            y: -50,
            filter: "blur(8px)",
            duration: at(0.06),
            ease: "power2.out",
          },
          0,
        )
        .to(
          ".h-feat",
          { autoAlpha: 0, x: 40, duration: at(0.05), ease: "power2.out" },
          at(0.01),
        )

        // 20–35 ▸ a hairline crack appears where the ball is hit and spiders out across the glass (bottle still inside)
        .to(S, { def: 1, duration: at(0.15), ease: "power1.in" }, at(0.2))
        .to(
          ".h-petals",
          { autoAlpha: 0, y: -90, duration: at(0.3), ease: "power1.in" },
          at(0.22),
        )

        // 35–57 ▸ the ball SHATTERS: flash, glass bursts into tumbling shards that fly toward the viewer and hang in the air
        .to(S, { break: 1, duration: at(0.22), ease: "none" }, at(0.35))
        // the shards melt away while the bottle is left floating, then dissolves into a single serum drop
        .to(S, { gone: 1, duration: at(0.14), ease: "power1.inOut" }, at(0.44))
        .to(
          S,
          { bottle: 0, duration: at(0.13), ease: "power1.inOut" },
          at(0.43),
        )
        .to(".h-water", { autoAlpha: 0, duration: at(0.14) }, at(0.38))

        // 57–72 ▸ the serum drop drifts to the middle of the stage
        .to(S, { conv: 1, duration: at(0.17), ease: "none" }, at(0.57))

        // 72–88 ▸ she rises from the bottom (parallax + a slow settle) while the primary drop hovers above her
        .to(
          ".h-face",
          { yPercent: 0, duration: at(0.2), ease: "power2.inOut" },
          at(0.66),
        )
        .fromTo(
          ".h-face-img",
          { scale: 1.14, yPercent: 4 },
          { scale: 1, yPercent: 0, duration: at(0.24), ease: "power1.out" },
          at(0.66),
        )
        .to(S, { lift: 1, duration: at(0.12), ease: "power2.out" }, at(0.7))

        // 88–100 ▸ the drop falls (camera tilts after it), lands, flattens into a film, is absorbed
        .to(
          ".h-face-cam",
          { scale: 1.06, duration: at(0.17), ease: "sine.inOut" },
          at(0.83),
        )
        .to(S, { fall: 1, duration: at(0.075), ease: "power1.inOut" }, at(0.83))
        .to(S, { fade: 1, duration: at(0.06), ease: "power1.inOut" }, at(0.905))
        .to(
          ".h-glow",
          { autoAlpha: 0.5, scale: 1, duration: at(0.06), ease: "power2.out" },
          at(0.915),
        )

        // mobile readability scrim: eases in slowly, starting before the headline appears
        .to(
          ".h-scrim",
          { autoAlpha: 1, duration: at(0.09), ease: "sine.inOut" },
          at(0.88),
        )

        // final message: line by line, then the support line, then the CTA
        .set(".h-final", { autoAlpha: 1 }, at(0.93))
        .to(
          ".h-line",
          {
            yPercent: 0,
            duration: at(0.04),
            ease: "power3.out",
            stagger: at(0.014),
          },
          at(0.93),
        )
        .to(
          ".h-sub",
          { autoAlpha: 1, y: 0, duration: at(0.035), ease: "power2.out" },
          at(0.96),
        )
        .to(
          ".h-cta",
          { autoAlpha: 1, y: 0, duration: at(0.035), ease: "power2.out" },
          at(0.98),
        )
        .to({}, { duration: 0.8 }, D);
    }, root);

    return () => {
      if (onMove) window.removeEventListener("pointermove", onMove);
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={root}
      id="top"
      className="relative h-screen w-full overflow-hidden"
      style={{ color: INK }}
    >
      {/* ── 1. atmosphere ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(95% 85% at 62% 40%, #FCF1E5 0%, #F3DDC9 52%, #E4C6AE 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -inset-[10%] opacity-70 mix-blend-soft-light blur-[26px]"
        style={{
          background:
            "linear-gradient(112deg, transparent 18%, rgba(255,255,255,.75) 30%, transparent 42%, rgba(255,255,255,.5) 56%, transparent 70%)",
        }}
      />
      {[
        ["14%", "62%", 90, 0.35],
        ["46%", "16%", 60, 0.3],
        ["72%", "70%", 120, 0.28],
        ["30%", "82%", 50, 0.35],
      ].map(([x, y, s, o], i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-full blur-[14px]"
          style={{
            left: x as string,
            top: y as string,
            width: s as number,
            height: s as number,
            opacity: o as number,
            background:
              "radial-gradient(circle, rgba(255,246,232,.95), rgba(255,246,232,0) 70%)",
          }}
        />
      ))}

      {/* water surface + ripples under the sphere */}
      <div className="h-water pointer-events-none absolute inset-x-0 bottom-0 h-[34%]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(226,198,174,0) 0%, rgba(214,176,146,.42) 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-[40%] h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        {[0, 1.8, 3.6].map((d) => (
          <span
            key={d}
            className="absolute bottom-[10%] left-1/2 h-[9vmin] w-[48vmin] rounded-[50%] border border-white/70 lg:left-[63%]"
            style={{
              animation: `hRipple 5.4s ${d}s cubic-bezier(.2,.6,.3,1) infinite`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* ── 2. blossoms + petals ── */}
      <div className="h-petals pointer-events-none absolute inset-0 z-[1]">
        <div className="h-par-a absolute inset-0">
          <Flower
            photo={hasFlower}
            className="absolute -bottom-[9vh] -left-[7vw] w-[31vw] min-w-[200px] max-w-[560px] rotate-[14deg] drop-shadow-[0_14px_22px_rgba(120,80,50,.16)]"
          />
          <Flower
            photo={hasFlower}
            className="absolute -right-[4vw] -top-[5vh] w-[15vw] min-w-[110px] -rotate-[24deg] opacity-90 drop-shadow-[0_10px_16px_rgba(120,80,50,.14)]"
          />
          {PETALS.filter((p) => p.z === "a").map((p, i) => (
            <Petal
              key={i}
              className="hPetal absolute drop-shadow-[0_6px_10px_rgba(120,80,50,.14)]"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}vw`,
                minWidth: 28,
                ["--r" as string]: `${p.r}deg`,
                animationDuration: `${p.t}s`,
                animationDelay: `${-p.d}s`,
              }}
            />
          ))}
        </div>
        <div className="h-par-b absolute inset-0">
          <Flower
            photo={hasFlower}
            className="absolute -bottom-[5vh] right-[2vw] w-[19vw] min-w-[130px] max-w-[360px] -rotate-[8deg] drop-shadow-[0_14px_22px_rgba(120,80,50,.18)] max-lg:right-[-6vw]"
          />
          <Flower
            photo={hasFlower}
            className="absolute bottom-[6vh] left-[22vw] hidden w-[7vw] rotate-[40deg] lg:block drop-shadow-[0_8px_14px_rgba(120,80,50,.15)]"
          />
          {PETALS.filter((p) => p.z === "b").map((p, i) => (
            <Petal
              key={i}
              className="hPetal absolute drop-shadow-[0_6px_10px_rgba(120,80,50,.16)]"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}vw`,
                minWidth: 28,
                ["--r" as string]: `${p.r}deg`,
                animationDuration: `${p.t}s`,
                animationDelay: `${-p.d}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── 3. copy (left) ── */}
      <div className="h-copy pointer-events-none absolute inset-0 z-[2] flex flex-col px-[6vw] pb-[10vh] pt-[16vh] lg:w-[48%] lg:justify-center lg:px-0 lg:pb-0 lg:pl-[5.5vw] lg:pt-0">
        <p className="text-[11px] tracking-[0.3em] text-[#5B4333]">
          BOTANICAL&nbsp;&nbsp;•&nbsp;&nbsp;EFFECTIVE&nbsp;&nbsp;•&nbsp;&nbsp;GENTLE
        </p>
        <h1 className="font-display mt-5 text-[clamp(42px,5.5vw,96px)] font-normal italic leading-[1.02] tracking-[-0.012em]">
          Everyday Care
          <br />
          for Radiant Skin
        </h1>
        <p className="mt-5 max-w-[340px] text-[14px] leading-[1.75] text-[#5B4333] lg:mt-7">
          Thoughtfully crafted skincare with the purity of botanicals and the
          power of science.
        </p>
        <div className="pointer-events-auto mt-auto flex items-center gap-5 lg:mt-10">
          <a
            href="#shop"
            onClick={(e) => {
              e.preventDefault();
              scrollToHash("#shop");
            }}
            className="btn gap-3 !h-[50px] !px-7 !bg-[#3B2A1D] hover:!bg-[#A97956]"
          >
            Shop the Collection {Icon.arrow}
          </a>
          <button
            onClick={() => scrollToHash("#film")}
            className="group flex items-center gap-3 text-[13px] tracking-[0.04em]"
          >
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[#3B2A1D]/35 bg-white/30 pl-[2px] backdrop-blur-sm transition-colors duration-500 group-hover:bg-[#3B2A1D] group-hover:text-[#F5F0E9]">
              {Icon.play}
            </span>
            Our Story
          </button>
        </div>
      </div>

      {/* benefits (right) */}
      <ul className="h-feat pointer-events-none absolute right-[3vw] top-1/2 z-[2] hidden -translate-y-1/2 flex-col gap-7 xl:flex">
        {FEATURES.map((f) => (
          <li
            key={f.label}
            className="flex flex-col items-center gap-2 text-center text-[12px] leading-[1.35] text-[#3B2A1D]"
          >
            <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-[#3B2A1D]/25 bg-white/35 backdrop-blur-sm">
              {f.icon}
            </span>
            <span className="whitespace-pre-line">{f.label}</span>
          </li>
        ))}
      </ul>

      {/* ── 4. the face (rises from the bottom) ── */}
      <div
        className="h-face pointer-events-none absolute bottom-0 left-0 right-0 z-[3] h-[124vh]"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, #000 24vh)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 24vh)",
        }}
      >
        <div className="h-face-cam absolute inset-0 will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hasFace ? ASSETS.face : ASSETS.faceFallback}
            alt=""
            className="h-face-img h-full w-full object-cover"
            style={{
              objectPosition: hasFace ? "10% 60%" : "62% 55%",
              filter: hasFace
                ? undefined
                : "sepia(.28) saturate(1.2) contrast(1.04) brightness(.98)",
            }}
          />
          {!hasFace && (
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ background: "linear-gradient(115deg,#F6D9C0,#E8BC9C)" }}
            />
          )}
          {/* keep the right side calm for the closing headline */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to left, rgba(246,228,212,.62) 0%, rgba(246,228,212,0) 52%)",
            }}
          />
        </div>
      </div>

      {/* soft hydrated glow where the drop dissolves */}
      <div
        className="h-skin pointer-events-none absolute z-[4] aspect-square w-[26vmin] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${cheek.x * 100}%`, top: `${cheek.y * 100}%` }}
      >
        <div
          className="h-glow absolute -inset-[25%] rounded-full mix-blend-soft-light"
          style={{
            background:
              "radial-gradient(circle, rgba(255,244,224,.95) 0%, rgba(255,226,186,.55) 38%, rgba(255,226,186,0) 70%)",
          }}
        />
      </div>

      {/* ── 5. liquid (WebGL) ── */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <HeroLiquid
          state={state.current}
          active={active}
          mobile={mobile}
          cheek={cheek}
          bottleSrc={ASSETS.bottle}
        />
      </div>

      {/* mobile only: soft warm scrim behind the closing text; fades in on its own timeline tween */}
      <div
        aria-hidden
        className="h-scrim pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[55vh] md:hidden"
        style={{
          opacity: 0,
          visibility: "hidden",
          background:
            "linear-gradient(to top, rgba(246,228,212,.7) 0%, rgba(246,228,212,.62) 22%, rgba(246,228,212,.45) 42%, rgba(246,228,212,.24) 62%, rgba(246,228,212,.09) 80%, rgba(246,228,212,0) 100%)",
        }}
      />

      {/* ── 6. closing message ── */}
      <div className="h-final pointer-events-none absolute right-[6vw] top-1/2 z-[6] -translate-y-1/2 text-right max-md:left-[6vw] max-md:top-auto max-md:bottom-[12vh] max-md:translate-y-0">
        <h2 className="font-display text-[clamp(38px,5vw,86px)] font-normal leading-[1.04] tracking-[-0.01em] max-md:text-[clamp(44px,14vw,58px)]">
          <span className="block overflow-hidden pb-[.1em]">
            <span className="h-line block">Nature’s Ritual</span>
          </span>
          <span className="block overflow-hidden pb-[.1em]">
            <span className="h-line block">for Lasting Glow.</span>
          </span>
        </h2>
        <p className="h-sub ml-auto mt-5 max-w-[360px] text-[14px] leading-[1.75] text-[#5B4333] max-md:ml-0 max-md:text-[15px] max-md:font-medium max-md:text-[#2A1A10] max-md:[text-shadow:0_0_10px_rgba(246,228,212,.9),0_0_3px_rgba(246,228,212,.9)] max-md:text-left">
          Thoughtfully crafted care for skin that deserves a little more
          attention.
        </p>
        <a
          href="#shop"
          onClick={(e) => {
            e.preventDefault();
            scrollToHash("#shop");
          }}
          className="h-cta btn pointer-events-auto mt-8 gap-3 !bg-[#3B2A1D] hover:!bg-[#A97956]"
        >
          Shop the Collection {Icon.arrow}
        </a>
      </div>

      {/* scroll cue */}
      <div className="h-scroll absolute bottom-[4vh] left-[6vw] z-[6] hidden items-center gap-3 text-[11px] tracking-[0.12em] text-[#5B4333] lg:flex lg:left-[5.5vw]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3B2A1D]/30 bg-white/25 backdrop-blur-sm">
          {Icon.down}
        </span>
        Scroll to explore
      </div>

      <style>{`
        @keyframes hRipple { 0%{ transform:translateX(-50%) scale(.45); opacity:0 } 15%{ opacity:.75 } 100%{ transform:translateX(-50%) scale(1.5); opacity:0 } }
        @keyframes hDrift { 0%,100%{ transform: translate3d(0,0,0) rotate(var(--r)) } 50%{ transform: translate3d(14px,-18px,0) rotate(calc(var(--r) + 14deg)) } }
        .hPetal{ animation: hDrift 9s ease-in-out infinite; will-change: transform }
      `}</style>
    </section>
  );
}
