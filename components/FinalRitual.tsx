"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, isMobile, prefersReducedMotion } from "@/lib/gsap";
import type { RitualState } from "./RitualCanvas";

const RitualCanvas = dynamic(() => import("./RitualCanvas"), { ssr: false });

export default function FinalRitual() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<RitualState>({ p: 0 });
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobile());
    const el = root.current!;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      rootMargin: "20% 0px",
    });
    io.observe(el);
    // the canvas only exists while the section is within ~1.5 screens (frees the GPU context the rest of the time)
    const ioNear = new IntersectionObserver(
      ([e]) => setNear(e.isIntersecting),
      { rootMargin: "150% 0px" },
    );
    ioNear.observe(el);

    if (prefersReducedMotion()) {
      state.current.p = 1;
      gsap.set(".r-l1, .r-l2", { opacity: 1 });
      return () => {
        io.disconnect();
        ioNear.disconnect();
      };
    }
    const ctx = gsap.context(() => {
      gsap.set(".r-l1, .r-l2", { opacity: 0, y: 28 });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=260%",
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
        },
      });
      tl.to(state.current, { p: 1, duration: 1 }, 0)
        .to(
          ".r-l1",
          { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
          0.78,
        )
        .to(
          ".r-l2",
          { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
          0.9,
        )
        .to({}, { duration: 0.25 }, 1);
    }, el);
    return () => {
      io.disconnect();
      ioNear.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={root}
      id="ritual"
      className="relative h-screen w-full overflow-hidden bg-nude"
    >
      {near && (
        <RitualCanvas state={state.current} active={active} mobile={mobile} />
      )}
      <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center px-[6vw] text-center">
        <p className="r-l1 font-display text-[clamp(34px,6.4vw,108px)] leading-[1]">
          Your skin deserves more than a routine.
        </p>
        <p className="r-l2 font-display mt-4 text-[clamp(34px,6.4vw,108px)] italic leading-[1] text-clay">
          It deserves a ritual.
        </p>
      </div>
    </section>
  );
}
