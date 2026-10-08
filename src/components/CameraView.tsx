import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { cameraService, CameraStatus } from '../services/cameraService';
import { diagnosticsService } from '../services/diagnosticsService';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Camera,
  CameraOff,
  RefreshCw,
  AlertTriangle,
  SwitchCamera,
} from 'lucide-react';
import { DetectedObject } from '../types';

export interface CameraViewRef {
  captureFrame: (maxWidth?: number, quality?: number, playSound?: boolean) => string | null;
  captureProcessedOCRFrame: (maxWidth?: number, quality?: number, playSound?: boolean) => string | null;
  getMotionScore: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

interface CameraViewProps {
  guidanceMode?: 'default' | 'text-reader' | 'currency' | 'obstacle' | 'none';
  guidanceText?: string;
  detectedObjects?: DetectedObject[];
  onCameraReady?: () => void;
  className?: string;
}

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  (
    {
      guidanceMode = 'default',
      guidanceText,
      detectedObjects = [],
      onCameraReady,
      className = '',
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [status, setStatus] = useState<CameraStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const { setSystemStatus, theme } = useAccessibility();
    const isYellow = theme === 'high-yellow';

    // Expose imperative methods to parent modules
    useImperativeHandle(ref, () => ({
      captureFrame: (maxWidth?: number, quality?: number, playSound?: boolean) => {
        if (!videoRef.current) return null;
        return cameraService.captureFrame(videoRef.current, maxWidth, quality, playSound);
      },
      captureProcessedOCRFrame: (maxWidth?: number, quality?: number, playSound?: boolean) => {
        if (!videoRef.current) return null;
        return cameraService.captureProcessedOCRFrame(videoRef.current, maxWidth, quality, playSound);
      },
      getMotionScore: () => {
        if (!videoRef.current) return 100;
        return cameraService.calculateMotionScore(videoRef.current);
      },
      getVideoElement: () => videoRef.current,
    }));

    // Subscribe to camera status
    useEffect(() => {
      const unsub = cameraService.subscribe((newStatus, errorMsg) => {
        setStatus(newStatus);
        setErrorMessage(errorMsg || '');

        if (newStatus === 'ready') {
          setSystemStatus('Camera Ready', 'Camera is streaming live.');
          if (onCameraReady) onCameraReady();
        } else if (newStatus === 'permission_denied') {
          setSystemStatus(
            'Permission Required',
            'Camera permission required. Please allow access in browser.'
          );
        } else if (newStatus === 'requesting') {
          setSystemStatus('Processing', 'Requesting camera stream...');
        }
      });

      return () => {
        unsub();
      };
    }, [setSystemStatus, onCameraReady]);

    // Start camera stream on mount
    const initCamera = async (preferEnv = true) => {
      try {
        const stream = await cameraService.startCamera(preferEnv);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        // Errors handled by cameraService subscription
      }
    };

    useEffect(() => {
      initCamera(facingMode === 'environment');
      return () => {
        cameraService.stopCamera(false);
      };
    }, [facingMode]);

    // Connect stream to video element when ready
    useEffect(() => {
      const activeStream = cameraService.getStream();
      if (activeStream && videoRef.current && videoRef.current.srcObject !== activeStream) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play().catch(() => {});
      }
    }, [status]);

    const toggleCameraFacing = () => {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
    };

    return (
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-black border-2 transition-all flex items-center justify-center ${
          isYellow ? 'border-[#FFE600]' : 'border-slate-800'
        } ${className}`}
        style={{ minHeight: '340px' }}
      >
        {/* Live HTML5 Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
          }}
          aria-label="Vision camera live view"
          className={`w-full h-full object-cover select-none transition-opacity duration-300 ${
            status === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Guidance Overlays */}
        {status === 'ready' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* 1. TEXT READER GUIDANCE FRAME (BLUE FRAME) */}
            {guidanceMode === 'text-reader' && (
              <div
                className="w-11/12 max-w-xl h-4/5 border-4 border-cyan-400 rounded-3xl relative shadow-[0_0_30px_rgba(34,211,238,0.35)] flex flex-col justify-between p-4 bg-cyan-500/5 animate-pulse"
                aria-hidden="true"
              >
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 border-t-4 border-l-4 border-cyan-300 rounded-tl-xl" />
                  <div className="w-8 h-8 border-t-4 border-r-4 border-cyan-300 rounded-tr-xl" />
                </div>
                <div className="text-center bg-black/85 backdrop-blur-md text-cyan-200 border border-cyan-400/50 py-2.5 px-5 rounded-2xl mx-auto shadow-lg">
                  <p className="font-extrabold text-base sm:text-lg">
                    {guidanceText || 'Place text inside the blue frame.'}
                  </p>
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-8 h-8 border-b-4 border-l-4 border-cyan-300 rounded-bl-xl" />
                  <div className="w-8 h-8 border-b-4 border-r-4 border-cyan-300 rounded-br-xl" />
                </div>
              </div>
            )}

            {/* 2. CURRENCY GUIDANCE BOX */}
            {guidanceMode === 'currency' && (
              <div
                className="w-10/12 max-w-md h-3/5 border-4 border-emerald-400 rounded-2xl relative shadow-[0_0_25px_rgba(52,211,153,0.3)] flex flex-col justify-between p-3 bg-emerald-500/5"
                aria-hidden="true"
              >
                <div className="text-center bg-black/85 backdrop-blur-md text-emerald-200 border border-emerald-500/50 py-2 px-4 rounded-xl mx-auto">
                  <p className="font-bold text-sm sm:text-base">
                    {guidanceText || 'Align Indian currency note flat inside frame'}
                  </p>
                </div>
                <div className="text-center text-xs font-semibold text-emerald-300/80 tracking-wide uppercase">
                  Supports ₹10 • ₹20 • ₹50 • ₹100 • ₹200 • ₹500
                </div>
              </div>
            )}

            {/* 3. OBSTACLE WALKING PATH GUIDANCE */}
            {guidanceMode === 'obstacle' && (
              <div
                className="w-4/5 max-w-lg h-5/6 border-2 border-dashed border-amber-400/80 rounded-3xl relative flex flex-col justify-end p-4 bg-gradient-to-t from-amber-500/10 to-transparent"
                aria-hidden="true"
              >
                <div className="text-center bg-black/85 backdrop-blur-md text-amber-300 border border-amber-500/60 py-2.5 px-4 rounded-xl mx-auto shadow-lg mb-2">
                  <p className="font-extrabold text-sm sm:text-base">
                    {guidanceText || 'Walking path navigation active'}
                  </p>
                </div>
              </div>
            )}

            {/* 4. DEFAULT SUBTLE CROSSHAIR */}
            {guidanceMode === 'default' && (
              <div className="w-16 h-16 border border-white/30 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              </div>
            )}

            {/* DYNAMIC OBJECT BOUNDING BOXES */}
            {detectedObjects &&
              detectedObjects.map((obj, idx) => {
                if (!obj.box) return null;
                const top = `${Math.max(0, Math.min(100, obj.box.ymin))}%`;
                const left = `${Math.max(0, Math.min(100, obj.box.xmin))}%`;
                const width = `${Math.max(5, Math.min(100, obj.box.xmax - obj.box.xmin))}%`;
                const height = `${Math.max(5, Math.min(100, obj.box.ymax - obj.box.ymin))}%`;

                return (
                  <div
                    key={`${obj.label}-${idx}`}
                    style={{ top, left, width, height }}
                    className="absolute border-2 border-cyan-400 bg-cyan-400/15 rounded-lg shadow-sm"
                  >
                    <span className="absolute -top-7 left-0 bg-black/90 text-cyan-300 text-xs font-bold px-2 py-0.5 rounded border border-cyan-400 whitespace-nowrap shadow-md">
                      {obj.label} ({obj.confidence}%)
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Camera controls toolbar overlay */}
        {status === 'ready' && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={toggleCameraFacing}
              className="p-3 rounded-xl bg-black/75 hover:bg-black/90 border border-white/20 text-white backdrop-blur-md shadow-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 transition-transform active:scale-95"
              title="Flip camera (Back / Front)"
              aria-label="Flip camera lens"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* PERMISSION REQUIRED / ERROR FALLBACK UI */}
        {(status === 'permission_denied' || status === 'error' || status === 'unsupported') && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mb-4">
              {status === 'permission_denied' ? (
                <CameraOff className="w-8 h-8" />
              ) : (
                <AlertTriangle className="w-8 h-8" />
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-rose-300 mb-2">
              {status === 'permission_denied'
                ? 'Camera Access Required'
                : 'Camera Unavailable'}
            </h3>

            <p className="max-w-md text-sm sm:text-base text-slate-300 mb-6 leading-relaxed">
              {errorMessage ||
                'VisionAid requires your device camera to recognize objects, read text, identify currency notes, and spot obstacles.'}
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm text-left text-xs sm:text-sm text-slate-400 mb-6 space-y-1.5">
              <p className="font-bold text-slate-200">How to allow in Chrome:</p>
              <p>1. Tap the lock/tune icon near the address bar</p>
              <p>2. Set Camera to "Allow"</p>
              <p>3. Tap "Retry Camera" below</p>
            </div>

            <button
              onClick={() => initCamera(facingMode === 'environment')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-base shadow-lg transition-transform active:scale-95 focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-white focus:ring-cyan-300'
              }`}
            >
              <RefreshCw className="w-5 h-5" />
              Retry Camera
            </button>
          </div>
        )}

        {/* LOADING / REQUESTING STATE */}
        {status === 'requesting' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
            <Camera className="w-12 h-12 text-cyan-400 animate-pulse mb-3" />
            <p className="text-lg font-bold text-slate-200">Initializing Camera...</p>
            <p className="text-xs text-slate-400 mt-1">Please approve browser permission prompt</p>
          </div>
        )}
      </div>
    );
  }
);
