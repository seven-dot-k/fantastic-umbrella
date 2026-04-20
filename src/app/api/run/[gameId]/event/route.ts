import { gameEventHook } from "@/workflows/hooks/game-event";
import { HookNotFoundError } from "workflow/internal/errors";
import { z } from "zod";

const eventSchema = z.object({
  type: z.enum(["accuse", "end-game", "end-persona-chat"]),
  personaId: z.string().optional(),
});

/**
 * POST /api/run/[gameId]/event — Send a game event to the PlayGame workflow.
 * Used for high-level game actions like accusing a suspect or ending the game.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid event", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await gameEventHook.resume(gameId, parsed.data);
    return Response.json({ success: true });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return Response.json(
        { error: "Game not found or expired" },
        { status: 404 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/run/${gameId}/event] Error:`, message);
    return Response.json(
      { error: "Failed to send event", details: message },
      { status: 500 },
    );
  }
}
