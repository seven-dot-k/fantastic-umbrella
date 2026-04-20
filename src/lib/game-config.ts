/**
 * Client-only spatial configuration for the PIXIJS game world.
 *
 * The backend generates personas and clues textually; this module maps them
 * into 2D positions, furniture collision boxes, and interaction zones.
 */

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NpcPlacement {
  personaId: string;
  x: number;
  y: number;
  interactionRadius: number;
}

export interface CluePlacement {
  clueId: string;
  x: number;
  y: number;
  interactionRadius: number;
}

export interface FurniturePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLayout {
  width: number;
  height: number;
  npcs: NpcPlacement[];
  clues: CluePlacement[];
  furniture: FurniturePlacement[];
  accusationPoint: { x: number; y: number; interactionRadius: number };
  playerSpawn: { x: number; y: number };
}

/** Generate a default map layout for the given persona IDs. */
export function createDefaultMapLayout(personaIds: string[]): MapLayout {
  const width = 960;
  const height = 640;
  const centerX = width / 2;
  const centerY = height / 2;

  // Distribute NPCs in a circle around the room center.
  const npcRadius = 200;
  const npcs: NpcPlacement[] = personaIds.map((id, i) => {
    const angle =
      personaIds.length > 0
        ? (i / personaIds.length) * Math.PI * 2 - Math.PI / 2
        : 0;
    return {
      personaId: id,
      x: centerX + Math.cos(angle) * npcRadius,
      y: centerY + Math.sin(angle) * npcRadius,
      interactionRadius: 48,
    };
  });

  return {
    width,
    height,
    npcs,
    clues: [
      { clueId: "env-clue-1", x: 120, y: 120, interactionRadius: 32 },
      {
        clueId: "env-clue-2",
        x: width - 120,
        y: height - 120,
        interactionRadius: 32,
      },
    ],
    furniture: [
      { id: "table-1", x: 100, y: 280, width: 80, height: 60 },
      { id: "bookshelf-1", x: width - 100, y: 100, width: 60, height: 120 },
      { id: "couch-1", x: 200, y: height - 100, width: 120, height: 50 },
    ],
    accusationPoint: { x: centerX, y: centerY, interactionRadius: 48 },
    playerSpawn: { x: centerX, y: height - 80 },
  };
}

/** Check if point (px, py) is within `radius` of (tx, ty). */
export function isInRange(
  px: number,
  py: number,
  tx: number,
  ty: number,
  radius: number,
): boolean {
  const dx = px - tx;
  const dy = py - ty;
  return dx * dx + dy * dy <= radius * radius;
}

/** Axis-aligned bounding box collision check. */
export function checkAABBCollision(
  ax: number,
  ay: number,
  aWidth: number,
  aHeight: number,
  bx: number,
  by: number,
  bWidth: number,
  bHeight: number,
): boolean {
  return (
    ax < bx + bWidth &&
    ax + aWidth > bx &&
    ay < by + bHeight &&
    ay + aHeight > by
  );
}
