import type { Product } from "./products";
import { gsap } from "./gsap";

/** Animates the product photo along a curved path into the bag icon. Resolves when it lands. */
export function flyToBag(from: DOMRect, p: Product): Promise<void> {
  const target = document.querySelector(
    "[data-bag-target]",
  ) as HTMLElement | null;
  if (!target) return Promise.resolve();
  const t = target.getBoundingClientRect();

  const size = Math.min(from.height, 220);
  const w = size * 0.6;

  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${w}px`,
    height: `${size}px`,
    pointerEvents: "none",
    zIndex: "200",
    transformOrigin: "50% 50%",
    willChange: "transform",
  });

  const img = document.createElement("img");
  img.src = p.image;
  img.alt = "";
  img.draggable = false;
  Object.assign(img.style, {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    filter: "drop-shadow(0 12px 14px rgba(51,36,31,.22))",
  });
  el.appendChild(img);
  document.body.appendChild(el);

  const sx = from.left + from.width / 2,
    sy = from.top + from.height / 2;
  const ex = t.left + t.width / 2,
    ey = t.top + t.height / 2;
  const cx = (sx + ex) / 2,
    cy = Math.min(sy, ey) - 200;
  const o = { k: 0 };
  const place = (k: number, s: number) => {
    const x = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * ex;
    const y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * ey;
    gsap.set(el, { x: x - w / 2, y: y - size / 2, scale: s, rotate: k * 24 });
  };
  place(0, 1);

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        el.remove();
        gsap.fromTo(
          target,
          { scale: 1.3 },
          { scale: 1, duration: 0.7, ease: "elastic.out(1,0.4)" },
        );
        resolve();
      },
    });
    const sc = { s: 1 };
    tl.to(sc, {
      s: 0.7,
      duration: 0.25,
      ease: "power2.out",
      onUpdate: () => place(0, sc.s),
    }).to(o, {
      k: 1,
      duration: 0.85,
      ease: "power2.inOut",
      onUpdate: () => place(o.k, 0.7 - o.k * 0.55),
    });
  });
}
