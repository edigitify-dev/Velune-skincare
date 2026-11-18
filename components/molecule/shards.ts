import * as THREE from 'three';
import { mulberry, SPHERE_R } from './network';
import type { Network } from './network';

/**
 * Pre-fractured glass: every face of the jittered geodesic lattice becomes a thin prism, ~40% are split again
 * for irregular sizes. One merged geometry; the shatter itself is animated on the GPU as a pure function of
 * scroll progress, so it is deterministic and reverses exactly.
 */
export function buildShards(net: Network): THREE.BufferGeometry {
  const rnd = mulberry(777);
  const R = SPHERE_R;
  type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  const tris: Tri[] = [];
  const splitP = net.lite ? 0.5 : 0.42;
  for (const f of net.F) {
    const a = net.V[f[0]].clone().multiplyScalar(R), b = net.V[f[1]].clone().multiplyScalar(R), c = net.V[f[2]].clone().multiplyScalar(R);
    if (rnd() < splitP) {
      const m = a.clone().add(b).add(c).divideScalar(3);
      m.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.18)).setLength(R);
      tris.push([a, b, m], [b, c, m], [c, a, m]);
    } else tris.push([a, b, c]);
  }
  const areas = tris.map(([a, b, c]) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2);
  const meanA = areas.reduce((x, y) => x + y, 0) / areas.length;

  const pos: number[] = [], nor: number[] = [], cen: number[] = [], rd: number[] = [], bar: number[] = [], side: number[] = [];
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Vector3, r: number[], b: number[], s: number) => {
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); cen.push(c.x, c.y, c.z); rd.push(r[0], r[1], r[2], r[3]); bar.push(b[0], b[1], b[2]); side.push(s);
  };

  tris.forEach(([a0, b0, c0], ti) => {
    const c = a0.clone().add(b0).add(c0).divideScalar(3);
    const n = c.clone().normalize();
    const sh = 0.962;
    const pts = [a0, b0, c0].map((p) => c.clone().add(p.clone().sub(c).multiplyScalar(sh)));
    const T = 0.028 + rnd() * 0.04;
    const top = pts.map((p) => p.clone().addScaledVector(n, T / 2));
    const bot = pts.map((p) => p.clone().addScaledVector(n, -T / 2));
    const sizeK = Math.min(1, areas[ti] / (meanA * 2));
    // bigger shards are heavier: slower
    const r = [Math.min(1, Math.max(0, rnd() * 0.75 + (1 - sizeK) * 0.25)), rnd(), rnd(), rnd()];
    const B = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let k = 0; k < 3; k++) push(top[k], n, c, r, B[k], 0);
    const nb = n.clone().negate();
    for (const k of [0, 2, 1]) push(bot[k], nb, c, r, B[k], 0);
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      const edge = new THREE.Vector3().subVectors(pts[k2], pts[k]);
      const sn = new THREE.Vector3().crossVectors(edge, n).normalize();
      if (sn.dot(pts[k].clone().sub(c)) < 0) sn.negate();
      const flip = sn.dot(new THREE.Vector3().crossVectors(edge, n)) < 0; // keep winding facing outwards
      const q = flip ? [top[k2], top[k], bot[k], top[k2], bot[k], bot[k2]] : [top[k], top[k2], bot[k2], top[k], bot[k2], bot[k]];
      for (const p of q) push(p, sn, c, r, [1, 1, 1], 1);
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 3));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(rd, 4));
  g.setAttribute('aBary', new THREE.Float32BufferAttribute(bar, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 6); // fragments fly far; never cull
  return g;
}
