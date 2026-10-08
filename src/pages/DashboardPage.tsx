import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { AccessibleCard } from '../components/AccessibleCard';
import { ttsService } from '../services/ttsService';
import {
  Eye,
  FileText,
  Banknote,
  Mic,
  Volume2,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  useEffect(() => {
    // Speak concise orientation message on dashboard load
    const greeting = `VisionAid Dashboard. Welcome ${user?.name || 'User'}. Choose Smart Vision, Smart Read, Currency, or Voice Assistant.`;
    ttsService.speak(greeting, { cooldownMs: 10000, category: 'dashboard-welcome' });
  }, [user]);

  const modules = [
    {
      title: 'Smart Vision',
      description: 'See and understand your surroundings with real-time object detection and spatial positioning.',
      voiceHint: 'Open Smart Vision',
      icon: Eye,
      badge: 'Live Vision',
      colorTheme: 'cyan' as const,
      route: '/smart-vision',
    },
    {
      title: 'Smart Read',
      description: 'Read text through the camera. Point at documents, product labels, and room signs to read aloud.',
      voiceHint: 'Read text',
      icon: FileText,
      badge: 'OCR Audio',
      colorTheme: 'blue' as const,
      route: '/text-reader',
    },
    {
      title: 'Currency',
      description: 'Identify Indian currency notes accurately: ₹10, ₹20, ₹50, ₹100, ₹200, and ₹500.',
      voiceHint: 'Identify currency',
      icon: Banknote,
      badge: 'INR ₹10 - ₹500',
      colorTheme: 'emerald' as const,
      route: '/currency',
    },
    {
      title: 'Voice Assistant',
      description: 'Control VisionAid hands-free with verbal navigation, questions, and spoken guidance.',
      voiceHint: 'Open voice assistant',
      icon: Mic,
      badge: 'Hands-Free',
      colorTheme: 'purple' as const,
      route: '/voice-assistant',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header section */}
      <div className="mb-8 sm:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                isYellow ? 'bg-[#FFE600] text-black' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              }`}
            >
              Accessibility Suite
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            VISIONAID
          </h1>
          <p className="text-lg sm:text-xl font-bold mt-1 opacity-90">
            Welcome, {user?.name || 'Friend'} • 4-in-1 Vision Assistance
          </p>
        </div>

        {/* Global Voice Prompt Quick Bar */}
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3.5 max-w-md ${
            isYellow
              ? 'bg-neutral-900 border-[#FFE600]'
              : 'bg-slate-900/80 border-slate-700/80'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 flex-shrink-0">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-xs sm:text-sm">
            <p className="font-extrabold text-white">Always-On Voice Navigation</p>
            <p className="opacity-80">
              Just speak: <span className="font-bold underline text-cyan-400">"Open Smart Vision"</span> or <span className="font-bold underline text-cyan-400">"Read text"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Grid of 4 consolidated primary modules */}
      <section aria-label="VisionAid Modules" className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {modules.map((m) => (
          <AccessibleCard
            key={m.title}
            title={m.title}
            description={m.description}
            voiceHint={m.voiceHint}
            icon={m.icon}
            badge={m.badge}
            colorTheme={m.colorTheme}
            onClick={() => onNavigate(m.route)}
          />
        ))}
      </section>

      {/* Quick Audio Guide Bar */}
      <div className="mt-12 p-6 rounded-2xl border border-inherit/30 bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <Volume2 className="w-6 h-6 text-cyan-400 flex-shrink-0" />
          <div>
            <p className="font-extrabold text-base">Automatic Audio Assistance</p>
            <p className="text-sm opacity-80">
              All results are automatically announced. No repeated tapping required.
            </p>
          </div>
        </div>
        <button
          onClick={() => ttsService.speak('VisionAid is actively listening for your voice commands. Say any module name or tap its card.')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
            isYellow
              ? 'bg-[#FFE600] text-black focus:ring-white'
              : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 focus:ring-cyan-400'
          }`}
        >
          Hear Audio Overview
        </button>
      </div>
    </div>
  );
};
