import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView, CameraViewRef } from '../components/CameraView';
import { visionApiService } from '../services/visionApiService';
import { ttsService } from '../services/ttsService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import { TextReaderResult } from '../types';
import {
  FileText,
  ArrowLeft,
  Volume2,
  Copy,
  Check,
  Play,
  Pause,
  ScanText,
  Languages,
} from 'lucide-react';

interface SmartReadPageProps {
  onNavigate: (path: string) => void;
}

// Calculate token similarity ratio between 0 and 1
function calculateTextSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const words1 = new Set(str1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
  const words2 = new Set(str2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w)) intersection++;
  });

  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

export const SmartReadPage: React.FC<SmartReadPageProps> = ({ onNavigate }) => {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [speechSummary, setSpeechSummary] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('English');
  const [wordCount, setWordCount] = useState<number>(0);
  const [isAutoReading, setIsAutoReading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const lastSpokenTextRef = useRef<string>('');
  const processingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setSystemStatus, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    isMountedRef.current = true;
    ttsService.speak('Smart Text Reader active. Place document or sign inside the blue frame.', {
      urgent: true,
      category: 'module-nav',
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const processTextFrame = useCallback(async (isManual = false) => {
    if (!cameraRef.current || processingRef.current || !isMountedRef.current) return;

    // Use cropped and contrast-enhanced frame capture with optimized 720px width for fast transfer and sharp OCR
    const frameBase64 = cameraRef.current.captureProcessedOCRFrame(720, 0.8, isManual);
    if (!frameBase64) return;

    processingRef.current = true;
    setIsProcessing(true);
    setSystemStatus('Processing', 'Scanning for readable text in blue frame...');

    let nextAdaptiveDelay = 900;

    try {
      abortControllerRef.current = new AbortController();
      const result: TextReaderResult = await visionApiService.readText(
        frameBase64,
        abortControllerRef.current.signal
      );

      if (!isMountedRef.current) return;

      // Validate meaningful text (discard random single-character noise)
      const cleanText = (result.detectedText || '').trim();
      const meaningfulWords = cleanText.split(/\s+/).filter((w) => w.length > 1);

      if (result.hasText && cleanText && meaningfulWords.length >= 2) {
        const uiT0 = performance.now();
        setExtractedText(cleanText);
        setSpeechSummary(result.speechSummary);
        setDetectedLanguage(result.language || 'English');
        setWordCount(meaningfulWords.length);
        setSystemStatus('Detected', 'Text detected and extracted.');
        requestAnimationFrame(() => {
          diagnosticsService.update({
            uiUpdateTimeMs: Math.round(performance.now() - uiT0),
          });
        });

        // Deduplication using word-level similarity
        const similarity = calculateTextSimilarity(cleanText, lastSpokenTextRef.current);
        if (similarity < 0.75) {
          lastSpokenTextRef.current = cleanText;
          // Announce meaningful text clearly
          const announcement = `Text detected. ${cleanText}`;
          ttsService.speak(announcement, {
            cooldownMs: 6000,
            category: 'ocr-text',
          });
        }
        // When text is found and stable, pace down so user can read/listen without interruption
        nextAdaptiveDelay = 2500;
      } else {
        setSystemStatus('Camera Ready', 'No text found in blue frame.');
        nextAdaptiveDelay = 800;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSystemStatus('Camera Ready', 'Place text inside blue frame.');
      }
      nextAdaptiveDelay = 1200;
    } finally {
      processingRef.current = false;
      if (isMountedRef.current) {
        setIsProcessing(false);
        if (isAutoReading) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMountedRef.current && isAutoReading) {
              processTextFrame(false);
            }
          }, nextAdaptiveDelay);
        }
      }
    }
  }, [setSystemStatus, isAutoReading]);

  // Initial trigger once camera is ready
  const onCameraReady = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && isAutoReading && !processingRef.current) {
        processTextFrame(false);
      }
    }, 200);
  }, [isAutoReading, processTextFrame]);

  const toggleAuto = () => {
    const next = !isAutoReading;
    setIsAutoReading(next);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next) {
      ttsService.speak('Automatic text reading resumed.');
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current && !processingRef.current) {
          processTextFrame(false);
        }
      }, 150);
    } else {
      ttsService.speak('Automatic reading paused.');
    }
  };

  const manualRead = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastSpokenTextRef.current = '';
    ttsService.speak('Reading text in frame.');
    processTextFrame(true);
  };

  const copyToClipboard = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    ttsService.speak('Text copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const readAgain = () => {
    if (!extractedText) return;
    ttsService.speak(extractedText, { urgent: true });
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
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">Smart Text Reader</h1>
            <p className="text-xs opacity-80 hidden sm:block">OCR with Speech for Signs & Documents</p>
          </div>
        </div>

        {/* Auto mode toggle */}
        <button
          onClick={toggleAuto}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? isAutoReading
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
              : isAutoReading
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 focus:ring-blue-300'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-400'
          }`}
          aria-label={isAutoReading ? 'Pause auto text scan' : 'Resume auto text scan'}
        >
          {isAutoReading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {isAutoReading ? 'Auto: ON' : 'Auto: PAUSED'}
          </span>
        </button>
      </div>

      {/* Main Grid: Camera with Blue Frame + Readout text */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera container with large blue guidance frame */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[420px] sm:h-[480px]">
            <CameraView
              ref={cameraRef}
              guidanceMode="text-reader"
              guidanceText="Place text inside the blue frame."
              onCameraReady={onCameraReady}
              className="h-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={manualRead}
              disabled={isProcessing}
              className={`flex-1 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-300 shadow-blue-600/30'
              } ${isProcessing ? 'opacity-70 cursor-wait' : 'active:scale-[0.99]'}`}
            >
              <ScanText className="w-5 h-5" />
              <span>{isProcessing ? 'Reading Frame...' : 'Read Text Now'}</span>
            </button>
          </div>
        </div>

        {/* Extracted Text Content Box */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl border-2 flex flex-col justify-between ${
            isYellow
              ? 'bg-black border-[#FFE600] text-[#FFE600]'
              : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-inherit/30 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-black uppercase tracking-wider">
                  Extracted Text
                </h2>
              </div>
              {detectedLanguage && (
                <span className="flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-950/60 border border-blue-800 px-2.5 py-1 rounded-full">
                  <Languages className="w-3.5 h-3.5" />
                  {detectedLanguage}
                </span>
              )}
            </div>

            {/* Main readable text container */}
            {extractedText ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border max-h-[300px] overflow-y-auto leading-relaxed text-base sm:text-lg font-medium whitespace-pre-wrap select-text ${
                    isYellow
                      ? 'bg-neutral-950 border-[#FFE600]'
                      : 'bg-slate-950/80 border-slate-800 text-slate-100'
                  }`}
                  tabIndex={0}
                  aria-label="Extracted document text"
                >
                  {extractedText}
                </div>

                <div className="flex items-center justify-between text-xs opacity-75 font-mono">
                  <span>{wordCount} words extracted</span>
                  <span>Supports English & Indian scripts</span>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-inherit/30 rounded-xl px-4">
                <ScanText className="w-12 h-12 mx-auto mb-3 opacity-40 text-blue-400" />
                <p className="font-bold text-base">No Text Extracted Yet</p>
                <p className="text-xs opacity-70 mt-1 max-w-xs mx-auto">
                  Hold a book, invoice, medicine strip, or sign inside the blue frame.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons (Read Again / Copy) */}
          <div className="mt-6 pt-4 border-t border-inherit/30 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={readAgain}
                disabled={!extractedText}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 ${
                  isYellow
                    ? 'bg-[#FFE600] text-black focus:ring-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-300'
                } ${!extractedText ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <Volume2 className="w-4 h-4" />
                <span>Read Again</span>
              </button>

              <button
                onClick={copyToClipboard}
                disabled={!extractedText}
                className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all focus:outline-none focus:ring-4 ${
                  isYellow
                    ? 'border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600]/10 focus:ring-white'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-cyan-400'
                } ${!extractedText ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
                title="Copy text to clipboard"
                aria-label="Copy extracted text"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-center text-xs opacity-75">
              Say <span className="font-bold">"Read this"</span> or <span className="font-bold">"Go back"</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
