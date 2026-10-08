import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import { SmartAssistResult } from '../types';
import {
  Sparkles,
  ArrowLeft,
  Volume2,
  Users,
  Box,
  FileText,
  ShieldAlert,
  Play,
  Pause,
  Eye,
  Banknote,
} from 'lucide-react';

interface SmartAssistPageProps {
  onNavigate: (path: string) => void;
}

export const SmartAssistPage: React.FC<SmartAssistPageProps> = ({ onNavigate }) => {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [assistResult, setAssistResult] = useState<SmartAssistResult | null>(null);
  const [isAutoActive, setIsAutoActive] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastAnnouncedSpeech, setLastAnnouncedSpeech] = useState<string>('');
  const processingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setSystemStatus, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    isMountedRef.current = true;
    ttsService.speak('Smart Assist active. Analyzing your surroundings.', {
      urgent: true,
      category: 'module-nav',
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const analyzeScene = useCallback(async (isManual = false) => {
    if (!cameraRef.current || processingRef.current || !isMountedRef.current) return;

    // Optimized: maxWidth 640 and quality 0.78 for fast scene synthesis
    const frameBase64 = cameraRef.current.captureFrame(640, 0.78, isManual);
    if (!frameBase64) return;

    processingRef.current = true;
    setIsProcessing(true);
    setSystemStatus('Processing', 'Synthesizing scene description...');

    let nextAdaptiveDelay = 2200;

    try {
      abortControllerRef.current = new AbortController();
      const result: SmartAssistResult = await visionApiService.getSmartAssist(
        frameBase64,
        abortControllerRef.current.signal
      );

      if (!isMountedRef.current) return;
      const uiT0 = performance.now();
      setAssistResult(result);
      requestAnimationFrame(() => {
        diagnosticsService.update({
          uiUpdateTimeMs: Math.round(performance.now() - uiT0),
        });
      });

      if (result.speechSummary) {
        setSystemStatus('Detected', 'Scene synthesized.');

        if (result.speechSummary !== lastAnnouncedSpeech) {
          setLastAnnouncedSpeech(result.speechSummary);
          ttsService.speak(result.speechSummary, {
            cooldownMs: 6000,
            category: 'smart-assist-speech',
          });
        }
        nextAdaptiveDelay = 2200;
      } else {
        setSystemStatus('Camera Ready', 'Camera stream active.');
        nextAdaptiveDelay = 1200;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSystemStatus('Camera Ready', 'Surroundings active.');
      }
      nextAdaptiveDelay = 1500;
    } finally {
      processingRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
        if (isAutoActive) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMountedRef.current && isAutoActive) {
              analyzeScene(false);
            }
          }, nextAdaptiveDelay);
        }
      }
    }
  }, [setSystemStatus, lastAnnouncedSpeech, isAutoActive]);

  // Initial trigger once camera is ready
  const onCameraReady = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && isAutoActive && !processingRef.current) {
        analyzeScene(false);
      }
    }, 250);
  }, [isAutoActive, analyzeScene]);

  const toggleAuto = () => {
    const next = !isAutoActive;
    setIsAutoActive(next);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next) {
      ttsService.speak('Smart assist automatic updates resumed.');
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current && !processingRef.current) {
          analyzeScene(false);
        }
      }, 150);
    } else {
      ttsService.speak('Smart assist updates paused.');
    }
  };

  const manualAnalyze = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    ttsService.speak('Analyzing what I see.');
    analyzeScene(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
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

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">Smart Assist</h1>
            <p className="text-xs opacity-80 hidden sm:block">Combined Surroundings Intelligence</p>
          </div>
        </div>

        <button
          onClick={toggleAuto}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? isAutoActive
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
              : isAutoActive
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 focus:ring-purple-300'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-400'
          }`}
          aria-label={isAutoActive ? 'Pause smart assist' : 'Resume smart assist'}
        >
          {isAutoActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isAutoActive ? 'Assist: ON' : 'Assist: PAUSED'}
          </span>
        </button>
      </div>

      {/* Main Grid: Camera + Smart Narrative */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[420px] sm:h-[480px]">
            <CameraView
              ref={cameraRef}
              guidanceMode="default"
              onCameraReady={() => {
                setTimeout(() => analyzeScene(), 1000);
              }}
              className="h-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={manualAnalyze}
              disabled={isProcessing}
              className={`flex-1 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white focus:ring-purple-300 shadow-purple-600/30'
              } ${isProcessing ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}`}
            >
              <Eye className="w-5 h-5" />
              <span>{isProcessing ? 'Synthesizing...' : 'Describe Surroundings Now'}</span>
            </button>
          </div>
        </div>

        {/* Multimodal Scene Narrative */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl border-2 flex flex-col justify-between ${
            isYellow
              ? 'bg-black border-[#FFE600] text-[#FFE600]'
              : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-inherit/30 mb-4">
              <h2 className="text-lg font-black uppercase tracking-wider">
                Scene Narrative
              </h2>
              {assistResult?.sceneType && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 capitalize">
                  {assistResult.sceneType} Environment
                </span>
              )}
            </div>

            {/* Primary Verbal Audio Description */}
            {assistResult?.speechSummary ? (
              <div
                className={`p-4 rounded-xl border mb-5 font-bold text-base leading-relaxed ${
                  isYellow
                    ? 'bg-neutral-900 border-[#FFE600]'
                    : 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-xs uppercase font-black text-purple-400">
                  <Volume2 className="w-4 h-4" />
                  <span>Audio Narrative</span>
                </div>
                <p>"{assistResult.speechSummary}"</p>
              </div>
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-inherit/30 rounded-xl mb-5 opacity-75">
                <Sparkles className="w-10 h-10 mx-auto mb-2 text-purple-400 animate-pulse" />
                <p className="font-bold text-sm">Synthesizing Scene</p>
                <p className="text-xs opacity-75 mt-1">Smart Assist is analyzing people, objects, and signs.</p>
              </div>
            )}

            {/* Key Breakdown Elements */}
            {assistResult?.keyElements && (
              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="p-3 rounded-xl border border-inherit/30 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold">People in View:</span>
                  </div>
                  <span className="font-mono font-bold">
                    {assistResult.keyElements.peopleCount > 0
                      ? `${assistResult.keyElements.peopleCount} person(s)`
                      : 'None'}
                  </span>
                </div>

                {assistResult.keyElements.prominentObjects?.length > 0 && (
                  <div className="p-3 rounded-xl border border-inherit/30 bg-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="w-4 h-4 text-blue-400" />
                      <span className="font-bold">Prominent Items:</span>
                    </div>
                    <p className="opacity-80 capitalize">
                      {assistResult.keyElements.prominentObjects.join(', ')}
                    </p>
                  </div>
                )}

                {assistResult.keyElements.textDetected && (
                  <div className="p-3 rounded-xl border border-inherit/30 bg-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">Text Found:</span>
                    </div>
                    <p className="opacity-80 italic">
                      "{assistResult.keyElements.textDetected}"
                    </p>
                  </div>
                )}

                {assistResult.keyElements.currencyIdentified && (
                  <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">Currency:</span>
                      <span>{assistResult.keyElements.currencyIdentified}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-inherit/30">
            <button
              onClick={() => {
                if (assistResult?.speechSummary) {
                  ttsService.speak(assistResult.speechSummary, { urgent: true });
                } else {
                  ttsService.speak('Smart Assist is actively processing your surroundings.');
                }
              }}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 focus:ring-purple-400'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Repeat Scene Description</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
