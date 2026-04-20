import { start } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";
import { playGameWorkflow } from "@/workflows/play-game";
import type { FullGameState } from "@/workflows/schemas/game-state";

/**
 * POST /api/run — Start a new murder mystery game.
 * Streams back status updates and game state via UIMessageStream.
 */
export async function POST() {
  const initialState: FullGameState  = {
    public: {
      gameId: "",
      scenario: {} as any,
      personas: [],
      events: [],
      status: "active",
    },
    secret: {} as any,
  }
  let run;
  try {
    run = await start(playGameWorkflow, [initialState]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/run] Failed to start game:", message);
    return Response.json(
      { error: "Failed to start game", details: message },
      { status: 500 },
    );
  }

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
