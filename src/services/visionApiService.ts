// VisionAid Vision API Client with Performance Latency Telemetry
import {
  ObjectDetectionResult,
  TextReaderResult,
  CurrencyResult,
  ObstacleResult,
  SmartAssistResult,
  VoiceAssistantResult,
} from '../types';
import { diagnosticsService } from './diagnosticsService';

class VisionApiService {
  private getAuthHeader(): Record<string, string> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('visionaid_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async executeVisionCall<T>(
    endpoint: string,
    payload: any,
    signal?: AbortSignal
  ): Promise<T> {
    const t0 = performance.now();
    diagnosticsService.update({
      inferenceStatus: 'RUNNING',
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal,
      });

      const roundTripMs = Math.round(performance.now() - t0);
      const serverInferenceMs = parseInt(res.headers.get('X-Inference-Time-Ms') || '0', 10);
      const cacheHit = res.headers.get('X-Cache') === 'HIT';

      const parseT0 = performance.now();
      const data = await res.json();
      const parseDurationMs = Math.round(performance.now() - parseT0);
      const totalLatency = Math.round(performance.now() - t0);

      diagnosticsService.update({
        inferenceStatus: 'COMPLETE',
        apiRoundTripMs: roundTripMs,
        serverInferenceMs,
        cacheHit,
        parseDurationMs,
        totalDetectionLatencyMs: totalLatency,
        inferencesCount: diagnosticsService.getMetrics().inferencesCount + 1,
        lastResultSummary: data.speechSummary || data.spokenResponse || 'Processed',
      });

      return data as T;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        diagnosticsService.update({
          inferenceStatus: 'FAILED',
          lastError: err.message || 'Request failed',
        });
      }
      throw err;
    }
  }

  public async detectObjects(image: string, signal?: AbortSignal): Promise<ObjectDetectionResult> {
    return this.executeVisionCall<ObjectDetectionResult>('/api/vision/detect-objects', { image }, signal);
  }

  public async readText(image: string, signal?: AbortSignal): Promise<TextReaderResult> {
    return this.executeVisionCall<TextReaderResult>('/api/vision/read-text', { image }, signal);
  }

  public async recognizeCurrency(image: string, signal?: AbortSignal): Promise<CurrencyResult> {
    return this.executeVisionCall<CurrencyResult>('/api/vision/recognize-currency', { image }, signal);
  }

  public async checkObstacles(image: string, signal?: AbortSignal): Promise<ObstacleResult> {
    return this.executeVisionCall<ObstacleResult>('/api/vision/obstacle-alert', { image }, signal);
  }

  public async getSmartAssist(image: string, signal?: AbortSignal): Promise<SmartAssistResult> {
    return this.executeVisionCall<SmartAssistResult>('/api/vision/smart-assist', { image }, signal);
  }

  public async queryAssistant(query: string, image?: string, signal?: AbortSignal): Promise<VoiceAssistantResult> {
    return this.executeVisionCall<VoiceAssistantResult>('/api/vision/assistant-query', { query, image }, signal);
  }
}

export const visionApiService = new VisionApiService();
