import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SystemStatusState } from '../types';
import { ttsService } from '../services/ttsService';
import { audioFeedbackService } from '../services/audioFeedbackService';
import { voiceControlService } from '../services/voiceControlService';

export type ContrastTheme = 'standard' | 'high-yellow';
export type FontSizeScale = 'normal' | 'large' | 'extra-large';

interface AccessibilityContextType {
  theme: ContrastTheme;
  setTheme: (theme: ContrastTheme) => void;
  toggleTheme: () => void;
  fontSize: FontSizeScale;
  setFontSize: (size: FontSizeScale) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  soundEffects: boolean;
  setSoundEffects: (enabled: boolean) => void;
  systemStatus: SystemStatusState;
  statusMessage: string;
  setSystemStatus: (status: SystemStatusState, message?: string) => void;
  liveAnnouncement: string;
  announce: (text: string, assertive?: boolean) => void;
  isVoiceActive: boolean;
  toggleVoiceControl: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ContrastTheme>('standard');
  const [fontSize, setFontSizeState] = useState<FontSizeScale>('normal');
  const [speechRate, setSpeechRateState] = useState<number>(1.0);
  const [soundEffects, setSoundEffectsState] = useState<boolean>(true);
  const [systemStatus, setSystemStatusState] = useState<SystemStatusState>('Idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(true);

  // Sync TTS speaking state to system status
  useEffect(() => {
    const unsub = ttsService.subscribe((isSpeaking) => {
      if (isSpeaking) {
        setSystemStatusState('Speaking');
      } else if (systemStatus === 'Speaking') {
        setSystemStatusState('Idle');
      }
    });
    return unsub;
  }, [systemStatus]);

  // Load accessibility preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('visionaid_theme') as ContrastTheme;
    if (savedTheme) setThemeState(savedTheme);

    const savedFont = localStorage.getItem('visionaid_font') as FontSizeScale;
    if (savedFont) setFontSizeState(savedFont);

    const savedRate = localStorage.getItem('visionaid_speech_rate');
    if (savedRate) {
      const rate = parseFloat(savedRate);
      setSpeechRateState(rate);
      ttsService.setRate(rate);
    }
  }, []);

  const setTheme = (newTheme: ContrastTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('visionaid_theme', newTheme);
  };

  const toggleTheme = () => {
    const next = theme === 'standard' ? 'high-yellow' : 'standard';
    setTheme(next);
    ttsService.speak(`Theme changed to ${next === 'high-yellow' ? 'high contrast yellow' : 'standard dark'}.`);
  };

  const setFontSize = (size: FontSizeScale) => {
    setFontSizeState(size);
    localStorage.setItem('visionaid_font', size);
  };

  const setSpeechRate = (rate: number) => {
    setSpeechRateState(rate);
    ttsService.setRate(rate);
    localStorage.setItem('visionaid_speech_rate', rate.toString());
  };

  const setSoundEffects = (enabled: boolean) => {
    setSoundEffectsState(enabled);
    audioFeedbackService.setSoundEnabled(enabled);
  };

  const setSystemStatus = useCallback((status: SystemStatusState, message: string = '') => {
    setSystemStatusState(status);
    setStatusMessage(message);
  }, []);

  const announce = useCallback((text: string, assertive = false) => {
    setLiveAnnouncement('');
    // Slight timeout allows screen reader DOM mutation trigger
    setTimeout(() => {
      setLiveAnnouncement(text);
    }, 50);
  }, []);

  const toggleVoiceControl = () => {
    if (isVoiceActive) {
      voiceControlService.stop();
      setIsVoiceActive(false);
      ttsService.speak('Voice control paused.');
    } else {
      voiceControlService.start();
      setIsVoiceActive(true);
      ttsService.speak('Voice control active.');
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        fontSize,
        setFontSize,
        speechRate,
        setSpeechRate,
        soundEffects,
        setSoundEffects,
        systemStatus,
        statusMessage,
        setSystemStatus,
        liveAnnouncement,
        announce,
        isVoiceActive,
        toggleVoiceControl,
      }}
    >
      <div
        className={`min-h-screen transition-colors duration-150 ${
          theme === 'high-yellow'
            ? 'theme-high-contrast bg-black text-[#FFE600]'
            : 'bg-slate-950 text-slate-100'
        } ${
          fontSize === 'extra-large'
            ? 'text-xl'
            : fontSize === 'large'
            ? 'text-lg'
            : 'text-base'
        }`}
      >
        {children}
        {/* ARIA Live Region for screen reader accessibility */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveAnnouncement}
        </div>
      </div>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
};
