"use client";

import { useTick } from "@pixi/react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { useCallback, useRef } from "react";
import type { InputManager } from "@/lib/input-manager";
import {
  checkAABBCollision,
  isInRange,
  type MapLayout,
} from "@/lib/game-config";

const PLAYER_SIZE = 24;
const PLAYER_SPEED = 3;

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
 *
 * Position is held in refs so per-frame updates never trigger React re-renders;
 * we mutate the Graphics object's (x, y) directly via draw callback + ref.
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
  const graphicsRef = useRef<PixiGraphics | null>(null);
  const lastNearbyRef = useRef<NearbyEntity | null>(null);

  const draw = useCallback((g: PixiGraphics) => {
    g.clear();
    // Center the sprite on its AABB anchor by drawing relative to origin.
    g.rect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE).fill(
      0x4fc3f7,
    );
    g.rect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE).stroke(
      { color: 0xffffff, width: 2 },
    );
  }, []);

  useTick((ticker) => {
    const delta = ticker.deltaTime;

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

    current.x = nextX;
    current.y = nextY;

    const graphics = graphicsRef.current;
    if (graphics) {
      graphics.x = current.x;
      graphics.y = current.y;
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

  // Initial x/y come from props; subsequent frame updates mutate the
  // Graphics object directly via graphicsRef in useTick to avoid re-renders.
  return (
    <pixiGraphics ref={graphicsRef} draw={draw} x={spawnX} y={spawnY} />
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
