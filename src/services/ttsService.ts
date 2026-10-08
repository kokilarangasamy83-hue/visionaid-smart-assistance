// VisionAid Centralized Text-To-Speech Engine
import { diagnosticsService } from './diagnosticsService';

type SpeechStateListener = (speaking: boolean, currentText: string) => void;

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private speechRate: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private listeners: Set<SpeechStateListener> = new Set();
  private lastSpokenTexts: Map<string, number> = new Map(); // key -> timestamp for deduplication cooldown
  private isCurrentlySpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer high quality English voices (Google US English, Samantha, Daniel, Natural)
    const preferred = voices.find(
      (v) =>
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium'))) ||
        v.lang === 'en-US' ||
        v.lang === 'en-IN' ||
        v.lang === 'en-GB'
    );
    this.selectedVoice = preferred || voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  public subscribe(listener: SpeechStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(speaking: boolean, text: string) {
    this.isCurrentlySpeaking = speaking;
    this.listeners.forEach((l) => l(speaking, text));
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking || (this.synth?.speaking ?? false);
  }

  public setRate(rate: number) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public getRate(): number {
    return this.speechRate;
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
    this.notify(false, '');
  }

  /**
   * Speak text with priority, cancellation, and cooldown deduplication.
   * @param text Text to speak
   * @param options { urgent?: boolean; cooldownMs?: number; category?: string }
   */
  public speak(
    text: string,
    options: {
      urgent?: boolean;
      cooldownMs?: number;
      category?: string;
      onEnd?: () => void;
    } = {}
  ): boolean {
    if (!this.synth || !text || !text.trim()) return false;

    const trimmed = text.trim();
    const cooldown = options.cooldownMs ?? 3000;
    const cacheKey = (options.category ? options.category + ':' : '') + trimmed.toLowerCase();
    const now = Date.now();

    // Check deduplication unless explicitly urgent
    if (!options.urgent && cooldown > 0) {
      const lastTime = this.lastSpokenTexts.get(cacheKey);
      if (lastTime && now - lastTime < cooldown) {
        // Cooldown active, skip repeating
        return false;
      }
    }

    this.lastSpokenTexts.set(cacheKey, now);

    // If urgent or new request, cancel current ongoing speech to ensure responsiveness
    this.synth.cancel();
    const speakT0 = performance.now();

    // Small timeout ensures clean state in mobile Chrome
    setTimeout(() => {
      if (!this.synth) return;
      const utterance = new SpeechSynthesisUtterance(trimmed);

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.speechRate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onstart = () => {
        const delayMs = Math.round(performance.now() - speakT0);
        diagnosticsService.update({ speechDelayMs: delayMs });
        this.notify(true, trimmed);
      };

      utterance.onend = () => {
        this.notify(false, '');
        if (options.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        // Interrupted/canceled is normal when a newer message supersedes
        this.notify(false, '');
        if (options.onEnd) options.onEnd();
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    }, 40);

    return true;
  }
}

export const ttsService = new TTSService();
