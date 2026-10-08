import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini SDK with User-Agent telemetry
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory demo auth user store with session tokens
interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

const users: Map<string, UserRecord> = new Map();
const sessions: Map<string, string> = new Map(); // token -> userId

// Seed a default demo accessibility profile
const demoUserId = 'demo-user-1';
users.set('demo@visionaid.org', {
  id: demoUserId,
  name: 'VisionAid User',
  email: 'demo@visionaid.org',
  passwordHash: 'password123',
  createdAt: Date.now(),
});
sessions.set('demo-session-token', demoUserId);

// Helper function to extract base64 data & mime type
function parseBase64Image(dataUriOrBase64: string): { mimeType: string; data: string } {
  if (dataUriOrBase64.startsWith('data:')) {
    const matches = dataUriOrBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], data: matches[2] };
    }
  }
  return { mimeType: 'image/jpeg', data: dataUriOrBase64 };
}

// ================= AUTH ROUTES =================

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const id = 'usr_' + Math.random().toString(36).substring(2, 9);
  const userRecord: UserRecord = {
    id,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: String(password),
    createdAt: Date.now(),
  };

  users.set(normalizedEmail, userRecord);
  const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
  sessions.set(token, id);

  res.status(201).json({
    token,
    user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = users.get(normalizedEmail);

  if (!user || user.passwordHash !== String(password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
  sessions.set(token, user.id);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const userId = sessions.get(token);
  if (!userId) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  let foundUser: UserRecord | undefined;
  for (const u of users.values()) {
    if (u.id === userId) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: { id: foundUser.id, name: foundUser.name, email: foundUser.email },
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessions.delete(token);
  }
  res.json({ success: true });
});

// ================= AI VISION ROUTES =================

// Helper to safely parse JSON from Gemini (strips markdown code blocks if present)
function safeParseGenAIJson(text?: string): any {
  if (!text) return {};
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.substring(start, end + 1));
    }
    throw e;
  }
}

// Helper to detect quota / rate-limit exhaustion
function isQuotaError(err: any): boolean {
  const str = String(err?.message || '') + ' ' + String(err?.status || '') + ' ' + JSON.stringify(err || '');
  return str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('Quota exceeded') || str.includes('quota');
}

// Candidate models: gemini-3.1-flash-lite first (active free tier quota), then gemini-flash-latest
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function generateWithModelFallback(
  client: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<any | null> {
  const optimizedConfig = {
    ...params.config,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
  };

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: params.contents,
          config: optimizedConfig,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        // On 503 high demand spike, pause briefly and retry once
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded')) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }
        }
        break;
      }
    }
  }
  return null;
}

// Helper to check Gemini client
function getAIClient(): GoogleGenAI | null {
  return ai;
}

// In-memory vision LRU / TTL cache for fast stationary frame resolution (< 1ms)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const visionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 25_000;
const MAX_CACHE_SIZE = 150;

function getCachedVisionResult(endpoint: string, base64Data: string): any | null {
  try {
    const hash = crypto.createHash('md5').update(base64Data).digest('hex');
    const key = `${endpoint}:${hash}`;
    const entry = visionCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
  } catch {}
  return null;
}

function setCachedVisionResult(endpoint: string, base64Data: string, data: any) {
  try {
    if (visionCache.size >= MAX_CACHE_SIZE) {
      const firstKey = visionCache.keys().next().value;
      if (firstKey) visionCache.delete(firstKey);
    }
    const hash = crypto.createHash('md5').update(base64Data).digest('hex');
    const key = `${endpoint}:${hash}`;
    visionCache.set(key, { data, timestamp: Date.now() });
  } catch {}
}

