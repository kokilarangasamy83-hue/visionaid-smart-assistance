// VisionAid Global Voice Recognition & Intent Routing Engine
import { ttsService } from './ttsService';
import { audioFeedbackService } from './audioFeedbackService';
import { VoiceIntent, VoiceIntentType, AppRoute } from '../types';

type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'unsupported'
  | 'permission_denied'
  | 'error';

type StatusListener = (status: VoiceStatus, message?: string) => void;
type CommandListener = (intent: VoiceIntent) => void;

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

class VoiceControlService {
  private recognition: any = null;
  private isSupported: boolean = false;
  private isEnabled: boolean = false;
  private isRunning: boolean = false;
  private statusListeners: Set<StatusListener> = new Set();
  private commandListeners: Set<CommandListener> = new Set();
  private currentStatus: VoiceStatus = 'idle';
  private statusMessage: string = '';
  private lastTranscript: string = '';
  private restartTimeout: any = null;
  private isMutedForTTS: boolean = false;
  private recognitionRestartAttempts: number = 0;
  private isManuallyPaused: boolean = false;

  constructor() {
    this.initRecognition();
    // Subscribe to TTS to automatically discard recognition while VisionAid is speaking
    ttsService.subscribe((speaking) => {
      this.isMutedForTTS = speaking;
    });
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.isSupported = false;
      this.updateStatus('unsupported', 'Voice recognition is not supported in this browser. Please use Google Chrome.');
      return;
    }

    this.isSupported = true;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.isRunning = true;
        this.recognitionRestartAttempts = 0;
        this.updateStatus('listening', 'Listening for voice commands...');
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Drop any voice input received while VisionAid itself is speaking to prevent loopback
        if (this.isMutedForTTS) {
          return;
        }

        const latestResult = event.results[event.results.length - 1];
        if (latestResult && latestResult[0]) {
          const rawTranscript = latestResult[0].transcript || '';
          const confidence = latestResult[0].confidence || 0.9;
          this.handleTranscript(rawTranscript, confidence);
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          this.updateStatus(
            'permission_denied',
            'Microphone access is required for voice commands. Please allow microphone in Chrome site settings.'
          );
          this.isRunning = false;
          return;
        }

        if (error === 'no-speech') {
          // Normal silence timeout, keep listening
          return;
        }

        if (error === 'audio-capture') {
          this.updateStatus('error', 'Microphone hardware unavailable or already in use.');
          this.isRunning = false;
          return;
        }

        if (error === 'aborted') {
          return;
        }

