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

    const models = ["gemini-2.0-flash", "gemini-pro-latest", "gemini-flash-latest"];
    let lastError = null;

    for (const modelName of models) {
        try {
            const result = await generateObject({
                model: google(modelName),
                schema: DefinitionSchema,
                prompt: prompt,
            });

            const objectToReturn = result.object || {
                wordOrPhrase: selection,
                ipa: "",
                pos: "",
                definition: "無法獲取定義 (API 額度限制)",
                usage_in_context: "請稍候再試"
            };

            return new Response(JSON.stringify(objectToReturn), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error: any) {
            console.warn(`Define API fallback from ${modelName}:`, error.message);
            lastError = error;
            if (error.status === 429 || error.message?.includes("quota")) {
                continue;
            }
            break;
        }
    }

    return new Response(JSON.stringify({ error: lastError?.message || "All models failed" }), { status: 500 });

  } catch (error: any) {
    console.error("Define API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
