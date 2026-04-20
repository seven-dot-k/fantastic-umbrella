"use client";

import { useTick } from "@pixi/react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { useCallback, useRef } from "react";

const CLUE_SIZE = 12;

interface ClueObjectProps {
  x: number;
  y: number;
}

/**
 * Environmental clue: small golden diamond with a pulsing alpha glow.
 */
export function ClueObject({ x, y }: ClueObjectProps) {
  const graphicsRef = useRef<PixiGraphics | null>(null);
  const timeRef = useRef(0);

  const draw = useCallback((g: PixiGraphics) => {
    g.clear();
    // Diamond = rotated square; draw as rotated rect around origin.
    const half = CLUE_SIZE;
    g.poly([0, -half, half, 0, 0, half, -half, 0]).fill(0xf1c40f);
    g.poly([0, -half, half, 0, 0, half, -half, 0]).stroke({
      color: 0xfff3a3,
      width: 1,
    });
  }, []);

  useTick((ticker) => {
    timeRef.current += ticker.deltaTime;
    const graphics = graphicsRef.current;
    if (graphics) {
      graphics.alpha = 0.5 + 0.5 * Math.sin(timeRef.current * 0.05);
    }
  });

  return <pixiGraphics ref={graphicsRef} draw={draw} x={x} y={y} />;
}
