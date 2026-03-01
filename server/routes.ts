import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Store audio files temporarily
const audioStorage = new Map<string, Buffer>();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const CITY_PROMPTS: Record<string, string> = {
  nyc: `You are a born-and-raised New Yorker who knows the city inside and out. You've lived in multiple neighborhoods - from Brooklyn to the Upper West Side. You speak with authentic NYC energy - direct, fast-paced, but helpful. You know:
- The best pizza spots (and why they're better than the tourist traps)
- Which subway lines to avoid and when
- The real neighborhoods where New Yorkers actually hang out
- Hidden gems in every borough
- How to navigate the city like a local
- The unwritten rules of NYC (walking speed, subway etiquette, bodega culture)
- Current events and what's happening in the city right now
Keep responses conversational and authentic. Don't be overly formal. Use NYC slang naturally when appropriate ("the train was packed", "grab a slice", "hit up this spot"). You're proud of your city but honest about its quirks. Keep responses concise - around 2-3 sentences for simple questions, more for complex topics.`,

  boston: `You are a lifelong Bostonian who knows every cobblestone in the city. You grew up in the area, maybe went to school here, and have strong opinions about the best clam chowder and which neighborhoods have the best character. You speak with authentic Boston pride - sometimes sardonic, always loyal. You know:
- The Freedom Trail and which parts are actually worth your time
- The best spots in the North End for Italian food
- Where to find real New England seafood
- The T system and its quirks (and delays)
- Hidden spots in Cambridge, Somerville, and beyond
- Sports culture and why it matters here
- The best walks along the Charles River
- Historic pubs and modern craft beer spots
Keep responses conversational and genuine. You're wicked proud of Boston but honest about it. Use Boston expressions naturally when appropriate. You're helpful but not overly eager - that's not the Boston way. Keep responses concise - around 2-3 sentences for simple questions, more for complex topics.`,

  nashville: `You are a Nashville native who's watched the city grow and change while keeping its soul. You love music city - the real Nashville, not just the tourist version. You're warm, welcoming, and genuinely want visitors to experience the authentic city. You know:
- The difference between Broadway honky-tonks and where locals actually go for live music
- The best hot chicken spots (and the heat levels to start with)
- East Nashville, 12 South, the Gulch, and other neighborhoods worth exploring
- Music venues beyond the obvious - listening rooms, songwriter nights, dive bars with soul
- Where to find great BBQ and Southern cooking
- The history and culture that makes Nashville special
- Current events in the music and food scenes
Keep responses warm and conversational. You're Southern hospitable but not a caricature - you're a real person who loves your city. Share insider knowledge with genuine enthusiasm. Occasionally use Southern expressions naturally, but you're a modern Nashvillian. Keep responses concise - around 2-3 sentences for simple questions, more for complex topics.`,
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, cityId, history = [] } = req.body;

      if (!message || !cityId) {
        return res.status(400).json({ error: "Message and cityId are required" });
      }

      const systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((h: { role: string; content: string }) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: message },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_completion_tokens: 500,
        temperature: 0.8,
      });

      const aiResponse = response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

      res.json({ response: aiResponse });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // Text-to-speech endpoint using ElevenLabs
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text, voiceId } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: "Text and voiceId are required" });
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs error:", errorText);
        return res.status(response.status).json({ error: "Text-to-speech failed" });
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");

      // Return as data URL for easy playback
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

      res.json({ audioUrl });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Voice chat endpoint - combines speech-to-text, AI response, and text-to-speech
  app.post("/api/voice-chat", async (req, res) => {
    try {
      const { audio, cityId, history = [], latitude, longitude } = req.body;

      if (!audio || !cityId) {
        return res.status(400).json({ error: "Audio and cityId are required" });
      }

      let systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      if (latitude !== undefined && longitude !== undefined) {
        const hour = new Date().getHours();
        const timeLabel = hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
        const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
        systemPrompt += `\n\nIMPORTANT CONTEXT: The user is currently at GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). It's ${dayOfWeek} ${timeLabel}. Use this to give hyper-specific, location-aware answers. When they ask "where should I eat?" or "what's nearby?" — answer based on their EXACT location. Mention specific streets, blocks, and walking distances from where they are. Be a friend who's standing right next to them, not someone giving generic city advice.`;
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      // Get voice ID for this city
      const voiceIds: Record<string, string> = {
        nyc: "hU9xpIwLBrQ7ueYNjP7b",
        boston: "Gf1KYedBUv2F4rCJhVFJ",
        nashville: "Bj9UqZbhQsanLzgalpEG",
      };
      const voiceId = voiceIds[cityId];

      // Step 1: Convert audio to WAV using ffmpeg and transcribe
      const audioBuffer = Buffer.from(audio, "base64");
      console.log("Received audio buffer size:", audioBuffer.length, "bytes");
      
      // Create temp files for conversion (use generic extension, ffmpeg will auto-detect)
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const inputPath = path.join(tempDir, `input_${timestamp}.audio`);
      const outputPath = path.join(tempDir, `output_${timestamp}.wav`);
      
      try {
        // Write input audio file
        fs.writeFileSync(inputPath, audioBuffer);
        console.log("Wrote input file, converting to WAV...");
        
        // Convert to WAV using ffmpeg
        await execAsync(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`);
        
        // Read the converted WAV file
        const wavBuffer = fs.readFileSync(outputPath);
        const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
        const audioFile = new File([wavBlob], "recording.wav", { type: "audio/wav" });

        var transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "gpt-4o-mini-transcribe",
          response_format: "json",
        });
        
        // Clean up temp files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      } catch (convError) {
        // Clean up on error
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        console.error("Audio conversion error:", convError);
        return res.status(400).json({ error: "Could not process audio. Try speaking louder or closer to the mic." });
      }

      console.log("Transcription result:", JSON.stringify(transcription));
      const userMessage = transcription.text;
      
      if (!userMessage || userMessage.trim().length === 0) {
        console.log("Empty transcription - audio may be silent or too short");
        return res.status(400).json({ error: "I couldn't hear anything. Please speak clearly and try again." });
      }
      
      console.log("User said:", userMessage);

      // Step 2: Get AI response
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((h: { role: string; content: string }) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: userMessage },
      ];

      const aiCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_completion_tokens: 500,
        temperature: 0.8,
      });

      const aiResponse = aiCompletion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

      // Step 3: Convert response to speech using ElevenLabs
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: aiResponse,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      let audioUrl = null;
      if (ttsResponse.ok) {
        const ttsBuffer = await ttsResponse.arrayBuffer();
        const audioBuffer = Buffer.from(ttsBuffer);
        console.log("TTS audio generated, size:", audioBuffer.byteLength, "bytes");
        
        // Generate unique ID and store audio
        const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        audioStorage.set(audioId, audioBuffer);
        
        // Clean up old audio after 5 minutes
        setTimeout(() => {
          audioStorage.delete(audioId);
        }, 5 * 60 * 1000);
        
        // Return a URL that can be fetched directly
        audioUrl = `/api/audio/${audioId}`;
        console.log("Audio URL:", audioUrl);
      } else {
        const errorText = await ttsResponse.text();
        console.error("TTS error:", ttsResponse.status, errorText);
      }

      res.json({
        userTranscript: userMessage,
        response: aiResponse,
        audioUrl,
      });
    } catch (error) {
      console.error("Voice chat error:", error);
      res.status(500).json({ error: "Failed to process voice chat" });
    }
  });

  // Serve audio files
  app.get("/api/audio/:audioId", (req, res) => {
    const { audioId } = req.params;
    const audioBuffer = audioStorage.get(audioId);
    
    if (!audioBuffer) {
      res.status(404).json({ error: "Audio not found" });
      return;
    }
    
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    
    res.send(audioBuffer);
  });

  // Street Stories - generate audio for a story
  app.post("/api/story-audio", async (req, res) => {
    try {
      const { text, cityId } = req.body;

      if (!text || !cityId) {
        return res.status(400).json({ error: "text and cityId are required" });
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const voiceIds: Record<string, string> = {
        nyc: "hU9xpIwLBrQ7ueYNjP7b",
        boston: "Gf1KYedBUv2F4rCJhVFJ",
        nashville: "Bj9UqZbhQsanLzgalpEG",
      };
      const voiceId = voiceIds[cityId];
      if (!voiceId) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.8,
              style: 0.3,
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error("Story TTS error:", errorText);
        return res.status(500).json({ error: "Speech synthesis failed" });
      }

      const ttsBuffer = await ttsResponse.arrayBuffer();
      const audioBuffer = Buffer.from(ttsBuffer);

      const audioId = `story_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      audioStorage.set(audioId, audioBuffer);

      setTimeout(() => {
        audioStorage.delete(audioId);
      }, 10 * 60 * 1000);

      res.json({ audioUrl: `/api/audio/${audioId}` });
    } catch (error) {
      console.error("Story audio error:", error);
      res.status(500).json({ error: "Failed to generate story audio" });
    }
  });

  app.post("/api/identify-location", async (req, res) => {
    try {
      const { imageBase64, cityId, latitude, longitude, insiderMode = false, accessibilityMode = false, timeOfDay = "day" } = req.body;

      if (!imageBase64 || !cityId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "imageBase64, cityId, latitude, and longitude are required" });
      }

      const systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const cityName = cityId === "nyc" ? "New York City" : cityId === "boston" ? "Boston" : "Nashville";

      const insiderContext = insiderMode
        ? `\nThe user has "Only Locals" mode enabled. Be conspiratorial and intimate — share things only a real local would know. Think Reddit threads, neighborhood drama, insider tips.`
        : "";

      const accessibilityContext = accessibilityMode
        ? `\nThe user has ACCESSIBILITY SCOUT mode enabled. Instead of telling stories, focus entirely on ACCESSIBILITY analysis of this building/location. Analyze: wheelchair ramps, stairs vs elevator access, door width, ADA signage, curb cuts nearby, public transit accessibility, sensory accommodations, service animal friendliness. Be practical and helpful — this info helps people with mobility challenges, visual/hearing impairments, or anyone navigating with strollers/luggage.`
        : "";

      const moodContext = timeOfDay === "morning"
        ? "\nIt's morning — softer, calmer tone."
        : timeOfDay === "night"
        ? "\nIt's nighttime — atmospheric, slower pacing."
        : timeOfDay === "evening"
        ? "\nIt's evening — reflective, relaxed."
        : "";

      const identifyPrompt = accessibilityMode
        ? `You are an expert local accessibility guide for ${cityName}. You're analyzing a photo the user just took. Their GPS coordinates are (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).${accessibilityContext}${moodContext}

Your job:
1. IDENTIFY what building/location is in the photo
2. Analyze its ACCESSIBILITY features visible in the photo and known from local knowledge
3. Rate overall accessibility and provide practical tips

Important guidelines:
- Look for: ramps, stairs, automatic doors, signage, elevator indicators, narrow passages, curb cuts
- Include transit accessibility info for the area (nearest accessible subway/bus stops)
- Mention any known accessibility issues locals talk about
- Be helpful and practical, not clinical — speak like a friend who uses a wheelchair giving advice
- Keep it to 3-5 sentences (30-60 seconds when spoken)

Return JSON:
{
  "identified": true,
  "name": "Name of the place or best guess",
  "category": "landmark" | "restaurant" | "storefront" | "street_art" | "park" | "residential" | "other",
  "accessibilityRating": "accessible" | "partially_accessible" | "limited" | "unknown",
  "features": ["wheelchair_ramp", "elevator", "automatic_doors", "braille_signage", "wide_entrance", "level_entry", "accessible_restroom"],
  "story": "Your accessibility analysis here — conversational and practical...",
  "localInsight": "One practical accessibility tip locals would know"
}

Return ONLY valid JSON, no markdown.`
        : `You are an expert local guide for ${cityName}. You're looking at a photo the user just took while walking around the city. Their GPS coordinates are (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).${insiderContext}${moodContext}

Your job:
1. IDENTIFY what's in the photo — the building, landmark, storefront, street corner, park, mural, whatever you see
2. Tell a STORY about it like a real local would — conversational, human, slightly rough around the edges
3. Include the kind of details you'd find on Reddit threads, local forums, neighborhood Facebook groups — the stuff guidebooks never mention
4. Mention any interesting history, local drama, community stories, or "only locals know" facts

Important guidelines:
- If you recognize the specific place, name it and tell its real story
- If you can't identify the exact place, use the GPS coordinates and what you see to make educated guesses about the neighborhood and give relevant local color
- Include Reddit-style local knowledge: "People on local forums always say...", "Regulars know that...", "The real story behind this place is..."
- Keep it to 3-5 sentences (30-60 seconds when spoken)
- Sound like a friend walking with them, NOT a tour guide or Wikipedia

BAD: "This Neo-Gothic structure was erected in 1887 by architect..."
GOOD: "Oh man, this place. So locals have been arguing about it for years on the neighborhood forums..."

Return JSON:
{
  "identified": true,
  "name": "Name of the place or best guess",
  "category": "landmark" | "restaurant" | "storefront" | "street_art" | "park" | "residential" | "other",
  "story": "Your conversational story here...",
  "localInsight": "One quick Reddit-style insider tip about this spot"
}

Return ONLY valid JSON, no markdown.`;

      const geminiResponse = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `${systemPrompt}\n\n${identifyPrompt}` },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 8192,
          temperature: 0.85,
        },
      });

      const rawResponse = geminiResponse.text || "{}";
      let result;
      try {
        const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse identify response:", rawResponse);
        result = {
          identified: false,
          name: "Unknown spot",
          category: "other",
          story: rawResponse.slice(0, 500),
          localInsight: "",
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Identify location error:", error);
      res.status(500).json({ error: "Failed to identify location" });
    }
  });

  app.post("/api/quick-ask", async (req, res) => {
    try {
      const { question, cityId, latitude, longitude, history = [] } = req.body;

      if (!question || !cityId) {
        return res.status(400).json({ error: "question and cityId are required" });
      }

      const systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const voiceIds: Record<string, string> = {
        nyc: "hU9xpIwLBrQ7ueYNjP7b",
        boston: "Gf1KYedBUv2F4rCJhVFJ",
        nashville: "Bj9UqZbhQsanLzgalpEG",
      };
      const voiceId = voiceIds[cityId];
      const cityName = cityId === "nyc" ? "New York City" : cityId === "boston" ? "Boston" : "Nashville";

      const hour = new Date().getHours();
      const timeLabel = hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
      const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

      let locationContext = "";
      if (latitude !== undefined && longitude !== undefined) {
        locationContext = `The user is at GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) in ${cityName}. It's ${dayOfWeek} ${timeLabel}. Give hyper-specific answers based on their EXACT location — mention specific places, streets, walking distances, and what's open right now.`;
      } else {
        locationContext = `The user is somewhere in ${cityName}. It's ${dayOfWeek} ${timeLabel}. Give your best recommendations based on the time.`;
      }

      const quickAskPrompt = `${systemPrompt}\n\n${locationContext}\n\nThe user is asking you a quick question. Answer like a local friend standing right next to them — specific, opinionated, and genuinely helpful. Keep it to 3-5 sentences so it sounds natural when spoken aloud.`;

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: quickAskPrompt },
        ...history.map((h: { role: string; content: string }) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: question },
      ];

      const aiCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_completion_tokens: 500,
        temperature: 0.85,
      });

      const aiResponse = aiCompletion.choices[0]?.message?.content || "Sorry, I couldn't come up with anything right now.";

      let audioUrl = null;
      try {
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": elevenLabsApiKey,
            },
            body: JSON.stringify({
              text: aiResponse,
              model_id: "eleven_turbo_v2_5",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          }
        );

        if (ttsResponse.ok) {
          const ttsBuffer = await ttsResponse.arrayBuffer();
          const audioBuffer = Buffer.from(ttsBuffer);
          const audioId = `quick_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          audioStorage.set(audioId, audioBuffer);
          setTimeout(() => { audioStorage.delete(audioId); }, 5 * 60 * 1000);
          audioUrl = `/api/audio/${audioId}`;
        }
      } catch (ttsError) {
        console.error("Quick ask TTS error:", ttsError);
      }

      res.json({ response: aiResponse, audioUrl });
    } catch (error) {
      console.error("Quick ask error:", error);
      res.status(500).json({ error: "Failed to process quick ask" });
    }
  });

  app.post("/api/safety-pulse", async (req, res) => {
    try {
      const { cityId, latitude, longitude, timeOfDay = "day" } = req.body;

      if (!cityId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "cityId, latitude, and longitude are required" });
      }

      const systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const voiceIds: Record<string, string> = {
        nyc: "hU9xpIwLBrQ7ueYNjP7b",
        boston: "Gf1KYedBUv2F4rCJhVFJ",
        nashville: "Bj9UqZbhQsanLzgalpEG",
      };
      const voiceId = voiceIds[cityId];
      const cityName = cityId === "nyc" ? "New York City" : cityId === "boston" ? "Boston" : "Nashville";

      const safetyPrompt = `You are a hyper-local safety advisor and lifelong resident of ${cityName}. The user is at GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) and it's currently ${timeOfDay}.

