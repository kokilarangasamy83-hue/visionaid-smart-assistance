import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { Navbar } from './components/Navbar';
import { StatusBanner } from './components/StatusBanner';
import { VoiceStatusOverlay } from './components/VoiceStatusOverlay';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ObjectDetectionPage } from './pages/ObjectDetectionPage';
import { SmartReadPage } from './pages/SmartReadPage';
import { CurrencyPage } from './pages/CurrencyPage';
import { ObstacleAlertPage } from './pages/ObstacleAlertPage';
import { SmartAssistPage } from './pages/SmartAssistPage';
import { VoiceAssistantPage } from './pages/VoiceAssistantPage';
import { voiceControlService } from './services/voiceControlService';
import { ttsService } from './services/ttsService';
import { AppRoute, VoiceIntent } from './types';

function MainApp() {
  const { user, loading, logout } = useAuth();
  const { setSystemStatus, announce, isVoiceActive } = useAccessibility();
  const [currentPath, setCurrentPath] = useState<AppRoute>('/home');
  const [history, setHistory] = useState<AppRoute[]>([]);
  const isNavigatingBackRef = useRef<boolean>(false);

  // Sync route navigation with browser history
  const navigateTo = useCallback(
    (targetPath: AppRoute | string) => {
      const validPath = targetPath as AppRoute;
      if (validPath === currentPath) return;

      if (!isNavigatingBackRef.current) {
        setHistory((prev) => [...prev, currentPath]);
        try {
          window.history.pushState({ path: validPath }, '', '#' + validPath.replace('/', ''));
        } catch {}
      }
      isNavigatingBackRef.current = false;
      setCurrentPath(validPath);
    },
    [currentPath]
  );

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      isNavigatingBackRef.current = true;
      setHistory((prev) => prev.slice(0, -1));
      setCurrentPath(previous);
      ttsService.speak('Going back.', { urgent: true });
    } else {
      navigateTo('/home');
      ttsService.speak('Going to dashboard.', { urgent: true });
    }
  }, [history, navigateTo]);

  // Handle browser / Android back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.path) {
        isNavigatingBackRef.current = true;
        setCurrentPath(e.state.path as AppRoute);
      } else if (window.location.hash) {
        const hashPath = ('/' + window.location.hash.replace('#', '')) as AppRoute;
        isNavigatingBackRef.current = true;
        setCurrentPath(hashPath);
      } else {
        goBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack]);

  // Global voice command listener
  useEffect(() => {
    const unsub = voiceControlService.subscribeCommand((intent: VoiceIntent) => {
      if (!user && intent.type !== 'HELP') return;

      switch (intent.type) {
        case 'SMART_VISION':
        case 'OBJECT_DETECTION':
          ttsService.speak('Opening Smart Vision.', { urgent: true });
          navigateTo('/smart-vision');
          break;

        case 'TEXT_READER':
          ttsService.speak('Opening text reader.', { urgent: true });
          navigateTo('/text-reader');
          break;

        case 'CURRENCY':
          ttsService.speak('Opening currency recognition.', { urgent: true });
          navigateTo('/currency');
          break;

        case 'OBSTACLE':
          ttsService.speak('Opening obstacle alert.', { urgent: true });
          navigateTo('/obstacle-alert');
          break;

        case 'SMART_ASSIST':
          ttsService.speak('Opening smart assist.', { urgent: true });
          navigateTo('/smart-assist');
          break;

        case 'VOICE_ASSISTANT':
          ttsService.speak('Opening voice assistant.', { urgent: true });
          navigateTo('/voice-assistant');
          break;

        case 'HOME':
          ttsService.speak('Opening dashboard.', { urgent: true });
          navigateTo('/home');
          break;

        case 'BACK':
          goBack();
          break;

        case 'LOGOUT':
          logout();
          navigateTo('/login');
          break;

        case 'STOP':
          ttsService.stop();
          ttsService.speak('Stopped.', { urgent: true });
          break;

        case 'HELP':
          ttsService.speak(
            'You can say: Open Smart Vision, Read text, Identify currency, Voice assistant, Go home, or Go back.',
            { urgent: true }
          );
          break;

        default:
          break;
      }
    });

    return () => unsub();
  }, [user, navigateTo, goBack, logout]);

  // Voice control lifecycle: auto-start when logged in and enabled
  useEffect(() => {
    if (user && isVoiceActive) {
      voiceControlService.start();
    } else {
      voiceControlService.stop();
    }
  }, [user, isVoiceActive]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user && currentPath !== '/login' && currentPath !== '/register') {
      setCurrentPath('/login');
    } else if (!loading && user && (currentPath === '/login' || currentPath === '/register')) {
      setCurrentPath('/home');
    }
  }, [user, loading, currentPath]);

  // Render current active page
  const renderPage = () => {
    if (loading) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-extrabold text-lg text-slate-200">Loading VisionAid...</p>
        </div>
      );
    }

    if (!user) {
      if (currentPath === '/register') {
        return <RegisterPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      }
      return <LoginPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
    }

    switch (currentPath) {
      case '/smart-vision':
      case '/object-detection':
        return <ObjectDetectionPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/text-reader':
        return <SmartReadPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/currency':
        return <CurrencyPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/obstacle-alert':
        return <ObstacleAlertPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/smart-assist':
        return <SmartAssistPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/voice-assistant':
        return <VoiceAssistantPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
      case '/home':
      default:
        return <DashboardPage onNavigate={(p) => navigateTo(p as AppRoute)} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar currentPath={currentPath} onNavigate={(p) => navigateTo(p as AppRoute)} />
      <StatusBanner />
      <main className="flex-1 pb-16">{renderPage()}</main>
      <VoiceStatusOverlay />
      <DiagnosticsPanel />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <MainApp />
      </AccessibilityProvider>
    </AuthProvider>
  );
}
