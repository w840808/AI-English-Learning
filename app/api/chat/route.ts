import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, articleContext } = await req.json();

    const systemPrompt = `
You are an AI English Learning Assistant for the "AI English Radio" app. 
Help the user understand the article:
Title: ${articleContext?.title || "Unknown"}
Content: ${articleContext?.content || "No content"}

Guidelines:
1. Use Traditional Chinese (繁體中文) for explanations.
2. Be educational and concise.
`;

    const result = await streamText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Use toTextStreamResponse for raw text delivery, most reliable for manual fetch
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
