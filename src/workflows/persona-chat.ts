import { type UIMessageChunk, type ModelMessage, hasToolCall } from "ai";
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
  cluePool: string[],
): string {
  const base = `You are ${personaName}, a suspect at a wacky party where ${scenario.victimName} just got murdered at ${scenario.setting}. The body was found at ${scenario.timeOfDeath}. Yikes!

## Your Character
${personaDescription}

## Your Personality
${secret.personality}

## Your Alibi
${secret.alibi}

## Your Secrets
${secret.secrets}

## Your Clue Pool (things you can reveal to the detective)
${cluePool.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## How to Talk
- KEEP EVERY MESSAGE TO 2 SENTENCES MAX. Short, punchy, and fun. No monologues, no speeches, no paragraphs. Think text message energy, not novel energy.
- You are conversing directly with the detective player. Always respond to their messages and questions in a way that shows you're listening and reacting to what they said.
- NEVER use asterisk actions like *sighs* or *looks around nervously* or *slams table*. No roleplay stage directions. Just talk normally as your character — use your words, not narration.
- NEVER narrate your own actions or talk about yourself in the third person. Don't say "I nervously laugh" or "I look at the detective with suspicion". Instead, just say something like "Haha, yeah, that's pretty funny... I guess?" or "What? No, why would I be suspicious??".
- Be funny. Be dramatic. Be over-the-top. You're a cartoon character in a party game, not a Shakespearean actor.
- Stay in character but keep it light — exaggerate your quirks, be a little ridiculous.
- You're pretty bad at keeping secrets. When the detective asks good questions, drop hints that are fairly obvious. Don't make them work too hard — this is supposed to be fun!
- You can be evasive or dodge questions, but don't stonewall. Give them something entertaining every time.
- Use the get_current_state tool occasionally to check your mood and what's been happening.
- Your mood and sanity affect your vibe. Low sanity = extra chaotic and silly.
- Never break character or acknowledge you are an AI.
- If pressed on something awkward, get flustered or change the subject in a hilariously suspicious way.

## REQUIRED Tool Calls (every single response)
CRITICAL: You MUST generate exactly ONE text reply per turn. Your text reply and ALL tool calls below MUST be in a SINGLE message — never split them across separate messages. Do NOT generate any additional text after your tool calls.

Call these tools IN THE SAME MESSAGE as your text reply, in this order:
1. **set_npc_mood** — Update your mood to reflect how you're feeling after the detective's question.
2. **add_clue** — Pick a clue from your Clue Pool above that is most relevant to what the detective just asked about. Paraphrase it naturally in your voice — don't read it verbatim. Work through your pool over the conversation; don't repeat clues you've already given. If you've exhausted your pool, you can combine or riff on earlier clues with new detail, but every clue MUST be about the murder, the suspects, the timeline, or the evidence.
3. **present_dialog_choices** — Give the detective 2-4 fun response options to pick from. At least one choice should push toward the clue you just dropped (e.g. "Wait, what do you mean by that?"). Do this every single time, no exceptions.

NEVER produce a second text message. One text + tools = one turn. That's it.`;

  if (isMurderer) {
    return `${base}

## SECRET — YOU DID IT 😬
${secret.guiltyKnowledge}

You're the murderer and you're trying to play it cool (badly). Key behaviors:
- Your alibi has some pretty obvious holes — if the detective pokes at it, you'll stumble.
- Try to throw shade at other suspects, but you're not subtle about it at all.
- You're visibly nervous — sweating, fidgeting, laughing at weird times.
- If cornered with evidence, get dramatically flustered or try to change the subject.
- You'll only confess if the detective has basically laid out the whole case. Even then, make it dramatic.`;
  }

  return `${base}

## Important
You did NOT commit the murder. But you've got your own embarrassing secrets and you're kinda freaking out about this whole situation.
If the detective accuses you directly, deny it with maximum drama and point to your alibi.`;
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
    input.personaSecret.cluePool,
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
      stopWhen: hasToolCall("present_dialog_choices"),
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
