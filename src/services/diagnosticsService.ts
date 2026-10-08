// VisionAid Performance Diagnostics & Telemetry Service

export interface PerformanceMetrics {
  cameraStatus: 'READY' | 'ERROR' | 'IDLE' | 'REQUESTING';
  cameraStartupTimeMs: number;
  videoReadinessTimeMs: number;
  videoPlaying: boolean;
  videoResolution: string; // e.g. 1280x720
  frameStatus: 'CAPTURED' | 'FAILED' | 'IDLE';
  frameSizeKb: number;
  frameCaptureTimeMs: number;
  imageConversionTimeMs: number;
  preprocessingTimeMs: number;
  motionScore: number;
  inferenceStatus: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  inferenceDurationMs: number;
  apiRoundTripMs: number;
  serverInferenceMs: number;
  parseDurationMs: number;
  cacheHit: boolean;
  confirmationStatus: 'idle' | 'verifying' | 'confirmed' | 'unsteady';
  temporalConfirmationTimeMs: number;
  uiUpdateTimeMs: number;
  speechDelayMs: number;
  totalDetectionLatencyMs: number;
  inferencesCount: number;
  lastResultSummary: string;
  lastError: string;
}

type DiagnosticsListener = (metrics: PerformanceMetrics) => void;

class DiagnosticsService {
  private metrics: PerformanceMetrics = {
    cameraStatus: 'IDLE',
    cameraStartupTimeMs: 0,
    videoReadinessTimeMs: 0,
    videoPlaying: false,
    videoResolution: '0x0',
    frameStatus: 'IDLE',
    frameSizeKb: 0,
    frameCaptureTimeMs: 0,
    imageConversionTimeMs: 0,
    preprocessingTimeMs: 0,
    motionScore: 0,
    inferenceStatus: 'IDLE',
    inferenceDurationMs: 0,
    apiRoundTripMs: 0,
    serverInferenceMs: 0,
    parseDurationMs: 0,
    cacheHit: false,
    confirmationStatus: 'idle',
    temporalConfirmationTimeMs: 0,
    uiUpdateTimeMs: 0,
    speechDelayMs: 0,
    totalDetectionLatencyMs: 0,
    inferencesCount: 0,
    lastResultSummary: 'Ready',
    lastError: '',
  };

  private listeners: Set<DiagnosticsListener> = new Set();
  private isEnabled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('visionaid_diagnostics_enabled');
      this.isEnabled = saved === 'true';
    }
  }

  public subscribe(listener: DiagnosticsListener): () => void {
    this.listeners.add(listener);
    listener(this.metrics);
    return () => this.listeners.delete(listener);
  }

  public toggleEnabled(): boolean {
    this.isEnabled = !this.isEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('visionaid_diagnostics_enabled', String(this.isEnabled));
    }
    this.notify();
    return this.isEnabled;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public update(partial: Partial<PerformanceMetrics>) {
    this.metrics = { ...this.metrics, ...partial };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l(this.metrics));
  }
}

export const diagnosticsService = new DiagnosticsService();
