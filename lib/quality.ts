import { useEffect, useState } from "react";

export type Tier = "high" | "medium" | "low";

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };
const BY_RANK: Tier[] = ["low", "medium", "high"];
const KEY = "velune-tier";

type Nav = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

const lower = (a: Tier, b: Tier): Tier => (RANK[a] <= RANK[b] ? a : b);

// GPUs that cannot run the 3D scenes at all (software rendering)
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
// old / integrated GPUs: they can run it, but only in the lighter mode
const WEAK =
  /mali-(4|t)|adreno.*\b[345]\d\d\b|powervr|sgx|vivante|videocore|intel.*(hd graphics|uhd graphics|iris)/i;

function gpuRenderer(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return r;
  } catch {
    return "";
  }
}

function detect(): Tier {
  const n = navigator as Nav;
  let t: Tier = "high";

  const cores = n.hardwareConcurrency || 8;
  const mem = n.deviceMemory ?? 8; // not available in Safari / Firefox -> assume fine
  const small = window.matchMedia("(max-width: 767px)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  if (n.connection?.saveData) t = lower(t, "low");
  if (cores <= 2 || mem <= 2) t = lower(t, "low");
  else if (cores <= 4 || mem <= 4) t = lower(t, "medium");
  if (small || touch) t = lower(t, "medium");

  const gpu = gpuRenderer();
  if (SOFTWARE.test(gpu)) t = "low";
  else if (WEAK.test(gpu)) t = lower(t, "medium");

  // a downgrade made earlier in this session (by the FPS guard) sticks
  try {
    const saved = sessionStorage.getItem(KEY) as Tier | null;
    if (saved && saved in RANK) t = lower(t, saved);
  } catch {}
  return t;
}

let current: Tier | null = null;
let lastDowngrade = 0;
const listeners = new Set<() => void>();

/** Current quality tier. Only call in the browser (inside effects / event handlers). */
export function getTier(): Tier {
  if (current === null)
    current = typeof window === "undefined" ? "high" : detect();
  return current;
}

/** One step down (high -> medium -> low). Never goes back up. */
export function downgradeTier() {
  const next = BY_RANK[RANK[getTier()] - 1];
  const now = performance.now();
  if (!next || now - lastDowngrade < 5000) return;
  lastDowngrade = now;
  current = next;
  try {
    sessionStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((fn) => fn());
}

/** null on the server and on the very first render, the real tier after that. */
export function useTier(): Tier | null {
  const [t, setT] = useState<Tier | null>(null);
  useEffect(() => {
    const sync = () => setT(getTier());
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return t;
}

/** devicePixelRatio cap per tier. `hi` is the cap used on the high tier. */
export const dprFor = (
  tier: Tier,
  hi: number | [number, number],
  lowest = 1,
): number | [number, number] =>
  tier === "high" ? hi : tier === "medium" ? [1, 1.25] : lowest;

/** texture anisotropy per tier (call in the browser) */
export const aniso = () => ({ high: 8, medium: 4, low: 2 })[getTier()];
