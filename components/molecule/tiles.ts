/**
 * Hexagon-tile sphere.
 *
 * The ingredient hexagons themselves form the ball: they sit in latitude rings (pointy-top, labels always upright),
 * every ring is staggered half a tile against its neighbours (honeycomb), and each ring's tile size is fitted so the
 * ring closes exactly around the sphere. No THREE import, so it can be unit-tested in plain node.
 */

/** the artwork hexagon: flat-to-flat width ÷ vertex-to-vertex height (measured on /public/ingredients/*.png) */
export const HEX_ASPECT = 0.89;
/** the artwork's vertex-to-vertex height as a fraction of its atlas cell (atlas.ts normalises every picture to this) */
export const ART_FRAC = 0.82;
/** the hexagon mesh spans -1.1 … 1.1, so one atlas cell is 2.2 mesh units wide */
export const CELL_UNITS = 2.2;
/** artwork height in mesh units at scale 1 */
export const ART_H = ART_FRAC * CELL_UNITS;

export type Slots = {
  count: number;
  nx: Float32Array; // unit normal of every tile (sphere surface direction)
  ny: Float32Array;
  nz: Float32Array;
  scale: Float32Array; // mesh scale that makes the artwork exactly fill its slot
  row: Uint8Array;
  rings: number[]; // tiles per ring, pole to pole
  size: number; // typical tile height in world units
};

/**
 * @param R sphere radius
 * @param h tile height (vertex to vertex) in world units; smaller = more tiles
 * @param overlap >1 lets neighbours overlap a hair so no dark seams show between them
 */
export function ringSlots(R: number, h: number, overlap = 1.1): Slots {
  const w = HEX_ASPECT * h;
  const K = Math.max(2, Math.round(Math.PI / ((0.75 * h) / R)));

  // first pass: evenly spaced rows -> how many tiles fit around each ring
  const th0: number[] = [];
  for (let k = 0; k <= K; k++) th0.push((Math.PI * k) / K);
  const n: number[] = th0.map((t, k) =>
    k === 0 || k === K
      ? 1
      : Math.max(3, Math.round((2 * Math.PI * R * Math.sin(t)) / w)),
  );

  // each ring's tiles are fitted to its circumference, which fixes their height
  const hk = th0.map((t, k) =>
    n[k] === 1 ? h * 0.9 : (2 * Math.PI * R * Math.sin(t)) / n[k] / HEX_ASPECT,
  );
  // honeycomb rows interlock at 0.75 × tile height; rescale so the rows span exactly pole to pole
  const gaps: number[] = [];
  for (let k = 0; k < K; k++) gaps.push(0.75 * ((hk[k] + hk[k + 1]) / 2));
  const tot = gaps.reduce((a, b) => a + b, 0);
  const th: number[] = [0];
  for (const g of gaps) th.push(th[th.length - 1] + (g / tot) * Math.PI);

  const count = n.reduce((a, b) => a + b, 0);
  const nx = new Float32Array(count),
    ny = new Float32Array(count),
    nz = new Float32Array(count),
    scale = new Float32Array(count),
    row = new Uint8Array(count);
  let i = 0;
  for (let k = 0; k <= K; k++) {
    const size =
      n[k] === 1
        ? h * 0.9
        : (2 * Math.PI * R * Math.sin(th[k])) / n[k] / HEX_ASPECT;
    for (let j = 0; j < n[k]; j++) {
      const ph = (2 * Math.PI * (j + (k % 2 ? 0.5 : 0))) / n[k];
      nx[i] = Math.sin(th[k]) * Math.sin(ph);
      ny[i] = Math.cos(th[k]);
      nz[i] = Math.sin(th[k]) * Math.cos(ph);
      scale[i] = (size * overlap) / ART_H;
      row[i] = k;
      i++;
    }
  }
  return { count, nx, ny, nz, scale, row, rings: n, size: h };
}

/**
 * Decide which ingredient picture goes into which slot, and which instance flies to which slot.
 *
 * - instances 0..first.length-1 keep the pictures they already have in the opening field (`first`)
 * - the remaining instances are given pictures so every ingredient appears about equally often
 * - pictures are laid out so that touching tiles never show the same ingredient
 * - every instance flies to the free slot of its own picture that lies closest to where it floats now
 *
 * Returns `cell[i]` (picture of instance i) and `slot[i]` (slot index instance i lands in).
 */
export function assignTiles(
  s: Slots,
  first: number[],
  cells: number,
  from: (i: number) => [number, number, number],
  rnd: () => number,
) {
  const T = s.count;
  const cellOf = new Int32Array(T);
  const use = new Int32Array(cells);
  for (let i = 0; i < first.length; i++) {
    cellOf[i] = first[i];
    use[first[i]]++;
  }
  for (let i = first.length; i < T; i++) {
    let best = 0;
    for (let c = 1; c < cells; c++) if (use[c] < use[best]) best = c;
    cellOf[i] = best;
    use[best]++;
  }

  // neighbours = slots closer than ~1.25 tile widths
  const lim = (s.size * 1.25) ** 2;
  const near: number[][] = Array.from({ length: T }, () => []);
  for (let a = 0; a < T; a++)
    for (let b = a + 1; b < T; b++) {
      const dx = s.nx[a] - s.nx[b],
        dy = s.ny[a] - s.ny[b],
        dz = s.nz[a] - s.nz[b];
      if ((dx * dx + dy * dy + dz * dz) * 4 < lim) {
        near[a].push(b);
        near[b].push(a);
      }
    }

  // greedy fill (rows, top to bottom), repeated with different dice; keep the layout with the fewest clashes
  let bestSlotCell: Int32Array | null = null,
    bestClash = 1e9;
  for (let attempt = 0; attempt < 80 && bestClash > 0; attempt++) {
    const left = Int32Array.from(use);
    const sc = new Int32Array(T).fill(-1);
    let clash = 0;
    for (let a = 0; a < T; a++) {
      const bad = new Set<number>();
      for (const b of near[a]) if (sc[b] >= 0) bad.add(sc[b]);
      let pick = -1,
        score = -1;
      for (let c = 0; c < cells; c++) {
        if (left[c] <= 0 || bad.has(c)) continue;
        const v = left[c] + rnd() * 1.5;
        if (v > score) {
          score = v;
          pick = c;
        }
      }
      if (pick < 0) {
        clash++;
        for (let c = 0; c < cells; c++) if (left[c] > 0) pick = c;
      }
      sc[a] = pick;
      left[pick]--;
    }
    if (clash < bestClash) {
      bestClash = clash;
      bestSlotCell = sc;
    }
  }
  const slotCell = bestSlotCell!;

  // instance -> slot: nearest free slot that shows the instance's own picture
  const taken = new Uint8Array(T);
  const slot = new Int32Array(T);
  for (let i = 0; i < T; i++) {
    const [fx, fy, fz] = from(i);
    const l = Math.hypot(fx, fy, fz) || 1;
    let bs = -1,
      bd = -9;
    for (let a = 0; a < T; a++) {
      if (taken[a] || slotCell[a] !== cellOf[i]) continue;
      const d = (s.nx[a] * fx + s.ny[a] * fy + s.nz[a] * fz) / l;
      if (d > bd) {
        bd = d;
        bs = a;
      }
    }
    taken[bs] = 1;
    slot[i] = bs;
  }
  return { cell: cellOf, slot, clashes: bestClash };
}
