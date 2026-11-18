'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger, isMobile, prefersReducedMotion } from '@/lib/gsap';
import { PRODUCTS } from '@/lib/products';
import { useAddToBag } from './useAddToBag';
import type { BloomState } from './BloomScene';

const BloomScene = dynamic(() => import('./BloomScene'), { ssr: false });

export default function Bloom() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<BloomState>({ scroll: 0, boost: 0, px: 0, py: 0 });
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lite, setLite] = useState(false);
  const addToBag = useAddToBag();
  const product = PRODUCTS[0];

  useEffect(() => {
    setLite(isMobile());
    const el = root.current!;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); setVisible(e.isIntersecting); }, { rootMargin: '50% 0px' });
    io.observe(el);

    if (prefersReducedMotion()) { state.current.scroll = 1; setRevealed(true); return () => io.disconnect(); }
    const st = ScrollTrigger.create({
      trigger: el, start: 'top top', end: '+=150%', pin: true, anticipatePin: 1, scrub: 0.6,
      onUpdate: (s) => {
        state.current.scroll = Math.min(1, s.progress * 1.25);
        setRevealed((r) => r || s.progress > 0.8);
      },
    });
    return () => { io.disconnect(); st.kill(); };
  }, []);

  const open = () => { gsap.to(state.current, { boost: 1, duration: 1.6, ease: 'power2.out' }); setRevealed(true); };
  const hover = (v: number) => gsap.to(state.current, { boost: v, duration: 1.2, overwrite: true });

  return (
    <section ref={root} id="formulation" className="relative h-screen w-full overflow-hidden bg-nude"
             onPointerEnter={() => hover(0.45)} onPointerLeave={() => !revealed && hover(0)}>
      {near && <div className="absolute inset-0" onClick={open}><BloomScene state={state.current} active={visible} lite={lite} /></div>}

      <h2 className="font-display pointer-events-none absolute left-[5vw] top-[16vh] max-w-[11ch] text-[clamp(40px,6.4vw,110px)] leading-[0.95]">
        Let it open slowly.
      </h2>

      <div className={`absolute bottom-[8vh] right-[5vw] w-[min(360px,86vw)] transition-all duration-[1100ms] ease-[cubic-bezier(.2,.7,.2,1)] ${
        revealed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
        <div className="font-display text-[34px] leading-none">{product.name}</div>
        <dl className="mt-5 space-y-3 text-[13px] leading-relaxed text-muted">
          <div><dt className="text-espresso">Key ingredient</dt><dd>To be confirmed with verified formulation details.</dd></div>
          <div><dt className="text-espresso">Benefits</dt><dd>To be confirmed. No claims are made until approved copy is supplied.</dd></div>
        </dl>
        <button className="btn mt-6" onClick={(e) => addToBag(product, (e.currentTarget.closest('section') as HTMLElement).getBoundingClientRect())}>
          Add to Bag · ${product.price}
        </button>
      </div>

      {!revealed && (
        <p className="pointer-events-none absolute bottom-[6vh] left-1/2 -translate-x-1/2 text-[12px] tracking-[0.08em] text-muted">
          Scroll, or touch the flower
        </p>
      )}
    </section>
  );
}
