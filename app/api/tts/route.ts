import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();
    console.log("TTS Request:", { text: text.substring(0, 20) + "...", voice });
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("TTS Error: API Key missing");
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: voice || 'en-US-Neural2-D',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google TTS API Error Response:", JSON.stringify(errorData, null, 2));
      return NextResponse.json({ 
        error: errorData.error?.message || "Failed to synthesize speech",
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log("TTS Success: Received audio content");
    return NextResponse.json({ audioContent: data.audioContent });
  } catch (error: any) {
    console.error("TTS Internal Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
