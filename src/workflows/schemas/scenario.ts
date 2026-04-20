import { z } from "zod";

// --- Step 1: Generate the scenario ---

export const SCENARIO_PROMPT = `You are a murder mystery scenario generator. Create a compelling setting and victim for an interactive detective game.

Requirements:
- A vivid setting (e.g. a country manor, a luxury yacht, a theater)
- A victim who was found dead this evening
- A compelling synopsis that sets the scene for investigation
- Include 2-3 discoverable clues that will later point toward the real murderer`;

export const scenarioStepSchema = z.object({
  title: z.string(),
  setting: z.string(),
  victimName: z.string(),
  timeOfDeath: z.string(),
  synopsis: z.string(),
  clues: z.array(z.string()),
});

// --- Step 2: Generate the personas ---

export function buildPersonasPrompt(scenario: z.infer<typeof scenarioStepSchema>) {
  return `You are continuing to build a murder mystery scenario. The scenario so far:

Title: ${scenario.title}
Setting: ${scenario.setting}
Victim: ${scenario.victimName}
Time of Death: ${scenario.timeOfDeath}
Synopsis: ${scenario.synopsis}

Generate EXACTLY 5 suspects. One of them will be the murderer (you don't need to decide who yet).

Requirements:
- Each suspect has a unique background, occupation, and relationship to the victim
- Each suspect should seem potentially suspicious
- Give them distinct personalities and speech patterns
- Each persona starts with a mood and sanity level (0-100, most start 60-85)
- Make the characters diverse, interesting, and memorable`;
}

export const personaStepSchema = z.object({
  personas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
      occupation: z.string(),
      relationship: z.string(),
      description: z.string(),
      mood: z.string(),
      sanity: z.number(),
    }),
  ),
});

// --- Step 3: Generate the secrets ---

export function buildSecretsPrompt(
  scenario: z.infer<typeof scenarioStepSchema>,
  personas: z.infer<typeof personaStepSchema>["personas"],
) {
  const personaList = personas
    .map((p) => `- ${p.name} (${p.id}): ${p.occupation}, ${p.relationship}`)
    .join("\n");

  return `You are finalizing a murder mystery scenario. Here is the scenario and suspects:

Title: ${scenario.title}
Setting: ${scenario.setting}
Victim: ${scenario.victimName}
Time of Death: ${scenario.timeOfDeath}
Synopsis: ${scenario.synopsis}

Suspects:
${personaList}

Choose ONE suspect as the murderer and build the secret state.

Requirements:
- The murderer must have a clear motive, means, and opportunity
- Each non-murderer should have an alibi that is ultimately verifiable but may seem shaky at first
- The murderer's alibi should have a subtle flaw that a good detective can uncover
- Each suspect should have their own secrets (not necessarily murder-related) that make them seem suspicious
- Give each suspect a distinct personality description for how they speak and act
- For each suspect, include their personaId matching the id from the suspects list above`;
}

export const secretsStepSchema = z.object({
  murdererId: z.string(),
  motive: z.string(),
  weapon: z.string(),
  opportunity: z.string(),
  personaSecrets: z.array(
    z.object({
      personaId: z.string(),
      alibi: z.string(),
      secrets: z.string(),
      personality: z.string(),
      guiltyKnowledge: z.string().optional(),
    }),
  ),
});
