import { defineHook } from "workflow";
import { z } from "zod";

/**
 * Hook for human-in-the-loop approval of content changes.
 * Used by save_products and save_categories tools to pause
 * until the user explicitly approves or rejects.
 */
export const contentApprovalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
});
