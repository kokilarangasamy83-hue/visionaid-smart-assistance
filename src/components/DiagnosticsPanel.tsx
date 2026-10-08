import React, { useState, useEffect } from 'react';
import { diagnosticsService, PerformanceMetrics } from '../services/diagnosticsService';
import { Activity, X, ChevronDown, ChevronUp, Cpu, Gauge } from 'lucide-react';

export const DiagnosticsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(diagnosticsService.getMetrics());
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isEnabled, setIsEnabled] = useState<boolean>(diagnosticsService.getIsEnabled());

  useEffect(() => {
    const unsub = diagnosticsService.subscribe((m) => {
      setMetrics(m);
      setIsEnabled(diagnosticsService.getIsEnabled());
    });

    // Keyboard shortcut: Alt+D to toggle diagnostics
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const next = diagnosticsService.toggleEnabled();
        setIsEnabled(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Development Performance Diagnostics"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-slate-950/95 text-slate-100 border border-cyan-500/50 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden font-mono text-xs transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-cyan-500/30">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>PERF DIAGNOSTICS (DEV)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            aria-label={isOpen ? 'Collapse Diagnostics' : 'Expand Diagnostics'}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => diagnosticsService.toggleEnabled()}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"
            aria-label="Close Diagnostics"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Metrics Body */}
      {isOpen && (
        <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
          {/* Hardware & Stream */}
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800">
            <div>
              <span className="text-slate-400">Camera: </span>
              <span
                className={`font-bold ${
                  metrics.cameraStatus === 'READY'
                    ? 'text-emerald-400'
                    : metrics.cameraStatus === 'ERROR'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {metrics.cameraStatus}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Video: </span>
              <span className={metrics.videoPlaying ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {metrics.videoPlaying ? 'PLAYING' : 'IDLE'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Resolution: </span>
              <span className="text-cyan-300 font-semibold">{metrics.videoResolution}</span>
            </div>
            <div>
              <span className="text-slate-400">Frame: </span>
              <span
                className={
                  metrics.frameStatus === 'CAPTURED'
                    ? 'text-emerald-400 font-semibold'
                    : metrics.frameStatus === 'FAILED'
                    ? 'text-rose-400'
                    : 'text-slate-500'
                }
              >
                {metrics.frameStatus} ({metrics.frameSizeKb} KB)
              </span>
            </div>
          </div>

          {/* Latency Timing Breakdown */}
          <div className="space-y-1.5 py-1 text-[11px]">
            {metrics.cameraStartupTimeMs > 0 && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Camera Startup:</span>
                <span className="text-slate-200">{metrics.cameraStartupTimeMs} ms</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" /> Frame Capture:
              </span>
              <span className="text-slate-200">
                {metrics.frameCaptureTimeMs} ms
                {metrics.imageConversionTimeMs > 0 && (
                  <span className="text-[10px] text-slate-400 ml-1">
                    (conv: {metrics.imageConversionTimeMs}ms)
                  </span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Motion Score:</span>
              <span className="text-slate-300">{metrics.motionScore}%</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Inference Status:</span>
              <span
                className={`font-bold ${
                  metrics.inferenceStatus === 'RUNNING'
                    ? 'text-amber-300 animate-pulse'
                    : metrics.inferenceStatus === 'COMPLETE'
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {metrics.inferenceStatus}
                {metrics.cacheHit && (
                  <span className="ml-1 text-[10px] text-emerald-400 font-extrabold uppercase">[CACHE HIT]</span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">API Round-Trip:</span>
              <span className="text-cyan-300 font-semibold">{metrics.apiRoundTripMs} ms</span>
            </div>

            {metrics.serverInferenceMs > 0 && (
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>└ Server AI Time:</span>
                <span>{metrics.serverInferenceMs} ms</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Result Parsing:</span>
              <span className="text-slate-300">{metrics.parseDurationMs} ms</span>
            </div>

            {metrics.speechDelayMs > 0 && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Speech Audio Delay:</span>
                <span className="text-slate-300">{metrics.speechDelayMs} ms</span>
              </div>
            )}

            {metrics.uiUpdateTimeMs > 0 && (
              <div className="flex justify-between items-center text-slate-400">
                <span>UI Update Render:</span>
                <span className="text-slate-300">{metrics.uiUpdateTimeMs} ms</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold text-sm">
              <span className="text-slate-200 flex items-center gap-1">
                <Gauge className="w-4 h-4 text-emerald-400" /> Total Latency:
              </span>
              <span
                className={`${
                  metrics.totalDetectionLatencyMs < 1200
                    ? 'text-emerald-400'
                    : metrics.totalDetectionLatencyMs < 2500
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {metrics.totalDetectionLatencyMs} ms
              </span>
            </div>
          </div>

          {/* Temporal Confirmation & Status */}
          <div className="pt-2 border-t border-slate-800 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Confirmation State:</span>
              <span
                className={`font-bold uppercase ${
                  metrics.confirmationStatus === 'confirmed'
                    ? 'text-emerald-400'
                    : metrics.confirmationStatus === 'verifying'
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              >
                {metrics.confirmationStatus}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 mt-0.5">
              <span>Total Inferences:</span>
              <span className="text-slate-200">{metrics.inferencesCount}</span>
            </div>
            {metrics.lastResultSummary && (
              <div className="mt-1 p-1 bg-slate-900 rounded text-slate-300 truncate">
                <span className="text-slate-500">Summary: </span>
                {metrics.lastResultSummary}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
