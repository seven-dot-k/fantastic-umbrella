import { generateText, Output } from 'ai';
import {
    SCENARIO_PROMPT,
    scenarioStepSchema,
    buildPersonasPrompt,
    personaStepSchema,
    buildSecretsPrompt,
    secretsStepSchema,
} from '@/workflows/schemas/scenario';

export const maxDuration = 180; // Set timeout to 180 seconds
export async function GET() {
    try {
        // Step 1: Generate the scenario
        const scenarioResult = await generateText({
            model: "anthropic/claude-haiku-4.5",
            output: Output.object({ schema: scenarioStepSchema }),
            prompt: SCENARIO_PROMPT,
        });
        const scenario = scenarioResult.output!;
        console.log("Scenario generated:", scenario.title);

        // Step 2: Generate the personas
        const personasResult = await generateText({
            model: "anthropic/claude-haiku-4.5",
            output: Output.object({ schema: personaStepSchema }),
            prompt: buildPersonasPrompt(scenario),
        });
        const { personas } = personasResult.output!;
        console.log("Personas generated:", personas.map(p => p.name));

        // Step 3: Generate the secrets
        const secretsResult = await generateText({
            model: "anthropic/claude-haiku-4.5",
            output: Output.object({ schema: secretsStepSchema }),
            prompt: buildSecretsPrompt(scenario, personas),
        });
        const secretState = secretsResult.output!;
        console.log("Secrets generated, murderer:", secretState.murdererId);

        return Response.json({ scenario, personas, secretState });
    } catch (error: any) {
        console.error("Error generating scenario:", error);
        return new Response(JSON.stringify({ error: "Failed to generate scenario" }), { status: 500 });
    }
}