import React from 'react';
import { extractSocialUsername } from '../../utils/socialHelpers';

interface SocialUrlInputFieldProps {
  label: string;
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  isLightMode?: boolean;
}

export const SocialUrlInputField: React.FC<SocialUrlInputFieldProps> = ({
  label,
  prefix,
  value,
  onChange,
  placeholder = 'username',
  icon,
  isLightMode = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extract clean username if a full URL or leading @ is typed/pasted
    const clean = extractSocialUsername(raw);
    onChange(clean);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-semibold">
          {icon && <span className="opacity-75">{icon}</span>}
          <span>{label}</span>
        </label>
      </div>

      <div
        className={`flex items-center rounded-xl border transition-all focus-within:ring-2 focus-within:ring-amber-500/20 overflow-hidden ${
          isLightMode
            ? 'bg-[#f8f9fa] border-slate-300 focus-within:border-amber-500 focus-within:bg-white'
            : 'bg-slate-50 dark:bg-[#08090e] border-slate-200 dark:border-white/10 focus-within:border-amber-500'
        }`}
      >
        {/* Fixed Domain Prefix Display */}
        <span
          className={`pl-3 pr-0.5 py-2 text-[11px] font-mono-tech select-none shrink-0 font-medium ${
            isLightMode ? 'text-slate-500' : 'text-slate-400 dark:text-zinc-500'
          }`}
        >
          {prefix}
        </span>

        {/* Pure Username Input */}
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full py-2 pr-3 bg-transparent text-xs font-mono-tech focus:outline-none ${
            isLightMode
              ? 'text-slate-900 placeholder:text-slate-400'
              : 'text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600'
          }`}
        />
      </div>
    </div>
  );
};
