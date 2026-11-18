import * as THREE from "three";
import type { ExpState } from "./types";
import { assignTiles, ringSlots } from "./tiles";

export const SPHERE_R = 2.0;
const CAM_Z = 10; // camera distance the scattered field is laid out for
const TAN = Math.tan(THREE.MathUtils.degToRad(20));

export const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const sm = (x: number) => {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * (3 - 2 * x);
};
export const ss = (a: number, b: number, x: number) => sm((x - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ───────── geodesic lattice (icosphere), slightly jittered so it never looks mechanical ───────── */
function icosphere(level: number, rnd: () => number, jitter: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as number[][]
  ).map((a) => new THREE.Vector3(a[0], a[1], a[2]).normalize());
  let F: number[][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let l = 0; l < level; l++) {
    const cache = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      let i = cache.get(k);
      if (i === undefined) {
        i = V.length;
        V.push(V[a].clone().add(V[b]).normalize());
        cache.set(k, i);
      }
      return i;
    };
    const nf: number[][] = [];
    for (const [a, b, c] of F) {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    F = nf;
  }
  for (const v of V)
    v.add(
      new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(
        jitter,
      ),
    ).normalize();
  return { V, F };
}

export type Network = {
  lite: boolean;
  N: number; // all points: hexagon tiles first, then the small connection nodes
  H: number; // hexagon tiles that make up the sphere
  H0: number; // of those, the ones already floating in the opening field (the rest materialise while it gathers)
  V: THREE.Vector3[]; // jittered unit lattice vertices (only used for the glass shards now)
  F: number[][]; // lattice faces
  // per point
  scatter: Float32Array; // base scattered position
  float: Float32Array; // 6 floats: freq xyz, phase xyz
  sphere: Float32Array; // unit-sphere target
  swirl: Float32Array; // curved-flight offset
  arrive: Float32Array; // stagger 0..0.5
  vis: Float32Array; // emergence threshold (small nodes)
  vel: Float32Array; // world-space explosion velocity
  fadeAt: Float32Array;
  depth: Float32Array; // 0 far … 1 near
  nodeR: Float32Array;
  // hexagon tiles
  cell: Int32Array; // which ingredient picture (0..14) each tile shows
  hexScale: Float32Array; // scale while floating
  tileScale: Float32Array; // scale once it sits in the sphere (fills its slot exactly)
  hexSphereQuat: THREE.Quaternion[];
  hexSeed: Float32Array;
  hexTilt: Float32Array; // 3 phases per hex
  hexSpin: Float32Array; // axis xyz + rate
  // bonds (only the loose proximity web of the opening field; the sphere itself is built from tiles)
  edgesA: Uint32Array;
  thrA: Float32Array;
  // live state, rewritten every frame
  pos: Float32Array;
  g: Float32Array;
  nodeScale: Float32Array;
  hexPos: Float32Array;
  hexQuat: Float32Array;
  hexS: Float32Array;
  hexA: Float32Array;
  hover: Float32Array; // smoothed hover amount per hex
};

const CELLS = 15; // ingredient pictures

export function buildNetwork(lite: boolean, aspect: number): Network {
  const rnd = mulberry(20260);
  const { V, F } = icosphere(lite ? 1 : 2, rnd, lite ? 0.1 : 0.06);
  const Nv = V.length;
  const H0 = lite ? 12 : 21; // hexagons floating in the opening field (unchanged)

  // the sphere itself: honeycomb of hexagon tiles (bigger tiles on lighter devices = fewer of them)
  const slots = ringSlots(SPHERE_R, lite ? 1.5 : 1.2);
  const H = slots.count;
  const Ns = Nv - H0; // small connection nodes (unchanged count)
  const N = H + Ns;

  // lattice vertices for the small nodes' flight path (same selection as before, so the field looks the same)
  const chosen: number[] = [];
  let first = 0,
    best = -9;
  V.forEach((v, i) => {
    const s = v.z + 0.25 * v.x - Math.abs(v.y) * 0.3;
    if (s > best) {
      best = s;
      first = i;
    }
  });
  chosen.push(first);
  const minD = new Float32Array(Nv).fill(1e9);
  while (chosen.length < H0) {
    const last = V[chosen[chosen.length - 1]];
    let arg = 0,
      mx = -1;
    for (let i = 0; i < Nv; i++) {
      minD[i] = Math.min(minD[i], V[i].distanceToSquared(last));
      if (minD[i] > mx) {
        mx = minD[i];
        arg = i;
      }
    }
    chosen.push(arg);
  }
  const rest: number[] = [];
  for (let i = 0; i < Nv; i++) if (!chosen.includes(i)) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  const scatter = new Float32Array(N * 3),
    sphere = new Float32Array(N * 3),
    swirl = new Float32Array(N * 3);
  const flt = new Float32Array(N * 6),
    arrive = new Float32Array(N),
    vis = new Float32Array(N),
    vel = new Float32Array(N * 3);
  const fadeAt = new Float32Array(N),
    depth = new Float32Array(N),
    nodeR = new Float32Array(N);
  const hexScale = new Float32Array(H),
    tileScale = new Float32Array(H),
    hexSeed = new Float32Array(H),
    hexTilt = new Float32Array(H * 3),
    hexSpin = new Float32Array(H * 4);

  const hw = (z: number) => (CAM_Z - z) * TAN * Math.max(aspect, 0.5);
  const hh = (z: number) => (CAM_Z - z) * TAN;
  const sizeK = Math.min(1, Math.max(0.6, aspect / 1.5));

  // hexagons of the opening field: spread over several depth planes, no angular overlap (unchanged)
  const placed: [number, number][] = [];
  for (let i = 0; i < H0; i++) {
    const d = (i * 0.618034 + rnd() * 0.12) % 1;
    const z = -6 + 9 * d;
    let bx = 0,
      by = 0,
      bestScore = -1;
    for (let k = 0; k < 90; k++) {
      const x = (rnd() * 2 - 1) * hw(z) * 0.9,
        y = (rnd() * 2 - 1) * hh(z) * 0.82;
      const a: [number, number] = [x / (CAM_Z - z), y / (CAM_Z - z)];
      let m = 1e9;
      for (const p of placed)
        m = Math.min(m, Math.hypot(a[0] - p[0], a[1] - p[1]));
      if (m > bestScore) {
        bestScore = m;
        bx = x;
        by = y;
      }
    }
    placed.push([bx / (CAM_Z - z), by / (CAM_Z - z)]);
    scatter.set([bx, by, z], i * 3);
    depth[i] = d;
    hexScale[i] =
      (i >= 15 ? 0.34 : 0.4 + rnd() * 0.34) * sizeK * (0.82 + 0.3 * d);
    hexSeed[i] = rnd();
    hexTilt.set([rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], i * 3);
    const ax = new THREE.Vector3(
      rnd() - 0.5,
      rnd() - 0.5,
      rnd() - 0.5,
    ).normalize();
    hexSpin.set([ax.x, ax.y, ax.z, (rnd() - 0.5) * 9], i * 4);
  }
  // the remaining tiles start somewhere in the loose volume behind the field, invisible, and join while it gathers
  // (own random stream, so nothing above changes)
  const rx = mulberry(4242);
  for (let i = H0; i < H; i++) {
    const z = -8 + rx() * 10;
    scatter.set(
      [(rx() * 2 - 1) * hw(z) * 0.95, (rx() * 2 - 1) * hh(z) * 0.9, z],
      i * 3,
    );
    depth[i] = (z + 8) / 10;
    hexScale[i] = 0.4 * sizeK;
    hexSeed[i] = rx();
    hexTilt.set([rx() * 6.28, rx() * 6.28, rx() * 6.28], i * 3);
    const ax = new THREE.Vector3(
      rx() - 0.5,
      rx() - 0.5,
      rx() - 0.5,
    ).normalize();
    hexSpin.set([ax.x, ax.y, ax.z, (rx() - 0.5) * 9], i * 4);
  }
  // small connection nodes: a loose volume behind and between the hexagons (unchanged)
  for (let i = H; i < N; i++) {
    const z = -8 + rnd() * 10;
    scatter.set(
      [(rnd() * 2 - 1) * hw(z) * 0.95, (rnd() * 2 - 1) * hh(z) * 0.9, z],
      i * 3,
    );
    depth[i] = (z + 8) / 10;
    nodeR[i] = 0.028 + rnd() * 0.03;
    vis[i] = rnd();
  }

  // which ingredient goes into which slot of the sphere: no two touching tiles show the same picture,
  // and every tile flies to the nearest slot that holds its own picture
  const firstCells = Array.from({ length: H0 }, (_, i) => i % CELLS);
  const asg = assignTiles(
    slots,
    firstCells,
    CELLS,
    (i) => [scatter[i * 3], scatter[i * 3 + 1], scatter[i * 3 + 2]],
    mulberry(99),
  );

  for (let i = 0; i < N; i++) {
    const r = i >= H0 && i < H ? rx : rnd;
    flt.set(
      [
        0.2 + r() * 0.35,
        0.2 + r() * 0.35,
        0.15 + r() * 0.25,
        r() * 6.28,
        r() * 6.28,
        r() * 6.28,
      ],
      i * 6,
    );
    const v = new THREE.Vector3();
    if (i < H) {
      const sl = asg.slot[i];
      v.set(slots.nx[sl], slots.ny[sl], slots.nz[sl]);
      tileScale[i] = slots.scale[sl];
    } else v.copy(V[rest[i - H]]);
    sphere.set([v.x, v.y, v.z], i * 3);
    arrive[i] = r() * 0.5;
    fadeAt[i] = r();
    // curved flight: sideways bow relative to the straight path
    const s = new THREE.Vector3(
      scatter[i * 3],
      scatter[i * 3 + 1],
      scatter[i * 3 + 2],
    );
    const dlt = v.clone().multiplyScalar(SPHERE_R).sub(s);
    const sw = new THREE.Vector3()
      .crossVectors(dlt, new THREE.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(dlt.length() * 0.16 * (r() < 0.5 ? -1 : 1));
    swirl.set([sw.x, sw.y, sw.z], i * 3);
    // explosion velocity (world space): mostly radial, some thrown toward the camera, some back
    const rd = v
      .clone()
      .multiplyScalar(0.8 + r() * 2.2)
      .add(new THREE.Vector3(r() - 0.5, r() - 0.5, (r() - 0.3) * 2.4));
    vel.set([rd.x, rd.y, rd.z], i * 3);
  }
  nodeR.fill(0.034, 0, H);

  // tile orientation on the sphere: face outwards, label upright
  const hexSphereQuat: THREE.Quaternion[] = [];
  const m4 = new THREE.Matrix4(),
    zero = new THREE.Vector3();
  for (let i = 0; i < H; i++) {
    const n = new THREE.Vector3(
      sphere[i * 3],
      sphere[i * 3 + 1],
      sphere[i * 3 + 2],
    );
    const up =
      Math.abs(n.y) > 0.96
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    m4.lookAt(n, zero, up);
    hexSphereQuat.push(new THREE.Quaternion().setFromRotationMatrix(m4));
  }

  /* bonds: the loose proximity web of the opening field (hexagon↔hexagon first, then the fine web).
     Only the opening-field hexagons and the small nodes take part; tiles that join later stay out of it. */
  const web: number[] = [];
  for (let i = 0; i < N; i++) if (i < H0 || i >= H) web.push(i);
  const key = (a: number, b: number) => (a < b ? a * 4096 + b : b * 4096 + a);
  const seen = new Set<number>();
  const eA: number[] = [],
    tA: number[] = [];
  const P = (i: number) => [
    scatter[i * 3] / (CAM_Z - scatter[i * 3 + 2]),
    scatter[i * 3 + 1] / (CAM_Z - scatter[i * 3 + 2]),
    scatter[i * 3 + 2],
  ];
  const dist = (a: number, b: number) => {
    const p = P(a),
      q = P(b);
    return Math.hypot(
      (p[0] - q[0]) * 9,
      (p[1] - q[1]) * 9,
      (p[2] - q[2]) * 0.12,
    );
  };
  const add = (a: number, b: number, thr: number) => {
    const k = key(a, b);
    if (a === b || seen.has(k)) return;
    seen.add(k);
    eA.push(a, b);
    tA.push(thr);
  };
  for (let i = 0; i < H0; i++) {
    const o = Array.from({ length: H0 }, (_, j) => j)
      .filter((j) => j !== i)
      .sort((a, b) => dist(i, a) - dist(i, b));
    o.slice(0, 3).forEach((j, r) => add(i, j, rnd() * 0.3 + r * 0.06));
  }
  for (const i of web) {
    const o = web
      .filter((j) => j !== i)
      .sort((a, b) => dist(i, a) - dist(i, b));
    o.slice(0, 2).forEach((j) => {
      if (dist(i, j) < 3.4) add(i, j, 0.3 + rnd() * 0.6);
    });
  }

  return {
    lite,
    N,
    H,
    H0,
    V,
    F,
    scatter,
    float: flt,
    sphere,
    swirl,
    arrive,
    vis,
    vel,
    fadeAt,
    depth,
    nodeR,
    cell: asg.cell,
    hexScale,
    tileScale,
    hexSphereQuat,
    hexSeed,
    hexTilt,
    hexSpin,
    edgesA: new Uint32Array(eA),
    thrA: new Float32Array(tA),
    pos: new Float32Array(N * 3),
    g: new Float32Array(N),
    nodeScale: new Float32Array(N),
    hexPos: new Float32Array(H * 3),
    hexQuat: new Float32Array(H * 4),
    hexS: new Float32Array(H),
    hexA: new Float32Array(H),
    hover: new Float32Array(H),
  };
}

const qa = new THREE.Quaternion(),
  qb = new THREE.Quaternion(),
  qc = new THREE.Quaternion(),
  eu = new THREE.Euler(),
  ax = new THREE.Vector3();

/** Advance the whole network one frame from the scroll state. Everything is a pure function of (S, time, pointer). */
export function stepNetwork(
  net: Network,
  S: ExpState,
  t: number,
  mouse: { x: number; y: number },
  hoverIdx: number,
  dt: number,
) {
  const {
    N,
    H,
    H0,
    pos,
    g,
    scatter,
    sphere,
    swirl,
    float: f,
    arrive,
    vel,
    hexQuat,
    hexPos,
    hexS,
    hexA,
  } = net;
  const R = SPHERE_R;
  const cr = Math.cos(S.rot),
    sr = Math.sin(S.rot);
  const par = 1 - ss(0, 0.35, S.gather); // pointer parallax only while still a field
  const ex = S.shatter;
  const hp = hoverIdx >= 0 ? hoverIdx : -1;

  for (let i = 0; i < N; i++) {
    const gi = ss(arrive[i], arrive[i] + 0.5, S.gather);
    g[i] = gi;
    const amp = (i < H ? 0.3 : 0.15) * (1 - gi);
    const sx = scatter[i * 3] + Math.sin(t * f[i * 6] + f[i * 6 + 3]) * amp;
    const sy =
      scatter[i * 3 + 1] + Math.sin(t * f[i * 6 + 1] + f[i * 6 + 4]) * amp;
    const sz =
      scatter[i * 3 + 2] +
      Math.sin(t * f[i * 6 + 2] + f[i * 6 + 5]) * amp * 0.8;
    const pk = par * (sz + 9) * 0.05;
    const px = sx + mouse.x * pk,
      py = sy + mouse.y * pk * 0.7;
    const sw = Math.sin(Math.PI * gi);
    let x = lerp(px, sphere[i * 3] * R, gi) + swirl[i * 3] * sw;
    let y = lerp(py, sphere[i * 3 + 1] * R, gi) + swirl[i * 3 + 1] * sw;
    let z = lerp(sz, sphere[i * 3 + 2] * R, gi) + swirl[i * 3 + 2] * sw;
    // structural failure: pieces lift off the surface before the burst
    const lift = S.detach * (i < H ? 0.16 : 0.05) * (0.5 + net.fadeAt[i]);
    x += sphere[i * 3] * lift;
    y += sphere[i * 3 + 1] * lift;
    z += sphere[i * 3 + 2] * lift;
    // explosion: world-space velocity rotated into the (rotating) group's space
    if (ex > 0) {
      const wx = vel[i * 3],
        wy = vel[i * 3 + 1],
        wz = vel[i * 3 + 2];
      x += (wx * cr - wz * sr) * ex * 2.2;
      y += wy * ex * 2.2;
      z += (wx * sr + wz * cr) * ex * 2.2;
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const fade = ss(net.fadeAt[i] * 0.6, net.fadeAt[i] * 0.6 + 0.4, S.frag);
    // small nodes: they belong to the loose web, so they melt into the tiles as the sphere closes
    net.nodeScale[i] =
      i < H
        ? 0
        : ss(net.vis[i] * 0.7, net.vis[i] * 0.7 + 0.25, S.dense) *
          (1 - fade) *
          (1 - ss(0.55, 0.95, gi));
  }

  // hover: smooth per-hex amount, neighbours lean away (opening-field hexagons only)
  for (let i = 0; i < H0; i++)
    net.hover[i] += ((i === hp ? 1 : 0) - net.hover[i]) * Math.min(1, dt * 9);
  if (hp >= 0 && S.gather < 0.2) {
    const hx = pos[hp * 3],
      hy = pos[hp * 3 + 1],
      hz = pos[hp * 3 + 2];
    for (let i = 0; i < H0; i++) {
      if (i === hp) continue;
      const dx = pos[i * 3] - hx,
        dy = pos[i * 3 + 1] - hy,
        dz = pos[i * 3 + 2] - hz;
      const d = Math.hypot(dx, dy, dz) + 1e-3;
      const push = Math.max(0, 1 - d / 3.6) * 0.32 * net.hover[hp];
      pos[i * 3] += (dx / d) * push;
      pos[i * 3 + 1] += (dy / d) * push;
      pos[i * 3 + 2] += (dz / d) * push;
    }
  }

  for (let i = 0; i < H; i++) {
    const gi = g[i];
    const primary = i < H0;
    hexPos[i * 3] = pos[i * 3];
    hexPos[i * 3 + 1] = pos[i * 3 + 1];
    hexPos[i * 3 + 2] = pos[i * 3 + 2];
    // scatter orientation: gently tilting, leaning toward the pointer
    const tp = net.hexTilt;
    eu.set(
      Math.sin(t * 0.31 + tp[i * 3]) * 0.28 - mouse.y * 0.12 * par,
      Math.cos(t * 0.27 + tp[i * 3 + 1]) * 0.34 + mouse.x * 0.16 * par,
      Math.sin(t * 0.2 + tp[i * 3 + 2]) * 0.14,
    );
    qa.setFromEuler(eu);
    qa.slerp(net.hexSphereQuat[i], gi);
    if (ex > 0) {
      ax.set(
        net.hexSpin[i * 4],
        net.hexSpin[i * 4 + 1],
        net.hexSpin[i * 4 + 2],
      );
      qb.setFromAxisAngle(ax, ex * net.hexSpin[i * 4 + 3]);
      qc.copy(qb).multiply(qa);
      qa.copy(qc);
    }
    hexQuat[i * 4] = qa.x;
    hexQuat[i * 4 + 1] = qa.y;
    hexQuat[i * 4 + 2] = qa.z;
    hexQuat[i * 4 + 3] = qa.w;
    // opening-field hexagons emerge with the scroll; the other tiles appear while the field flies into the sphere
    const em = primary
      ? ss((i / H0) * 0.6, (i / H0) * 0.6 + 0.4, S.emerge)
      : ss(0.08, 0.5, gi);
    const fade = ss(net.fadeAt[i] * 0.6, net.fadeAt[i] * 0.6 + 0.4, S.frag);
    hexS[i] =
      lerp(net.hexScale[i], net.tileScale[i], gi) *
      (primary ? 0.55 + 0.45 * em : em) *
      (1 + 0.14 * net.hover[i]) *
      (1 - 0.4 * fade);
    hexA[i] = em * (1 - fade);
  }
}
