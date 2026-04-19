import {
  convertToModelMessages,
  type UIMessageChunk,
  type UIMessage,
  type ModelMessage,
} from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, getWorkflowMetadata } from "workflow";

const MAX_TURNS = 50;
const MAX_STEPS_PER_TURN = 15;
import { chatMessageHook } from "./hooks/chat-message";
import {
  writeUserMessageMarker,
  writeStreamClose,
  writeTurnEnd,
} from "./steps/writer";
import { getProductsToolDef } from "./tools/get-products";
import { getCategoriesToolDef } from "./tools/get-categories";
import { getBrandVoiceToolDef } from "./tools/get-brand-voice";
import { generateDescriptionsToolDef } from "./tools/generate-descriptions";
import { generateSeoDataToolDef } from "./tools/generate-seo-data";
import { saveProductsToolDef } from "./tools/save-products";
import { saveCategoriesToolDef } from "./tools/save-categories";

export const SYSTEM_PROMPT = `You are CatalogManager AI, an expert e-commerce catalog content optimizer. You help catalog operators generate and optimize product descriptions, category descriptions, and SEO metadata using their brand voice.

## Your Capabilities
- Fetch products by category or all products in the catalog
- Fetch categories
- Retrieve the brand voice for consistent tone
- Generate optimized descriptions (short and long) for products and categories
- Generate SEO metadata (meta title and meta description)
- Save approved changes

## How You Work
1. When the user asks to optimize content, first fetch the relevant products or categories using get_products or get_categories
2. Always retrieve the brand voice using get_brand_voice before generating any content
3. Use generate_descriptions to create new descriptions for each item — pass the full product/category objects including their seoContent
4. Use generate_seo_data if the user asks for SEO optimization — pass the full product/category objects including their seoContent
5. After generation completes, tell the user the results are ready for review in the side panel — do NOT repeat or summarize the generated descriptions, SEO data, or any content changes in the chat
6. Immediately call save_products or save_categories after generation — the save tool will pause and wait for human approval automatically via the review panel

## Important Rules
- ALWAYS fetch the brand voice before generating content
- Process items in bulk — pass all items to the generation tools at once
- When the user asks for descriptions, generate both short and long descriptions
- When the user asks for SEO, generate both meta title and meta description
- NEVER repeat generated content in your chat response — the content review panel shows it automatically. Just confirm what was done (e.g., "I've generated new descriptions for 6 electronics products. You can review and edit them in the panel on the right.")
- ALWAYS call save_products or save_categories immediately after content generation — the tool itself handles human approval, so do NOT wait for the user to say "approve" in chat
- If the user provides follow-up instructions (e.g., "make it more casual"), re-generate with the updated instructions
- Be conversational and helpful — explain what you're doing at each step
- If the user asks for something outside your capabilities, politely explain that you can only optimize product/category descriptions and SEO metadata using the provided tools.
`;

export const catalogTools = {
  get_products: getProductsToolDef,
  get_categories: getCategoriesToolDef,
  get_brand_voice: getBrandVoiceToolDef,
  generate_descriptions: generateDescriptionsToolDef,
  generate_seo_data: generateSeoDataToolDef,
  save_products: saveProductsToolDef,
  save_categories: saveCategoriesToolDef,
};

/**
 * Multi-turn chat workflow for the catalog content optimizer.
 *
 * A single workflow handles the entire conversation session across multiple turns.
 * The workflow owns the conversation state, and follow-up messages are injected via hooks.
 */
export async function catalogAgentWorkflow(initialMessages: UIMessage[]) {
  "use workflow";

  const { workflowRunId: runId, workflowStartedAt } = getWorkflowMetadata();
  const writable = getWritable<UIMessageChunk>();
  const workflowStartTime = workflowStartedAt.getTime();

  // Convert UI messages to model messages for the agent
  const messages: ModelMessage[] = await convertToModelMessages(initialMessages);

  // Write markers for initial user messages (for replay purposes)
  let isFirstUserMessage = true;
  for (const msg of initialMessages) {
    if (msg.role === "user") {
      const textContent = msg.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
      if (textContent) {
        await writeUserMessageMarker(writable, textContent, msg.id, {
          turnNumber: 1,
          turnStartedAt: workflowStartTime,
          workflowRunId: runId,
          workflowStartedAt: workflowStartTime,
          isFirstTurn: isFirstUserMessage,
        });
        isFirstUserMessage = false;
      }
    }
  }

  // Sonnet for the orchestration agent (needs strong tool-use and reasoning to
  // coordinate multi-step workflows). Bulk content generation tools use Haiku
  // for cost efficiency — see generate-descriptions.ts and generate-seo-data.ts.
  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-6",
    instructions: SYSTEM_PROMPT,
    tools: catalogTools,
  });

  // Create a hook that uses the run ID as the token for resumption
  const hook = chatMessageHook.create({ token: runId });

  let turnNumber = 0;
  let totalStepCount = 0;

  // Main conversation loop — bounded to prevent infinite sessions
  while (turnNumber < MAX_TURNS) {
    turnNumber++;
    const turnStartTime = Date.now();

    let result;
    try {
      // preventClose: keep the stream open between turns so the client stays
      //   connected across the entire multi-turn session (closed explicitly in
      //   writeStreamClose after the loop ends).
      // sendStart: only emit the stream-start event on turn 1 — subsequent turns
      //   continue the same stream.
      // sendFinish: always false — we write our own turn-end markers via
      //   writeTurnEnd for observability, and close the stream manually.
      result = await agent.stream({
        messages,
        writable,
        preventClose: true,
        sendStart: turnNumber === 1,
        sendFinish: false,
        maxSteps: MAX_STEPS_PER_TURN,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[workflow:${runId}] Agent stream failed on turn ${turnNumber}:`, errorMessage);

      // Write error marker to stream so the frontend can display it
      const writer = writable.getWriter();
      try {
        await writer.write({
          type: "error",
          errorMessage: `An error occurred during processing: ${errorMessage}`,
        } as unknown as UIMessageChunk);
      } finally {
        writer.releaseLock();
      }
      break;
    }

    const stepsForTurn = result.steps.map((step, index) => ({
      stepNumber: totalStepCount + index + 1,
      toolCalls: step.toolCalls?.map((tc) => tc.toolName) || [],
      finishReason: step.finishReason || "unknown",
    }));

    totalStepCount = await writeTurnEnd(
      writable,
      turnNumber,
      Date.now() - turnStartTime,
      stepsForTurn,
      totalStepCount,
    );

    messages.push(...result.messages);

    // Wait for next user message via hook
    const { message: followUp } = await hook;

    // Check for session end signal
    if (followUp === "/done") {
      break;
    }

    const nextTurnNumber = turnNumber + 1;
    const followUpId = `user-${runId}-${nextTurnNumber}`;
    const followUpTurnStartTime = Date.now();

    await writeUserMessageMarker(writable, followUp, followUpId, {
      turnNumber: nextTurnNumber,
      turnStartedAt: followUpTurnStartTime,
      workflowRunId: runId,
      workflowStartedAt: workflowStartTime,
      isFirstTurn: false,
    });

    messages.push({ role: "user", content: followUp });
  }

  // Close the stream with workflow-end observability data
  await writeStreamClose(writable, {
    workflowRunId: runId,
    totalDurationMs: Date.now() - workflowStartTime,
    turnCount: turnNumber,
  });

  return { messages };
}
