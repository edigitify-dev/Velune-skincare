"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { CarouselState, ExpState, Mouse } from "./types";
import { buildNetwork, ss } from "./network";
import NetworkLayer from "./NetworkLayer";
import GlassShards from "./GlassShards";
import Particles from "./Particles";
import Carousel from "./Carousel";

export type Shared = { uTime: { value: number }; uDark: { value: number } };

type Props = {
  S: ExpState;
  car: CarouselState;
  mouse: Mouse;
  lite: boolean;
  active: boolean;
  onHover: (i: number) => void;
  onActive: (i: number) => void;
};

/** camera path + pointer parallax (the background image and its colour washes live in the page, behind the transparent canvas) */
function Rig({
  S,
  mouse,
  shared,
}: {
  S: ExpState;
  mouse: Mouse;
  shared: Shared;
}) {
  useFrame(({ camera, size }, dt0) => {
    const dt = Math.min(dt0, 1 / 30);
    mouse.x += (mouse.sx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.sy - mouse.y) * Math.min(1, dt * 3);
    const aspect = size.width / size.height;
    // portrait screens need the camera further back so the sphere still fits
    const zs =
      aspect >= 1.25
        ? 1
        : THREE.MathUtils.lerp(
            2.0,
            1,
            THREE.MathUtils.clamp((aspect - 0.46) / (1.25 - 0.46), 0, 1),
          );
    const z = S.camZ * (1 + (zs - 1) * ss(0, 0.8, S.gather) * (1 - S.prod));
    const par = 1 - 0.6 * ss(0.2, 0.6, S.gather);
    camera.position.set(
      Math.sin(S.orbit) * z + mouse.x * 0.35 * par,
      S.camY + mouse.y * 0.22 * par,
      Math.cos(S.orbit) * z,
    );
    camera.lookAt(0, S.camY * 0.3, 0);
    shared.uDark.value = S.dark;
  });
  return null;
}

function World({
  S,
  car,
  mouse,
  lite,
  onHover,
  onActive,
}: Omit<Props, "active">) {
  const aspect = useThree((s) => s.size.width / s.size.height);
  const bucket = aspect < 0.9 ? 0 : aspect < 1.4 ? 1 : 2;
  const net = useMemo(() => buildNetwork(lite, aspect), [lite, bucket]); // eslint-disable-line react-hooks/exhaustive-deps
  const shared = useMemo<Shared>(
    () => ({ uTime: { value: 0 }, uDark: { value: 0 } }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const hoverRef = useRef(-1);
  const bloom = useRef<any>(null);

  useFrame(() => {
    if (group.current) group.current.rotation.y = S.rot;
    if (bloom.current) bloom.current.intensity = 0.32 + 0.3 * S.dark;
  });

  return (
    <>
      <Rig S={S} mouse={mouse} shared={shared} />
      <group ref={group}>
        <Particles S={S} shared={shared} lite={lite} />
        <GlassShards net={net} S={S} shared={shared} />
        <NetworkLayer
          net={net}
          S={S}
          shared={shared}
          mouse={mouse}
          onHover={onHover}
          hoverRef={hoverRef}
        />
      </group>
      <Suspense fallback={null}>
        <Carousel S={S} car={car} mouse={mouse} onActive={onActive} />
      </Suspense>
      {!lite && (
        <EffectComposer multisampling={4}>
          <Bloom
            ref={bloom}
            intensity={0.6}
            luminanceThreshold={1}
            luminanceSmoothing={0.25}
            mipmapBlur
            radius={0.72}
          />
        </EffectComposer>
      )}
    </>
  );
}

export default function MolecularScene({
  S,
  car,
  mouse,
  lite,
  active,
  onHover,
  onActive,
}: Props) {
  return (
    <Canvas
      className="!absolute inset-0"
      flat
      dpr={lite ? 1 : [1, 1.6]}
      camera={{ fov: 40, near: 0.1, far: 80, position: [0, 0, 10.5] }}
      gl={{ antialias: lite, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      frameloop={active ? "always" : "never"}
      aria-hidden
    >
      <World
        S={S}
        car={car}
        mouse={mouse}
        lite={lite}
        onHover={onHover}
        onActive={onActive}
      />
    </Canvas>
  );
}
