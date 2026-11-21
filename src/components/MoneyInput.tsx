import { useState } from 'react';

interface MoneyInputProps {
  id?: string;
  value: number;
  onChange: (nextValue: number) => void;
  placeholder?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  showUnitHint?: boolean;
  accent?: 'emerald' | 'sky';
}

export function formatShortVietnameseUnit(amount: number): string {
  if (!amount || amount <= 0) return '';
  if (amount >= 1_000_000_000) {
    const billions = amount / 1_000_000_000;
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(billions)} tỷ`;
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(millions)} triệu`;
  }
  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(thousands)} nghìn`;
  }
  return `${amount} đồng`;
}

export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = '0',
  ariaLabel,
  size = 'md',
  showUnitHint = false,
  accent = 'sky',
}: MoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const formattedDisplay = value > 0 ? Math.round(value).toLocaleString('vi-VN') : '';

  const handleFocus = () => {
    setDraft(value > 0 ? String(Math.round(value)) : '');
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDraft('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '').slice(0, 12);
    setDraft(digitsOnly);
    onChange(digitsOnly ? Number(digitsOnly) : 0);
  };

  const focusRing =
    accent === 'emerald'
      ? 'focus:ring-[#059669]/20 focus:border-[#059669]'
      : 'focus:ring-[#0F766E]/20 focus:border-[#0F766E]';

  const unitHint = formatShortVietnameseUnit(value);

  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          value={isFocused ? draft : formattedDisplay}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full font-mono tabular-nums font-medium bg-white border border-stone-200 rounded-xl text-[#1F2937] placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-all ${focusRing} ${
            size === 'sm' ? 'pl-2.5 pr-7 py-1.5 text-sm text-right' : 'pl-3.5 pr-8 py-2.5 text-base'
          }`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none select-none font-medium text-stone-400 absolute ${
            size === 'sm' ? 'right-2.5 text-xs' : 'right-3 text-sm'
          }`}
        >
          đ
        </span>
      </div>
      {showUnitHint && value > 0 && (
        <p className="mt-1 text-xs font-medium text-[#0F766E] tabular-nums">
          Số tiền: <span className="font-mono font-semibold">{formattedDisplay} đ</span>
          {unitHint ? <span className="text-stone-600"> ({unitHint})</span> : null}
        </p>
      )}
    </div>
  );
}
