import { CalendarDays } from 'lucide-react';
import { todayIsoDate } from '../utils/format.ts';

interface DateSelectorViProps {
  idPrefix?: string;
  value: string; // YYYY-MM-DD
  onChange: (nextIsoDate: string) => void;
  label?: string;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIsoParts(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (match) {
    const year = Math.min(2040, Math.max(2015, Number(match[1]) || new Date().getFullYear()));
    const month = Math.min(12, Math.max(1, Number(match[2]) || 1));
    const maxDay = getDaysInMonth(year, month);
    const day = Math.min(maxDay, Math.max(1, Number(match[3]) || 1));
    return { year, month, day };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  const maxDay = getDaysInMonth(year, month);
  const clampedDay = Math.min(maxDay, Math.max(1, day));
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function DateSelectorVi({
  idPrefix = 'date-vi',
  value,
  onChange,
  label = 'Ngày / tháng / năm',
}: DateSelectorViProps) {
  const { year, month, day } = parseIsoParts(value);
  const maxDay = getDaysInMonth(year, month);
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(2020, year);
  const maxYear = Math.max(currentYear + 5, year);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <CalendarDays className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden="true" />
          <span>{label}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(todayIsoDate())}
          className="px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition-colors cursor-pointer whitespace-nowrap"
        >
          Ngày hiện tại
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label htmlFor={`${idPrefix}-day`} className="sr-only">
            Ngày
          </label>
          <select
            id={`${idPrefix}-day`}
            value={day}
            onChange={(e) => onChange(toIsoDate(year, month, Number(e.target.value)))}
            aria-label="Ngày"
            className="w-full px-2 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
          >
            {days.map((d) => (
              <option key={d} value={d}>
                Ngày {String(d).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-month`} className="sr-only">
            Tháng
          </label>
          <select
            id={`${idPrefix}-month`}
            value={month}
            onChange={(e) => onChange(toIsoDate(year, Number(e.target.value), day))}
            aria-label="Tháng"
            className="w-full px-2 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                Thg {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-year`} className="sr-only">
            Năm
          </label>
          <select
            id={`${idPrefix}-year`}
            value={year}
            onChange={(e) => onChange(toIsoDate(Number(e.target.value), month, day))}
            aria-label="Năm"
            className="w-full px-2 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white border border-stone-200 rounded-xl text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
