import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, articleContext } = await req.json();
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not found" }), { status: 500 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    const systemPrompt = `
You are an AI English Learning Assistant for the "AI English Radio" app. 
Help the user understand the article:
Title: ${articleContext?.title || "Unknown"}
Content: ${articleContext?.content || "No content"}

Guidelines:
1. Use Traditional Chinese (繁體中文) for explanations.
2. Be educational and concise.
`;

    // Multi-model Fallback Chain for Quota Issues
    const models = ["gemini-2.0-flash", "gemini-pro-latest", "gemini-1.5-flash-latest", "gemini-1.5-flash-8b"];
    let lastError = null;

    for (const modelName of models) {
      try {
        const { text } = await generateText({
          model: google(modelName),
          system: systemPrompt,
          messages: messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
        });

        console.log(`AI Assistant Success using ${modelName}`);
        
        return new Response(JSON.stringify({ text }), { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error: any) {
        console.warn(`Chat API fallback from ${modelName}:`, error.message);
        lastError = error;
        // Continue to fallback ONLY if it's a quota/rate limit error (429)
        if (error.status === 429 || error.message?.includes("quota") || error.message?.includes("limit")) {
          continue;
        }
        break; // If it's a real error (e.g. prompt violation), stop here
      }
    }

    // If all fail
    return new Response(JSON.stringify({ error: lastError?.message || "All models throttled" }), { 
      status: 503,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Chat API Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
