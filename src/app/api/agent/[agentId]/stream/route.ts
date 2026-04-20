import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";
import { gameEventHook } from "@/workflows/hooks/game-event";
import { z } from "zod";

const startChatSchema = z.object({
  gameId: z.string().min(1),
  personaId: z.string().min(1),
});

/**
 * POST /api/agent/[agentId]/stream — Start or continue a persona chat.
 *
 * The agentId in the URL is the personaId. The request body provides the gameId.
 * Instead of starting a separate workflow, this sends a "chat-message" event to
 * the PlayGame workflow's hook and returns the persona-namespaced stream.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId: personaId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startChatSchema.safeParse({ ...body, personaId });
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const gameId = parsed.data.gameId;

  try {
    // Send a chat-message event to the PlayGame workflow to trigger the first turn
    await gameEventHook.resume(gameId, {
      type: "chat-message",
      personaId,
      message: "__start__",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/agent/${personaId}] Failed to start chat:`, message);
    return Response.json(
      { error: "Failed to start persona chat", details: message },
      { status: 500 },
    );
  }

  // Return the persona-namespaced stream from the PlayGame workflow run
  const run = getRun(gameId);
  const stream = run.getReadable({ namespace: `persona-${personaId}` });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "x-workflow-run-id": gameId,
    },
  });
}
