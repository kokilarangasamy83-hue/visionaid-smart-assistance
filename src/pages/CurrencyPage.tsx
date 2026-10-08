import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import { CurrencyResult } from '../types';
import {
  Banknote,
  ArrowLeft,
  Volume2,
  CheckCircle,
  Play,
  Pause,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface CurrencyPageProps {
  onNavigate: (path: string) => void;
}

export const CurrencyPage: React.FC<CurrencyPageProps> = ({ onNavigate }) => {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [currencyResult, setCurrencyResult] = useState<CurrencyResult | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confirmedDenomination, setConfirmedDenomination] = useState<number | null>(null);
  const [temporalState, setTemporalState] = useState<'verifying' | 'confirmed' | 'unsteady' | 'idle'>('idle');

  // Temporal confirmation history refs
  const historyRef = useRef<Array<{ denomination: number; confidence: number }>>([]);
  const lastAnnouncedDenomRef = useRef<number | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);
  const verificationStartRef = useRef<number>(0);
  const processingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setSystemStatus, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    isMountedRef.current = true;
    ttsService.speak('Currency Recognition active. Hold an Indian currency note flat in front of the camera.', {
      urgent: true,
      category: 'module-nav',
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const denominationColors: Record<number, { bg: string; text: string; border: string; name: string }> = {
    10: { bg: 'bg-amber-950', text: 'text-amber-300', border: 'border-amber-600', name: 'Chocolate Brown (₹10)' },
    20: { bg: 'bg-lime-950', text: 'text-lime-300', border: 'border-lime-600', name: 'Greenish Yellow (₹20)' },
    50: { bg: 'bg-cyan-950', text: 'text-cyan-300', border: 'border-cyan-600', name: 'Fluorescent Blue (₹50)' },
    100: { bg: 'bg-purple-950', text: 'text-purple-300', border: 'border-purple-600', name: 'Lavender (₹100)' },
    200: { bg: 'bg-yellow-950', text: 'text-yellow-300', border: 'border-yellow-500', name: 'Bright Yellow (₹200)' },
    500: { bg: 'bg-stone-900', text: 'text-stone-300', border: 'border-stone-500', name: 'Stone Grey (₹500)' },
  };

  const speakDenominationAmount = (denom: number) => {
    let spokenAmount = '';
    switch (denom) {
      case 500:
        spokenAmount = 'Five hundred rupees.';
        break;
      case 200:
        spokenAmount = 'Two hundred rupees.';
        break;
      case 100:
        spokenAmount = 'One hundred rupees.';
        break;
      case 50:
        spokenAmount = 'Fifty rupees.';
        break;
      case 20:
        spokenAmount = 'Twenty rupees.';
        break;
      case 10:
        spokenAmount = 'Ten rupees.';
        break;
      default:
        spokenAmount = `${denom} rupees.`;
    }

    ttsService.speak(spokenAmount, {
      urgent: true,
      cooldownMs: 6000,
      category: 'currency-announcement',
    });
  };

  const processCurrencyFrame = useCallback(async (isManual = false) => {
    if (!cameraRef.current || processingRef.current || !isMountedRef.current) return;

    // Optimized: maxWidth 640 and quality 0.78 reduces payload by ~70% without sacrificing accuracy
    const frameBase64 = cameraRef.current.captureFrame(640, 0.78, isManual);
    if (!frameBase64) return;

    processingRef.current = true;
    setIsProcessing(true);
    setSystemStatus('Processing', 'Analyzing Indian banknote...');

    let nextAdaptiveDelay = 800; // default schedule delay

    try {
      abortControllerRef.current = new AbortController();
      const result: CurrencyResult = await visionApiService.recognizeCurrency(
        frameBase64,
        abortControllerRef.current.signal
      );

      if (!isMountedRef.current) return;
      const uiT0 = performance.now();
      setCurrencyResult(result);
      requestAnimationFrame(() => {
        diagnosticsService.update({
          uiUpdateTimeMs: Math.round(performance.now() - uiT0),
        });
      });

      if (
        result.isCurrency &&
        result.denomination &&
        [10, 20, 50, 100, 200, 500].includes(result.denomination) &&
        result.confidence >= 65
      ) {
        consecutiveFailuresRef.current = 0;
        const currentHist = [...historyRef.current.slice(-2), { denomination: result.denomination, confidence: result.confidence }];
        historyRef.current = currentHist;

        // Temporal confirmation check:
        // Either:
        // 1) High confidence (>= 88%)
        // 2) Or at least 2 consecutive frames agreeing on the same denomination
        const isConsecutiveMatch =
          currentHist.length >= 2 &&
          currentHist[currentHist.length - 1].denomination === currentHist[currentHist.length - 2].denomination;

        const isVeryHighConfidence = result.confidence >= 88;

        if (isConsecutiveMatch || isVeryHighConfidence) {
          const confMs = verificationStartRef.current ? Math.round(performance.now() - verificationStartRef.current) : 0;
          setConfirmedDenomination(result.denomination);
          setTemporalState('confirmed');
          setSystemStatus('Detected', `₹${result.denomination} confirmed.`);
          diagnosticsService.update({
            confirmationStatus: 'confirmed',
            temporalConfirmationTimeMs: confMs,
          });

          // Only speak if this denomination hasn't been announced yet in current session, or cooled down
          if (result.denomination !== lastAnnouncedDenomRef.current) {
            lastAnnouncedDenomRef.current = result.denomination;
            speakDenominationAmount(result.denomination);
          }
          // Note confirmed: pace down to conserve bandwidth while note remains in view
          nextAdaptiveDelay = 2000;
        } else {
          // In verification phase across frames: FAST adaptive follow-up (250ms) for prompt confirmation!
          if (!verificationStartRef.current) {
            verificationStartRef.current = performance.now();
          }
          setTemporalState('verifying');
          setSystemStatus('Processing', `Verifying ₹${result.denomination}... hold steady`);
          diagnosticsService.update({
            confirmationStatus: 'verifying',
          });
          nextAdaptiveDelay = 250;
        }
      } else {
        historyRef.current = [];
        verificationStartRef.current = 0;
        consecutiveFailuresRef.current++;

        if (consecutiveFailuresRef.current >= 3) {
          setTemporalState('unsteady');
          setSystemStatus('Camera Ready', 'Currency not recognized. Hold note steady.');
          diagnosticsService.update({
            confirmationStatus: 'unsteady',
          });
          ttsService.speak('Currency not recognized. Please move the note closer and keep it steady.', {
            cooldownMs: 8000,
            category: 'currency-unsteady',
          });
          nextAdaptiveDelay = 1200;
        } else {
          setSystemStatus('Camera Ready', 'Align note inside frame.');
          diagnosticsService.update({
            confirmationStatus: 'idle',
          });
          nextAdaptiveDelay = 700;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSystemStatus('Camera Ready', 'Align note inside frame.');
      }
      nextAdaptiveDelay = 1000;
    } finally {
      processingRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
        // Adaptive scheduling: dynamically queue next frame without rigid interval lag
        if (isAutoScanning) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMountedRef.current && isAutoScanning) {
              processCurrencyFrame(false);
            }
          }, nextAdaptiveDelay);
        }
      }
    }
  }, [setSystemStatus, isAutoScanning]);

  // Initial trigger once camera is ready
  const onCameraReady = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && isAutoScanning && !processingRef.current) {
        processCurrencyFrame(false);
      }
    }, 200);
  }, [isAutoScanning, processCurrencyFrame]);

  const toggleAuto = () => {
    const next = !isAutoScanning;
    setIsAutoScanning(next);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next) {
      ttsService.speak('Automatic currency scan resumed.');
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current && !processingRef.current) {
          processCurrencyFrame(false);
        }
      }, 150);
    } else {
      ttsService.speak('Automatic scan paused.');
    }
  };

  const manualScan = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    historyRef.current = [];
    lastAnnouncedDenomRef.current = null;
    ttsService.speak('Identifying currency note now.');
    processCurrencyFrame(true);
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
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">Currency Recognition</h1>
            <p className="text-xs opacity-80 hidden sm:block">Indian Rupee (INR) Banknotes</p>
          </div>
        </div>

        {/* Auto mode toggle */}
        <button
          onClick={toggleAuto}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? isAutoScanning
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
              : isAutoScanning
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 focus:ring-emerald-300'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-400'
          }`}
          aria-label={isAutoScanning ? 'Pause automatic currency scan' : 'Resume automatic scan'}
        >
          {isAutoScanning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isAutoScanning ? 'Auto: ON' : 'Auto: PAUSED'}
          </span>
        </button>
      </div>

      {/* Main Grid: Camera with Currency Box + Result card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera container */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[420px] sm:h-[480px]">
            <CameraView
              ref={cameraRef}
              guidanceMode="currency"
              guidanceText="Align note flat inside the green frame"
              onCameraReady={onCameraReady}
              className="h-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={manualScan}
              disabled={isProcessing}
              className={`flex-1 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-300 shadow-emerald-600/30'
              } ${isProcessing ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}`}
            >
              <Banknote className="w-5 h-5" />
              <span>{isProcessing ? 'Verifying Note...' : 'Identify Currency Now'}</span>
            </button>
          </div>
        </div>

        {/* Currency Result Panel */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl border-2 flex flex-col justify-between ${
            isYellow
              ? 'bg-black border-[#FFE600] text-[#FFE600]'
              : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-inherit/30 mb-5">
              <h2 className="text-lg font-black uppercase tracking-wider">
                Currency Verification
              </h2>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                Temporal Confirmation Active
              </span>
            </div>

            {/* Confirmed Denomination Hero Banner */}
            {confirmedDenomination ? (
              <div
                className={`p-6 rounded-2xl border-2 text-center mb-6 shadow-xl transition-all ${
                  isYellow
                    ? 'bg-neutral-900 border-[#FFE600]'
                    : `${denominationColors[confirmedDenomination]?.bg || 'bg-emerald-950'} ${
                        denominationColors[confirmedDenomination]?.border || 'border-emerald-500'
                      }`
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmed Indian Banknote</span>
                </div>
                <div className="text-5xl sm:text-6xl font-black tracking-tight text-white my-2 flex items-center justify-center gap-1">
                  <span>₹</span>
                  <span>{confirmedDenomination}</span>
                </div>
                <p className="text-lg font-bold text-emerald-300 mt-1">
                  {confirmedDenomination === 500 && 'Five Hundred Rupees'}
                  {confirmedDenomination === 200 && 'Two Hundred Rupees'}
                  {confirmedDenomination === 100 && 'One Hundred Rupees'}
                  {confirmedDenomination === 50 && 'Fifty Rupees'}
                  {confirmedDenomination === 20 && 'Twenty Rupees'}
                  {confirmedDenomination === 10 && 'Ten Rupees'}
                </p>

                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-around text-xs font-semibold">
                  <span>Confidence: {currencyResult?.confidence}%</span>
                  <span>{denominationColors[confirmedDenomination]?.name}</span>
                </div>
              </div>
            ) : temporalState === 'verifying' ? (
              <div className="py-10 text-center border-2 border-dashed border-amber-500/50 bg-amber-950/20 rounded-xl px-4 mb-6">
                <RefreshCw className="w-12 h-12 mx-auto mb-2 text-amber-400 animate-spin" />
                <p className="font-black text-lg text-amber-300">Verifying Across Frames...</p>
                <p className="text-xs opacity-80 mt-1">
                  Confirming ₹{currencyResult?.denomination} note consistency. Please hold steady.
                </p>
              </div>
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-inherit/30 rounded-xl px-4 mb-6">
                <Banknote className="w-14 h-14 mx-auto mb-3 opacity-40 text-emerald-400 animate-pulse" />
                <p className="font-black text-lg">Point at Currency Note</p>
                <p className="text-xs opacity-80 mt-1.5 max-w-xs mx-auto">
                  Hold an Indian currency note flat in front of the lens. Result is confirmed and announced automatically.
                </p>
              </div>
            )}

            {/* Supported Notes Reference list */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider opacity-75 mb-3">
                Supported Indian Denominations
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 50, 100, 200, 500].map((d) => (
                  <div
                    key={d}
                    className={`py-2 px-3 rounded-xl border text-center text-xs font-bold transition-all ${
                      confirmedDenomination === d
                        ? 'border-emerald-400 bg-emerald-500/30 text-white font-black scale-105 shadow-md'
                        : 'border-inherit/30 bg-white/5 opacity-80'
                    }`}
                  >
                    ₹{d}
                  </div>
                ))}
              </div>
              <p className="text-[11px] opacity-60 mt-2 text-center">
                * Note: ₹2000 is intentionally excluded per specifications.
              </p>
            </div>
          </div>

          {/* Spoken Repeat action */}
          <div className="mt-6 pt-4 border-t border-inherit/30">
            <button
              onClick={() => {
                if (confirmedDenomination) {
                  speakDenominationAmount(confirmedDenomination);
                } else {
                  ttsService.speak('No currency note confirmed yet. Please hold note steady in the camera view.');
                }
              }}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 focus:ring-emerald-400'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Repeat Currency Amount</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
