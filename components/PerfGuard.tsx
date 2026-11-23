"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { downgradeTier, getTier } from "@/lib/quality";

const WARMUP = 4; // seconds ignored after start (shader compile, texture upload)
const WINDOW = 1.5; // seconds per measurement
const MIN_FPS = 38; // below this a window counts as "slow"
const STRIKES = 2; // slow windows in a row before we drop one tier

/** Put inside a <Canvas>. If frames stay slow, the whole site drops one quality tier. */
export default function PerfGuard() {
  const s = useRef({ warm: 0, time: 0, frames: 0, strikes: 0 });
  useFrame((_, dt) => {
    const k = s.current;
    if (getTier() === "low") return; // nothing left to drop
    if (dt > 0.5) {
      // tab was hidden or the page stalled: ignore this sample
      k.time = 0;
      k.frames = 0;
      return;
    }
    if (k.warm < WARMUP) {
      k.warm += dt;
      return;
    }
    k.time += dt;
    k.frames++;
    if (k.time < WINDOW) return;
    const fps = k.frames / k.time;
    k.time = 0;
    k.frames = 0;
    if (fps >= MIN_FPS) {
      k.strikes = 0;
      return;
    }
    if (++k.strikes >= STRIKES) {
      k.strikes = 0;
      k.warm = 0; // let the lower tier settle before measuring again
      downgradeTier();
    }
  });
  return null;
}
