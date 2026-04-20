import { z } from "zod";

// --- Public State (sent to client) ---

export const personaSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  occupation: z.string(),
  relationship: z.string(),
  description: z.string(),
  mood: z.string(),
  sanity: z.number().min(0).max(100),
});

export const gameEventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  personaId: z.string(),
  personaName: z.string(),
  description: z.string(),
});

export const clueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  relatedNpcIds: z.array(z.string()),
  discoveredAt: z.number(),
  discoveredFrom: z.string(),
});

export const scenarioSchema = z.object({
  title: z.string(),
  setting: z.string(),
  victimName: z.string(),
  timeOfDeath: z.string(),
  synopsis: z.string(),
});

export const gameStateSchema = z.object({
  gameId: z.string(),
  scenario: scenarioSchema,
  personas: z.array(personaSchema),
  events: z.array(gameEventSchema),
  clues: z.array(clueSchema),
  status: z.enum(["active", "solved", "failed"]),
});

export type Persona = z.infer<typeof personaSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
export type Clue = z.infer<typeof clueSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type GameState = z.infer<typeof gameStateSchema>;

// --- Secret State (server-only, never sent to client) ---

export const personaSecretSchema = z.object({
  alibi: z.string(),
  secrets: z.string(),
  personality: z.string(),
  guiltyKnowledge: z.string().optional(),
});

export const secretStateSchema = z.object({
  murdererId: z.string(),
  motive: z.string(),
  weapon: z.string(),
  opportunity: z.string(),
  personaSecrets: z.record(z.string(), personaSecretSchema),
});

export type PersonaSecret = z.infer<typeof personaSecretSchema>;
export type SecretState = z.infer<typeof secretStateSchema>;

// --- Full internal game record ---

export interface FullGameState {
  public: GameState;
  secret: SecretState;
}
