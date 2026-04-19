import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { start } from "workflow/api";
import { catalogAgentWorkflow } from "@/workflows/catalog-agent";
import { z } from "zod";

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.unknown()),
  }).passthrough()).min(1, "At least one message is required"),
});

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const messages = parsed.data.messages as UIMessage[];

  let run;
  try {
    run = await start(catalogAgentWorkflow, [messages]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/chat] Failed to start workflow:", message);
    return Response.json({ error: "Failed to start chat session", details: message }, { status: 500 });
  }

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
