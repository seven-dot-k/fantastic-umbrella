import { type UIMessageChunk, type ModelMessage } from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import {
  writeUserMessageMarker,
  writeTurnEnd,
} from "./steps/writer";
import { createGetCurrentStateTool } from "./tools/get-current-state";
import { createAddEventTool } from "./tools/add-event";
import { createSetNpcMoodTool } from "./tools/set-npc-mood";
import { createAddClueTool } from "./tools/add-clue";
import { createPresentDialogChoicesTool } from "./tools/present-dialog-choices";
import type { GameState, GameEvent, PersonaSecret, Clue } from "./schemas/game-state";

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
 * PersonaChat workflow — handles a single turn of conversation with one persona.
 *
 * Called as a child workflow from PlayGame via direct await (flattening).
 * The child's steps execute inline within the parent workflow's context.
 *
 * Accepts all persona configuration, the conversation history for this persona,
 * a writable stream for output, and current game state. Returns the new messages
 * produced by the agent so the parent can store them.
 */
export async function personaChatWorkflow(input: {
  gameId: string;
  personaId: string;
  personaName: string;
  personaDescription: string;
  personaSecret: PersonaSecret;
  isMurderer: boolean;
  scenario: { victimName: string; setting: string; timeOfDeath: string };
  currentGameState: GameState;
  messages: ModelMessage[];
  writable: WritableStream<UIMessageChunk>;
  turnNumber: number;
  totalStepCount: number;
  workflowStartedAt: number;
  onGameStateUpdate: (state: GameState) => void;
}) {
  "use workflow";

  let currentGameState: GameState = input.currentGameState;
  const writable = input.writable;

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
        // Notify the parent about the state update
        input.onGameStateUpdate(currentGameState);
      },
    ),
    set_npc_mood: createSetNpcMoodTool(
      input.personaId,
      (personaId, mood) => {
        currentGameState = {
          ...currentGameState,
          personas: currentGameState.personas.map((p) =>
            p.id === personaId ? { ...p, mood } : p,
          ),
        };
        input.onGameStateUpdate(currentGameState);
      },
    ),
    add_clue: createAddClueTool(
      input.personaId,
      input.personaName,
      (clue: Clue) => {
        currentGameState = {
          ...currentGameState,
          clues: [...(currentGameState.clues ?? []), clue],
        };
        input.onGameStateUpdate(currentGameState);
      },
    ),
    present_dialog_choices: createPresentDialogChoicesTool(),
  };

  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-6",
    instructions: systemPrompt,
    tools,
  });

  const messages = [...input.messages];
  const turnStartTime = Date.now();

  let result;
  try {
    result = await agent.stream({
      messages,
      writable,
      preventClose: true,
      sendStart: input.turnNumber === 1,
      sendFinish: false,
      maxSteps: MAX_STEPS_PER_TURN,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[persona:${input.personaId}] Agent stream failed on turn ${input.turnNumber}:`,
      errorMessage,
    );
    return {
      personaId: input.personaId,
      newMessages: [] as ModelMessage[],
      totalStepCount: input.totalStepCount,
      updatedGameState: currentGameState,
    };
  }

  const stepsForTurn = result.steps.map((step, index) => ({
    stepNumber: input.totalStepCount + index + 1,
    toolCalls: step.toolCalls?.map((tc) => tc.toolName) || [],
    finishReason: step.finishReason || "unknown",
  }));

  const newTotalStepCount = await writeTurnEnd(
    writable,
    input.turnNumber,
    Date.now() - turnStartTime,
    stepsForTurn,
    input.totalStepCount,
  );

  return {
    personaId: input.personaId,
    newMessages: result.messages as ModelMessage[],
    totalStepCount: newTotalStepCount,
    updatedGameState: currentGameState,
  };
}
