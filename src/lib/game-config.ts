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

/**
 * Hand-tuned NPC scatter positions within the mansion room's walkable zones.
 * Positions are sampled around the perimeter of the room so characters feel
 * placed rather than lined up, while staying clear of furniture collisions.
 */
const NPC_SCATTER_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 130, y: 340 }, // left wall, middle
  { x: 550, y: 270 }, // right of the rug, upper
  { x: 370, y: 510 }, // bottom of rug, near door
  { x: 240, y: 230 }, // below the bookshelves
  { x: 620, y: 480 }, // in front of the fireplace
  { x: 870, y: 420 }, // far right corridor
];

/** Generate a map layout matching the pre-rendered mansion-room.jpg art. */
export function createDefaultMapLayout(personaIds: string[]): MapLayout {
  // Matches the 3:2 aspect ratio of the mansion background art.
  const width = 960;
  const height = 640;

  // Accusation focal point: centered on the ritual circle painted on the rug.
  const accusationX = 435;
  const accusationY = 322;

  // Place NPCs at scattered positions, wrapping if more personas than slots.
  const npcs: NpcPlacement[] = personaIds.map((id, i) => {
    const slot =
      NPC_SCATTER_POSITIONS[i % NPC_SCATTER_POSITIONS.length] ??
      NPC_SCATTER_POSITIONS[0];
    return {
      personaId: id,
      x: slot.x,
      y: slot.y,
      interactionRadius: 48,
    };
  });

  return {
    width,
    height,
    npcs,
    // Clues placed near thematic props visible in the mansion art.
    clues: [
      // On the teacup table in the bottom-left sitting area.
      { clueId: "env-clue-1", x: 320, y: 445, interactionRadius: 36 },
      // On the fireplace mantle in the bottom-right.
      { clueId: "env-clue-2", x: 755, y: 515, interactionRadius: 36 },
      // Tucked against the bookshelves along the top wall.
      { clueId: "env-clue-3", x: 430, y: 205, interactionRadius: 36 },
    ],
    // Collision boxes matching the walls and furniture depicted in the art.
    furniture: [
      // Outer walls + built-in top furniture (bookshelves, clock, painting).
      { id: "wall-top", x: 0, y: 0, width, height: 180 },
      { id: "wall-left", x: 0, y: 180, width: 55, height: 380 },
      { id: "wall-right", x: 905, y: 180, width: 55, height: 380 },
      { id: "wall-bottom-left", x: 0, y: 560, width: 441, height: 80 },
      { id: "wall-bottom-right", x: 553, y: 560, width: 407, height: 80 },
      // Free-standing furniture the player can see and collide with.
      { id: "fireplace", x: 670, y: 338, width: 170, height: 187 },
      { id: "armchair", x: 169, y: 425, width: 121, height: 87 },
      { id: "side-table-left", x: 89, y: 437, width: 75, height: 41 },
      { id: "teacup-table", x: 267, y: 469, width: 75, height: 43 },
      { id: "potted-plant", x: 108, y: 500, width: 75, height: 62 },
    ],
    accusationPoint: {
      x: accusationX,
      y: accusationY,
      interactionRadius: 56,
    },
    // Player spawns on the walkable floor just inside the main door.
    playerSpawn: { x: 497, y: 540 },
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
