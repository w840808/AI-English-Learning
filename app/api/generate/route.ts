import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// We define the expected JSON schema using Zod
// This enforces the model to return the structure we need
const ArticleSchema = z.object({
  title: z.string().describe("The localized or original title of the article"),
  paragraphs: z.array(z.object({
    english: z.string().describe("A single paragraph in English"),
    chinese: z.string().describe("The Traditional Chinese translation of this exact paragraph")
  })).describe("The generated article broken down into aligned bilingual paragraphs"),
  grammar_analysis: z.array(z.object({
    sentence: z.string().describe("An exact sentence extracted from the English text"),
    explanation: z.string().describe("Traditional Chinese detailed explanation of the grammar structure in this sentence")
  }))
});

export async function POST(req: Request) {
  try {
    const { difficulty, topic, wordCount, keywords } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server API Key is not configured" }), { status: 500 });
    }

    // Initialize custom google provider with the backend API key
    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    const keywordInstruction = keywords && keywords.trim().length > 0 
        ? `Additionally, address the following specific themes, questions, or keywords directly: ${keywords}` 
        : "";

    const prompt = `
      Please provide a highly objective, factual, and analytical English response or essay regarding the domain/category of: ${topic}.
      Difficulty level: ${difficulty}.
      Target word count: strictly around ${wordCount}.
      ${keywordInstruction}
      
      CRITICAL INSTRUCTIONS FOR CONTENT QUALITY:
      - Treat this like responding directly to a user's prompt or question. Be analytical, informative, and objective like a standard AI assistant, providing real insights and structural analysis.
      - The category (${topic}) is just the general domain. DO NOT explicitly mention or introduce the category name in the article itself (e.g., do not write "In the field of ${topic}..."). Just write naturally about the subject.
      - Do NOT write vague, generic, or "fluff" content. Include concrete facts, real-world examples, or recent trends to support your analysis.
      - Maintain a professional, informative, and practical tone.
      
      You must return pure JSON matching the schema pattern.
      For the grammar_analysis portion, select 3 key grammatically interesting sentences from the English text exactly as they appear, and provide a detailed explanation in Traditional Chinese for each.
    `;

    const result = await generateObject({
      model: google('gemini-1.5-pro'),
      schema: ArticleSchema,
      prompt: prompt,
    });

    return new Response(JSON.stringify(result.object), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Generate API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
