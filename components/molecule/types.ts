/** Scroll-driven state. GSAP tweens these on one scrubbed timeline; the scene only reads them. */
export type ExpState = {
  p: number; // overall progress 0..1 (phase for tremble etc.)
  emerge: number; // hexagons fade/scale in
  bonds: number; // proximity bonds grow between hexagons / nodes
  dense: number; // extra connection nodes appear
  gather: number; // network flies inward and curves into the sphere
  rot: number; // sphere rotation (rad)
  crack: number; // fracture lines + structural stress
  detach: number; // hexagons lift off, bonds break
  shatter: number; // glass fragments fly (eased: burst then slow motion)
  frag: number; // fragments dissolve at individual times
  dark: number; // 0 warm … 1 espresso/charcoal
  prod: number; // products emerge
  camZ: number;
  camY: number;
  orbit: number;
};

export type CarouselState = {
  pos: number; // fractional index, animated
  target: number;
  dragging: boolean;
  startPos: number;
  startX: number;
  vel: number;
  active: number;
  spacing: number;
  interactive: boolean;
};

export type Mouse = { x: number; y: number; sx: number; sy: number };
