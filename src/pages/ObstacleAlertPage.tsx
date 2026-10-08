import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { audioFeedbackService } from '../services/audioFeedbackService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import { ObstacleResult, ObstacleItem } from '../types';
import {
  ShieldAlert,
  ArrowLeft,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Compass,
  Footprints,
} from 'lucide-react';

interface ObstacleAlertPageProps {
  onNavigate: (path: string) => void;
}

export const ObstacleAlertPage: React.FC<ObstacleAlertPageProps> = ({ onNavigate }) => {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [obstacleResult, setObstacleResult] = useState<ObstacleResult | null>(null);
  const [isAutoMonitoring, setIsAutoMonitoring] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastAlertText, setLastAlertText] = useState<string>('');
  const processingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setSystemStatus, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    isMountedRef.current = true;
    ttsService.speak('Obstacle Alert active. Monitoring your walking path.', {
      urgent: true,
      category: 'module-nav',
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const processObstacleFrame = useCallback(async (isManual = false) => {
    if (!cameraRef.current || processingRef.current || !isMountedRef.current) return;

    // Optimized: maxWidth 640 and quality 0.78 for low latency walking path monitoring
    const frameBase64 = cameraRef.current.captureFrame(640, 0.78, isManual);
    if (!frameBase64) return;

    processingRef.current = true;
    setIsProcessing(true);
    setSystemStatus('Processing', 'Scanning path for obstacles...');

    let nextAdaptiveDelay = 900;

    try {
      abortControllerRef.current = new AbortController();
      const result: ObstacleResult = await visionApiService.checkObstacles(
        frameBase64,
        abortControllerRef.current.signal
      );

      if (!isMountedRef.current) return;
      const uiT0 = performance.now();
      setObstacleResult(result);
      requestAnimationFrame(() => {
        diagnosticsService.update({
          uiUpdateTimeMs: Math.round(performance.now() - uiT0),
        });
      });

      if (result.hasObstacle && result.obstacles && result.obstacles.length > 0) {
        setSystemStatus('Detected', `${result.obstacles.length} obstacle(s) detected.`);

        // Sound earcon ping for hazard awareness
        if (result.highestUrgency === 'high' || result.highestUrgency === 'medium') {
          audioFeedbackService.playObstacleAlert(result.highestUrgency as 'high' | 'medium');
        }

        // Spoken alert with deduplication
        if (result.speechSummary && result.speechSummary !== lastAlertText) {
          setLastAlertText(result.speechSummary);
          ttsService.speak(result.speechSummary, {
            urgent: result.highestUrgency === 'high',
            cooldownMs: 4000,
            category: 'obstacle-alert',
          });
        }
        // Safety critical: if high-urgency obstacle ahead, fast adaptive follow-up (400ms)
        nextAdaptiveDelay = result.highestUrgency === 'high' ? 400 : 800;
      } else {
        setSystemStatus('Camera Ready', 'Path ahead appears clear.');
        nextAdaptiveDelay = 1000;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSystemStatus('Camera Ready', 'Monitoring walking path.');
      }
      nextAdaptiveDelay = 1200;
    } finally {
      processingRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
        if (isAutoMonitoring) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMountedRef.current && isAutoMonitoring) {
              processObstacleFrame(false);
            }
          }, nextAdaptiveDelay);
        }
      }
    }
  }, [setSystemStatus, lastAlertText, isAutoMonitoring]);

  // Initial trigger once camera is ready
  const onCameraReady = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && isAutoMonitoring && !processingRef.current) {
        processObstacleFrame(false);
      }
    }, 200);
  }, [isAutoMonitoring, processObstacleFrame]);

  const toggleAuto = () => {
    const next = !isAutoMonitoring;
    setIsAutoMonitoring(next);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next) {
      ttsService.speak('Obstacle monitoring resumed.');
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current && !processingRef.current) {
          processObstacleFrame(false);
        }
      }, 150);
    } else {
      ttsService.speak('Obstacle monitoring paused.');
    }
  };

  const manualCheck = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    ttsService.speak('Checking path for obstacles.');
    processObstacleFrame(true);
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
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">Obstacle Alert</h1>
            <p className="text-xs opacity-80 hidden sm:block">Walking Safety & Hazard Detection</p>
          </div>
        </div>

        <button
          onClick={toggleAuto}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? isAutoMonitoring
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
              : isAutoMonitoring
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30 focus:ring-amber-300'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-400'
          }`}
          aria-label={isAutoMonitoring ? 'Pause obstacle monitoring' : 'Resume obstacle monitoring'}
        >
          {isAutoMonitoring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isAutoMonitoring ? 'Monitor: ON' : 'Monitor: PAUSED'}
          </span>
        </button>
      </div>

      {/* Main Grid: Camera with path guides + Alert cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[420px] sm:h-[480px]">
            <CameraView
              ref={cameraRef}
              guidanceMode="obstacle"
              guidanceText="Aim camera forward at your walking path"
              onCameraReady={onCameraReady}
              className="h-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={manualCheck}
              disabled={isProcessing}
              className={`flex-1 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-300 shadow-amber-600/30'
              } ${isProcessing ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}`}
            >
              <Footprints className="w-5 h-5" />
              <span>{isProcessing ? 'Scanning Path...' : 'Scan Path Ahead'}</span>
            </button>
          </div>
        </div>

        {/* Status & Hazard Warnings Panel */}
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
                Path Status
              </h2>
              {obstacleResult?.highestUrgency && (
                <span
                  className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                    obstacleResult.highestUrgency === 'high'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500'
                      : obstacleResult.highestUrgency === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                  }`}
                >
                  Urgency: {obstacleResult.highestUrgency}
                </span>
              )}
            </div>

            {/* Urgent Audio Announcement Box */}
            {obstacleResult?.speechSummary ? (
              <div
                className={`p-4 rounded-xl border mb-5 font-bold text-base leading-relaxed ${
                  obstacleResult.highestUrgency === 'high'
                    ? 'bg-rose-950/50 border-rose-500 text-rose-200'
                    : obstacleResult.highestUrgency === 'medium'
                    ? 'bg-amber-950/50 border-amber-500 text-amber-200'
                    : 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs uppercase font-black">
                  <Volume2 className="w-4 h-4" />
                  <span>Current Audio Warning</span>
                </div>
                <p>"{obstacleResult.speechSummary}"</p>
              </div>
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-inherit/30 rounded-xl mb-5 opacity-75">
                <Footprints className="w-10 h-10 mx-auto mb-2 text-amber-400" />
                <p className="font-bold text-sm">Path monitoring active</p>
                <p className="text-xs opacity-80 mt-1">Obstacles in path will trigger audio warnings.</p>
              </div>
            )}

            {/* List of obstacles */}
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
              {!obstacleResult?.obstacles || obstacleResult.obstacles.length === 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-center gap-3 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>No immediate obstacles detected in direct path.</span>
                </div>
              ) : (
                obstacleResult.obstacles.map((obs, i) => (
                  <div
                    key={`${obs.label}-${i}`}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${
                      obs.urgency === 'high'
                        ? 'border-rose-500/60 bg-rose-950/30'
                        : obs.urgency === 'medium'
                        ? 'border-amber-500/60 bg-amber-950/30'
                        : 'border-inherit/30 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle
                        className={`w-4 h-4 flex-shrink-0 ${
                          obs.urgency === 'high' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <div>
                        <p className="font-extrabold capitalize text-base">{obs.label}</p>
                        <p className="text-xs opacity-75 capitalize">
                          {obs.proximity} proximity • {obs.direction} path
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        obs.urgency === 'high'
                          ? 'bg-rose-900 text-rose-200'
                          : 'bg-amber-900 text-amber-200'
                      }`}
                    >
                      {obs.urgency}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-inherit/30">
            <button
              onClick={() => {
                if (obstacleResult?.speechSummary) {
                  ttsService.speak(obstacleResult.speechSummary, { urgent: true });
                } else {
                  ttsService.speak('Path is currently clear.');
                }
              }}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 focus:ring-amber-400'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Repeat Obstacle Warning</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
