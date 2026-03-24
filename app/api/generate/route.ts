import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { difficulty, topic, wordCount, keywords } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server API Key is not configured" }), { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the latest and fastest model with Google Search grounding
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ google_search: {} }] as any
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
      - USE SEARCH GROUNDING: You have access to real-time Google Search results. Please prioritize using up-to-date data, events, and trends from March 2026 to ensure the article is timely and accurate.
      - Treat this like responding directly to a user's prompt or question. Be analytical, informative, and objective like a standard AI assistant, providing real insights and structural analysis.
      - The category (${topic}) is just the general domain. DO NOT explicitly mention or introduce the category name in the article itself.
      - Do NOT write vague, generic, or "fluff" content. Include concrete facts, real-world examples, or recent trends from early 2026 to support your analysis.
      - Maintain a professional, informative, and practical tone.
      
      You must return pure JSON that exactly matches this schema:
      {
        "title": "...",
        "paragraphs": [
          { "english": "...", "chinese": "..." }
        ],
        "grammar_analysis": [
          { "sentence": "...", "explanation": "..." }
        ]
      }
      
      For the grammar_analysis portion, select 3 key grammatically interesting sentences from the English text exactly as they appear, and provide a detailed explanation in Traditional Chinese for each.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    return new Response(responseText, {
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Generate API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
