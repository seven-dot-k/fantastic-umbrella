import { contentApprovalHook } from "@/workflows/hooks/approval";
import { HookNotFoundError, HookConflictError } from "workflow/internal/errors";
import { z } from "zod";

const approvalSchema = z.object({
  toolCallId: z.string().min(1),
  approved: z.boolean(),
  comment: z.string().optional(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const { toolCallId, approved, comment } = parsed.data;

  try {
    await contentApprovalHook.resume(toolCallId, { approved, comment });
    return Response.json({ success: true });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return Response.json(
        { error: "Approval hook expired or not found" },
        { status: 404 },
      );
    }
    if (HookConflictError.is(error)) {
      return Response.json(
        { error: "Approval hook token conflict" },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/hooks/approval] Error resuming hook:", message);
    return Response.json(
      { error: "Failed to process approval", details: message },
      { status: 500 },
    );
  }
}
