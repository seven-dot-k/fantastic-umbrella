"use client";

import type { Graphics as PixiGraphics } from "pixi.js";
import { useCallback, type ReactNode } from "react";
import type { MapLayout } from "@/lib/game-config";

interface GameWorldProps {
  mapLayout: MapLayout;
  children: ReactNode;
}

/**
 * Renders the room background and furniture collision boxes, then layers
 * entity children (Player, NPCs, Clues, InteractionPrompt) above them.
 */
export function GameWorld({ mapLayout, children }: GameWorldProps) {
  const { width, height, furniture } = mapLayout;

  const drawFloor = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      // Dark room floor.
      g.rect(0, 0, width, height).fill(0x2a1f3d);
      // Subtle border to frame the room.
      g.rect(0, 0, width, height).stroke({ color: 0x3d2f55, width: 2 });
    },
    [width, height],
  );

  const drawFurniture = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      for (const piece of furniture) {
        g.rect(piece.x, piece.y, piece.width, piece.height).fill(0x4a3868);
        g.rect(piece.x, piece.y, piece.width, piece.height).stroke({
          color: 0x6b5090,
          width: 1,
        });
      }
    },
    [furniture],
  );

  return (
    <pixiContainer>
      {/* Floor layer */}
      <pixiGraphics draw={drawFloor} />
      {/* Furniture layer (collision boxes) */}
      <pixiGraphics draw={drawFurniture} />
      {/* Entity layer */}
      <pixiContainer>{children}</pixiContainer>
    </pixiContainer>
  );
}
