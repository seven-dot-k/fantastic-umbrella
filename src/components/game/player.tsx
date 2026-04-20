"use client";

import { useTick } from "@pixi/react";
import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Sprite as PixiSprite,
} from "pixi.js";
import { useCallback, useRef } from "react";
import { useSpriteSheetFrames } from "@/hooks/use-texture";
import type { InputManager } from "@/lib/input-manager";
import {
  checkAABBCollision,
  isInRange,
  type MapLayout,
} from "@/lib/game-config";

// Collision box is smaller than the rendered sprite so the player's feet
// fit between furniture pieces without the head / shoulders blocking.
const PLAYER_SIZE = 24;
const PLAYER_SPEED = 3;

// Sprite sheet layout - identical to the NPC component so both read as
// characters from the same world. See src/components/game/npc.tsx for the
// full breakdown of rows.
const SHEET_URL = "/sprites/characters-movement.png";
const SHEET_COLS = 6;
const SHEET_ROWS = 5;
const CELL_W = 1024 / SHEET_COLS;
const CELL_H = 1024 / SHEET_ROWS;
const FRAME_PAD_X = 32;
const FRAME_PAD_Y = 18;
const FRAME_W = CELL_W - FRAME_PAD_X * 2;
const FRAME_H = CELL_H - FRAME_PAD_Y * 2;

// Slightly taller than NPCs so the protagonist visually anchors the scene.
const DISPLAY_HEIGHT = 80;
const DISPLAY_SCALE = DISPLAY_HEIGHT / FRAME_H;

// Walk-cycle frames for the detective, picked from the cells that contain
// the trench-coat character on the movement sheet. Cycling between these
// three gives a readable "stride" animation while moving.
const WALK_FRAMES = [6, 24, 25];
// Frame the player rests on when not moving.
const IDLE_FRAME = 6;
// Seconds between walk-cycle frame advances.
const FRAME_DURATION = 0.16;

export type NearbyEntity = {
  type: "npc" | "clue" | "accusation";
  id: string;
};

interface PlayerProps {
  inputManager: InputManager;
  mapLayout: MapLayout;
  spawnX: number;
  spawnY: number;
  onNearbyEntity: (entity: NearbyEntity | null) => void;
  onInteract: (entity: NearbyEntity) => void;
}

/**
 * Player character component.
 *
 * - Reads WASD state from InputManager each tick.
 * - Applies AABB collision against furniture before committing movement.
 * - Scans NPCs, clues, and accusation point for proximity each tick,
 *   reporting the nearest interactable (or null) via onNearbyEntity.
 * - Consumes E key presses to fire onInteract with the current nearest entity.
 * - Renders a sprite from the shared character sheet and cycles through
 *   walk frames while the player is moving (freezes on IDLE_FRAME otherwise).
 *
 * Position and animation state are held in refs so per-frame updates mutate
 * the PIXI objects directly and never trigger React re-renders.
 */
