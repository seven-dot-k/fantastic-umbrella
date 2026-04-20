// import { generateText, Output } from "ai";
import { getWritable, getWorkflowMetadata } from "workflow";
import { type UIMessageChunk } from "ai";
import { gameEventHook } from "./hooks/game-event";
import { fullGameStateStore } from '@/lib/game-state-store'
import { fallbackGameScenario } from "@/lib/data/game-scenario";
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
 * The workflow listens for game events (accuse, add-event, get-state, end-game)
 * via the gameEventHook.
 */
export async function playGameWorkflow(initialState: FullGameState) {
  "use workflow";

  const { workflowRunId: gameId } = getWorkflowMetadata();
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

  // Step 4: Event loop — listen for game events until game ends
  const hook = gameEventHook.create({ token: gameId });

  for await (const event of hook) {
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
  await delay(5000);
  return fallbackGameScenario.scenario;
}

/**
 * Step 2: Mock — return the personas from fallback data.
 */
async function generatePersonasStep() {
  "use step";
  await delay(5000);
  return fallbackGameScenario.personas;
}

/**
 * Step 3: Mock — return the secrets from fallback data.
 */
async function generateSecretsStep() {
  "use step";
  await delay(5000);
  return fallbackGameScenario.secretState;
}
