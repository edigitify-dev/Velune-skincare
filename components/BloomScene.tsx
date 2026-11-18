'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

export type BloomState = { scroll: number; boost: number; px: number; py: number };

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function Petal({ i, n, ring, state }: { i: number; n: number; ring: 0 | 1; state: BloomState }) {
  const tilt = useRef<THREE.Group>(null);
  const yaw = (i / n) * Math.PI * 2 + ring * (Math.PI / n);
  const len = ring ? 1.15 : 1.5;
  const base = ring ? 0.42 : 0.55;
  const closed = ring ? 0.05 : 0.15;
  const open = ring ? -0.7 : -0.98;

  useFrame(({ clock }) => {
    if (!tilt.current) return;
    const o = ease(Math.max(state.scroll, state.boost));
    const t = clock.elapsedTime;
    const dir = Math.cos(yaw) * state.px + Math.sin(yaw) * -state.py;
    const flutter = Math.sin(t * 0.8 + i * 1.7) * 0.03 * (0.4 + o) + dir * 0.09 * o;
    tilt.current.rotation.z = closed + (open - closed) * o + flutter;
  });

  return (
    <group rotation={[0, yaw, 0]}>
      <group position={[base, 0, 0]}>
        <group ref={tilt}>
          <mesh position={[0, len, 0]} scale={[0.085, len, ring ? 0.4 : 0.5]}>
            <sphereGeometry args={[1, 36, 24]} />
            <meshPhysicalMaterial
              color="#fff4e8" transmission={0.96} thickness={0.5} roughness={0.07} ior={1.32}
              iridescence={1} iridescenceIOR={1.3} iridescenceThicknessRange={[200, 600]}
              attenuationColor="#E9D4C2" attenuationDistance={1.6} envMapIntensity={1.4}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Bottle() {
  return (
    <group>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.3, 40]} />
        <meshPhysicalMaterial color="#fff" transmission={0.9} thickness={0.3} roughness={0.04} ior={1.45} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 1.0, 40]} />
        <meshStandardMaterial color="#D9A441" roughness={0.18} metalness={0.15} emissive="#8a5a10" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.19, 0.22, 0.16, 32]} />
        <meshStandardMaterial color="#2d231d" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.08, 0]}>
        <cylinderGeometry args={[0.15, 0.19, 0.64, 32]} />
        <meshStandardMaterial color="#1d1511" roughness={0.35} />
      </mesh>
    </group>
  );
}

function Rig({ state, lite }: { state: BloomState; lite: boolean }) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ camera, clock }) => {
    const o = ease(Math.max(state.scroll, state.boost * 0.9));
    camera.position.z += ((7.6 - o * 2.3) - camera.position.z) * 0.06;
    camera.position.y += ((1.9 - o * 0.5) - camera.position.y) * 0.06;
    camera.lookAt(0, 1.3, 0);
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.05 + state.px * 0.35;
    if (light.current) {
      light.current.position.x += (state.px * 4 - light.current.position.x) * 0.08;
      light.current.position.y += (2.5 - state.py * 3 - light.current.position.y) * 0.08;
      light.current.intensity = 6 + o * 14; // light travels through petals as they open
    }
  });
  return (
    <>
      <color attach="background" args={['#E9D4C2']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 3]} intensity={2.2} color="#fff0dc" />
      <pointLight ref={light} position={[0, 2.5, 2]} color="#ffd9a8" distance={9} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[3, 4, 3]} scale={[5, 5, 1]} color="#fff1dc" />
        <Lightformer form="rect" intensity={1.5} position={[-4, 2, -2]} scale={[4, 6, 1]} color="#E9D4C2" />
        <Lightformer form="ring" intensity={1.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={4} color="#ffffff" />
      </Environment>
      <group ref={group}>
        <Bottle />
        {Array.from({ length: lite ? 6 : 9 }, (_, i) => <Petal key={`o${i}`} i={i} n={lite ? 6 : 9} ring={0} state={state} />)}
        {Array.from({ length: lite ? 5 : 7 }, (_, i) => <Petal key={`i${i}`} i={i} n={lite ? 5 : 7} ring={1} state={state} />)}
      </group>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} blur={2.6} scale={9} far={3} color="#33241F" />
    </>
  );
}

export default function BloomScene({ state, active, lite }: { state: BloomState; active: boolean; lite: boolean }) {
  return (
    <Canvas
      className="!absolute inset-0 touch-pan-y"
      camera={{ position: [0, 1.9, 7.6], fov: 32 }}
      dpr={lite ? 1 : [1, 1.6]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMove={(e) => {
        const r = (e.target as HTMLElement).getBoundingClientRect();
        state.px = ((e.clientX - r.left) / r.width - 0.5) * 2;
        state.py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }}
    >
      <Rig state={state} lite={lite} />
    </Canvas>
  );
}
