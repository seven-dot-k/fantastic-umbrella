import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";
import { chatMessageHook } from "@/workflows/hooks/chat-message";
import { HookNotFoundError, HookConflictError } from "workflow/internal/errors";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1).max(10000),
});

/**
 * GET /api/agent/[agentId]/stream/[runId] — Reconnect to an existing persona chat stream.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; runId: string }> },
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex =
    startIndexParam !== null ? parseInt(startIndexParam, 10) : undefined;

  const run = getRun(runId);
  const stream = run.getReadable({ startIndex });

  return createUIMessageStreamResponse({ stream });
}

/**
 * POST /api/agent/[agentId]/stream/[runId] — Send a follow-up message to a persona chat.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string; runId: string }> },
) {
  const { runId } = await params;

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
    await chatMessageHook.resume(runId, { message });
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
    console.error(`[api/agent/stream/${runId}] Error resuming hook:`, message);
    return Response.json(
      { error: "Failed to send message", details: message },
      { status: 500 },
    );
  }
}
