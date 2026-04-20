"use client";

import type { Graphics as PixiGraphics } from "pixi.js";
import { TextStyle } from "pixi.js";
import { useCallback, useMemo } from "react";
import { useSpriteSheetFrames } from "@/hooks/use-texture";

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

// Sprite sheet layout for /sprites/characters-movement.png (1024x1024).
// The sheet has a 6-column by 5-row grid of full-body characters. We use the
// PNG (chroma-keyed from the JPG) so the sheet has real alpha transparency -
// see scripts/chroma-key-sprites.mjs.
//
// Cell size is fractional (1024/6 x 1024/5) - PIXI's Rectangle accepts floats.
const SHEET_URL = "/sprites/characters-movement.png";
const SHEET_COLS = 6;
const SHEET_ROWS = 5;
const CELL_W = 1024 / SHEET_COLS; // ~170.67
const CELL_H = 1024 / SHEET_ROWS; // 204.8
// Crop inset removes the grid line and extra transparent padding around each
// character, leaving a tight bounding box that shows the full body.
const FRAME_PAD_X = 32;
const FRAME_PAD_Y = 18;
const FRAME_W = CELL_W - FRAME_PAD_X * 2;
const FRAME_H = CELL_H - FRAME_PAD_Y * 2;

// Displayed sprite size in world pixels, tuned so characters read as humans
// next to mansion furniture without feeling oversized.
const DISPLAY_HEIGHT = 72;
const DISPLAY_SCALE = DISPLAY_HEIGHT / FRAME_H;

// Allowlist of flat (row * 6 + col) indices that contain clean full-body
// sprites. Row 0 is mostly upper-body portraits; row 2 col 0 is empty; row 3
// col 0 is an icon cell. Everything else is a usable full-body character.
const NPC_FRAME_INDICES = [
  // Row 1: detective, butlers, heiresses (indices 6-11).
  6, 7, 8, 9, 10, 11,
  // Row 2: chefs and brunette maids (skip index 12 which is empty).
  13, 14, 15, 16, 17,
  // Row 3: doctors and blonde maids (skip index 18 which is an icon).
  19, 20, 21, 22, 23,
  // Row 4: detectives, farmhand kid, gardeners.
  24, 25, 26, 27, 28, 29,
];

/** Stable non-cryptographic string hash for picking a sprite frame. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface NpcProps {
  x: number;
  y: number;
  name: string;
  mood: string;
  /**
   * Stable identifier used to pick a sprite frame. Two NPCs with the same
   * seed will always render the same character art. Defaults to `name`.
   */
  spriteSeed?: string;
}

/**
 * NPC sprite rendered from the shared character sprite sheet. A mood-colored
 * shadow ring beneath the feet encodes the current mood at a glance, and the
 * NPC's name is rendered with a pixel-style stroked label for readability.
 *
 * While the sprite sheet is still loading, a mood-colored circle is shown as
 * a graceful fallback so layout doesn't shift once textures resolve.
 */
export function Npc({ x, y, name, mood, spriteSeed }: NpcProps) {
  const color = MOOD_COLORS[mood.toLowerCase()] ?? DEFAULT_COLOR;

  const frames = useSpriteSheetFrames(
    SHEET_URL,
    SHEET_COLS,
    SHEET_ROWS,
    CELL_W,
    CELL_H,
    FRAME_PAD_X,
    FRAME_PAD_Y,
    FRAME_W,
    FRAME_H,
  );

  const frameIndex = useMemo(() => {
    const seed = spriteSeed ?? name;
    return NPC_FRAME_INDICES[hashString(seed) % NPC_FRAME_INDICES.length];
  }, [spriteSeed, name]);

  const texture = frames?.[frameIndex] ?? null;

  // Soft mood-colored ground shadow under the sprite's feet. Sits at the
  // NPC's world position (local y=0) so the character appears to stand on it.
  const drawMoodRing = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.ellipse(0, 4, 22, 6).fill({ color: 0x000000, alpha: 0.25 });
      g.ellipse(0, 4, 20, 5).fill({ color, alpha: 0.55 });
      g.ellipse(0, 4, 20, 5).stroke({
        color: 0xffffff,
        width: 1,
        alpha: 0.7,
      });
    },
    [color],
  );

  // Fallback mood circle shown while the sprite sheet loads. Positioned
  // above the ground ring so it reads as a "head" placeholder.
  const drawFallback = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.circle(0, -NPC_RADIUS - 2, NPC_RADIUS).fill(color);
      g.circle(0, -NPC_RADIUS - 2, NPC_RADIUS).stroke({
        color: 0xffffff,
        width: 2,
      });
    },
    [color],
  );

  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: "sans-serif",
        fontSize: 11,
        fontWeight: "600",
        fill: 0xffffff,
        stroke: { color: 0x1a0f2d, width: 3 },
        align: "center",
      }),
    [],
  );

  return (
    <pixiContainer x={x} y={y}>
      {/* Ground shadow drawn first so the sprite stands on top of it. */}
      <pixiGraphics draw={drawMoodRing} />
      {texture ? (
        // Bottom-center anchor: sprite "stands" on the NPC position (0, 0).
        // A 2px lift keeps the character visually above the shadow.
        <pixiSprite
          texture={texture}
          anchor={{ x: 0.5, y: 1 }}
          scale={DISPLAY_SCALE}
          y={2}
        />
      ) : (
        <pixiGraphics draw={drawFallback} />
      )}
      <pixiText text={name} style={labelStyle} anchor={0.5} y={16} />
    </pixiContainer>
  );
}
