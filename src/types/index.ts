// VisionAid TypeScript Definitions

export interface User {
  id: string;
  name: string;
  email: string;
}

export type VisionModuleId =
  | 'smart-vision'
  | 'object-detection'
  | 'text-reader'
  | 'currency'
  | 'obstacle-alert'
  | 'smart-assist'
  | 'voice-assistant';

export type AppRoute =
  | '/login'
  | '/register'
  | '/home'
  | '/smart-vision'
  | '/object-detection'
  | '/text-reader'
  | '/currency'
  | '/obstacle-alert'
  | '/smart-assist'
  | '/voice-assistant';

export type SystemStatusState =
  | 'Camera Ready'
  | 'Listening'
  | 'Processing'
  | 'Detected'
  | 'Speaking'
  | 'Permission Required'
  | 'Idle'
  | 'Error';

export interface DetectedObject {
  label: string;
  confidence: number;
  box: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  position: 'left' | 'center' | 'right' | 'nearby' | string;
}

export interface ObjectDetectionResult {
  objects: DetectedObject[];
  speechSummary: string;
  debugModel?: string;
}

export interface TextReaderResult {
  hasText: boolean;
  detectedText: string;
  language: string;
  speechSummary: string;
  wordCount: number;
  debugModel?: string;
}

export interface CurrencyResult {
  isCurrency: boolean;
  denomination: 10 | 20 | 50 | 100 | 200 | 500 | 0 | null;
  confidence: number;
  noteDetails: string;
  speechSummary: string;
  requiresSteadierView: boolean;
  debugModel?: string;
}

export interface ObstacleItem {
  label: string;
  proximity: 'immediate' | 'close' | 'moderate' | string;
  direction: 'left' | 'center' | 'right' | string;
  urgency: 'high' | 'medium' | 'low' | string;
}

export interface ObstacleResult {
  hasObstacle: boolean;
  obstacles: ObstacleItem[];
  highestUrgency: 'high' | 'medium' | 'low' | 'none';
  speechSummary: string;
  debugModel?: string;
}

export interface SmartAssistResult {
  speechSummary: string;
  fullSceneDescription: string;
  sceneType: string;
  keyElements: {
    peopleCount: number;
    prominentObjects: string[];
    textDetected: string;
    obstacles: string[];
    currencyIdentified: string;
  };
  debugModel?: string;
}

export interface DiagnosticsData {
  cameraStatus: string;
  videoPlaying: boolean;
  videoDimensions: string;
  videoReadyState: number;
  frameCaptured: boolean;
  frameSizeKb: number;
  lastCaptureTime: string;
  inferenceStatus: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  modelUsed: string;
  apiStatus: string;
  latencyMs: number;
  lastResultSummary: string;
  lastError: string;
}

export interface VoiceAssistantResult {
  spokenResponse: string;
  action: string;
}

export type VoiceIntentType =
  | 'SMART_VISION'
  | 'OBJECT_DETECTION'
  | 'TEXT_READER'
  | 'CURRENCY'
  | 'OBSTACLE'
  | 'SMART_ASSIST'
  | 'VOICE_ASSISTANT'
  | 'HOME'
  | 'BACK'
  | 'LOGOUT'
  | 'REPEAT'
  | 'STOP'
  | 'HELP'
  | 'UNKNOWN';

export interface VoiceIntent {
  type: VoiceIntentType;
  rawText: string;
  confidence?: number;
  targetRoute?: AppRoute;
}
