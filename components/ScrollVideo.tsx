"use client";
import { useEffect, useRef } from "react";

export default function ScrollVideo() {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // play only while it's on screen (saves CPU/battery on weak devices)
  useEffect(() => {
    const sec = section.current,
      vid = video.current;
    if (!sec || !vid) return;
    vid.muted = true; // iOS/Safari only autoplay when muted is set on the element
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? vid.play().catch(() => {}) : vid.pause()),
      { threshold: 0.25 },
    );
    io.observe(sec);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={section}
      id="film"
      className="relative flex min-h-screen w-full items-center justify-center bg-ivory px-[5vw] py-[12vh]"
    >
      {/* full width; from tablet up the height is fixed at 76vh, on phones it keeps the video's own 16:9 shape */}
      <div className="aspect-video w-full overflow-hidden rounded-[28px] md:aspect-auto md:h-[76vh] md:rounded-[44px]">
        <video
          ref={video}
          src="/video.mp4"
          muted
          loop
          playsInline
          preload="metadata"
          className="block h-full w-full object-cover"
        />
      </div>
    </section>
  );
}
