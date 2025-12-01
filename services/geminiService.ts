import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini Flash Lite for fast, low-latency responses.
 */
export const getFastHealthAdvice = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful, concise health assistant. Provide immediate, brief answers relevant to blood pressure and blood sugar management.",
      }
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Fast advice error:", error);
    return "Sorry, I couldn't fetch a quick response right now.";
  }
};

/**
 * Uses Gemini Pro 3 with Thinking Mode for deep analysis.
 */
export const getDeepThinkingAnalysis = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 32768,
        },
      }
    });
    return response.text || "Analysis complete, but no text returned.";
  } catch (error) {
    console.error("Thinking analysis error:", error);
    return "Deep analysis failed. Please try again.";
  }
};

/**
 * Analyzes an image using Gemini Pro Vision.
 */
export const analyzeHealthImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });
    return response.text || "I processed the image but found nothing to report.";
  } catch (error) {
    console.error("Image analysis error:", error);
    return "Unable to analyze the image at this moment.";
  }
};

/**
 * Generates an image using Gemini Pro Image Preview.
 */
export const generateRelaxationImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '1K',
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};

// --- Live API Helpers ---

export type LiveSessionCallbacks = {
  onOpen?: () => void;
  onMessage?: (message: LiveServerMessage) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
};

/**
 * Connects to Gemini Live API
 */
export const connectToLiveSession = async (callbacks: LiveSessionCallbacks) => {
  return await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      systemInstruction: `You are an expert AI Doctor performing a live telehealth consultation.
      
      CRITICAL: I have overlaid real-time vital signs text directly onto the video feed I am sending you.
      
      INSTRUCTIONS:
      1. **READ THE DATA**: Look at the top/bottom of the video frames for text like "BP: 120/80", "HR: 75", "Sugar: 90".
      2. **CONTEXTUAL ADVICE**: Use these specific numbers to provide advice. If BP is high (>140), warn me. If Sugar is high (>140), ask about my last meal.
      3. **VISUAL CHECK**: Look at my face for symptoms (pallor, sweating, fatigue).
      4. **BREVITY**: Keep answers concise (max 2 sentences) and conversational.
      5. **LANGUAGE**: Speak fluently in the language I speak to you in.
      
      Start by briefly acknowledging my current stats if they are visible.`,
    },
    callbacks: {
      onopen: () => callbacks.onOpen?.(),
      onmessage: (msg) => callbacks.onMessage?.(msg),
      onerror: (err) => callbacks.onError?.(err),
      onclose: () => callbacks.onClose?.(),
    }
  });
};

/**
 * Helper to convert Float32Array (Web Audio API) to Int16Array (PCM) and then base64
 */
export const float32To16BitPCMBase64 = (float32: Float32Array): string => {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    // Clamp values
    let s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Decodes base64 string to audio buffer
 */
export const base64ToAudioBuffer = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convert Int16 PCM to Float32
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }

  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  return buffer;
};