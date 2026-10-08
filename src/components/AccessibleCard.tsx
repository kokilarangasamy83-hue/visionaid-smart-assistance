import React from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { LucideIcon, ArrowRight, Mic } from 'lucide-react';

interface AccessibleCardProps {
  title: string;
  description: string;
  voiceHint: string;
  icon: LucideIcon;
  badge?: string;
  colorTheme?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
  onClick: () => void;
}

export const AccessibleCard: React.FC<AccessibleCardProps> = ({
  title,
  description,
  voiceHint,
  icon: Icon,
  badge,
  colorTheme = 'cyan',
  onClick,
}) => {
  const { theme } = useAccessibility();
  const isYellow = theme === 'high-yellow';

  const getColorClasses = () => {
    if (isYellow) {
      return {
        card: 'bg-black border-2 border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600]/10 focus:ring-4 focus:ring-white',
        iconBg: 'bg-[#FFE600] text-black',
        badge: 'bg-[#FFE600] text-black',
        hint: 'text-[#FFE600]/80',
      };
    }

    switch (colorTheme) {
      case 'emerald':
        return {
          card: 'bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 focus:ring-4 focus:ring-emerald-400',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          hint: 'text-emerald-400/90',
        };
      case 'amber':
        return {
          card: 'bg-slate-900/90 border border-amber-500/30 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 focus:ring-4 focus:ring-amber-400',
          iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
          badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          hint: 'text-amber-400/90',
        };
      case 'purple':
        return {
          card: 'bg-slate-900/90 border border-purple-500/30 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 focus:ring-4 focus:ring-purple-400',
          iconBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
          badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
          hint: 'text-purple-400/90',
        };
      case 'blue':
        return {
          card: 'bg-slate-900/90 border border-blue-500/30 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 focus:ring-4 focus:ring-blue-400',
          iconBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
          badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
          hint: 'text-blue-400/90',
        };
      case 'cyan':
      default:
        return {
          card: 'bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-500 hover:shadow-xl hover:shadow-cyan-500/10 focus:ring-4 focus:ring-cyan-400',
          iconBg: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
          badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
          hint: 'text-cyan-400/90',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <button
      onClick={onClick}
      role="link"
      className={`group relative w-full text-left p-6 sm:p-7 rounded-2xl transition-all duration-200 cursor-pointer transform hover:-translate-y-1 active:translate-y-0 focus:outline-none flex flex-col justify-between min-h-[220px] ${colors.card}`}
      aria-label={`${title}: ${description}. Voice command: ${voiceHint}`}
    >
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className={`p-4 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-110 ${colors.iconBg}`}>
            <Icon className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
          {badge && (
            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full tracking-wider ${colors.badge}`}>
              {badge}
            </span>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-2 flex items-center gap-2">
          {title}
          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </h3>

        <p className="text-sm sm:text-base opacity-90 leading-relaxed font-medium">
          {description}
        </p>
      </div>

      <div className={`mt-5 pt-3 border-t border-inherit/30 flex items-center gap-2 text-xs sm:text-sm font-bold ${colors.hint}`}>
        <Mic className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span>Voice: "{voiceHint}"</span>
      </div>
    </button>
  );
};
