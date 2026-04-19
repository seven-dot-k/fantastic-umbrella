import { generateText, Output } from "ai";
import type { UIMessageChunk } from "ai";
import { getWritable, FatalError, RetryableError } from "workflow";
import { z } from "zod";
import { catalogContentSchema } from "@/lib/schemas/catalog";
import type { CatalogContent, SEOContent } from "@/lib/schemas/catalog";

const MAX_BATCH_SIZE = 50;

interface ItemInput {
  name: string;
  sku?: string;
  id?: string;
  category?: string;
  catalog?: string;
  content: { shortDescription: string; longDescription: string };
  seoContent: { metaTitle: string; metaDescription: string };
}

async function generateSingleDescription(
  item: ItemInput,
  brandVoice: string,
  entityType: string,
  toolCallId: string,
) {
  "use step";

  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();
  const itemId = entityType === "product" ? (item.sku ?? item.name) : (item.id ?? item.name);
  const idField = entityType === "product" ? "sku" : "categoryId";
  const secondaryLabel = entityType === "product" ? (item.category ?? "") : (item.catalog ?? "");

  // Emit InProgress status
  await writer.write({
    type: entityType === "product" ? "data-product-content" : "data-category-content",
    id: `${toolCallId}-${itemId}`,
    data: {
      [idField]: itemId,
      name: item.name,
      [entityType === "product" ? "category" : "catalog"]: secondaryLabel,
      currentContent: item.content,
      currentSeo: item.seoContent,
      status: "InProgress",
    },
  } as UIMessageChunk);

  try {
    const { output } = await generateText({
      model: "anthropic/claude-haiku-4-5",
      output: Output.object({ schema: catalogContentSchema }),
      prompt: `You are a professional e-commerce copywriter. Generate improved ${entityType} descriptions using the brand voice below.

Brand voice: ${brandVoice}

${entityType} name: ${item.name}
Current short description: ${item.content.shortDescription}
Current long description: ${item.content.longDescription}

Generate an improved shortDescription (1-2 sentences, compelling and concise) and longDescription (2-4 sentences, detailed and engaging). Apply the brand voice consistently.`,
    });

    // Emit Done with proposed content
    await writer.write({
      type: entityType === "product" ? "data-product-content" : "data-category-content",
      id: `${toolCallId}-${itemId}`,
      data: {
        [idField]: itemId,
        name: item.name,
        [entityType === "product" ? "category" : "catalog"]: secondaryLabel,
        currentContent: item.content,
        currentSeo: item.seoContent,
        proposedContent: output,
        status: "Done",
      },
    } as UIMessageChunk);

    writer.releaseLock();
    return { itemId, content: output, status: "Done" as const };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[generate-descriptions] Failed for ${itemId}:`, errorMessage);

    // Best-effort heuristic to classify transient vs. permanent errors.
    // String-matching is fragile — provider error formats vary and new transient
    // error types won't be caught. Misclassifying a transient error as permanent
    // means that item fails immediately; misclassifying a permanent error as
    // transient wastes retry budget. Acceptable tradeoff for a prototype — a
    // production version should use structured error codes from the AI SDK.
    if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("ECONNRESET") || errorMessage.includes("timeout")) {
      throw new RetryableError(`Transient error generating description for ${itemId}: ${errorMessage}`, { retryAfter: "30s" });
    }

    await writer.write({
      type: entityType === "product" ? "data-product-content" : "data-category-content",
      id: `${toolCallId}-${itemId}`,
      data: {
        [idField]: itemId,
        name: item.name,
        [entityType === "product" ? "category" : "catalog"]: secondaryLabel,
        currentContent: item.content,
        currentSeo: item.seoContent,
        status: "Failed",
        errorMessage,
      },
    } as UIMessageChunk);

    writer.releaseLock();
    return { itemId, content: undefined, status: "Failed" as const };
  }
}

async function emitPendingItems(
  items: ItemInput[],
  entityType: "product" | "category",
  toolCallId: string,
) {
  "use step";

  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();
  const idField = entityType === "product" ? "sku" : "categoryId";

  for (const item of items) {
    const itemId = entityType === "product" ? (item.sku ?? item.name) : (item.id ?? item.name);
    const secondaryLabel = entityType === "product" ? (item.category ?? "") : (item.catalog ?? "");

    await writer.write({
      type: entityType === "product" ? "data-product-content" : "data-category-content",
      id: `${toolCallId}-${itemId}`,
      data: {
        [idField]: itemId,
        name: item.name,
        [entityType === "product" ? "category" : "catalog"]: secondaryLabel,
        currentContent: item.content,
        currentSeo: item.seoContent,
        status: "Pending",
      },
    } as UIMessageChunk);
  }

  writer.releaseLock();
}

// Workflow-level execute function (no "use step" — orchestrates steps)
async function executeGenerateDescriptions(
  { items, brandVoice, entityType }: { items: ItemInput[]; brandVoice: string; entityType: "product" | "category" },
  { toolCallId }: { toolCallId: string },
) {
  if (items.length === 0) {
    return { results: [], message: `No ${entityType === "product" ? "products" : "categories"} to generate descriptions for` };
  }

  if (items.length > MAX_BATCH_SIZE) {
    throw new FatalError(`Batch size ${items.length} exceeds maximum of ${MAX_BATCH_SIZE}. Please process in smaller batches.`);
  }

  // First emit all items as Pending
  await emitPendingItems(items, entityType, toolCallId);

  // Process each item as an individual durable step
  const results: Array<{
    itemId: string;
    content: CatalogContent | undefined;
    status: "Done" | "Failed";
  }> = [];

  for (const item of items) {
    const result = await generateSingleDescription(item, brandVoice, entityType, toolCallId);
    results.push(result);
  }

  const successCount = results.filter((r) => r.status === "Done").length;
  return {
    results,
    message: `Generated descriptions for ${successCount}/${items.length} ${entityType === "product" ? "products" : "categories"}`,
  };
}

export const generateDescriptionsToolDef = {
  description:
    "Generate enhanced descriptions for a list of products or categories using the brand voice. Processes each item individually as a durable step for reliability. Call get_brand_voice first to retrieve the brand voice.",
  inputSchema: z.object({
    items: z.array(
      z.object({
        name: z.string(),
        sku: z.string().optional(),
        id: z.string().optional(),
        category: z.string().optional(),
        catalog: z.string().optional(),
        content: z.object({
          shortDescription: z.string(),
          longDescription: z.string(),
        }),
        seoContent: z.object({
          metaTitle: z.string(),
          metaDescription: z.string(),
        }),
      })
    ).describe("Array of products or categories to generate descriptions for"),
    brandVoice: z.string().describe("The brand voice to apply"),
    entityType: z.enum(["product", "category"]).describe("Whether these are products or categories"),
  }),
  execute: executeGenerateDescriptions,
};
