import { generateText, Output } from "ai";
import type { UIMessageChunk } from "ai";
import { getWritable, FatalError, RetryableError } from "workflow";
import { z } from "zod";
import { seoContentSchema } from "@/lib/schemas/catalog";
import type { SEOContent } from "@/lib/schemas/catalog";

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

async function generateSingleSeoData(
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
    id: `${toolCallId}-seo-${itemId}`,
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
      output: Output.object({ schema: seoContentSchema }),
      prompt: `You are an SEO specialist. Generate optimized SEO metadata for this ${entityType} using the brand voice.

Brand voice: ${brandVoice}

${entityType} name: ${item.name}
Description: ${item.content.shortDescription}. ${item.content.longDescription}

Generate:
- metaTitle: 50-60 characters, include primary keyword and brand differentiator
- metaDescription: 150-160 characters, compelling with call-to-action, include key features`,
    });

    // Emit content with proposed SEO data
    await writer.write({
      type: entityType === "product" ? "data-product-content" : "data-category-content",
      id: `${toolCallId}-seo-${itemId}`,
      data: {
        [idField]: itemId,
        name: item.name,
        [entityType === "product" ? "category" : "catalog"]: secondaryLabel,
        currentContent: item.content,
        currentSeo: item.seoContent,
        proposedSeo: output,
        status: "Done",
      },
    } as UIMessageChunk);

    writer.releaseLock();
    return { itemId, seoContent: output, status: "Done" as const };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[generate-seo-data] Failed for ${itemId}:`, errorMessage);

    // Retry on transient errors (rate limits, network issues)
    if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("ECONNRESET") || errorMessage.includes("timeout")) {
      throw new RetryableError(`Transient error generating SEO data for ${itemId}: ${errorMessage}`, { retryAfter: "30s" });
    }

    await writer.write({
      type: entityType === "product" ? "data-product-content" : "data-category-content",
      id: `${toolCallId}-seo-${itemId}`,
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
    return { itemId, seoContent: undefined, status: "Failed" as const };
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
      id: `${toolCallId}-seo-${itemId}`,
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
async function executeGenerateSeoData(
  { items, brandVoice, entityType }: { items: ItemInput[]; brandVoice: string; entityType: "product" | "category" },
  { toolCallId }: { toolCallId: string },
) {
  if (items.length === 0) {
    return { results: [], message: `No ${entityType === "product" ? "products" : "categories"} to generate SEO data for` };
  }

  if (items.length > MAX_BATCH_SIZE) {
    throw new FatalError(`Batch size ${items.length} exceeds maximum of ${MAX_BATCH_SIZE}. Please process in smaller batches.`);
  }

  // First emit all items as Pending
  await emitPendingItems(items, entityType, toolCallId);

  const results: Array<{
    itemId: string;
    seoContent: SEOContent | undefined;
    status: "Done" | "Failed";
  }> = [];

  for (const item of items) {
    const result = await generateSingleSeoData(item, brandVoice, entityType, toolCallId);
    results.push(result);
  }

  const successCount = results.filter((r) => r.status === "Done").length;
  return {
    results,
    message: `Generated SEO data for ${successCount}/${items.length} ${entityType === "product" ? "products" : "categories"}`,
  };
}

export const generateSeoDataToolDef = {
  description:
    "Generate enhanced SEO metadata (metaTitle, metaDescription) for a list of products or categories using the brand voice. Call get_brand_voice first.",
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
    ).describe("Array of products or categories to generate SEO data for"),
    brandVoice: z.string().describe("The brand voice to apply"),
    entityType: z.enum(["product", "category"]).describe("Whether these are products or categories"),
  }),
  execute: executeGenerateSeoData,
};
