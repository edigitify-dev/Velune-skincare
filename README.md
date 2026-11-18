# VELUNE — homepage

Next.js 14 · TypeScript · Tailwind · GSAP ScrollTrigger · Lenis · React Three Fiber

    npm install
    npm run dev

## Sections (components/)
| Section | Tech |
|---|---|
| Loader (squeeze, drop, zoom; once per session, skippable) | GSAP timeline |
| Living Liquid hero (cursor-deformed membrane, break-up into droplets, droplet onto face) | GLSL shader (R3F) + pinned GSAP timeline |
| Scroll-controlled film (120 desktop / 60 mobile frames, staged preload, eased scrubbing) | Canvas + ScrollTrigger |
| Blooming Formula (translucent iridescent petals, pointer light, click to open) | R3F, dynamically imported |
| Product discovery (drag carousel, background shifts per product) | React + CSS |
| Final Liquid Ritual (droplet, whirl, lotion fill, settles to ivory) | GLSL shader + ScrollTrigger |
| Cart (drawer, quantities, bag fly-in only after a valid add) | Context + GSAP |

## Assets
- public/sequence, public/sequence-m: frames extracted from your supplied video. The hero face still is also frame f_085.
- Bottle.tsx vector bottles, product names, sizes, prices, the bloom ingredient/benefit text are **placeholders**.
- Replace the video's baked-in labels, bottle art and face still with final photography.

Checkout and newsletter are not connected to any provider.
