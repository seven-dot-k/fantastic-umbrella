import { type UIMessageChunk, type ModelMessage } from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, getWorkflowMetadata } from "workflow";
import { chatMessageHook } from "./hooks/chat-message";
import { gameEventHook } from "./hooks/game-event";
import {
  writeUserMessageMarker,
  writeStreamClose,
  writeTurnEnd,
} from "./steps/writer";
import { createGetCurrentStateTool } from "./tools/get-current-state";
import { createAddEventTool } from "./tools/add-event";
import type { GameState, GameEvent, PersonaSecret } from "./schemas/game-state";

const MAX_TURNS = 50;
const MAX_STEPS_PER_TURN = 10;

function buildPersonaSystemPrompt(
  personaName: string,
  personaDescription: string,
  secret: PersonaSecret,
  isMurderer: boolean,
  scenario: { victimName: string; setting: string; timeOfDeath: string },
): string {
  const base = `You are ${personaName}, a suspect being interrogated by a detective about the murder of ${scenario.victimName} at ${scenario.setting}. The victim was found dead at ${scenario.timeOfDeath}.

## Your Character
${personaDescription}

## Your Personality
${secret.personality}

## Your Alibi
${secret.alibi}

## Your Secrets
${secret.secrets}

## Rules for Roleplay
- Stay fully in character at all times. You ARE this person, with their fears, secrets, and mannerisms.
- Respond naturally as this character would — sometimes evasive, sometimes emotional, sometimes helpful.
- Use the get_current_state tool periodically to check your mood and what's been happening. React to events.
- Use the add_event tool when you have a strong emotional reaction that others would notice (e.g. crying, slamming a table, going pale). Don't overuse it — only for significant visible reactions.
- Your mood and sanity affect how you respond. Low sanity means more erratic, paranoid, or emotional responses.
- Never break character or acknowledge you are an AI.
- Never reveal information freely — the detective must earn it through good questioning.
- You may lie about things that make you look bad, but be consistent with your lies.
- If pressed on a sensitive topic, show emotional reactions appropriate to your character.`;

  if (isMurderer) {
    return `${base}

## SECRET — YOU ARE THE MURDERER
${secret.guiltyKnowledge}

You committed the murder and must avoid detection. Key behaviors:
- Maintain your alibi but it has a subtle flaw — if the detective asks the right questions, they can find holes.
- Deflect suspicion toward other suspects when possible, but be subtle about it.
- Show appropriate nervousness — you're being questioned about a murder you committed.
- If cornered with evidence, become more evasive or emotional rather than confessing immediately.
- You will NOT confess unless the evidence is overwhelming and the detective has cornered you completely.`;
  }

  return `${base}

## Important
You did NOT commit the murder. But you have your own secrets that make you nervous about this interrogation.
If the detective accuses you directly, firmly deny it and point to your alibi.`;
}

/**
 * PersonaChat workflow — handles the detective's conversation with one persona.
 *
 * Each persona gets their own workflow run with a unique system prompt derived
 * from the game's secret state. The persona has access to tools that let them
 * check the game state and emit visible events.
 */
export async function personaChatWorkflow(input: {
  gameId: string;
  personaId: string;
  personaName: string;
  personaDescription: string;
  personaSecret: PersonaSecret;
  isMurderer: boolean;
  scenario: { victimName: string; setting: string; timeOfDeath: string };
  initialGameState: GameState;
}) {
  "use workflow";

  const { workflowRunId: runId, workflowStartedAt } = getWorkflowMetadata();
  const writable = getWritable<UIMessageChunk>();
  const workflowStartTime = workflowStartedAt.getTime();

  // Mutable game state — updated when the persona checks state
  let currentGameState: GameState = input.initialGameState;

  const systemPrompt = buildPersonaSystemPrompt(
    input.personaName,
    input.personaDescription,
    input.personaSecret,
    input.isMurderer,
    input.scenario,
  );

  // Create tools with closures over the game state
  const tools = {
    get_current_state: createGetCurrentStateTool(
      input.personaId,
      () => currentGameState,
    ),
    add_event: createAddEventTool(
      input.personaId,
      input.personaName,
      (event: GameEvent, moodUpdate?: { mood?: string; sanityDelta?: number }) => {
        // Update local game state
        currentGameState = {
          ...currentGameState,
          events: [...currentGameState.events, event],
          personas: currentGameState.personas.map((p) =>
            p.id === input.personaId
              ? {
                  ...p,
                  mood: moodUpdate?.mood ?? p.mood,
                  sanity: Math.max(
                    0,
                    Math.min(100, p.sanity + (moodUpdate?.sanityDelta ?? 0)),
                  ),
                }
              : p,
          ),
        };

        // Fire-and-forget: notify the PlayGame workflow about the event
        gameEventHook
          .resume(input.gameId, {
            type: "add-event",
            personaId: input.personaId,
            description: event.description,
            mood: moodUpdate?.mood,
            sanityDelta: moodUpdate?.sanityDelta,
          })
          .catch(() => {
            // PlayGame workflow may have ended — that's okay
          });
      },
    ),
  };

  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-6",
    instructions: systemPrompt,
    tools,
  });

  // Create the chat hook for follow-up messages
  const hook = chatMessageHook.create({ token: runId });

  const messages: ModelMessage[] = [];
  let turnNumber = 0;
  let totalStepCount = 0;

  // Write an introductory greeting from the persona
  const greeting = `*${input.personaName} sits down across from you, looking ${input.initialGameState.personas.find((p) => p.id === input.personaId)?.mood ?? "uneasy"}.*`;
  messages.push({ role: "user", content: "The detective approaches you for questioning. Introduce yourself briefly and wait for their questions." });

  while (turnNumber < MAX_TURNS) {
    turnNumber++;
    const turnStartTime = Date.now();

    if (turnNumber === 1) {
      // Write a marker for the greeting context
      await writeUserMessageMarker(writable, greeting, `system-${runId}-greeting`, {
        turnNumber: 1,
        turnStartedAt: workflowStartTime,
        workflowRunId: runId,
        workflowStartedAt: workflowStartTime,
        isFirstTurn: true,
      });
    }

    let result;
    try {
      result = await agent.stream({
        messages,
        writable,
        preventClose: true,
        sendStart: turnNumber === 1,
        sendFinish: false,
        maxSteps: MAX_STEPS_PER_TURN,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[persona:${input.personaId}] Agent stream failed on turn ${turnNumber}:`,
        errorMessage,
      );
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

    // Wait for the next detective message
    const { message: followUp } = await hook;

    if (followUp === "/done") break;

    const nextTurnNumber = turnNumber + 1;
    const followUpId = `user-${runId}-${nextTurnNumber}`;

    await writeUserMessageMarker(writable, followUp, followUpId, {
      turnNumber: nextTurnNumber,
      turnStartedAt: Date.now(),
      workflowRunId: runId,
      workflowStartedAt: workflowStartTime,
      isFirstTurn: false,
    });

    messages.push({ role: "user", content: followUp });
  }

  await writeStreamClose(writable, {
    workflowRunId: runId,
    totalDurationMs: Date.now() - workflowStartTime,
    turnCount: turnNumber,
  });

  return { personaId: input.personaId, turnCount: turnNumber };
}
