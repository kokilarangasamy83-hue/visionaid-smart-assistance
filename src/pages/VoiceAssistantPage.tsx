import React, { useState, useEffect, useRef } from 'react';
import { voiceControlService } from '../services/voiceControlService';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { cameraService } from '../services/cameraService';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  ArrowLeft,
  Volume2,
  Send,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Camera,
  LogOut,
} from 'lucide-react';

interface VoiceAssistantPageProps {
  onNavigate: (path: string) => void;
}

export const VoiceAssistantPage: React.FC<VoiceAssistantPageProps> = ({ onNavigate }) => {
  const [transcript, setTranscript] = useState<string>('');
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const [micState, setMicState] = useState<'listening' | 'idle' | 'permission_denied' | 'unsupported'>('listening');
  const [inputText, setInputText] = useState<string>('');

  const { theme } = useAccessibility();
  const { logout } = useAuth();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    const status = voiceControlService.getStatus();
    setVoiceSupported(status.isSupported);
    if (!status.isSupported) {
      setMicState('unsupported');
    }

    ttsService.speak('Voice Assistant ready. What can I help you with?', {
      urgent: true,
      category: 'assistant-intro',
    });

    const unsubCommand = voiceControlService.subscribeCommand((intent) => {
      setTranscript(intent.rawText);
      handleAssistantQuery(intent.rawText);
    });

    const unsubStatus = voiceControlService.subscribeStatus((st) => {
      if (st === 'permission_denied') setMicState('permission_denied');
      else if (st === 'unsupported') setMicState('unsupported');
      else if (st === 'listening') setMicState('listening');
      else setMicState('idle');
    });

    return () => {
      unsubCommand();
      unsubStatus();
    };
  }, []);

  const handleAssistantQuery = async (queryText: string) => {
    if (!queryText.trim() || isAnswering) return;

    setIsAnswering(true);
    try {
      // Check if current camera stream has active frame to provide multimodal scene context
      let currentFrame: string | null = null;
      const stream = cameraService.getStream();
      if (stream) {
        // Capture frame if video is running
        const dummyVideo = document.querySelector('video') as HTMLVideoElement | null;
        if (dummyVideo) {
          currentFrame = cameraService.captureFrame(dummyVideo);
        }
      }

      const res = await visionApiService.queryAssistant(queryText, currentFrame || undefined);
      setAssistantReply(res.spokenResponse);

      // Speak response aloud with guarded navigation execution
      let actionExecuted = false;
      const runActionOnce = () => {
        if (!actionExecuted && res.action && res.action !== 'NONE') {
          actionExecuted = true;
          executeAction(res.action);
        }
      };

      ttsService.speak(res.spokenResponse, {
        urgent: true,
        onEnd: runActionOnce,
      });

      if (res.action && res.action !== 'NONE') {
        setTimeout(runActionOnce, 2500);
      }
    } catch (e: any) {
      const fallback = 'I heard you, but could not process the request right now.';
      setAssistantReply(fallback);
      ttsService.speak(fallback);
    } finally {
      setIsAnswering(false);
    }
  };

  const executeAction = (action: string) => {
    switch (action) {
      case 'NAV_OBJECTS':
        onNavigate('/object-detection');
        break;
      case 'NAV_TEXT':
        onNavigate('/text-reader');
        break;
      case 'NAV_CURRENCY':
        onNavigate('/currency');
        break;
      case 'NAV_OBSTACLE':
        onNavigate('/obstacle-alert');
        break;
      case 'NAV_SMART_ASSIST':
        onNavigate('/smart-assist');
        break;
      case 'NAV_HOME':
        onNavigate('/home');
        break;
      case 'NAV_LOGOUT':
        logout();
        onNavigate('/login');
        break;
      default:
        break;
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setTranscript(inputText);
    handleAssistantQuery(inputText);
    setInputText('');
  };

  const quickPrompts = [
    'Open currency recognition',
    'What can you see right now?',
    'Open smart text reader',
    'Detect obstacles in my path',
    'Go back to home dashboard',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={() => onNavigate('/home')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? 'bg-[#FFE600] text-black focus:ring-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100 focus:ring-cyan-400'
          }`}
          aria-label="Return to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-black">Voice Assistant</h1>

        <button
          onClick={() => {
            logout();
            onNavigate('/login');
          }}
          className={`p-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? 'bg-red-700 text-white focus:ring-white'
              : 'bg-red-950 text-red-200 border border-red-800 hover:bg-red-900 focus:ring-red-400'
          }`}
          title="Log Out"
          aria-label="Log Out of VisionAid"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Microphone Interaction Hero */}
      <div
        className={`p-8 sm:p-12 rounded-3xl border-2 text-center shadow-2xl mb-8 relative overflow-hidden transition-all ${
          isYellow
            ? 'bg-black border-[#FFE600] text-[#FFE600]'
            : 'bg-slate-900/90 border-cyan-500/40 text-slate-100 shadow-cyan-950/20'
        }`}
      >
        {/* Large pulsing microphone orb */}
        <div className="relative mx-auto w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center mb-6">
          {micState === 'listening' && (
            <>
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
              <div className="absolute -inset-3 rounded-full bg-cyan-400/10 animate-pulse" />
            </>
          )}

          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center shadow-2xl transition-transform ${
              isYellow
                ? 'bg-[#FFE600] text-black ring-4 ring-white'
                : micState === 'listening'
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/40 ring-4 ring-cyan-400/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {micState === 'listening' ? (
              <Mic className="w-14 h-14 sm:w-16 sm:h-16 animate-pulse" />
            ) : (
              <MicOff className="w-14 h-14 sm:w-16 sm:h-16" />
            )}
          </div>
        </div>

        {/* Current status display */}
        <div className="mb-4">
          <span
            className={`inline-block text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2 ${
              isYellow
                ? 'bg-[#FFE600] text-black'
                : micState === 'listening'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isAnswering
              ? 'Analyzing Question...'
              : micState === 'listening'
              ? 'Listening for your voice...'
              : 'Microphone Standby'}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black">
            {isAnswering
              ? 'Processing...'
              : micState === 'listening'
              ? 'Speak Naturally'
              : 'Voice Input Standby'}
          </h2>
        </div>

        {/* Browser compatibility notice if unsupported */}
        {!voiceSupported && (
          <div
            role="alert"
            className="p-4 rounded-xl border border-rose-500 bg-rose-950/60 text-rose-200 text-sm font-bold max-w-lg mx-auto mb-4"
          >
            Voice recognition is not supported in this browser. Please use a supported Chrome browser.
          </div>
        )}

        {/* User transcript and Assistant response */}
        <div className="max-w-2xl mx-auto space-y-4 text-left mt-6">
          {transcript && (
            <div
              className={`p-4 rounded-2xl border ${
                isYellow
                  ? 'bg-neutral-900 border-[#FFE600]'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <span className="text-xs uppercase font-extrabold tracking-wider text-cyan-400 block mb-1">
                You Said:
              </span>
              <p className="text-lg font-bold italic">"{transcript}"</p>
            </div>
          )}

          {assistantReply && (
            <div
              className={`p-5 rounded-2xl border shadow-lg ${
                isYellow
                  ? 'bg-[#FFE600]/10 border-[#FFE600] text-[#FFE600]'
                  : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">
                  Assistant Response:
                </span>
                <button
                  onClick={() => ttsService.speak(assistantReply, { urgent: true })}
                  className="p-1 rounded hover:bg-white/10"
                  aria-label="Repeat assistant response"
                >
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
              <p className="text-lg sm:text-xl font-bold leading-relaxed">
                {assistantReply}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Prompts Suggestions */}
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-wider opacity-75 mb-3 text-center sm:text-left">
          Try Saying Any of These:
        </p>
        <div className="flex flex-wrap gap-2.5 justify-center sm:justify-start">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => {
                setTranscript(p);
                handleAssistantQuery(p);
              }}
              className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-black border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600]/10 focus:ring-white'
                  : 'bg-slate-900/80 border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-white focus:ring-cyan-400'
              }`}
            >
              "{p}"
            </button>
          ))}
        </div>
      </div>

      {/* Accessible Text Fallback Input */}
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Or type a question / command here..."
          className={`flex-1 px-4 py-3.5 rounded-xl border-2 font-medium text-base focus:outline-none focus:ring-4 ${
            isYellow
              ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
              : 'bg-slate-900 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
          }`}
        />
        <button
          type="submit"
          className={`px-6 py-3.5 rounded-xl font-black flex items-center gap-2 focus:outline-none focus:ring-4 ${
            isYellow
              ? 'bg-[#FFE600] text-black focus:ring-white'
              : 'bg-cyan-500 hover:bg-cyan-400 text-white focus:ring-cyan-300'
          }`}
          aria-label="Send query"
        >
          <Send className="w-5 h-5" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </div>
  );
};
