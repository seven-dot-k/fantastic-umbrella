"use client";

import { Assets, type Texture } from "pixi.js";
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
