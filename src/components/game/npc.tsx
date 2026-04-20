"use client";

import type { Graphics as PixiGraphics } from "pixi.js";
import { TextStyle } from "pixi.js";
import { useCallback, useMemo } from "react";

const MOOD_COLORS: Record<string, number> = {
  calm: 0x4a90d9,
  nervous: 0xf5d547,
  defensive: 0xe74c3c,
  suspicious: 0xe67e22,
  angry: 0xc0392b,
  relieved: 0x2ecc71,
};

const DEFAULT_COLOR = 0x95a5a6;
const NPC_RADIUS = 16;

interface NpcProps {
  x: number;
  y: number;
  name: string;
  mood: string;
}

/**
 * NPC placeholder sprite: mood-colored circle with name label below.
 */
export function Npc({ x, y, name, mood }: NpcProps) {
  const color = MOOD_COLORS[mood.toLowerCase()] ?? DEFAULT_COLOR;

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.circle(0, 0, NPC_RADIUS).fill(color);
      g.circle(0, 0, NPC_RADIUS).stroke({ color: 0xffffff, width: 2 });
    },
    [color],
  );

  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: "sans-serif",
        fontSize: 12,
        fill: 0xffffff,
        align: "center",
      }),
    [],
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiText text={name} style={labelStyle} anchor={0.5} y={NPC_RADIUS + 12} />
    </pixiContainer>
  );
}
