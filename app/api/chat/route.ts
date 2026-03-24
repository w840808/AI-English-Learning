import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

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

    // Switch to generateText (Non-streaming) for maximum reliability
    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    console.log("AI Assistant Response Generated Successfully");
    
    return new Response(JSON.stringify({ text }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
