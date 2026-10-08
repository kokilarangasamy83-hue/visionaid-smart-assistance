import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import { DetectedObject, ObjectDetectionResult } from '../types';
import {
  Boxes,
  ArrowLeft,
  Camera,
  Play,
  Pause,
  Volume2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface ObjectDetectionPageProps {
  onNavigate: (path: string) => void;
}

export const ObjectDetectionPage: React.FC<ObjectDetectionPageProps> = ({ onNavigate }) => {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [speechSummary, setSpeechSummary] = useState<string>('');
  const [isAutoProcessing, setIsAutoProcessing] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // Deduplication tracking refs
  const lastSpokenSummaryRef = useRef<string>('');
  const lastKnownLabelsRef = useRef<string>('');
  const lastAnnouncedTimestampRef = useRef<number>(0);
  const processingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setSystemStatus, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  // Orientation announcement on mount
  useEffect(() => {
    isMountedRef.current = true;
    ttsService.speak('Smart Vision active. Point camera at your surroundings.', {
      urgent: true,
      category: 'module-nav',
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Frame processing handler
  const processFrame = useCallback(async (isManual = false) => {
    if (!cameraRef.current || processingRef.current || !isMountedRef.current) return;

    // Optimized: maxWidth 640 and quality 0.78 for fast transfer and inference
    const frameBase64 = cameraRef.current.captureFrame(640, 0.78, isManual);
    if (!frameBase64) return;

    processingRef.current = true;
    setIsProcessing(true);
    setSystemStatus('Processing', 'Detecting objects in frame...');

    let nextAdaptiveDelay = 900;

    try {
      abortControllerRef.current = new AbortController();
      const result: ObjectDetectionResult = await visionApiService.detectObjects(
        frameBase64,
        abortControllerRef.current.signal
      );

      if (!isMountedRef.current) return;
      const uiT0 = performance.now();
      const objects = result.objects || [];
      setDetectedObjects(objects);
      setSpeechSummary(result.speechSummary || '');
      setLastCheckTime(new Date().toLocaleTimeString());
      requestAnimationFrame(() => {
        diagnosticsService.update({
          uiUpdateTimeMs: Math.round(performance.now() - uiT0),
        });
      });

      if (objects.length > 0) {
        setSystemStatus('Detected', `Found ${objects.length} object(s).`);

        // Create normalized label signature to prevent repeating same objects continuously
        const currentLabelsSignature = objects
          .map((o) => o.label.toLowerCase())
          .sort()
          .join(',');

        const now = Date.now();
        const isNewObjectPresent = currentLabelsSignature !== lastKnownLabelsRef.current;
        const cooldownElapsed = now - lastAnnouncedTimestampRef.current > 12000;

        if (result.speechSummary && (isNewObjectPresent || cooldownElapsed)) {
          lastKnownLabelsRef.current = currentLabelsSignature;
          lastSpokenSummaryRef.current = result.speechSummary;
          lastAnnouncedTimestampRef.current = now;

          ttsService.speak(result.speechSummary, {
            cooldownMs: 5000,
            category: 'object-detection',
          });
        }
        nextAdaptiveDelay = isNewObjectPresent ? 1000 : 1600;
      } else {
        setSystemStatus('Camera Ready', 'No prominent objects in view.');
        lastKnownLabelsRef.current = '';
        nextAdaptiveDelay = 800;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSystemStatus('Camera Ready', 'Ready to scan surroundings.');
      }
      nextAdaptiveDelay = 1200;
    } finally {
      processingRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
        if (isAutoProcessing) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMountedRef.current && isAutoProcessing) {
              processFrame(false);
            }
          }, nextAdaptiveDelay);
        }
      }
    }
  }, [setSystemStatus, isAutoProcessing]);

  // Initial trigger once camera is ready
  const onCameraReady = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && isAutoProcessing && !processingRef.current) {
        processFrame(false);
      }
    }, 200);
  }, [isAutoProcessing, processFrame]);

  const toggleAuto = () => {
    const next = !isAutoProcessing;
    setIsAutoProcessing(next);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next) {
      ttsService.speak('Automatic object detection resumed.');
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current && !processingRef.current) {
          processFrame(false);
        }
      }, 150);
    } else {
      ttsService.speak('Automatic detection paused.');
    }
  };

  const manualScan = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastKnownLabelsRef.current = '';
    ttsService.speak('Scanning objects now.');
    processFrame(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header bar */}
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
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">Smart Vision</h1>
            <p className="text-xs opacity-80 hidden sm:block">Real-Time Object & Spatial Detection</p>
          </div>
        </div>

        {/* Auto toggle */}
        <button
          onClick={toggleAuto}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? isAutoProcessing
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
              : isAutoProcessing
              ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30 focus:ring-cyan-300'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-400'
          }`}
          aria-label={isAutoProcessing ? 'Pause automatic scanning' : 'Resume automatic scanning'}
        >
          {isAutoProcessing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isAutoProcessing ? 'Auto: ON' : 'Auto: PAUSED'}
          </span>
        </button>
      </div>

      {/* Main Grid: Camera feed + Detection status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large live camera */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="h-[420px] sm:h-[480px]">
            <CameraView
              ref={cameraRef}
              guidanceMode="default"
              detectedObjects={detectedObjects}
              onCameraReady={onCameraReady}
              className="h-full"
            />
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={manualScan}
              disabled={isProcessing}
              className={`flex-1 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-white focus:ring-cyan-300'
              } ${isProcessing ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}`}
            >
              <Camera className="w-5 h-5" />
              <span>{isProcessing ? 'Analyzing...' : 'Scan Objects Now'}</span>
            </button>

            {speechSummary && (
              <button
                onClick={() => ttsService.speak(speechSummary, { urgent: true })}
                className={`p-3.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                  isYellow
                    ? 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
                    : 'bg-slate-800 text-cyan-400 hover:bg-slate-700 focus:ring-cyan-400'
                }`}
                title="Speak results aloud"
                aria-label="Repeat audio announcement"
              >
                <Volume2 className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Detection Results Sidebar */}
        <div
          className={`p-6 rounded-2xl border-2 flex flex-col justify-between ${
            isYellow
              ? 'bg-black border-[#FFE600] text-[#FFE600]'
              : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-inherit/30 mb-4">
              <h2 className="text-lg font-black uppercase tracking-wider">
                Detected Objects
              </h2>
              {lastCheckTime && (
                <span className="text-xs opacity-75 font-mono">{lastCheckTime}</span>
              )}
            </div>

            {/* Spoken summary banner */}
            {speechSummary ? (
              <div
                className={`p-4 rounded-xl border mb-4 font-bold text-sm leading-relaxed ${
                  isYellow
                    ? 'bg-neutral-900 border-[#FFE600]'
                    : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs uppercase font-extrabold text-cyan-400">
                  <Volume2 className="w-4 h-4" />
                  <span>Spoken Announcement</span>
                </div>
                <p>"{speechSummary}"</p>
              </div>
            ) : (
              <p className="text-sm opacity-75 italic mb-4">
                Scanning area automatically. Detected objects will appear below.
              </p>
            )}

            {/* List of detected objects */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {detectedObjects.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-inherit/30 rounded-xl opacity-60 text-sm">
                  No objects identified in current view.
                </div>
              ) : (
                detectedObjects.map((obj, i) => (
                  <div
                    key={`${obj.label}-${i}`}
                    className="p-3 rounded-xl border border-inherit/40 bg-white/5 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="font-extrabold capitalize">{obj.label}</p>
                        <p className="text-xs opacity-75 capitalize">
                          Position: {obj.position || 'center'}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded text-xs">
                      {obj.confidence}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Voice instruction footer */}
          <div className="mt-6 pt-4 border-t border-inherit/30 text-xs opacity-80 flex items-center gap-2">
            <span className="font-bold text-cyan-400">Voice Navigation:</span>
            <span>Say "Go home" or "Read text" anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
