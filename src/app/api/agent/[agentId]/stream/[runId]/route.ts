import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";
import { gameEventHook } from "@/workflows/hooks/game-event";
import { HookNotFoundError, HookConflictError } from "workflow/internal/errors";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1).max(10000),
});

/**
 * GET /api/agent/[agentId]/stream/[runId] — Reconnect to an existing persona chat stream.
 *
 * The runId is the gameId. The persona stream is read from the game workflow's
 * persona-namespaced stream.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; runId: string }> },
) {
  const { agentId: personaId, runId: gameId } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex =
    startIndexParam !== null ? parseInt(startIndexParam, 10) : undefined;

  const run = getRun(gameId);
  const stream = run.getReadable({
    namespace: `persona-${personaId}`,
    startIndex,
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * POST /api/agent/[agentId]/stream/[runId] — Send a follow-up message to a persona chat.
 *
 * The runId is the gameId. The message is sent as a "chat-message" event to
 * the PlayGame workflow's hook.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string; runId: string }> },
) {
  const { agentId: personaId, runId: gameId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const message = parsed.data.message.trim();
  if (!message) {
    return Response.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  try {
    await gameEventHook.resume(gameId, {
      type: "chat-message",
      personaId,
      message,
    });
    return Response.json({ success: true });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return Response.json(
        { error: "Chat session expired or not found" },
        { status: 404 },
      );
    }
    if (HookConflictError.is(error)) {
      return Response.json(
        { error: "Session token conflict" },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/agent/stream/${gameId}] Error resuming hook:`, message);
    return Response.json(
      { error: "Failed to send message", details: message },
      { status: 500 },
    );
  }
}