export function Player({
  inputManager,
  mapLayout,
  spawnX,
  spawnY,
  onNearbyEntity,
  onInteract,
}: PlayerProps) {
  const posRef = useRef({ x: spawnX, y: spawnY });
  const containerRef = useRef<PixiContainer | null>(null);
  const spriteRef = useRef<PixiSprite | null>(null);
  const animRef = useRef({ frameIndex: 0, elapsed: 0 });
  const facingRef = useRef<1 | -1>(1);
  const lastNearbyRef = useRef<NearbyEntity | null>(null);

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

  // Soft ground shadow under the player's feet.
  const drawShadow = useCallback((g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, 4, 22, 6).fill({ color: 0x000000, alpha: 0.3 });
  }, []);

  // Fallback rectangle shown while the sprite sheet is still loading.
  const drawFallback = useCallback((g: PixiGraphics) => {
    g.clear();
    g.rect(-PLAYER_SIZE / 2, -PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE).fill(
      0x4fc3f7,
    );
    g.rect(-PLAYER_SIZE / 2, -PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE).stroke({
      color: 0xffffff,
      width: 2,
    });
  }, []);

  useTick((ticker) => {
    const delta = ticker.deltaTime;
    // deltaTime is in frames @ 60fps; convert to seconds for the anim clock.
    const deltaSeconds = delta / 60;

    let dx = 0;
    let dy = 0;
    if (inputManager.isPressed("w") || inputManager.isPressed("arrowup")) {
      dy -= 1;
    }
    if (inputManager.isPressed("s") || inputManager.isPressed("arrowdown")) {
      dy += 1;
    }
    if (inputManager.isPressed("a") || inputManager.isPressed("arrowleft")) {
      dx -= 1;
    }
    if (inputManager.isPressed("d") || inputManager.isPressed("arrowright")) {
      dx += 1;
    }

    // Normalize diagonal movement so it isn't faster than axis-aligned.
    if (dx !== 0 && dy !== 0) {
      const invSqrt2 = 0.70710678;
      dx *= invSqrt2;
      dy *= invSqrt2;
    }

    const step = PLAYER_SPEED * delta;
    const current = posRef.current;
    let nextX = current.x + dx * step;
    let nextY = current.y + dy * step;

    // Clamp to map bounds (AABB anchored at center).
    const halfSize = PLAYER_SIZE / 2;
    nextX = Math.max(halfSize, Math.min(mapLayout.width - halfSize, nextX));
    nextY = Math.max(halfSize, Math.min(mapLayout.height - halfSize, nextY));

    // Resolve furniture collisions axis-by-axis so the player can slide
    // along walls instead of sticking.
    const proposedX = { x: nextX, y: current.y };
    if (collidesWithFurniture(proposedX.x, proposedX.y, mapLayout)) {
      nextX = current.x;
    }
    const proposedY = { x: nextX, y: nextY };
    if (collidesWithFurniture(proposedY.x, proposedY.y, mapLayout)) {
      nextY = current.y;
    }

    const isMoving = nextX !== current.x || nextY !== current.y;
    current.x = nextX;
    current.y = nextY;

    // Flip the sprite horizontally based on last non-zero horizontal input,
    // so the detective faces the direction they're walking.
    if (dx > 0) facingRef.current = 1;
    else if (dx < 0) facingRef.current = -1;

    const container = containerRef.current;
    if (container) {
      container.x = current.x;
      container.y = current.y;
    }

    // Advance the walk-cycle timer only while moving; idle snaps back to
    // the rest frame so the character doesn't keep animating in place.
    const sprite = spriteRef.current;
    if (sprite && frames && frames.length > 0) {
      const anim = animRef.current;
      let frameIdx: number;
      if (isMoving) {
        anim.elapsed += deltaSeconds;
        while (anim.elapsed >= FRAME_DURATION) {
          anim.elapsed -= FRAME_DURATION;
          anim.frameIndex = (anim.frameIndex + 1) % WALK_FRAMES.length;
        }
        frameIdx = WALK_FRAMES[anim.frameIndex] ?? IDLE_FRAME;
      } else {
        anim.elapsed = 0;
        anim.frameIndex = 0;
        frameIdx = IDLE_FRAME;
      }
      const nextTexture = frames[frameIdx];
      if (nextTexture && sprite.texture !== nextTexture) {
        sprite.texture = nextTexture;
      }
      // Horizontal flip via scale.x sign; keep scale magnitude constant.
      sprite.scale.x = facingRef.current * DISPLAY_SCALE;
    }

    // Proximity scan for interactables.
    const nearby = findNearestInteractable(current.x, current.y, mapLayout);
    const prev = lastNearbyRef.current;
    const changed =
      (prev?.id ?? null) !== (nearby?.id ?? null) ||
      (prev?.type ?? null) !== (nearby?.type ?? null);
    if (changed) {
      lastNearbyRef.current = nearby;
      onNearbyEntity(nearby);
    }

    // E key handling.
    if (inputManager.consumePress("e") && nearby) {
      onInteract(nearby);
    }
  });

  const initialTexture = frames?.[IDLE_FRAME];

  return (
    <pixiContainer ref={containerRef} x={spawnX} y={spawnY}>
      <pixiGraphics draw={drawShadow} />
      {initialTexture ? (
        <pixiSprite
          ref={spriteRef}
          texture={initialTexture}
          anchor={{ x: 0.5, y: 1 }}
          scale={{ x: DISPLAY_SCALE, y: DISPLAY_SCALE }}
          y={2}
        />
      ) : (
        <pixiGraphics draw={drawFallback} />
      )}
    </pixiContainer>
  );
}

function collidesWithFurniture(
  cx: number,
  cy: number,
  mapLayout: MapLayout,
): boolean {
  const half = PLAYER_SIZE / 2;
  const ax = cx - half;
  const ay = cy - half;
  for (const piece of mapLayout.furniture) {
    if (
      checkAABBCollision(
        ax,
        ay,
        PLAYER_SIZE,
        PLAYER_SIZE,
        piece.x,
        piece.y,
        piece.width,
        piece.height,
      )
    ) {
      return true;
    }
  }
  return false;
}

function findNearestInteractable(
  px: number,
  py: number,
  mapLayout: MapLayout,
): NearbyEntity | null {
  let best: { entity: NearbyEntity; distSq: number } | null = null;

  const consider = (
    type: NearbyEntity["type"],
    id: string,
    tx: number,
    ty: number,
    radius: number,
  ) => {
    if (!isInRange(px, py, tx, ty, radius)) return;
    const dx = px - tx;
    const dy = py - ty;
    const distSq = dx * dx + dy * dy;
    if (best === null || distSq < best.distSq) {
      best = { entity: { type, id }, distSq };
    }
  };

  for (const npc of mapLayout.npcs) {
    consider("npc", npc.personaId, npc.x, npc.y, npc.interactionRadius);
  }
  for (const clue of mapLayout.clues) {
    consider("clue", clue.clueId, clue.x, clue.y, clue.interactionRadius);
  }
  const accusation = mapLayout.accusationPoint;
  consider(
    "accusation",
    "accusation",
    accusation.x,
    accusation.y,
    accusation.interactionRadius,
  );

  return best ? (best as { entity: NearbyEntity; distSq: number }).entity : null;
}
