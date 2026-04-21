"use client";

import { Assets, Rectangle, Texture } from "pixi.js";
import { useEffect, useState } from "react";

/**
 * Loads a PIXIJS texture asynchronously via the Assets system and returns
 * it once available. Returns null while the texture is still loading so
 * callers can render a fallback.
 *
 * Assets.load() de-duplicates concurrent requests for the same URL, so
 * multiple components calling this hook with the same URL share one load.
 */
export function useTexture(url: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Assets.load<Texture>(url).then((loaded) => {
      if (!cancelled) {
        setTexture(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return texture;
}

/**
 * Loads a sprite sheet image and slices it into a flat array of sub-textures
 * using a uniform grid. Row-major order: index 0 = top-left, then left→right,
 * top→bottom.
 *
 * The optional frame* parameters let you crop within each cell, which is
 * useful for AI-generated sheets where each cell has padding or baked-in
 * labels that you want to exclude from the visible sprite.
 *
 *   cellWidth/cellHeight: spacing of the grid (pixels per cell)
 *   frameOffsetX/Y:       top-left inset of the visible sprite inside a cell
 *   frameWidth/Height:    size of the visible sprite within the cell
 */
export function useSpriteSheetFrames(
  url: string,
  cols: number,
  rows: number,
  cellWidth: number,
  cellHeight: number,
  frameOffsetX = 0,
  frameOffsetY = 0,
  frameWidth: number = cellWidth,
  frameHeight: number = cellHeight,
): Texture[] | null {
  const [frames, setFrames] = useState<Texture[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Assets.load<Texture>(url).then((loaded) => {
      if (cancelled) return;
      const source = loaded.source;
      const sliced: Texture[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const frame = new Rectangle(
            c * cellWidth + frameOffsetX,
            r * cellHeight + frameOffsetY,
            frameWidth,
            frameHeight,
          );
          sliced.push(new Texture({ source, frame }));
        }
      }
      setFrames(sliced);
    });
    return () => {
      cancelled = true;
    };
  }, [
    url,
    cols,
    rows,
    cellWidth,
    cellHeight,
    frameOffsetX,
    frameOffsetY,
    frameWidth,
    frameHeight,
  ]);

  return frames;
}
