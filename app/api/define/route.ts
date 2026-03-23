import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const DefinitionSchema = z.object({
  wordOrPhrase: z.string().describe("The selected word or phrase"),
  ipa: z.string().describe("IPA pronunciation, e.g. /ˈvokæbjəˌlɛri/"),
  pos: z.string().describe("Part of speech (e.g. Noun, Verb, Adjective)"),
  definition: z.string().describe("Traditional Chinese definition corresponding to how it's used in context"),
  usage_in_context: z.string().describe("Traditional Chinese explanation of its grammatical function or meaning specifically in this article's context")
});

export async function POST(req: Request) {
  try {
    const { selection, context } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Server API Key is not configured" }), { status: 500 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    const prompt = `
      Please explain the word or phrase "${selection}" as it is used in the following context.
      
      Context:
      "${context}"
      
      Provide a highly accurate explanation in Traditional Chinese, containing the definition, part of speech, IPA pronunciation, and an analysis of its usage within this specific context.
      Output pure JSON.
    `;

    const result = await generateObject({
      model: google('gemini-1.5-pro'),
      schema: DefinitionSchema,
      prompt: prompt,
    });

    return new Response(JSON.stringify(result.object), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Define API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