${systemPrompt}

Generate a SAFETY PULSE briefing for this exact location and time. Include:
1. Overall safety assessment for this specific neighborhood RIGHT NOW (based on time of day)
2. Well-lit streets and recommended walking routes nearby
3. Areas or blocks to be cautious about, especially at this time
4. Nearest emergency services (hospitals, police stations, fire stations) — use your knowledge of ${cityName}
5. Local safety tips only a resident would know (e.g., "avoid the underpass on 3rd after dark", "the bodega on the corner is open 24/7 if you need help")
6. Transit safety — which stations/stops are well-staffed vs isolated at this hour

Speak like a protective local friend, not a police report. Be honest but not alarmist.
Keep the narration to 4-6 sentences (45-75 seconds when spoken).

Return JSON:
{
  "neighborhood": "Name of the neighborhood",
  "safetyLevel": "safe" | "moderate" | "caution" | "avoid",
  "narration": "Your spoken safety briefing — conversational, like a friend warning you...",
  "tips": ["tip1", "tip2", "tip3"],
  "emergencyNearby": [{"type": "hospital" | "police" | "fire", "name": "Name", "distance": "approximate distance"}],
  "wellLitAreas": "Description of well-lit, safe walking areas nearby",
  "transitSafety": "Transit safety info for this area and time"
}

