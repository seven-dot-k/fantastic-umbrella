import { createUIMessageStreamResponse } from "ai";
import { start, getRun } from "workflow/api";
import { personaChatWorkflow } from "@/workflows/persona-chat";
import type { GameState } from "@/workflows/schemas/game-state";
import { z } from "zod";
import { fullGameStateStore } from "@/lib/game-state-store";
const startChatSchema = z.object({
  gameId: z.string().min(1),
  personaId: z.string().min(1),
});

/**
 * POST /api/agent/[agentId]/stream — Start a new persona chat workflow.
 *
 * The agentId in the URL is the personaId. The request body provides the gameId
 * so we can look up the persona's secret state from the PlayGame workflow.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId: personaId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startChatSchema.safeParse({ ...body, personaId });
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Read the current game state to get persona details and secrets
  const gameState = await readGameState(parsed.data.gameId);
  if (!gameState) {
    return Response.json(
      { error: "Game not found or state unavailable" },
      { status: 404 },
    );
  }

  const persona = gameState.personas.find((p) => p.id === personaId);
  if (!persona) {
    return Response.json(
      { error: "Persona not found in game" },
      { status: 404 },
    );
  }

  // Read secret state from workflow — the secret is stored server-side only
  const secretState = await readSecretState(parsed.data.gameId);
  if (!secretState) {
    return Response.json(
      { error: "Game secret state unavailable" },
      { status: 500 },
    );
  }

  const personaSecret = secretState.personaSecrets[personaId];
  if (!personaSecret) {
    return Response.json(
      { error: "Persona secret not found" },
      { status: 500 },
    );
  }

  let run;
  try {
    run = await start(personaChatWorkflow, [
      {
        gameId: parsed.data.gameId,
        personaId,
        personaName: persona.name,
        personaDescription: persona.description,
        personaSecret,
        isMurderer: secretState.murdererId === personaId,
        scenario: {
          victimName: gameState.scenario.victimName,
          setting: gameState.scenario.setting,
          timeOfDeath: gameState.scenario.timeOfDeath,
        },
        initialGameState: gameState,
      },
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/agent/${personaId}] Failed to start chat:`, message);
    return Response.json(
      { error: "Failed to start persona chat", details: message },
      { status: 500 },
    );
  }

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}

/**
 * Read game state from the PlayGame workflow's namespaced stream.
 */
async function readGameState(gameId: string): Promise<GameState | null> {

  try {
    const run = getRun(gameId);
    const readable = run.getReadable({ namespace: "game-state" });
    const reader = readable.getReader();
    let latestState: GameState | null = null;

    try {
      while (true) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: true }>((resolve) =>
            setTimeout(() => resolve({ value: undefined, done: true }), 2000),
          ),
        ]);

        if (done || !value) break;

        const chunk = value as unknown as {
          type: string;
          data?: { type: string; state?: GameState };
        };
        if (chunk.data?.type === "game-state" && chunk.data.state) {
          latestState = chunk.data.state;
        }
      }
    } finally {
      reader.releaseLock();
    }

    return latestState;
  } catch {
    return null;
  }
}

/**
 * Read secret state from the PlayGame workflow.
 * Secret state is stored as the workflow's return value or via a dedicated namespace.
 * For now, we read it from a "secret-state" namespace.
 */
async function readSecretState(
  gameId: string,
): Promise<{ murdererId: string; personaSecrets: Record<string, { alibi: string; secrets: string; personality: string; guiltyKnowledge?: string }> } | null> {
  try {
    const run = getRun(gameId);
    const readable = run.getReadable({ namespace: "secret-state" });
    const reader = readable.getReader();

    let secretState = null;

    try {
      while (true) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: true }>((resolve) =>
            setTimeout(() => resolve({ value: undefined, done: true }), 2000),
          ),
        ]);

        if (done || !value) break;

        const chunk = value as unknown as {
          type: string;
          data?: { type: string; state?: unknown };
        };
        if (chunk.data?.type === "secret-state" && chunk.data.state) {
          secretState = chunk.data.state as {
            murdererId: string;
            personaSecrets: Record<string, { alibi: string; secrets: string; personality: string; guiltyKnowledge?: string }>;
          };
        }
      }
    } finally {
      reader.releaseLock();
    }

    return secretState;
  } catch {
    return null;
  }
}
