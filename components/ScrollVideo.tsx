"use client";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const N_DESKTOP = 150;

const CAPTIONS = [
  {
    text: "Nature, thoughtfully formulated.",
    from: 0.09,
    to: 0.27,
    tone: "dark",
  },
  { text: "Every drop has a purpose.", from: 0.3, to: 0.45, tone: "dark" },
  { text: "Care in its purest form.", from: 0.5, to: 0.64, tone: "dark" },
  { text: "Return to your skin.", from: 0.78, to: 1.01, tone: "light" },
];

/* ───────────── Wrapper: picks desktop or mobile ───────────── */
export default function ScrollVideo() {
  // null until mounted → avoids SSR/hydration mismatch
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (mobile === null)
    return <section id="film" className="h-screen w-full bg-ivory" />;

  return mobile ? <MobileVideo /> : <DesktopSequence />;
}

/* ───────────── Mobile: simple rounded video ───────────── */
function MobileVideo() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (prefersReducedMotion()) return; // poster + controls only

    // Play only while visible (saves battery/data)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="film"
      className="relative flex w-full flex-col items-center bg-ivory px-5 py-16"
    >
      <p className="font-display mb-8 max-w-[85vw] text-center text-[clamp(28px,8vw,40px)] leading-[1.05] text-espresso">
        Nature, thoughtfully formulated.
      </p>

      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] bg-charcoal/5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
        <video
          ref={video}
          src="/video.mp4"
          poster="/poster.jpg"
          className="block aspect-[4/5] w-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          controls={prefersReducedMotion()}
          aria-label="VELUNE serum, from bottle to skin"
        />
      </div>

      <p className="font-display mt-8 text-center text-[22px] text-espresso/80">
        Return to your skin.
      </p>
    </section>
  );
}

/* ───────────── Desktop: scroll-driven frames ───────────── */
function DesktopSequence() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const sec = section.current,
      cv = canvas.current;
    if (!sec || !cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const N = N_DESKTOP;
    const url = (i: number) =>
      `/sequence/f_${String(i + 1).padStart(3, "0")}.webp`;
    const imgs: (HTMLImageElement | null)[] = Array(N).fill(null);

    let target = 0,
      lastDrawn = -1,
      started = false,
      dead = false;
    let lastW = 0,
      lastH = 0;

    const nearest = (i: number) => {
      for (let d = 0; d < N; d++) {
        if (imgs[i - d]) return imgs[i - d];
        if (imgs[i + d]) return imgs[i + d];
      }
      return null;
    };

    const draw = () => {
      const i = Math.round(target);
      if (i === lastDrawn) return;
      const img = nearest(i);
      if (!img) return;
      const cw = cv.width,
        ch = cv.height;
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s,
        h = img.naturalHeight * s;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      lastDrawn = i;
    };

    const resize = () => {
      const w = cv.clientWidth,
        h = cv.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      lastDrawn = -1;
      draw();
    };

    const startLoading = () => {
      if (started) return;
      started = true;
      const order: number[] = [0];
      for (let i = 8; i < N; i += 8) order.push(i);
      for (let i = 0; i < N; i++) if (!order.includes(i)) order.push(i);
      if (reduced) order.unshift(Math.round(N * 0.7));
      const MAX_INFLIGHT = 6;
      let k = 0,
        inflight = 0;
      const pump = () => {
        while (!dead && inflight < MAX_INFLIGHT && k < order.length) {
          const idx = order[k++];
          inflight++;
          const im = new Image();
          im.src = url(idx);
          im.decode()
            .then(() => {
              if (!dead) {
                imgs[idx] = im;
                lastDrawn = -1;
                draw();
              }
            })
            .catch(() => {})
            .finally(() => {
              inflight--;
              pump();
            });
        }
      };
      pump();
    };

    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && startLoading(),
      { rootMargin: "150% 0px" },
    );
    io.observe(sec);
    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      target = Math.round(N * 0.7);
      setActive(3);
      return () => {
        dead = true;
        io.disconnect();
        window.removeEventListener("resize", resize);
      };
    }

    const st = ScrollTrigger.create({
      trigger: sec,
      start: "top top",
      end: "+=420%",
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        target = self.progress * (N - 1);
        const p = self.progress;
        const idx = CAPTIONS.findIndex((c) => p >= c.from && p < c.to);
        setActive((a) => (a === idx ? a : idx));
      },
    });

    gsap.ticker.add(draw);

    return () => {
      dead = true;
      gsap.ticker.remove(draw);
      st.kill();
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section
      ref={section}
      id="film"
      className="relative h-screen w-full overflow-hidden bg-ivory"
    >
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full"
        aria-label="VELUNE serum, from bottle to skin"
        role="img"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal/45 to-transparent transition-opacity duration-1000"
        style={{ opacity: active === 3 ? 1 : 0 }}
      />
      {CAPTIONS.map((c, i) => (
        <p
          key={c.text}
          className={`font-display pointer-events-none absolute bottom-[11vh] left-[5vw] max-w-[80vw] text-[clamp(30px,4.6vw,76px)] leading-[1.02] transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] ${
            c.tone === "light" ? "text-ivory" : "text-espresso"
          } ${active === i ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
          aria-hidden={active !== i}
        >
          {c.text}
        </p>
      ))}
    </section>
  );
}
