import * as THREE from "three";

/**
 * Glass-shatter pieces for the hero ball.
 *
 *  buildShardGeometry – pre-fractured disc: a Voronoi diagram whose seeds sit on rings around the impact point
 *                       (tiny wedges near the hit, big plates at the rim – the way real glass breaks).
 *  shardVert / shardFrag – every shard is a flat polygon animated 100 % on the GPU as a pure function of the
 *                       scroll-driven state, so the break is deterministic and plays backwards exactly.
 *  flashVert / flashFrag – impact flash + shock ring.
 *
 * All coordinates are in "ball units": the ball is the unit disc, y up.
 */

/** where the ball is hit, in ball units (unit disc, y up) */
export const IMPACT: [number, number] = [0.2, 0.18];

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = [number, number];

/** Sutherland–Hodgman: keep the part of `poly` on the seed's side of the bisector with `other` */
function clipHalf(poly: P[], s: P, o: P): P[] {
  const mx = (s[0] + o[0]) / 2,
    my = (s[1] + o[1]) / 2;
  const nx = o[0] - s[0],
    ny = o[1] - s[1];
  const side = (p: P) => (p[0] - mx) * nx + (p[1] - my) * ny; // <= 0 keeps
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = side(a),
      db = side(b);
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function areaCentroid(poly: P[]): { A: number; c: P } {
  let A = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const k = a[0] * b[1] - b[0] * a[1];
    A += k;
    cx += (a[0] + b[0]) * k;
    cy += (a[1] + b[1]) * k;
  }
  A /= 2;
  if (Math.abs(A) < 1e-9) return { A: 0, c: poly[0] };
  return { A: Math.abs(A), c: [cx / (6 * A), cy / (6 * A)] };
}

export type ShardCell = { poly: P[]; c: P; area: number };

function voronoi(seeds: P[]): (P[] | null)[] {
  const SEG = 128;
  const disc: P[] = Array.from({ length: SEG }, (_, i) => {
    const a = (i / SEG) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)] as P;
  });
  return seeds.map((s, i) => {
    let poly = disc;
    for (let j = 0; j < seeds.length && poly.length >= 3; j++) {
      if (j === i) continue;
      if (Math.hypot(seeds[j][0] - s[0], seeds[j][1] - s[1]) > 2.6) continue; // can never reach that bisector
      poly = clipHalf(poly, s, seeds[j]);
    }
    return poly.length >= 3 ? poly : null;
  });
}

/**
 * The fracture pattern: ~26 large, smooth, evenly-sized glass cells (jittered hex lattice relaxed once, Lloyd-style,
 * so the cells look like thick rounded glass plates divided by glowing gold seams) – not a fine web of splinters.
 */
export function buildCells(lite: boolean): ShardCell[] {
  const rnd = mulberry(5309);
  const sp = lite ? 0.52 : 0.38;
  const rowH = sp * 0.866;
  let seeds: P[] = [];
  for (let j = -8; j <= 8; j++)
    for (let i = -8; i <= 8; i++) {
      const x = (i + (j & 1 ? 0.5 : 0)) * sp + (rnd() - 0.5) * sp * 0.95;
      const y = j * rowH + (rnd() - 0.5) * sp * 0.95;
      if (Math.hypot(x, y) < 1 + sp * 0.55) seeds.push([x, y]);
    }
  for (let it = 0; it < 1; it++) {
    const polys = voronoi(seeds);
    seeds = seeds.map((s, i) => {
      const pl = polys[i];
      if (!pl) return s;
      const { A, c } = areaCentroid(pl);
      return A > 1e-6
        ? [s[0] * 0.25 + c[0] * 0.75, s[1] * 0.25 + c[1] * 0.75]
        : s;
    });
  }
  const polys = voronoi(seeds);
  const cells: ShardCell[] = [];
  polys.forEach((poly) => {
    if (!poly) return;
    const { A, c } = areaCentroid(poly);
    if (A < 6e-4) return; // drop slivers
    cells.push({ poly, c, area: A });
  });
  return cells;
}

/**
 * Non-indexed triangle fans (one per shard). Per-vertex attributes:
 *  position – (local x, local y, 0) relative to the shard centroid
 *  aCenter  – shard centroid in ball units
 *  aRand    – 4 random numbers per shard
 *  aD       – 1 at the centroid → 0 on the outer edge of the fan triangle
 *  aInr     – perpendicular distance centroid → that edge (so aD*aInr = real distance to the edge)
 *  aRim     – 1 when that edge lies on the ball's outline (no crack line there)
 */
