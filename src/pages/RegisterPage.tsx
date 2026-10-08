import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { Eye, EyeOff, UserPlus, Lock, Mail, User } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const { theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      onNavigate('/home');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">
            Create Account
          </h1>
          <p className="text-sm sm:text-base font-semibold mt-1 opacity-80">
            Join VisionAid Smart Vision Assistance
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label
              htmlFor="reg-name"
              className="block text-sm sm:text-base font-extrabold mb-1.5"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoComplete="name"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border-2 font-medium text-base focus:outline-none focus:ring-4 transition-all ${
                  isYellow
                    ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="reg-email"
              className="block text-sm sm:text-base font-extrabold mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                autoComplete="email"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border-2 font-medium text-base focus:outline-none focus:ring-4 transition-all ${
                  isYellow
                    ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="reg-password"
              className="block text-sm sm:text-base font-extrabold mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoComplete="new-password"
                className={`w-full pl-11 pr-12 py-3 rounded-xl border-2 font-medium text-base focus:outline-none focus:ring-4 transition-all ${
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

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="reg-confirm"
              className="block text-sm sm:text-base font-extrabold mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border-2 font-medium text-base focus:outline-none focus:ring-4 transition-all ${
                  isYellow
                    ? 'bg-neutral-950 border-[#FFE600] text-[#FFE600] focus:ring-white placeholder-neutral-600'
                    : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-500/30 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 mt-2 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-xl focus:outline-none focus:ring-4 ${
              isYellow
                ? 'bg-[#FFE600] text-black hover:bg-[#FFE600]/90 focus:ring-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/25 focus:ring-cyan-300'
            } ${loading ? 'opacity-70 cursor-wait' : 'cursor-pointer active:scale-[0.99]'}`}
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus className="w-6 h-6" />
                <span>Complete Registration</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-inherit/30 text-center">
          <p className="text-sm font-semibold opacity-80">
            Already registered?{' '}
            <button
              onClick={() => onNavigate('/login')}
              className={`font-black underline focus:outline-none focus:ring-2 rounded p-1 ${
                isYellow ? 'text-[#FFE600]' : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              Sign In Instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
