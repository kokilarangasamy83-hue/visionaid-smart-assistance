import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { ttsService } from '../services/ttsService';
import {
  Eye,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Type,
  LogOut,
  HelpCircle,
  X,
  Compass,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const {
    theme,
    toggleTheme,
    fontSize,
    setFontSize,
    soundEffects,
    setSoundEffects,
    isVoiceActive,
    toggleVoiceControl,
  } = useAccessibility();

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [modalTab, setModalTab] = useState<'commands' | 'permissions'>('commands');
  const [micTestResult, setMicTestResult] = useState<string>('');

  const cycleFontSize = () => {
    if (fontSize === 'normal') setFontSize('large');
    else if (fontSize === 'large') setFontSize('extra-large');
    else setFontSize('normal');
  };

  const testMic = async () => {
    setMicTestResult('Testing microphone...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicTestResult('✅ Microphone access granted and operational!');
      ttsService.speak('Microphone test passed.');
    } catch (e: any) {
      setMicTestResult('❌ Microphone access denied or unavailable.');
      ttsService.speak('Microphone access blocked. Please allow in Chrome settings.');
    }
  };

  const isYellow = theme === 'high-yellow';

  return (
    <>
      <header
        role="banner"
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isYellow
            ? 'bg-black border-[#FFE600] text-[#FFE600]'
            : 'bg-slate-900/95 border-slate-800 text-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Title */}
          <button
            onClick={() => onNavigate(user ? '/home' : '/login')}
            className="flex items-center gap-3 group focus:outline-none focus:ring-4 focus:ring-cyan-400 rounded-xl p-1 text-left"
            aria-label="VisionAid Home - Smart Vision Assistance"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl transition-transform group-hover:scale-105 ${
                isYellow
                  ? 'bg-[#FFE600] text-black ring-2 ring-white'
                  : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              }`}
            >
              <Eye className="w-7 h-7" />
            </div>
            <div>
              <span className="block text-2xl font-black tracking-wider uppercase">
                VISIONAID
              </span>
              <span
                className={`block text-xs font-semibold tracking-wider uppercase ${
                  isYellow ? 'text-[#FFE600]/80' : 'text-cyan-400'
                }`}
              >
                Smart Vision Assistance
              </span>
            </div>
          </button>

          {/* Quick Accessibility Controls & Session */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Voice Control Quick Toggle */}
            <button
              onClick={toggleVoiceControl}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? isVoiceActive
                    ? 'bg-[#FFE600] text-black focus:ring-white'
                    : 'bg-neutral-900 text-[#FFE600] border-2 border-[#FFE600] focus:ring-white'
                  : isVoiceActive
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30 focus:ring-cyan-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 focus:ring-slate-400'
              }`}
              title={isVoiceActive ? 'Voice control active (click to pause)' : 'Voice control paused (click to resume)'}
              aria-label={isVoiceActive ? 'Voice control is active' : 'Voice control is paused'}
            >
              {isVoiceActive ? (
                <>
                  <Mic className="w-5 h-5 animate-pulse" />
                  <span className="hidden md:inline">Voice Active</span>
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5" />
                  <span className="hidden md:inline">Voice Muted</span>
                </>
              )}
            </button>

            {/* High Contrast Theme Switcher */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-cyan-400'
              }`}
              title="Toggle Ultra High Contrast Theme"
              aria-label={`Toggle theme. Current theme is ${isYellow ? 'Yellow High Contrast' : 'Standard Dark'}`}
            >
              {isYellow ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Font Scaler */}
            <button
              onClick={cycleFontSize}
              className={`p-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-neutral-900 text-[#FFE600] border border-[#FFE600] focus:ring-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-cyan-400'
              }`}
              title="Cycle font size (Normal, Large, Extra Large)"
              aria-label={`Current font size: ${fontSize}. Click to enlarge.`}
            >
              <div className="flex items-center gap-0.5">
                <Type className="w-5 h-5" />
                <span className="text-xs font-black">
                  {fontSize === 'normal' ? '1x' : fontSize === 'large' ? '2x' : '3x'}
                </span>
              </div>
            </button>

            {/* Sound Earcon Effects Toggle */}
            <button
              onClick={() => setSoundEffects(!soundEffects)}
              className={`p-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-neutral-900 text-[#FFE600] border border-[#FFE600] focus:ring-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-cyan-400'
              }`}
              title={soundEffects ? 'Sound chimes enabled' : 'Sound chimes muted'}
              aria-label={soundEffects ? 'Audio cues are enabled' : 'Audio cues are muted'}
            >
              {soundEffects ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Voice Command Help Modal Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className={`p-2.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                isYellow
                  ? 'bg-[#FFE600] text-black focus:ring-white'
                  : 'bg-slate-800 text-cyan-400 hover:bg-slate-700 focus:ring-cyan-400'
              }`}
              title="Voice Commands Guide"
              aria-label="View Voice Commands Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Authenticated user actions */}
            {user && (
              <button
                onClick={logout}
                className={`flex items-center gap-2 p-2.5 sm:px-3 sm:py-2 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                  isYellow
                    ? 'bg-red-700 text-white hover:bg-red-600 focus:ring-white'
                    : 'bg-red-950/80 text-red-200 border border-red-800/80 hover:bg-red-900 focus:ring-red-400'
                }`}
                title="Log Out"
                aria-label="Log Out of VisionAid"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Voice Commands Guide Modal */}
      {showHelpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="commands-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            className={`w-full max-w-2xl rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto border-2 ${
              isYellow
                ? 'bg-black border-[#FFE600] text-[#FFE600]'
                : 'bg-slate-900 border-slate-700 text-slate-100 shadow-2xl'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-inherit">
              <div className="flex items-center gap-3">
                <Compass className="w-7 h-7 text-cyan-400" />
                <h2 id="commands-modal-title" className="text-2xl font-black">
                  VisionAid Assistance Guide
                </h2>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-xl border border-inherit hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-400"
                aria-label="Close guide"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex gap-2 mt-4 border-b border-inherit/40 pb-2">
              <button
                onClick={() => setModalTab('commands')}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  modalTab === 'commands'
                    ? isYellow
                      ? 'bg-[#FFE600] text-black'
                      : 'bg-cyan-500 text-white'
                    : 'bg-white/5 opacity-80'
                }`}
              >
                Voice Commands
              </button>
              <button
                onClick={() => setModalTab('permissions')}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  modalTab === 'permissions'
                    ? isYellow
                      ? 'bg-[#FFE600] text-black'
                      : 'bg-cyan-500 text-white'
                    : 'bg-white/5 opacity-80'
                }`}
              >
                Camera & Mic Permissions
              </button>
            </div>

            {modalTab === 'commands' ? (
              <>
                <p className="mt-4 text-base opacity-90 leading-relaxed">
                  VisionAid continuously listens for natural hands-free navigation. Speak any of the following phrases clearly:
                </p>

                <div className="mt-6 space-y-4">
                  <div className="p-3 rounded-xl border border-inherit bg-white/5">
                    <h3 className="font-bold text-lg text-cyan-400">1. Smart Vision</h3>
                    <p className="text-sm font-mono mt-1 opacity-90">
                      "Open Smart Vision" • "Smart Vision" • "Object detection" • "Detect objects"
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-inherit bg-white/5">
                    <h3 className="font-bold text-lg text-cyan-400">2. Smart Read</h3>
                    <p className="text-sm font-mono mt-1 opacity-90">
                      "Read text" • "Smart Read" • "Read this" • "Open text reader"
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-inherit bg-white/5">
                    <h3 className="font-bold text-lg text-cyan-400">3. Currency</h3>
                    <p className="text-sm font-mono mt-1 opacity-90">
                      "Open currency" • "Currency recognition" • "Identify currency" • "Detect cash"
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-inherit bg-white/5">
                    <h3 className="font-bold text-lg text-cyan-400">4. Voice Assistant</h3>
                    <p className="text-sm font-mono mt-1 opacity-90">
                      "Open voice assistant" • "Voice assistant" • "Hey Vision"
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-inherit bg-white/5">
                    <h3 className="font-bold text-lg text-cyan-400">Navigation & Controls</h3>
                    <p className="text-sm font-mono mt-1 opacity-90">
                      "Go home" • "Dashboard" • "Go back" • "Stop" • "Help" • "Log out"
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-4 text-sm leading-relaxed">
                <div className="p-4 rounded-xl border border-inherit bg-white/5">
                  <h3 className="font-bold text-base text-cyan-400 mb-2">Android Chrome Permission Steps</h3>
                  <ol className="list-decimal list-inside space-y-1.5 opacity-90">
                    <li>Tap the <strong>Page Info / Tune</strong> icon (left of the URL bar).</li>
                    <li>Tap <strong>Permissions</strong>.</li>
                    <li>Toggle both <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong>.</li>
                    <li>Reload the page if prompted.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl border border-inherit bg-white/5">
                  <h3 className="font-bold text-base text-cyan-400 mb-2">Desktop Chrome / Windows Steps</h3>
                  <ol className="list-decimal list-inside space-y-1.5 opacity-90">
                    <li>Click the <strong>padlock / site settings</strong> icon in the address bar.</li>
                    <li>Ensure <strong>Camera</strong> and <strong>Microphone</strong> are set to <strong>Allow</strong>.</li>
                    <li>If blocked, click "Reset permissions" and refresh.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl border border-inherit bg-white/5 flex flex-col gap-2">
                  <h3 className="font-bold text-base text-cyan-400">Hardware Diagnostics</h3>
                  <button
                    onClick={testMic}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      isYellow ? 'bg-[#FFE600] text-black' : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                    }`}
                  >
                    Test Microphone Hardware
                  </button>
                  {micTestResult && (
                    <p className="text-xs font-bold mt-1 text-slate-200">{micTestResult}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className={`px-6 py-3 rounded-xl font-bold focus:outline-none focus:ring-4 ${
                  isYellow
                    ? 'bg-[#FFE600] text-black focus:ring-white'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-white focus:ring-cyan-300'
                }`}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
