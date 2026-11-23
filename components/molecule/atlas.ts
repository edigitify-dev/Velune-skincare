import * as THREE from "three";
import { INGREDIENTS } from "@/lib/collection";
import { ART_FRAC } from "./tiles";
import { aniso } from "@/lib/quality";

type Art = { cx: number; cy: number; h: number }; // hexagon centre + vertex-to-vertex height, in the picture's own pixels

/**
 * Finds the hexagon inside a picture (the artwork has transparent margins and its size differs a little from picture to
 * picture). Measured on a small copy: height along the centre columns (vertex to vertex), width along the middle rows.
 */
function measureHex(img: HTMLImageElement): Art {
  const nw = img.naturalWidth,
    nh = img.naturalHeight;
  const fallback = { cx: nw / 2, cy: nh / 2, h: nh * 0.9 };
  try {
    const sc = Math.min(1, 320 / nw);
    const w = Math.max(8, Math.round(nw * sc)),
      h = Math.max(8, Math.round(nh * sc));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d", { willReadFrequently: true })!;
    c.drawImage(img, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h).data;
    const A = (x: number, y: number) => d[(y * w + x) * 4 + 3];
    const band = Math.max(2, Math.round(w * 0.03));
    const mx = Math.round(w / 2);
    let top = h,
      bot = -1;
    for (let x = mx - band; x <= mx + band; x++) {
      for (let y = 0; y < h; y++)
        if (A(x, y) > 128) {
          top = Math.min(top, y);
          break;
        }
      for (let y = h - 1; y >= 0; y--)
        if (A(x, y) > 128) {
          bot = Math.max(bot, y);
          break;
        }
    }
    if (bot <= top) return fallback;
    const my = Math.round((top + bot) / 2);
    let l = w,
      r = -1;
    for (let y = my - band; y <= my + band; y++) {
      for (let x = 0; x < w; x++)
        if (A(x, y) > 128) {
          l = Math.min(l, x);
          break;
        }
      for (let x = w - 1; x >= 0; x--)
        if (A(x, y) > 128) {
          r = Math.max(r, x);
          break;
        }
    }
    if (r <= l) return fallback;
    return {
      cx: (l + r) / 2 / sc,
      cy: (top + bot) / 2 / sc,
      h: (bot - top) / sc,
    };
  } catch {
    return fallback;
  }
}

/* ── preloading ──
 * Everything slow (download, decode, hexagon measuring, drawing the 16-cell sheet) happens ONCE, in small idle
 * slices, long before the section is reached (see preloadAtlas, called from MolecularExperience). By the time the
 * 3D scene mounts, the finished sheet is already sitting in memory and the texture is created from it instantly.
 */
const cellFor = (lite: boolean) => (lite ? 256 : 512);
const images = new Map<string, Promise<HTMLImageElement | null>>();
const built = new Map<number, HTMLCanvasElement>();
const building = new Map<number, Promise<HTMLCanvasElement>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        // decode off the main thread now, so drawing later never waits on it
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(
          () => resolve(img),
        );
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function drawCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  i: number,
  cell: number,
) {
  const x0 = (i % 4) * cell,
    y0 = Math.floor(i / 4) * cell;
  const art = measureHex(img);
  const k = (cell * ART_FRAC) / art.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, cell, cell); // never bleed into the neighbouring cell
  ctx.clip();
  ctx.clearRect(x0, y0, cell, cell);
  ctx.drawImage(
    img,
    x0 + cell / 2 - art.cx * k,
    y0 + cell / 2 - art.cy * k,
    img.naturalWidth * k,
    img.naturalHeight * k,
  );
  ctx.restore();
}

/** Starts (once) downloading every ingredient picture and painting the atlas sheet. Safe to call any number of times. */
export function preloadAtlas(lite: boolean): Promise<HTMLCanvasElement> {
  const cell = cellFor(lite);
  const done = built.get(cell);
  if (done) return Promise.resolve(done);
  let p = building.get(cell);
  if (!p) {
    p = (async () => {
      // all downloads run in parallel…
      const loaded = await Promise.all(
        INGREDIENTS.map((ing) => (ing.icon ? loadImage(ing.icon) : null)),
      );
      const cv = document.createElement("canvas");
      cv.width = cv.height = cell * 4;
      const ctx = cv.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // …the painting is spread over several tasks so no single one blocks scrolling
      for (let i = 0; i < loaded.length; i++) {
        const img = loaded[i];
        if (img) drawCell(ctx, img, i, cell);
        await tick();
      }
      built.set(cell, cv);
      return cv;
    })();
    building.set(cell, p);
  }
  return p;
}

/**
 * One canvas texture holding every ingredient hexagon image (4×4 cells, full colour with alpha).
 * Every picture is scaled and centred so its hexagon has exactly the same size in its cell (ART_FRAC of the cell
 * height): that is what lets the tiles sit edge to edge on the sphere with no size jumps between neighbours.
 */
export function makeAtlas(lite: boolean) {
  const cell = cellFor(lite);
  const ready = built.get(cell);
  // normal case: the sheet was prepared during idle time, so the texture is complete (and uploaded once) right away
  const cv = ready ?? document.createElement("canvas");
  if (!ready) cv.width = cv.height = cell * 4;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso();
  if (!ready) {
    // fallback (user got here before the preload finished): copy the sheet in as soon as it exists – one upload
    preloadAtlas(lite).then((src) => {
      cv.getContext("2d")!.drawImage(src, 0, 0);
      tex.needsUpdate = true;
    });
  }
  return tex;
}