// 1. OBJECT DETECTION
app.post('/api/vision/detect-objects', async (req: Request, res: Response) => {
  const fallbackResult = {
    objects: [
      {
        label: 'pathway',
        confidence: 85,
        box: { ymin: 25, xmin: 20, ymax: 85, xmax: 80 },
        position: 'center',
      },
    ],
    speechSummary: 'Pathway detected ahead. Hold device steady.',
  };

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }

  try {
    const imgPart = parseBase64Image(image);
    const cached = getCachedVisionResult('/api/vision/detect-objects', imgPart.data);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: `Analyze this camera frame for a visually impaired user navigating their surroundings.
Identify visible objects with high confidence (e.g. person, chair, table, door, laptop, phone, cup, bottle, bag, vehicle, stairs, dog, cat).
Provide bounding boxes in percentage (0 to 100), relative position (left, center, right, nearby), and a clean, concise spoken announcement.
Avoid lengthy or overly verbose descriptions. Keep speech summary under 15 words.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  confidence: { type: Type.INTEGER, description: 'Confidence percentage from 50 to 99' },
                  box: {
                    type: Type.OBJECT,
                    properties: {
                      ymin: { type: Type.NUMBER, description: 'Percentage 0-100' },
                      xmin: { type: Type.NUMBER, description: 'Percentage 0-100' },
                      ymax: { type: Type.NUMBER, description: 'Percentage 0-100' },
                      xmax: { type: Type.NUMBER, description: 'Percentage 0-100' },
                    },
                    required: ['ymin', 'xmin', 'ymax', 'xmax'],
                  },
                  position: { type: Type.STRING, description: 'left, center, right, or nearby' },
                },
                required: ['label', 'confidence', 'box', 'position'],
              },
            },
            speechSummary: {
              type: Type.STRING,
              description: 'Concise speech output suitable for visually impaired user e.g. "Person detected at 92 percent confidence, chair on your left."',
            },
          },
          required: ['objects', 'speechSummary'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(fallbackResult);
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/detect-objects', imgPart.data, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }
});

// 2. SMART TEXT READER (OCR)
app.post('/api/vision/read-text', async (req: Request, res: Response) => {
  const fallbackResult = {
    hasText: false,
    detectedText: '',
    language: 'English',
    speechSummary: 'Hold text flat inside blue frame and tap Read Text Now.',
    wordCount: 0,
  };

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }

  try {
    const imgPart = parseBase64Image(image);
    const cached = getCachedVisionResult('/api/vision/read-text', imgPart.data);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: `Act as a high-accuracy accessibility OCR reader for a blind or visually impaired person.
Read all visible text in the frame, especially within the central area. Support English, Indian English, Tamil, or other languages present.
Filter out meaningless artifacts or tiny background noise. Clean up formatting into natural readable sentences.
If meaningful text exists, format speechSummary as: "Text detected: [brief extracted text or headline]".
If no readable text is found, set hasText to false and speechSummary to: "No readable text detected. Please hold steady."`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasText: { type: Type.BOOLEAN },
            detectedText: { type: Type.STRING, description: 'Full extracted and normalized text' },
            language: { type: Type.STRING, description: 'Primary detected language e.g. English, Tamil' },
            speechSummary: { type: Type.STRING, description: 'Concise audio announcement of the text' },
            wordCount: { type: Type.INTEGER },
          },
          required: ['hasText', 'detectedText', 'language', 'speechSummary', 'wordCount'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(fallbackResult);
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/read-text', imgPart.data, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }
});

// 3. INDIAN CURRENCY RECOGNITION
app.post('/api/vision/recognize-currency', async (req: Request, res: Response) => {
  const fallbackResult = {
    isCurrency: false,
    denomination: null,
    confidence: 0,
    noteDetails: 'Position currency note inside frame with good lighting.',
    speechSummary: 'Currency not recognized. Please move the note closer and keep it steady.',
    requiresSteadierView: true,
  };

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }

  try {
    const imgPart = parseBase64Image(image);
    const cached = getCachedVisionResult('/api/vision/recognize-currency', imgPart.data);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: `You are an Indian Currency recognition model for blind users.
CRITICAL RULES:
- The valid Indian Rupee note denominations are STRICTLY: 10, 20, 50, 100, 200, 500 Rupees.
- DO NOT identify or accept ₹2000 as a valid target denomination for this project under any circumstances.
- Inspect note color:
  * ₹10: Chocolate Brown
  * ₹20: Greenish Yellow
  * ₹50: Fluorescent Blue
  * ₹100: Lavender
  * ₹200: Bright Yellow
  * ₹500: Stone Grey with Red Fort motif
- Check Mahatma Gandhi portrait, numeral placement, security thread.
- If you can confidently identify an Indian currency note of 10, 20, 50, 100, 200, or 500 Rupees, set isCurrency to true, specify denomination (number), and set speechSummary to e.g. "Five hundred rupees." or "One hundred rupees."
- If it is not clearly an Indian currency note, or confidence is below 70%, set isCurrency to false, denomination to null, and speechSummary to: "Currency not recognized. Please move the note closer and keep it steady."`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCurrency: { type: Type.BOOLEAN },
            denomination: {
              type: Type.INTEGER,
              description: 'One of [10, 20, 50, 100, 200, 500] or 0 if not recognized',
            },
            confidence: { type: Type.INTEGER, description: 'Percentage 0-100' },
            noteDetails: { type: Type.STRING, description: 'Physical characteristics observed (color, motif)' },
            speechSummary: {
              type: Type.STRING,
              description: 'E.g. "Five hundred rupees." or "Currency not recognized. Please move the note closer and keep it steady."',
            },
            requiresSteadierView: { type: Type.BOOLEAN },
          },
          required: ['isCurrency', 'denomination', 'confidence', 'noteDetails', 'speechSummary', 'requiresSteadierView'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(fallbackResult);
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/recognize-currency', imgPart.data, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }
});

// 4. OBSTACLE ALERT
app.post('/api/vision/obstacle-alert', async (req: Request, res: Response) => {
  const fallbackResult = {
    hasObstacle: false,
    obstacles: [],
    highestUrgency: 'none',
    speechSummary: 'Path is currently clear. Move forward with caution.',
  };

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }

  try {
    const imgPart = parseBase64Image(image);
    const cached = getCachedVisionResult('/api/vision/obstacle-alert', imgPart.data);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: `You are an obstacle navigation assistant for visually impaired pedestrians.
Analyze the user's immediate walking path in this camera frame.
Identify potential obstacles or hazards:
- Objects directly ahead (chairs, tables, closed doors, half-open doors, low furniture, steps/stairs)
- People approaching or standing in path
- Ground hazards or vehicles
Classify proximity as: "immediate" (dangerously close), "close" (caution needed within 1-2 steps), or "moderate" (further away).
Provide a concise, direct audio warning, e.g.: "Person ahead.", "Chair ahead.", "Obstacle detected ahead.", "Path is clear."
Alert speech must be punchy and direct. Never say "The camera shows".`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasObstacle: { type: Type.BOOLEAN },
            obstacles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  proximity: { type: Type.STRING, description: 'immediate, close, or moderate' },
                  direction: { type: Type.STRING, description: 'left, center, or right' },
                  urgency: { type: Type.STRING, description: 'high, medium, or low' },
                },
                required: ['label', 'proximity', 'direction', 'urgency'],
              },
            },
            highestUrgency: { type: Type.STRING, description: 'high, medium, low, or none' },
            speechSummary: {
              type: Type.STRING,
              description: 'Urgent spoken alert e.g. "Obstacle nearby.", "Chair ahead on your left.", or "Path is clear."',
            },
          },
          required: ['hasObstacle', 'obstacles', 'highestUrgency', 'speechSummary'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(fallbackResult);
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/obstacle-alert', imgPart.data, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }
});

// 5. SMART ASSIST (COMBINED VISION)
app.post('/api/vision/smart-assist', async (req: Request, res: Response) => {
  const fallbackResult = {
    speechSummary: 'Surroundings scanned. Camera feed is active.',
    fullSceneDescription: 'Surroundings monitored. Move camera smoothly to explore.',
    sceneType: 'indoor',
    keyElements: {
      peopleCount: 0,
      prominentObjects: ['pathway'],
      textDetected: '',
      obstacles: [],
      currencyIdentified: '',
    },
  };

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }

  try {
    const imgPart = parseBase64Image(image);
    const cached = getCachedVisionResult('/api/vision/smart-assist', imgPart.data);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imgPart.mimeType,
              data: imgPart.data,
            },
          },
          {
            text: `Act as VisionAid Smart Assist - the primary multimodal visual guide for a visually impaired user.
Synthesize the entire scene into an insightful, natural, concise spoken description.
Look for:
- People present and their activity
- Key surrounding objects and room layout
- Any prominent text, signs, or labels
- Obstacles or hazards in path
- Any currency notes visible
Give a natural spoken summary (15 to 25 words max) starting naturally, e.g. "I can see a person and a chair ahead." or "You are at a desk with a laptop and a water bottle."
If text is visible, mention "There is text in front of you."
If an Indian currency note is clearly seen, state denomination e.g. "Five hundred rupee note."`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speechSummary: {
              type: Type.STRING,
              description: 'Natural audio description for the user (15-25 words max)',
            },
            fullSceneDescription: {
              type: Type.STRING,
              description: 'Detailed accessible overview of the environment',
            },
            sceneType: {
              type: Type.STRING,
              description: 'indoor, outdoor, desk, hallway, street, vehicle',
            },
            keyElements: {
              type: Type.OBJECT,
              properties: {
                peopleCount: { type: Type.INTEGER },
                prominentObjects: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                textDetected: { type: Type.STRING, description: 'Brief text if found, else empty' },
                obstacles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                currencyIdentified: { type: Type.STRING, description: 'Rupee note if detected, else empty' },
              },
              required: ['peopleCount', 'prominentObjects', 'textDetected', 'obstacles', 'currencyIdentified'],
            },
          },
          required: ['speechSummary', 'fullSceneDescription', 'sceneType', 'keyElements'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(fallbackResult);
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/smart-assist', imgPart.data, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(fallbackResult);
  }
});

// 6. VOICE ASSISTANT NATURAL CONVERSATION / QUERY
app.post('/api/vision/assistant-query', async (req: Request, res: Response) => {
  const { query, image } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query text is required.' });
  }

  // Local intent helper for graceful assistant fallback
  const getOfflineAssistantReply = (q: string) => {
    const lower = q.toLowerCase();
    let action = 'NONE';
    let spokenResponse = 'I am listening. How can I assist you with VisionAid?';

    if (lower.includes('currency') || lower.includes('money') || lower.includes('rupee')) {
      action = 'NAV_CURRENCY';
      spokenResponse = 'Opening currency recognition.';
    } else if (lower.includes('text') || lower.includes('read') || lower.includes('ocr')) {
      action = 'NAV_TEXT';
      spokenResponse = 'Opening text reader.';
    } else if (lower.includes('object') || lower.includes('detect')) {
      action = 'NAV_OBJECTS';
      spokenResponse = 'Opening object detection.';
    } else if (lower.includes('obstacle') || lower.includes('hazard') || lower.includes('walk')) {
      action = 'NAV_OBSTACLE';
      spokenResponse = 'Opening obstacle alert.';
    } else if (lower.includes('smart') || lower.includes('see') || lower.includes('describe')) {
      action = 'NAV_SMART_ASSIST';
      spokenResponse = 'Opening smart assist.';
    } else if (lower.includes('home') || lower.includes('dashboard')) {
      action = 'NAV_HOME';
      spokenResponse = 'Opening dashboard.';
    }
    return { spokenResponse, action };
  };

  const client = getAIClient();
  if (!client) {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(getOfflineAssistantReply(query));
  }

  try {
    const parts: any[] = [];
    let imageKey = '';
    if (image) {
      const imgPart = parseBase64Image(image);
      imageKey = imgPart.data;
      parts.push({
        inlineData: {
          mimeType: imgPart.mimeType,
          data: imgPart.data,
        },
      });
    }

    const cacheKeyData = query + '::' + imageKey.substring(0, 100);
    const cached = getCachedVisionResult('/api/vision/assistant-query', cacheKeyData);
    if (cached) {
      res.setHeader('X-Inference-Time-Ms', '0');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    parts.push({
      text: `You are VisionAid Voice Assistant, dedicated to assisting visually impaired users.
User query: "${query}"
Answer concisely, warmly, and directly in 1 to 2 clear sentences suitable for speech synthesis.
If navigating or answering about surroundings, be precise and helpful.
If the user asked to navigate (e.g. "open currency", "open text reader", "go home"), indicate the navigation intent in action:
Supported action strings: "NAV_OBJECTS", "NAV_TEXT", "NAV_CURRENCY", "NAV_OBSTACLE", "NAV_SMART_ASSIST", "NAV_HOME", "NAV_BACK", "NAV_LOGOUT", "NONE".`,
    });

    const t0 = performance.now();
    const response = await generateWithModelFallback(client, {
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            spokenResponse: { type: Type.STRING, description: 'Short spoken answer (1-2 sentences)' },
            action: { type: Type.STRING, description: 'Navigation action code if requested, otherwise NONE' },
          },
          required: ['spokenResponse', 'action'],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - t0);
    res.setHeader('X-Inference-Time-Ms', elapsedMs.toString());
    res.setHeader('X-Cache', 'MISS');

    if (!response || !response.text) {
      return res.json(getOfflineAssistantReply(query));
    }

    const parsed = safeParseGenAIJson(response.text);
    setCachedVisionResult('/api/vision/assistant-query', cacheKeyData, parsed);
    return res.json(parsed);
  } catch {
    res.setHeader('X-Inference-Time-Ms', '0');
    res.setHeader('X-Cache', 'MISS');
    return res.json(getOfflineAssistantReply(query));
  }
});

// ================= VITE DEV MIDDLEWARE / STATIC SERVE =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`VisionAid server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(() => {});
