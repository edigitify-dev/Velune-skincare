"use client";
import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { getLenis } from "@/lib/scroll";

const FADE_LEAD = 3;

export default function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setGone(true);
      return;
    }

    const el = root.current!;
    const vid = video.current!;
    const box = el.querySelector(".l-vid") as HTMLElement;
    vid.muted = true;

    document.documentElement.style.overflow = "hidden";
    getLenis()?.stop();
    gsap.set("#top", { filter: "blur(26px)" });

    let started = false,
      revealed = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = () => {
      document.documentElement.style.overflow = "";
      getLenis()?.start();
      setGone(true);
    };

    const reveal = (duration = FADE_LEAD) => {
      if (revealed) return;
      revealed = true;
      gsap.to("#top", {
        filter: "blur(0px)",
        duration,
        ease: "power2.out",
        clearProps: "filter",
      });
      gsap.to(box, {
        filter: "blur(30px)",
        duration,
        ease: "power1.in",
      });
      gsap.to(el, {
        opacity: 0,
        duration: duration * 0.7,
        delay: duration * 0.3,
        ease: "power1.inOut",
        onComplete: finish,
      });
    };

    const start = () => {
      if (started) return;
      started = true;
      clearTimeout(timer);
      vid.play().catch(() => reveal(0.6));
    };

    const onTimeUpdate = () => {
      if (vid.duration && vid.duration - vid.currentTime <= FADE_LEAD) {
        reveal(FADE_LEAD);
      }
    };
    const onEnded = () => reveal(1);
    const onError = () => reveal(0.6);

    vid.addEventListener("canplaythrough", start);
    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("ended", onEnded);
    vid.addEventListener("error", onError);
    if (vid.readyState >= 4) start();

    timer = setTimeout(() => {
      if (!started) {
        started = true;
        reveal(0.6);
      }
    }, 6000);

    skipRef.current = () => {
      vid.pause();
      reveal(0.7);
    };

    return () => {
      clearTimeout(timer);
      vid.removeEventListener("canplaythrough", start);
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("ended", onEnded);
      vid.removeEventListener("error", onError);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (gone) return null;
  return (
    <div
      ref={root}
      className="fixed inset-0 z-[300] overflow-hidden bg-white"
      aria-hidden="true"
    >
      <div className="l-vid absolute inset-0 will-change-[filter]">
        <video
          ref={video}
          src="/loader/loader.mp4"
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-[1%] right-[2%] h-[7%] w-[16%] rounded-full bg-white blur-md" />
      </div>
      <button
        onClick={() => skipRef.current()}
        className="absolute right-6 top-6 z-10 text-[12px] tracking-[0.12em] text-muted hover:text-espresso"
      >
        Skip
      </button>
    </div>
  );
}