        this.updateStatus('idle', `Voice recognition notice: ${error}`);
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        // Schedule controlled restart if voice control remains active
        if (this.isEnabled && !this.isManuallyPaused) {
          this.scheduleRestart();
        } else {
          this.updateStatus('idle', 'Voice control inactive');
        }
      };
    } catch (e: any) {
      console.warn('SpeechRecognition notice:', e);
      this.isSupported = false;
      this.updateStatus('unsupported', 'Voice control initialization failed.');
    }
  }

  /**
   * Explicitly requests microphone permission via getUserMedia
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop track immediately after permission confirmation
      stream.getTracks().forEach((t) => t.stop());
      this.start();
      return true;
    } catch (err: any) {
      this.updateStatus('permission_denied', 'Microphone permission was denied.');
      return false;
    }
  }

  private scheduleRestart() {
    clearTimeout(this.restartTimeout);
    if (!this.isEnabled || this.isManuallyPaused) return;

    // Avoid rapid restart loops
    const delay = Math.min(800 + this.recognitionRestartAttempts * 500, 3500);
    this.restartTimeout = setTimeout(() => {
      if (this.isEnabled && !this.isRunning && !this.isManuallyPaused && this.recognition) {
        try {
          this.recognitionRestartAttempts++;
          this.recognition.start();
        } catch {
          // May already be starting
        }
      }
    }, delay);
  }

  private updateStatus(status: VoiceStatus, message: string = '') {
    this.currentStatus = status;
    this.statusMessage = message;
    this.statusListeners.forEach((l) => l(status, message));
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus, this.statusMessage);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeCommand(listener: CommandListener): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  public start() {
    this.isEnabled = true;
    this.isManuallyPaused = false;
    if (!this.isSupported || !this.recognition) {
      this.updateStatus('unsupported', 'Voice recognition is not supported in this browser.');
      return;
    }

    if (!this.isRunning) {
      try {
        this.recognition.start();
      } catch (e) {
        // Already active
      }
    }
  }

  public stop() {
    this.isEnabled = false;
    this.isManuallyPaused = true;
    clearTimeout(this.restartTimeout);
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.updateStatus('idle', 'Voice control stopped');
  }

  public pause() {
    this.isManuallyPaused = true;
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public resume() {
    this.isManuallyPaused = false;
    if (this.isEnabled) {
      this.start();
    }
  }

  public getStatus(): { status: VoiceStatus; message: string; isSupported: boolean; isRunning: boolean } {
    return {
      status: this.currentStatus,
      message: this.statusMessage,
      isSupported: this.isSupported,
      isRunning: this.isRunning,
    };
  }

  public getLastTranscript(): string {
    return this.lastTranscript;
  }

  /**
   * Resilient Intent Parser normalizing punctuation, filler words, and regional variations
   */
  public parseIntent(rawText: string): VoiceIntent {
    // Strip punctuation and normalize extra spaces
    const clean = rawText
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');

    // 1. SMART VISION / OBJECT DETECTION
    if (
      clean.includes('smart vision') ||
      clean.includes('open smart vision') ||
      clean.includes('object detection') ||
      clean.includes('detect object') ||
      clean.includes('detect objects') ||
      clean.includes('identify object') ||
      clean.includes('identify objects') ||
      clean.includes('what objects') ||
      clean.includes('open object') ||
      clean.includes('objects around me') ||
      clean.includes('find objects') ||
      clean.includes('look around')
    ) {
      return { type: 'SMART_VISION', rawText, targetRoute: '/smart-vision' };
    }

    // 2. SMART TEXT READER
    if (
      clean.includes('text reader') ||
      clean.includes('read text') ||
      clean.includes('read this') ||
      clean.includes('smart read') ||
      clean.includes('read the text') ||
      clean.includes('smart text') ||
      clean.includes('read document') ||
      clean.includes('read sign') ||
      clean.includes('read board') ||
      clean.includes('scan text') ||
      clean.includes('read book') ||
      clean.includes('ocr')
    ) {
      return { type: 'TEXT_READER', rawText, targetRoute: '/text-reader' };
    }

    // 3. INDIAN CURRENCY RECOGNITION
    if (
      clean.includes('currency') ||
      clean.includes('identify currency') ||
      clean.includes('detect currency') ||
      clean.includes('what currency') ||
      clean.includes('currency recognition') ||
      clean.includes('identify this note') ||
      clean.includes('identify note') ||
      clean.includes('detect this note') ||
      clean.includes('what note is this') ||
      clean.includes('note recognition') ||
      clean.includes('rupee note') ||
      clean.includes('rupees') ||
      clean.includes('count money') ||
      clean.includes('check currency') ||
      clean.includes('detect cash')
    ) {
      return { type: 'CURRENCY', rawText, targetRoute: '/currency' };
    }

    // 4. OBSTACLE ALERT
    if (
      clean.includes('obstacle') ||
      clean.includes('detect obstacle') ||
      clean.includes('detect obstacles') ||
      clean.includes('obstacle alert') ||
      clean.includes('obstacle detection') ||
      clean.includes('what is in front of me') ||
      clean.includes('what is ahead') ||
      clean.includes('is path clear') ||
      clean.includes('hazard') ||
      clean.includes('collision alert')
    ) {
      return { type: 'OBSTACLE', rawText, targetRoute: '/obstacle-alert' };
    }

    // 5. SMART ASSIST / COMBINED ASSISTANCE
    if (
      clean.includes('smart assist') ||
      clean.includes('what can you see') ||
      clean.includes('what do you see') ||
      clean.includes('describe surroundings') ||
      clean.includes('scan surroundings') ||
      clean.includes('look around') ||
      clean.includes('describe scene') ||
      clean.includes('tell me what you see')
    ) {
      return { type: 'SMART_ASSIST', rawText, targetRoute: '/smart-assist' };
    }

    // 6. VOICE ASSISTANT PAGE
    if (
      clean.includes('voice assistant') ||
      clean.includes('open voice assistant') ||
      clean.includes('talk to assistant') ||
      clean.includes('hey vision') ||
      clean.includes('open assistant')
    ) {
      return { type: 'VOICE_ASSISTANT', rawText, targetRoute: '/voice-assistant' };
    }

    // 7. HOME / DASHBOARD
    if (
      clean === 'home' ||
      clean.includes('go home') ||
      clean.includes('dashboard') ||
      clean.includes('main menu') ||
      clean.includes('open dashboard') ||
      clean.includes('open home')
    ) {
      return { type: 'HOME', rawText, targetRoute: '/home' };
    }

    // 8. BACK
    if (
      clean === 'back' ||
      clean.includes('go back') ||
      clean.includes('previous page') ||
      clean.includes('return')
    ) {
      return { type: 'BACK', rawText };
    }

    // 9. LOGOUT
    if (
      clean.includes('log out') ||
      clean.includes('logout') ||
      clean.includes('sign out')
    ) {
      return { type: 'LOGOUT', rawText, targetRoute: '/login' };
    }

    // 10. REPEAT
    if (
      clean.includes('repeat') ||
      clean.includes('say again') ||
      clean.includes('repeat that') ||
      clean.includes('what did you say')
    ) {
      return { type: 'REPEAT', rawText };
    }

    // 11. STOP / SILENCE
    if (
      clean === 'stop' ||
      clean === 'pause' ||
      clean.includes('stop talking') ||
      clean.includes('be quiet') ||
      clean.includes('silence') ||
      clean.includes('cancel')
    ) {
      return { type: 'STOP', rawText };
    }

    // 12. HELP
    if (
      clean.includes('help') ||
      clean.includes('what can i say') ||
      clean.includes('commands') ||
      clean.includes('voice commands')
    ) {
      return { type: 'HELP', rawText };
    }

    return { type: 'UNKNOWN', rawText };
  }

  private handleTranscript(rawTranscript: string, confidence: number) {
    if (!rawTranscript.trim()) return;

    this.lastTranscript = rawTranscript;
    const intent = this.parseIntent(rawTranscript);
    intent.confidence = confidence;

    if (intent.type !== 'UNKNOWN') {
      audioFeedbackService.playCommandRecognized();
    }

    this.commandListeners.forEach((l) => l(intent));
  }
}

export const voiceControlService = new VoiceControlService();
