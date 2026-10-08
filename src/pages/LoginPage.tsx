import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { Eye, EyeOff, LogIn, Lock, Mail, Sparkles, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const { theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      onNavigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail('demo@visionaid.org');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`w-full max-w-lg rounded-3xl p-8 sm:p-10 border-2 shadow-2xl transition-all ${
          isYellow
            ? 'bg-black border-[#FFE600] text-[#FFE600]'
            : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-cyan-950/20'
        }`}
      >
        <div className="text-center mb-8">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
              isYellow
                ? 'bg-[#FFE600] text-black font-black'
                : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
            }`}
          >
            <Eye className="w-9 h-9" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">
            VISIONAID
          </h1>
          <p className="text-sm sm:text-base font-semibold mt-1 opacity-80">
            Smart Vision Assistance • Accessibility Portal
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl border-2 border-rose-500 bg-rose-950/50 text-rose-200 text-sm font-bold flex items-start gap-2.5"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Demo Account Quick-Fill Card */}
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            isYellow
              ? 'bg-neutral-900 border-[#FFE600]'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div>
              <p className="font-extrabold text-white">College Project Demo Login</p>
              <p className="opacity-80">demo@visionaid.org / password123</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fillDemoAccount}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all focus:outline-none focus:ring-4 ${
              isYellow
                ? 'bg-[#FFE600] text-black focus:ring-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-white focus:ring-cyan-300'
            }`}
          >
            Auto Fill
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm sm:text-base font-extrabold mb-2"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                className={`w-full pl-11 pr-4 py-3.5 rounded-xl border-2 font-medium text-base sm:text-lg focus:outline-none focus:ring-4 transition-all ${
                  isYellow
                    ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm sm:text-base font-extrabold mb-2"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={`w-full pl-11 pr-12 py-3.5 rounded-xl border-2 font-medium text-base sm:text-lg focus:outline-none focus:ring-4 transition-all ${
                  isYellow
                    ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded-lg p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-xl focus:outline-none focus:ring-4 ${
              isYellow
                ? 'bg-[#FFE600] text-black hover:bg-[#FFE600]/90 focus:ring-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/25 focus:ring-cyan-300'
            } ${loading ? 'opacity-70 cursor-wait' : 'cursor-pointer active:scale-[0.99]'}`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-6 h-6" />
                <span>Sign In to VisionAid</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-inherit/30 text-center">
          <p className="text-sm font-semibold opacity-80">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('/register')}
              className={`font-black underline focus:outline-none focus:ring-2 rounded p-1 ${
                isYellow ? 'text-[#FFE600]' : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
