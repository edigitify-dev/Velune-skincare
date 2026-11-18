"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { CarouselState, ExpState, Mouse } from "./types";
import { COLLECTION } from "@/lib/collection";
import { ss } from "./network";

const FLOOR = -1.5;

function radialTexture(stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Interactive 3D product carousel: real pack shots hung in depth, one in focus, snapping spring. */
export default function Carousel({
  S,
  car,
  mouse,
  onActive,
}: {
  S: ExpState;
  car: CarouselState;
  mouse: Mouse;
  onActive: (i: number) => void;
}) {
  const tex = useTexture(COLLECTION.map((c) => c.image)) as THREE.Texture[];
  useEffect(() => {
    tex.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
    });
  }, [tex]);

  const shadowTex = useMemo(
    () =>
      radialTexture([
        [0, "rgba(51,36,31,.55)"],
        [0.55, "rgba(51,36,31,.16)"],
        [1, "rgba(51,36,31,0)"],
      ]),
    [],
  );
  const glowTex = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,246,232,.95)"],
        [0.35, "rgba(255,240,220,.25)"],
        [1, "rgba(255,240,220,0)"],
      ]),
    [],
  );
  useEffect(
    () => () => {
      shadowTex.dispose();
      glowTex.dispose();
    },
    [shadowTex, glowTex],
  );

  const refs = useRef<(THREE.Group | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const shMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const lastActive = useRef(-1);

  const dims = useMemo(
    () =>
      COLLECTION.map((c, i) => {
        const img = tex[i].image as HTMLImageElement | undefined;
        const asp = img ? img.width / img.height : 0.4;
        const h = 3.15 * c.h * 1.03;
        return { w: h * asp, h };
      }),
    [tex],
  );

  useFrame(({ clock, size }, dt0) => {
    const dt = Math.min(dt0, 1 / 30),
      t = clock.elapsedTime;
    if (!car.dragging)
      car.pos += (car.target - car.pos) * (1 - Math.exp(-dt * 6.5));
    const idx = Math.min(
      COLLECTION.length - 1,
      Math.max(0, Math.round(car.pos)),
    );
    if (idx !== lastActive.current) {
      lastActive.current = idx;
      car.active = idx;
      onActive(idx);
    }
    const sp = car.spacing;
    // portrait phones: smaller products, lifted so the information block never covers them
    const port = size.width / size.height < 0.9;
    const pf = port ? 0.68 : 1,
      lift = port ? 0.95 : 0;
    COLLECTION.forEach((_, i) => {
      const g = refs.current[i],
        m = mats.current[i],
        sh = shMats.current[i];
      if (!g || !m || !sh) return;
      const k = i - car.pos,
        ak = Math.abs(k),
        ac = Math.min(ak, 1);
      const p = ss(
        Math.min(ak, 3) * 0.08,
        Math.min(ak, 3) * 0.08 + 0.7,
        S.prod,
      );
      const x = ak <= 1 ? k * sp : Math.sign(k) * (sp + (ak - 1) * sp * 0.6);
      const sc =
        (1.1 - 0.42 * (ac * ac * (3 - 2 * ac))) * (0.86 + 0.14 * p) * pf;
      const z =
        -Math.min(ak, 2.5) * 1.1 +
        (ak < 0.5 ? (1 - ak * 2) * 0.55 : 0) -
        2.4 * (1 - p);
      const bob = Math.sin(t * 0.9 + i) * 0.05 * (1 - ac);
      const { w, h } = dims[i];
      g.position.set(x, FLOOR + lift + (h * sc) / 2 + bob - 0.5 * (1 - p), z);
      g.rotation.set(
        0,
        Math.max(-0.6, Math.min(0.6, -k * 0.3)) + mouse.x * 0.12 * (1 - ac),
        0,
      );
      g.scale.set(sc, sc, 1);
      g.visible = p > 0.002 && ak < 4;
      const base =
        ak < 0.5 ? 1 : 1 - Math.min(1, ak) * 0.5 - Math.max(0, ak - 1) * 0.4;
      m.opacity = Math.max(0, base) * p;
      sh.opacity = Math.max(0, base) * p * 0.9;
      // shadow sits on the "floor", under each product
      const sg = g.children[1] as THREE.Mesh;
      sg.position.set(0, -(h / 2) - 0.02 + 0.0, -0.02);
      void w;
    });
    if (glow.current) glow.current.opacity = 0.3 * ss(0.1, 0.9, S.prod);
  });

  return (
    <group>
      <mesh position={[0, 0.1, -3.4]} renderOrder={6}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial
          ref={glow}
          map={glowTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {COLLECTION.map((c, i) => (
        <group
          key={c.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
          renderOrder={7}
        >
          <mesh>
            <planeGeometry args={[dims[i].w, dims[i].h]} />
            <meshBasicMaterial
              ref={(el) => {
                mats.current[i] = el;
              }}
              map={tex[i]}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={[1, 1, 1]}>
            <planeGeometry args={[dims[i].w * 1.5, 0.42]} />
            <meshBasicMaterial
              ref={(el) => {
                shMats.current[i] = el;
              }}
              map={shadowTex}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
