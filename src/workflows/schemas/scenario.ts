import { z } from "zod";

// --- Step 1: Generate the scenario ---

export const SCENARIO_PROMPT = `You are a murder mystery party game scenario generator. Create a fun, slightly absurd setting and victim for a lighthearted detective party game.

Requirements:
- A quirky, entertaining setting (e.g. a country manor, a luxury yacht, a theater) — the location is real but the vibe is silly
- A victim who was found dead this evening in a funny or dramatic way
- A short, punchy synopsis that sets the scene — keep it fun, not grim
- Include 2-3 discoverable clues that pretty obviously point toward the real murderer (this is a party game, not a CIA investigation)`;

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
- Each suspect should seem potentially suspicious in a fun, over-the-top way
- Make them exaggerated, comedic caricatures — big personalities, funny quirks, memorable catchphrases
- Give them distinct speech patterns that are easy to recognize and fun to read
- Each persona starts with a mood and sanity level (0-100, most start 60-85)
- Keep descriptions SHORT (2-3 sentences). Punchy and entertaining, not literary`;
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
- Each non-murderer should have an alibi that checks out, even if it sounds a little fishy at first
- The murderer's alibi should have a pretty obvious flaw — the detective shouldn't need a PhD to spot it
- Each suspect has their own embarrassing or funny secrets that make them act suspicious even if they're innocent
- Give each suspect a SHORT personality description (2-3 sentences) for how they talk — make them funny and exaggerated
- Clues should be fairly easy to connect. This is a party game — players should feel clever, not frustrated
- For each suspect, include their personaId matching the id from the suspects list above
- For each suspect, include a "cluePool" of 4-8 concrete, mystery-relevant clues they can reveal during conversation. These must be REAL clues that help solve the murder — timeline details, physical evidence they noticed, things they overheard, suspicious behavior from other suspects, alibi contradictions, etc. The murderer's cluePool should contain deflections and misdirections that accidentally reveal their own guilt. Innocent suspects' cluePool should contain observations that point toward the real killer.`;
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
      cluePool: z
        .array(z.string())
        .min(4)
        .max(8)
        .describe(
          "4-8 concrete mystery-relevant clues this persona can reveal during conversation. Each clue should help the detective solve the murder — alibi details, timeline info, physical evidence they noticed, things they overheard, or suspicious behavior from other suspects.",
        ),
    }),
  ),
});
