import React from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Camera,
  Mic,
  Loader2,
  CheckCircle2,
  Volume2,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const StatusBanner: React.FC = () => {
  const { systemStatus, statusMessage, theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  const getStatusConfig = () => {
    switch (systemStatus) {
      case 'Camera Ready':
        return {
          icon: <Camera className="w-5 h-5 text-emerald-400" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-emerald-950/70 border-emerald-800 text-emerald-200',
          label: 'Camera Ready',
          defaultMsg: 'Video stream online and active.',
        };
      case 'Listening':
        return {
          icon: <Mic className="w-5 h-5 text-cyan-400 animate-pulse" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-cyan-950/70 border-cyan-800 text-cyan-200',
          label: 'Listening',
          defaultMsg: 'Listening for voice commands...',
        };
      case 'Processing':
        return {
          icon: <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-amber-950/70 border-amber-800 text-amber-200',
          label: 'Processing',
          defaultMsg: 'Analyzing frame with Vision AI...',
        };
      case 'Detected':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-emerald-950/70 border-emerald-800 text-emerald-200',
          label: 'Detected',
          defaultMsg: 'Target identified successfully.',
        };
      case 'Speaking':
        return {
          icon: <Volume2 className="w-5 h-5 text-purple-400 animate-bounce" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-purple-950/70 border-purple-800 text-purple-200',
          label: 'Speaking',
          defaultMsg: 'Announcing audio description...',
        };
      case 'Permission Required':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-rose-950/80 border-rose-800 text-rose-200',
          label: 'Permission Required',
          defaultMsg: 'Please grant camera or microphone access in browser settings.',
        };
      case 'Error':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-rose-950/80 border-rose-800 text-rose-200',
          label: 'System Notice',
          defaultMsg: 'An issue occurred during vision processing.',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-slate-400" />,
          bg: isYellow ? 'bg-black border-[#FFE600]' : 'bg-slate-900 border-slate-800 text-slate-300',
          label: 'Ready',
          defaultMsg: 'VisionAid is active. Speak a voice command or tap any module.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      role="region"
      aria-label="System status"
      className={`w-full py-2 px-4 border-b flex items-center justify-between text-sm transition-colors ${config.bg}`}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0">{config.icon}</div>
          <span className="font-extrabold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-inherit">
            {config.label}
          </span>
          <p className="truncate text-sm font-medium">
            {statusMessage || config.defaultMsg}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold opacity-75">
          <span>Hands-Free Voice Active</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