export function buildShardGeometry(lite: boolean): THREE.BufferGeometry {
  const rnd = mulberry(901);
  const cells = buildCells(lite);
  const pos: number[] = [],
    cen: number[] = [],
    rd: number[] = [],
    dd: number[] = [],
    inr: number[] = [],
    rim: number[] = [];
  for (const cell of cells) {
    const r = [rnd(), rnd(), rnd(), rnd()];
    const [cx, cy] = cell.c;
    const n = cell.poly.length;
    for (let k = 0; k < n; k++) {
      const a = cell.poly[k],
        b = cell.poly[(k + 1) % n];
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const el = Math.hypot(ex, ey) || 1e-6;
      // distance from centroid to the line through a,b
      const dist = Math.abs((cx - a[0]) * ey - (cy - a[1]) * ex) / el;
      const onRim =
        Math.hypot(a[0], a[1]) > 0.9995 && Math.hypot(b[0], b[1]) > 0.9995
          ? 1
          : 0;
      const verts: [number, number, number][] = [
        [cx, cy, 1],
        [a[0], a[1], 0],
        [b[0], b[1], 0],
      ];
      for (const [vx, vy, d] of verts) {
        pos.push(vx - cx, vy - cy, 0);
        cen.push(cx, cy);
        rd.push(r[0], r[1], r[2], r[3]);
        dd.push(d);
        inr.push(dist);
        rim.push(onRim);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aCenter", new THREE.Float32BufferAttribute(cen, 2));
  g.setAttribute("aRand", new THREE.Float32BufferAttribute(rd, 4));
  g.setAttribute("aD", new THREE.Float32BufferAttribute(dd, 1));
  g.setAttribute("aInr", new THREE.Float32BufferAttribute(inr, 1));
  g.setAttribute("aRim", new THREE.Float32BufferAttribute(rim, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100); // shards fly far; never cull
  return g;
}

/* ───────────────────────── shard shaders ───────────────────────── */

export const shardVert = /* glsl */ `
attribute vec2 aCenter; attribute vec4 aRand; attribute float aD, aInr, aRim;
uniform vec2 uC, uImp;            // ball centre (aspect units), impact (ball units)
uniform float uR, uAspect, uBurst, uCrack, uGone, uPh;
varying vec2 vO; varying vec3 vN, vL; varying float vD, vInr, vRim, vFade; varying vec4 vR;

vec3 rot(vec3 v, vec3 k, float a){ return v*cos(a)+cross(k,v)*sin(a)+k*dot(k,v)*(1.-cos(a)); }

void main(){
  vec2 o = aCenter + position.xy;                       // this vertex's place on the intact ball
  vec3 nd = normalize(vec3(o, sqrt(max(1.-dot(o,o), .02))));   // dome normal there (same as the liquid sphere's)

  // ── fracture direction: away from the impact, jittered; heavy plates are slower, shards near the hit get most energy
  vec2 dI = aCenter - uImp; float dl = length(dI);
  vec2 dir = dl > 1e-4 ? dI/dl : vec2(cos(aRand.y*6.2831), sin(aRand.y*6.2831));
  dir = normalize(dir + (aRand.zw-.5)*.7);
  float heavy = clamp(aInr/.3, 0., 1.);
  float prox = exp(-dl*1.25);
  float spd = (.5 + 1.5*prox + .55*aRand.x) * (1. - .42*heavy);

  // explosion: front-loaded (air drag) so it reads as a sudden burst that then hangs in the air
  float tt = (1.-exp(-3.2*uBurst))/(1.-exp(-3.2));
  vec3 p3 = vec3(aCenter, 0.);
  p3.xy += dir*spd*tt*1.9;
  p3.z  += (aRand.y-.22)*1.5*(.45+prox)*tt*1.9;         // mostly thrown toward the lens
  p3.y  -= .75*uBurst*uBurst*(.5+aRand.w);              // gravity takes over late
  // pre-burst stress: shards shiver while the cracks run
  float c3 = uCrack*uCrack*uCrack*(1.-tt);
  p3.xy += vec2(sin(uPh*210.+aRand.x*40.), cos(uPh*170.+aRand.y*40.))*.0045*c3;

  // tumble about a mostly in-plane axis so the plates flip and flash
  vec3 ax = normalize(vec3(aRand.z*2.-1., aRand.w*2.-1., (aRand.x-.5)*.9) + vec3(.001));
  float ang = tt*(aRand.x*2.-1.)*10.*(.45+aRand.y)*(1.-.5*heavy);   // big plates turn slower
  float fade = smoothstep(aRand.z*.5, aRand.z*.5+.45, uGone);
  vec3 loc = rot(vec3(position.xy*(1.-.4*fade), 0.), ax, ang);
  vec3 nr  = rot(nd, ax, ang);

  vec3 P = p3 + loc;
  float persp = 1./clamp(1.-P.z*.28, .5, 2.);           // coming at the camera = bigger
  vec2 scr = uC + P.xy*persp*uR;
  gl_Position = vec4(scr.x*2./uAspect, scr.y*2., 0., 1.);

  vO = o; vN = nr; vL = loc; vD = aD; vInr = aInr; vRim = aRim; vFade = fade; vR = aRand;
}`;

export const shardFrag = /* glsl */ `
precision highp float;
uniform float uCrack, uFace, uPh;
uniform vec2 uImp;
varying vec2 vO; varying vec3 vN, vL; varying float vD, vInr, vRim, vFade; varying vec4 vR;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }

void main(){
  float ed = vD*vInr;                                   // distance to this cell's outer edge (ball units)
  float sd = vR.x*2.-1.;

  // ── thick rounded glass plate: the normal bends outward toward the edge (pillow), so the rim of every cell
  //    catches light and goes amber while the middle stays clear
  vec2 lo = vL.xy; float ll = length(lo);
  float pil = pow(1.-vD, 2.);
  vec3 n = normalize(vN + vec3(ll>1e-5 ? lo/ll : vec2(0.), 0.)*pil*1.1);
  if(!gl_FrontFacing) n = -n;
  vec3 V = vec3(0.,0.,1.);
  vec3 L1 = normalize(vec3(-.55+sd*.28, .62-sd*.16, .56));
  vec3 L2 = normalize(vec3(.65,-.45,.45));
  float r1 = max(dot(reflect(-L1,n),V),0.);
  float s1  = pow(r1, 50.+sd*20.);
  float s1b = pow(r1, 9.)*.22;
  float s2  = pow(max(dot(reflect(-L2,n),V),0.), 28.)*.55;
  float fres = pow(1.-abs(n.z), 2.0);
  vec3 tint = vec3(.98,.90,.78), rimC = vec3(.86,.60,.30);
  vec3 col = mix(tint, rimC, clamp(fres*1.2,0.,1.));
  float a = .09 + fres*.5;
  // warm light gathered just inside the seam
  float inner = exp(-ed*26.);
  col += vec3(1.,.78,.42)*inner*.55; a += inner*.22;
  col += vec3(1.,.97,.92)*(s1*1.6 + s1b + s2); a += (s1 + s1b + s2*.6)*.85;
  float aFace = clamp(a,0.,1.)*uFace;

  // ── glowing gold seams: the fracture front runs out from the impact; seams ignite as it passes,
  //    then swell into thick molten-gold joints with sparkles
  float dI = distance(vO, uImp);
  float front = uCrack*1.9 - dI + (noise(vO*5.+3.)-.5)*.3;
  float rev = smoothstep(0., .1, front) * (1.-vRim);
  float grow = smoothstep(0., .7, front);
  float wC = mix(.004, .015, grow);
  float core = (1.-smoothstep(wC*.25, wC, ed))*rev;
  float glow = exp(-ed/(.014+.028*grow))*rev;
  float pulse = .88 + .12*sin(uPh*60.+vO.x*8.+vO.y*6.);
  vec3 gold = vec3(1.,.73,.34), hot = vec3(1.,.97,.86);
  float aSeam = clamp(core*.98 + glow*.5*pulse, 0., 1.);
  vec3 seamCol = mix(gold, hot, core);
  // sparkles that twinkle along the seams
  vec2 sg = floor(vO*58.); float hs = hash(sg);
  float tw = step(.972, hs)*(.5+.5*sin(uPh*95.+hs*60.));
  float spark = tw*glow;
  seamCol += hot*spark*1.4; aSeam = clamp(aSeam + spark*.9, 0., 1.);

  float A = 1.-(1.-aFace)*(1.-aSeam);
  vec3 C = mix(col, seamCol, aSeam/(aSeam+aFace+1e-4));
  A *= 1.-vFade;
  if(A < .004) discard;
  gl_FragColor = vec4(C, A);
}`;

/* ───────────────────────── impact flash + shock ring ───────────────────────── */

export const flashVert = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
export const flashFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uP; uniform float uAspect, uR, uFlash, uRing;
void main(){
  vec2 p = (vUv-.5)*vec2(uAspect,1.);
  float d = length(p-uP)/uR;
  float core = exp(-d*d*7.)*uFlash;
  float ring = exp(-pow((d-uRing)*9.,2.))*(1.-smoothstep(.2,2.6,uRing))*step(.001,uRing);
  float a = clamp(core*.9 + ring*.55, 0., 1.);
  vec3 c = mix(vec3(1.,.9,.7), vec3(1.,.99,.96), clamp(core,0.,1.));
  gl_FragColor = vec4(c, a);
}`;
