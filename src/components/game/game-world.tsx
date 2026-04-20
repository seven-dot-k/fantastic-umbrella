"use client";

import type { Graphics as PixiGraphics } from "pixi.js";
import { useCallback, type ReactNode } from "react";
import { useTexture } from "@/hooks/use-texture";
import type { MapLayout } from "@/lib/game-config";

const MANSION_MAP_URL = "/sprites/mansion-room.jpg";

interface GameWorldProps {
  mapLayout: MapLayout;
  children: ReactNode;
  /** When true, draws outlines of furniture collision boxes for debugging. */
  showCollisionDebug?: boolean;
}

/**
 * Renders the mansion room background from a pre-rendered pixel-art map and
 * layers entity children (Player, NPCs, Clues, InteractionPrompt) above it.
 *
 * Furniture collision boxes are not drawn visually - the background art
 * already depicts them. A debug outline mode is available via prop.
 */
export function GameWorld({
  mapLayout,
  children,
  showCollisionDebug = false,
}: GameWorldProps) {
  const { width, height, furniture } = mapLayout;
  const mansionTexture = useTexture(MANSION_MAP_URL);

  // Fallback solid color shown briefly while the mansion texture loads.
  const drawFallback = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.rect(0, 0, width, height).fill(0x2a1f3d);
    },
    [width, height],
  );

  // Subtle warm vignette overlay to enhance the mysterious ambience.
  const drawVignette = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.rect(0, 0, width, height).fill({ color: 0x1a0f2d, alpha: 0.08 });
    },
    [width, height],
  );

  const drawDebugFurniture = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!showCollisionDebug) return;
      for (const piece of furniture) {
        g.rect(piece.x, piece.y, piece.width, piece.height).stroke({
          color: 0xff00ff,
          width: 1,
          alpha: 0.6,
        });
      }
    },
    [furniture, showCollisionDebug],
  );

  return (
    <pixiContainer>
      {/* Background: pre-rendered mansion room map, sized to the game world. */}
      {mansionTexture ? (
        <pixiSprite
          texture={mansionTexture}
          x={0}
          y={0}
          width={width}
          height={height}
        />
      ) : (
        <pixiGraphics draw={drawFallback} />
      )}
      {/* Ambient warm vignette overlay. */}
      <pixiGraphics draw={drawVignette} />
      {/* Optional collision debug overlay. */}
      {showCollisionDebug && <pixiGraphics draw={drawDebugFurniture} />}
      {/* Entity layer (player, NPCs, clues, interaction prompts). */}
      <pixiContainer>{children}</pixiContainer>
    </pixiContainer>
  );
}
