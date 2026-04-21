// import { generateText, Output } from "ai";
import { getWritable, getWorkflowMetadata } from "workflow";
import { type UIMessageChunk, type ModelMessage } from "ai";
import { gameEventHook } from "./hooks/game-event";
import { personaChatWorkflow } from "./persona-chat";
import { fullGameStateStore } from '@/lib/game-state-store'
import { fallbackGameScenario } from "@/lib/data/game-scenario";
import {
  writeUserMessageMarker,
  writeStreamClose,
} from "./steps/writer";
import type {
  FullGameState,
  GameState,
  GameEvent,
  SecretState,
} from "./schemas/game-state";

/**
 * Writes a status message to the stream so clients can show progress.
 */
async function writeStatusMessage(
    writable: WritableStream<UIMessageChunk>,
  message: string,
) {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({
      type: "data-workflow",
      data: {
        type: "status",
        message,
        timestamp: Date.now(),
      },
    } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Writes the secret state to the secret-state namespaced stream.
 * Only written once at game creation — never exposed to the client.
 */
async function writeSecretState(
    writable: WritableStream<UIMessageChunk>,
  state: SecretState,
) {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({
      type: "data-workflow",
      data: {
        type: "secret-state",
        state,
        timestamp: Date.now(),
      },
    } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Writes the current public game state to the game-state namespaced stream.
 * This overwrites the previous state so the client always gets the latest.
 */
async function writeGameState(
    writable: WritableStream<UIMessageChunk>,
  state: GameState,
) {
  "use step";

  const writer = writable.getWriter();
  try {
    await writer.write({
      type: "data-workflow",
      data: {
        type: "game-state",
        state,
        timestamp: Date.now(),
      },
    } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}

async function getFullGameState(gameId: string){
    "use step";

    return fullGameStateStore.get(gameId);
}
async function saveFullGameState(gameId: string, state: FullGameState) {
    "use step";

    fullGameStateStore.set(gameId, state);
}
/**
 * PlayGame workflow — generates the murder mystery scenario and manages game state.
 *
 * Game state is published to a namespaced stream ("game-state") so clients can
 * read it via GET /api/run/[gameId]/state.
 *
 * The workflow listens for game events (accuse, add-event, get-state, end-game,
 * chat-message) via the gameEventHook. Chat messages trigger a child
 * personaChatWorkflow via direct await (flattening) — the child's steps execute
 * inline within this workflow's context.
 */
export async function playGameWorkflow(initialState: FullGameState) {
  "use workflow";

  const { workflowRunId: gameId, workflowStartedAt } = getWorkflowMetadata();
  const workflowStartTime = workflowStartedAt.getTime();
  // Default stream — flows through run.readable to the client
  const writable = getWritable<UIMessageChunk>();
  // Namespaced streams for later access by other routes
  const gameStateWritable = getWritable<UIMessageChunk>({ namespace: "game-state" });
  const secretWritable = getWritable<UIMessageChunk>({ namespace: "secret-state" });

  // Step 1: Generate the scenario
  await writeStatusMessage(writable, "Crafting the murder mystery scenario...");
  const scenario = await generateScenarioStep();

  // Step 2: Generate the personas
  await writeStatusMessage(writable, `Generating suspects for "${scenario.title}"...`);
  const personas = await generatePersonasStep();

  // Step 3: Generate the secrets
  await writeStatusMessage(writable, "Weaving secrets and alibis...");
  const secretsRaw = await generateSecretsStep();

  // Remap secrets array → record keyed by personaId for SecretState
  const personaSecrets: SecretState["personaSecrets"] = {};
  for (const s of secretsRaw.personaSecrets) {
    const { personaId, ...rest } = s;
    personaSecrets[personaId] = rest;
  }

  const secretState: SecretState = {
    murdererId: secretsRaw.murdererId,
    motive: secretsRaw.motive,
    weapon: secretsRaw.weapon,
    opportunity: secretsRaw.opportunity,
    personaSecrets,
  };

  // Build initial game state
  const fullState: FullGameState = {
    public: {
      gameId,
      scenario: {
        title: scenario.title,
        setting: scenario.setting,
        victimName: scenario.victimName,
        timeOfDeath: scenario.timeOfDeath,
        synopsis: scenario.synopsis,
      },
      personas,
      events: [],
      clues: [],
      status: "active",
    },
    secret: secretState,
  };

  // Publish initial state to default stream (client sees it) and namespaced stream (for later)
  await writeStatusMessage(writable, "The investigation begins...");
  await writeGameState(writable, fullState.public);
  await writeGameState(gameStateWritable, fullState.public);
  await saveFullGameState(gameId, fullState);
  // Publish secret state (only readable server-side, never exposed to client)
  await writeSecretState(secretWritable, fullState.secret);

  // Per-persona chat state: message histories, turn counts, step counts, and writables
  const personaMessages = new Map<string, ModelMessage[]>();
  const personaTurnCounts = new Map<string, number>();
  const personaStepCounts = new Map<string, number>();
  const personaWritables = new Map<string, WritableStream<UIMessageChunk>>();

  // Step 4: Event loop — listen for game events until game ends
  const hook = gameEventHook.create({ token: gameId });

  for await (const event of hook) {
    console.log(`[PlayGame] Received event:`, event);
    if (fullState.public.status !== "active") break;

    switch (event.type) {
      case "get-state": {
        // No-op: client reads state from the stream
        break;
      }

      case "add-event": {
        if (event.personaId && event.description) {
          const persona = fullState.public.personas.find(
            (p) => p.id === event.personaId,
          );
          if (persona) {
            const gameEvent: GameEvent = {
              id: `evt-${event.personaId}-${Date.now()}`,
              timestamp: Date.now(),
              personaId: event.personaId,
              personaName: persona.name,
              description: event.description,
            };
            fullState.public.events.push(gameEvent);

            // Update mood/sanity if provided
            if (event.mood) persona.mood = event.mood;
            if (event.sanityDelta) {
              persona.sanity = Math.max(
                0,
                Math.min(100, persona.sanity + event.sanityDelta),
              );
            }

            await writeGameState(gameStateWritable, fullState.public);
          }
        }
        break;
      }

      case "update-mood": {
        if (event.personaId) {
          const persona = fullState.public.personas.find(
            (p) => p.id === event.personaId,
          );
          if (persona) {
            if (event.mood) persona.mood = event.mood;
            if (event.sanityDelta) {
              persona.sanity = Math.max(
                0,
                Math.min(100, persona.sanity + event.sanityDelta),
              );
            }
            await writeGameState(gameStateWritable, fullState.public);
          }
        }
        break;
      }

      case "chat-message": {
        if (event.personaId && event.message) {
          const personaId = event.personaId;
          const persona = fullState.public.personas.find(
            (p) => p.id === personaId,
          );
          if (!persona) break;

          const personaSecret = fullState.secret.personaSecrets[personaId];
          if (!personaSecret) break;

          // Get or create per-persona namespaced writable
          if (!personaWritables.has(personaId)) {
            personaWritables.set(
              personaId,
              getWritable<UIMessageChunk>({ namespace: `persona-${personaId}` }),
            );
          }
          const personaWritable = personaWritables.get(personaId)!;

          // Get or initialize per-persona message history
          if (!personaMessages.has(personaId)) {
            personaMessages.set(personaId, []);
          }
          const messages = personaMessages.get(personaId)!;

          // Get turn and step counts
          const turnNumber = (personaTurnCounts.get(personaId) ?? 0) + 1;
          personaTurnCounts.set(personaId, turnNumber);
          const totalStepCount = personaStepCounts.get(personaId) ?? 0;

          const isFirstTurn = turnNumber === 1;

          if (isFirstTurn) {
            // First turn: write greeting marker and set up initial prompt
            // const greeting = `*${persona.name} shuffles over, looking ${persona.mood ?? "deeply suspicious"}. This should be fun.*`;
            messages.push({
              role: "user",
              content: "I'm detective Nash, who are you and what do you know about the murder?",
            });

            // await writeUserMessageMarker(
            //   personaWritable,
            //   greeting,
            //   `system-${gameId}-${personaId}-greeting`,
            //   {
            //     turnNumber: 1,
            //     turnStartedAt: workflowStartTime,
            //     workflowRunId: gameId,
            //     workflowStartedAt: workflowStartTime,
            //     isFirstTurn: true,
            //   },
            // );
          } else {
            // Follow-up: write user message marker and add to history
            const followUpId = `user-${gameId}-${personaId}-${turnNumber}`;
            await writeUserMessageMarker(
              personaWritable,
              event.message,
              followUpId,
              {
                turnNumber,
                turnStartedAt: Date.now(),
                workflowRunId: gameId,
                workflowStartedAt: workflowStartTime,
                isFirstTurn: false,
              },
            );
            messages.push({ role: "user", content: event.message });
          }
          console.log(JSON.stringify(messages, null, 2))
          // Spawn child persona workflow via direct await (flattening)
          const result = await personaChatWorkflow({
            gameId,
            personaId,
            personaName: persona.name,
            personaDescription: persona.description,
            personaSecret,
            isMurderer: fullState.secret.murdererId === personaId,
            scenario: {
              victimName: fullState.public.scenario.victimName,
              setting: fullState.public.scenario.setting,
              timeOfDeath: fullState.public.scenario.timeOfDeath,
            },
            currentGameState: fullState.public,
            messages,
            writable: personaWritable,
            turnNumber,
            totalStepCount,
            workflowStartedAt: workflowStartTime,
            onGameStateUpdate: (updatedState: GameState) => {
              fullState.public = updatedState;
            },
          });

          // Store new messages from the agent response
          messages.push(...result.newMessages);
          personaStepCounts.set(personaId, result.totalStepCount);

          // Sync game state updates from child workflow
          if (result.updatedGameState) {
            fullState.public = result.updatedGameState;
            await writeGameState(gameStateWritable, fullState.public);
          }
        }
        break;
      }

      case "end-persona-chat": {
        if (event.personaId) {
          const personaId = event.personaId;
          const personaWritable = personaWritables.get(personaId);
          if (personaWritable) {
            const turnCount = personaTurnCounts.get(personaId) ?? 0;
            await writeStreamClose(personaWritable, {
              workflowRunId: gameId,
              totalDurationMs: Date.now() - workflowStartTime,
              turnCount,
            });
            personaWritables.delete(personaId);
            personaMessages.delete(personaId);
            personaTurnCounts.delete(personaId);
            personaStepCounts.delete(personaId);
          }
        }
        break;
      }

      case "accuse": {
        if (event.personaId) {
          const isCorrect = event.personaId === fullState.secret.murdererId;
          fullState.public.status = isCorrect ? "solved" : "failed";
          await writeGameState(gameStateWritable, fullState.public);
        }
        break;
      }

      case "end-game": {
        fullState.public.status = "failed";
        await writeGameState(gameStateWritable, fullState.public);
        break;
      }
    }

    if (fullState.public.status !== "active") break;
  }

  // Close any persona streams
  for (const [personaId, personaWritable] of personaWritables) {
    const turnCount = personaTurnCounts.get(personaId) ?? 0;
    await writeStreamClose(personaWritable, {
      workflowRunId: gameId,
      totalDurationMs: Date.now() - workflowStartTime,
      turnCount,
    });
  }

  // Close the state stream
  return { gameId, status: fullState.public.status };
}

/**
 * Simulated delay to mimic LLM call latency.
 */
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Step 1: Mock — return the scenario from fallback data.
 */
async function generateScenarioStep() {
  "use step";
  await delay(2500);
  return fallbackGameScenario.scenario;
}

/**
 * Step 2: Mock — return the personas from fallback data.
 */
async function generatePersonasStep() {
  "use step";
  await delay(2500);
  return fallbackGameScenario.personas;
}

/**
 * Step 3: Mock — return the secrets from fallback data.
 */
async function generateSecretsStep() {
  "use step";
  await delay(2500);
  return fallbackGameScenario.secretState;
}
