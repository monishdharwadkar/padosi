import React from "react";
import { ShieldCheck, HelpCircle } from "lucide-react";

interface TrustScoreGaugeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export const TrustScoreGauge: React.FC<TrustScoreGaugeProps> = ({ score, size = 'md' }) => {
  if (score === null) {
    return (
      <div className="inline-flex flex-col items-center bg-sage-50 dark:bg-[#15251d] border border-sage-200 dark:border-emerald-950 p-3 rounded-xl max-w-xs">
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs font-display tracking-wide uppercase">
          <ShieldCheck className="w-4 h-4 animate-pulse" />
          New Neighbor
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 text-center">
          First-time sharer! Completing on-time handoffs unlocks their score gauge.
        </p>
      </div>
    );
  }

  // Get color based on score
  const getScoreTheme = (val: number) => {
    if (val >= 95) return { color: 'text-emerald-600 dark:text-emerald-400', stroke: '#10b981', label: 'Elite Sharer' };
    if (val >= 90) return { color: 'text-sage-500 dark:text-emerald-500', stroke: '#15803d', label: 'Trusted Neighbor' };
    if (val >= 80) return { color: 'text-ochre-500', stroke: '#d97706', label: 'Good Neighbor' };
    return { color: 'text-terracotta-500', stroke: '#c2410c', label: 'Needs Care' };
  };

  const { color, stroke, label } = getScoreTheme(score);
  
  // Size calculations
  const dimension = size === 'sm' ? 60 : size === 'md' ? 90 : 130;
  const strokeWidth = size === 'sm' ? 5 : size === 'md' ? 8 : 10;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: dimension, height: dimension }}>
        {/* SVG Circle Gauge */}
        <svg className="transform -rotate-90" width={dimension} height={dimension}>
          {/* Base Track */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            stroke="currentColor"
            className="text-zinc-200 dark:text-emerald-950/40"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Fill Arc */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Centered Score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display font-bold leading-none ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-3xl'}`}>
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-[8px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">
              Score
            </span>
          )}
        </div>
      </div>
      {size !== 'sm' && (
        <span className={`text-[10px] font-display font-medium uppercase tracking-wider mt-2 px-2 py-0.5 rounded-full bg-sage-100 dark:bg-emerald-950/50 ${color}`}>
          {label}
        </span>
      )}
    </div>
  );
};
