import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Use a stable model with high quota for chat
const model = google('gemini-2.0-flash');

export async function POST(req: Request) {
  const { messages, articleContext } = await req.json();

  const systemPrompt = `
You are an AI English Learning Assistant for the "AI English Radio" app. 
Your goal is to help users understand the current English article and improve their English skills.

${articleContext ? `The user is currently reading this article:
---
TITLE: ${articleContext.title}
CONTENT: ${articleContext.content}
---` : 'The user has not generated an article yet.'}

Guidelines:
1. Be encouraging, patient, and professional.
2. If the user asks about a word or sentence in the article, provide detailed explanations including grammar, usage, and synonyms.
3. If appropriate, suggest how they can rephrase their questions in better English.
4. Keep responses concise but highly educational.
5. Use traditional Chinese (繁體中文) for explanations when asked or when explaining to a Chinese-speaking user.
`;

  const result = await streamText({
    model,
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}
