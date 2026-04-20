import { getRun } from "workflow/api";
import type { GameState } from "@/workflows/schemas/game-state";

/**
 * GET /api/run/[gameId]/state — Read the current game state.
 * Reads from the game-state namespaced stream of the PlayGame workflow.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  try {
    const run = getRun(gameId);
    const readable = run.getReadable({ namespace: "game-state" });
    const reader = readable.getReader();

    let latestState: GameState | null = null;

    // Read all available chunks to get the latest state
    try {
      while (true) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: true }>((resolve) =>
            setTimeout(() => resolve({ value: undefined, done: true }), 2000),
          ),
        ]);

        if (done || !value) break;

        const chunk = value as unknown as {
          type: string;
          data?: { type: string; state?: GameState };
        };

        if (chunk.data?.type === "game-state" && chunk.data.state) {
          latestState = chunk.data.state;
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!latestState) {
      return Response.json(
        { error: "Game state not found" },
        { status: 404 },
      );
    }

    return Response.json({ gameState: latestState });
  } catch {
    return Response.json(
      { error: "Game not found or expired" },
      { status: 404 },
    );
  }
}
