import * as THREE from "three";
import { INGREDIENTS } from "@/lib/collection";
import { ART_FRAC } from "./tiles";

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

/**
 * One canvas texture holding every ingredient hexagon image (4×4 cells, full colour with alpha).
 * Every picture is scaled and centred so its hexagon has exactly the same size in its cell (ART_FRAC of the cell
 * height): that is what lets the tiles sit edge to edge on the sphere with no size jumps between neighbours.
 */
export function makeAtlas(lite: boolean) {
  const cell = lite ? 256 : 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = cell * 4;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  INGREDIENTS.forEach((ing, i) => {
    const src = ing.icon;
    if (!src) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
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
      tex.needsUpdate = true;
    };
    img.src = src;
  });
  return tex;
}
