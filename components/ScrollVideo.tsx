"use client";
import { useEffect, useRef, useState } from "react";
import {
  gsap,
  ScrollTrigger,
  isMobile,
  prefersReducedMotion,
} from "@/lib/gsap";

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

export default function ScrollVideo() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const sec = section.current,
      cv = canvas.current;
    if (!sec || !cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    const mobile = isMobile();
    const reduced = prefersReducedMotion();
    const N = mobile ? 60 : 120;
    const dir = mobile ? "/sequence-m" : "/sequence";
    const url = (i: number) =>
      `${dir}/f_${String(i + 1).padStart(3, "0")}.webp`;
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
      if (w === lastW && (mobile ? Math.abs(h - lastH) < 150 : h === lastH))
        return;
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
      let k = 0,
        inflight = 0;
      const pump = () => {
        while (!dead && inflight < 4 && k < order.length) {
          const idx = order[k++];
          inflight++;
          const im = new Image();
          im.src = url(idx);
          // decode off the main thread BEFORE we ever draw it
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

    // Lenis already smooths the scroll, so just draw the current frame each tick
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