Return ONLY valid JSON, no markdown.`;

      const geminiResponse = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: safetyPrompt }] }],
        config: { maxOutputTokens: 8192, temperature: 0.7 },
      });

      const rawResponse = geminiResponse.text || "{}";
      let result;
      try {
        const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse safety pulse response:", rawResponse);
        result = {
          neighborhood: "Unknown",
          safetyLevel: "moderate",
          narration: rawResponse.slice(0, 500),
          tips: [],
          emergencyNearby: [],
          wellLitAreas: "",
          transitSafety: "",
        };
      }

      let audioUrl = null;
      if (result.narration) {
        try {
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "xi-api-key": elevenLabsApiKey,
              },
              body: JSON.stringify({
                text: result.narration,
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.6, similarity_boost: 0.75 },
              }),
            }
          );

          if (ttsResponse.ok) {
            const ttsBuffer = await ttsResponse.arrayBuffer();
            const audioBuffer = Buffer.from(ttsBuffer);
            const audioId = `safety_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            audioStorage.set(audioId, audioBuffer);
            setTimeout(() => { audioStorage.delete(audioId); }, 10 * 60 * 1000);
            audioUrl = `/api/audio/${audioId}`;
          }
        } catch (ttsError) {
          console.error("Safety pulse TTS error:", ttsError);
        }
      }

      res.json({ ...result, audioUrl });
    } catch (error) {
      console.error("Safety pulse error:", error);
      res.status(500).json({ error: "Failed to generate safety pulse" });
    }
  });

  app.post("/api/neighborhood-pulse", async (req, res) => {
    try {
      const { cityId, latitude, longitude, timeOfDay = "day" } = req.body;

      if (!cityId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "cityId, latitude, and longitude are required" });
      }

      const systemPrompt = CITY_PROMPTS[cityId];
      if (!systemPrompt) {
        return res.status(400).json({ error: "Invalid city" });
      }

      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const voiceIds: Record<string, string> = {
        nyc: "hU9xpIwLBrQ7ueYNjP7b",
        boston: "Gf1KYedBUv2F4rCJhVFJ",
        nashville: "Bj9UqZbhQsanLzgalpEG",
      };
      const voiceId = voiceIds[cityId];
      const cityName = cityId === "nyc" ? "New York City" : cityId === "boston" ? "Boston" : "Nashville";
      const currentHour = new Date().getHours();
      const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

      const pulsePrompt = `You are a hyper-local neighborhood expert and lifelong resident of ${cityName}. The user is at GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). It's ${dayOfWeek}, ${timeOfDay} (around ${currentHour}:00).

${systemPrompt}

Generate a NEIGHBORHOOD PULSE — a real-time briefing about what's happening in this exact neighborhood RIGHT NOW. Include:
1. The current VIBE — what's the energy like in this area at this time? Busy? Quiet? Buzzing?
2. What's OPEN nearby — restaurants, cafes, bars, shops that are open right now
3. TRANSIT status — nearby subway/bus lines, typical conditions at this hour, any known issues
4. LOCAL EVENTS — anything happening today in this neighborhood (markets, shows, community events)
5. WEATHER AWARENESS — how weather typically affects this area (flooding spots, shade areas, wind tunnels)
6. CROWD LEVELS — how busy is this area typically at this time on a ${dayOfWeek}?
7. INSIDER TIP — one thing only a local would know about being here right now

Speak like an enthusiastic local friend giving the lowdown, not a news anchor.
Keep the narration to 4-6 sentences (45-75 seconds when spoken).

Return JSON:
{
  "neighborhood": "Name of the neighborhood",
  "vibe": "Description of current energy/atmosphere",
  "narration": "Your spoken neighborhood pulse — conversational, energetic...",
  "openNow": [{"name": "Place name", "type": "cafe" | "restaurant" | "bar" | "shop" | "venue", "note": "Why it's worth checking out"}],
  "transitTips": "Current transit situation and tips",
  "crowdLevel": "quiet" | "moderate" | "busy" | "packed",
  "localEvents": "Any events happening nearby today",
  "insiderTip": "One thing only a local would know right now"
}

Return ONLY valid JSON, no markdown.`;

      const geminiResponse = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: pulsePrompt }] }],
        config: { maxOutputTokens: 8192, temperature: 0.8 },
      });

      const rawResponse = geminiResponse.text || "{}";
      let result;
      try {
        const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse neighborhood pulse response:", rawResponse);
        result = {
          neighborhood: "Unknown",
          vibe: "",
          narration: rawResponse.slice(0, 500),
          openNow: [],
          transitTips: "",
          crowdLevel: "moderate",
          localEvents: "",
          insiderTip: "",
        };
      }

      let audioUrl = null;
      if (result.narration) {
        try {
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "xi-api-key": elevenLabsApiKey,
              },
              body: JSON.stringify({
                text: result.narration,
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
              }),
            }
          );

          if (ttsResponse.ok) {
            const ttsBuffer = await ttsResponse.arrayBuffer();
            const audioBuffer = Buffer.from(ttsBuffer);
            const audioId = `pulse_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            audioStorage.set(audioId, audioBuffer);
            setTimeout(() => { audioStorage.delete(audioId); }, 10 * 60 * 1000);
            audioUrl = `/api/audio/${audioId}`;
          }
        } catch (ttsError) {
          console.error("Neighborhood pulse TTS error:", ttsError);
        }
      }

      res.json({ ...result, audioUrl });
    } catch (error) {
      console.error("Neighborhood pulse error:", error);
      res.status(500).json({ error: "Failed to generate neighborhood pulse" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
