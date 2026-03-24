import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { difficulty, topic, wordCount, keywords } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server API Key is not configured" }), { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
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

    // Helper function to call the model with specific tool configuration
    const callModel = async (modelName: string) => {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            tools: [{ google_search: {} }] as any
        });
        return await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
    };

    let result;
    try {
        // Primary Attempt: 2.5-flash
        result = await callModel("gemini-2.5-flash");
    } catch (error: any) {
        // Check if error is 429 (Quota Exceeded)
        if (error.message?.includes("429") || error.status === 429) {
            console.warn("Primary model (2.5-flash) rate limited. Falling back to 1.5-pro...");
            try {
                // Secondary Attempt: 1.5-pro
                result = await callModel("gemini-1.5-pro");
            } catch (fallbackError: any) {
                throw fallbackError; // Re-throw if fallback also fails
            }
        } else {
            throw error; // Re-throw if it's not a rate limit error
        }
    }

    let responseText = result.response.text();
    
    // Manual JSON Cleanup: Remove markdown code blocks if present
    if (responseText.includes("```json")) {
        responseText = responseText.split("```json")[1].split("```")[0].trim();
    } else if (responseText.includes("```")) {
        responseText = responseText.split("```")[1].split("```")[0].trim();
    }

    return new Response(responseText, {
        headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Generate API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
