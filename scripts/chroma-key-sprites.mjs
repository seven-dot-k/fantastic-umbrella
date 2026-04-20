/**
 * Chroma-key the pink background out of the generated character sprite sheet
 * and write a PNG with real alpha transparency. The AI image generator used a
 * hot-pink background (~RGB 195, 85, 140) that JPG can't make transparent, so
 * we do a one-time offline conversion here.
 *
 * The algorithm is a standard distance-in-RGB-space chroma key with a soft
 * edge: pixels very close to the key color become fully transparent, pixels
 * past a feather threshold stay fully opaque, and pixels in between fade
 * linearly. The key color itself is subtracted ("despill") from edge pixels
 * to remove residual pink fringing.
 *
 * Run with:  node scripts/chroma-key-sprites.mjs
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const INPUTS = [
  {
    src: "public/sprites/characters.jpg",
    dst: "public/sprites/characters.png",
    // Sampled from the actual generated sheet (see bash diagnostic output).
    keyR: 195,
    keyG: 85,
    keyB: 140,
    // Any pixel within `keyRange` RGB distance is fully transparent.
    keyRange: 55,
    // Pixels between `keyRange` and `keyRange + feather` fade linearly.
    feather: 30,
  },
  {
    // Full-body walking sprites, 6x5 grid on the same pink background.
    src: "public/sprites/characters-movement.jpg",
    dst: "public/sprites/characters-movement.png",
    keyR: 195,
    keyG: 85,
    keyB: 140,
    keyRange: 55,
    feather: 30,
  },
];

function processPixels(data, info, cfg) {
  const { width, height, channels } = info;
  // Output is always RGBA. If the source is RGB (3 channels) we expand.
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * channels;
      const di = (y * width + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];

      const dr = r - cfg.keyR;
      const dg = g - cfg.keyG;
      const db = b - cfg.keyB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      let alpha;
      if (dist <= cfg.keyRange) {
        alpha = 0;
      } else if (dist >= cfg.keyRange + cfg.feather) {
        alpha = 255;
      } else {
        alpha = Math.round(((dist - cfg.keyRange) / cfg.feather) * 255);
      }

      // Despill: for edge pixels, pull the saturated pink out of the color.
      // This removes the subtle pink halo around character outlines.
      let outR = r;
      let outG = g;
      let outB = b;
      if (alpha > 0 && alpha < 255) {
        // Reduce the component along the key direction.
        const spill = (255 - alpha) / 255;
        outR = Math.max(0, r - cfg.keyR * spill * 0.5);
        outG = Math.max(0, g - cfg.keyG * spill * 0.5);
        outB = Math.max(0, b - cfg.keyB * spill * 0.5);
      }

      out[di] = outR;
      out[di + 1] = outG;
      out[di + 2] = outB;
      out[di + 3] = alpha;
    }
  }
  return out;
}

for (const cfg of INPUTS) {
  console.log(`Keying ${cfg.src} -> ${cfg.dst}`);
  const { data, info } = await sharp(cfg.src)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = processPixels(data, info, cfg);
  await mkdir(dirname(cfg.dst), { recursive: true });
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(cfg.dst);
  console.log(
    `  wrote ${cfg.dst} (${info.width}x${info.height}, RGBA)`,
  );
}

console.log("Done.");
