import React, { useState, useEffect } from 'react';
import { voiceControlService } from '../services/voiceControlService';
import { useAccessibility } from '../context/AccessibilityContext';
import { Mic, CheckCircle } from 'lucide-react';
import { VoiceIntent } from '../types';

export const VoiceStatusOverlay: React.FC = () => {
  const [lastHeard, setLastHeard] = useState<string>('');
  const [intentType, setIntentType] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(false);
  const { theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    let hideTimer: any = null;

    const unsubCommand = voiceControlService.subscribeCommand((intent: VoiceIntent) => {
      setLastHeard(intent.rawText);
      setIntentType(intent.type);
      setVisible(true);

      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setVisible(false);
      }, 3500);
    });

    return () => {
      unsubCommand();
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible || !lastHeard) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full transition-all transform animate-in fade-in slide-in-from-bottom-4"
    >
      <div
        className={`p-4 rounded-2xl border-2 shadow-2xl flex items-start gap-3 backdrop-blur-md ${
          isYellow
            ? 'bg-black border-[#FFE600] text-[#FFE600]'
            : 'bg-slate-900/95 border-cyan-500 text-slate-100 shadow-cyan-900/30'
        }`}
      >
        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 flex-shrink-0 mt-0.5">
          <Mic className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">
              Voice Heard
            </span>
            {intentType !== 'UNKNOWN' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Action: {intentType.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="font-bold text-base mt-0.5 truncate italic">
            "{lastHeard}"
          </p>
        </div>
      </div>
    </div>
  );
};
