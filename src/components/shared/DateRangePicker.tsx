'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface CalendarMonthProps {
  year: number;
  month: number;
  selected: DateRange;
  hovered: Date | null;
  onDayClick: (date: Date) => void;
  onDayHover: (date: Date | null) => void;
}

function CalendarMonth({ year, month, selected, hovered, onDayClick, onDayHover }: CalendarMonthProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

  const isStart = (date: Date) => selected.from && isSameDay(date, selected.from);
  const isEnd = (date: Date) => selected.to && isSameDay(date, selected.to);

  const isInRange = (date: Date) => {
    const from = selected.from;
    const to = selected.to || hovered;
    if (!from) return false;
    const d = startOfDay(date).getTime();
    const f = startOfDay(from).getTime();
    const t = to ? startOfDay(to).getTime() : null;
    if (!t) return false;
    const lo = Math.min(f, t);
    const hi = Math.max(f, t);
    return d > lo && d < hi;
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="min-w-[220px]">
      <p className="text-center text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-3">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          if (!date) return <div key={`blank-${idx}`} />;
          const start = isStart(date);
          const end = isEnd(date);
          const inRange = isInRange(date);
          const today = isToday(date);

          let cellClass = 'relative flex items-center justify-center h-8 text-xs cursor-pointer select-none transition-all duration-100 ';

          if (start || end) {
            cellClass += 'z-10 ';
          }

          if (inRange) {
            cellClass += 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ';
          } else if (!start && !end) {
            cellClass += 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-full ';
          }

          const innerClass = start || end
            ? 'w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center z-10 relative shadow-sm'
            : today
            ? 'w-8 h-8 rounded-full font-semibold underline underline-offset-2 flex items-center justify-center'
            : 'w-8 h-8 flex items-center justify-center';

          return (
            <div
              key={date.toISOString()}
              className={cellClass}
              onClick={() => onDayClick(date)}
              onMouseEnter={() => onDayHover(date)}
              onMouseLeave={() => onDayHover(null)}
            >
              <span className={innerClass}>{date.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS = [
  { label: 'Today', getRange: () => { const d = new Date(); return { from: d, to: d }; } },
  { label: 'Last 7 days', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from, to }; } },
  { label: 'Last 30 days', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from, to }; } },
  { label: 'Month to date', getRange: () => { const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth(), 1); return { from, to }; } },
  { label: 'Year to date', getRange: () => { const to = new Date(); const from = new Date(to.getFullYear(), 0, 1); return { from, to }; } },
  { label: 'All time', getRange: () => ({ from: null, to: null }) },
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange>(value);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Dual calendar state: left month and right month (right = left + 1)
  const today = new Date();
  const [leftYear, setLeftYear] = useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 11 : today.getMonth() - 1);
  // Adjust for year wrap
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync pendingRange when picker opens
  useEffect(() => {
    if (open) {
      setPendingRange(value);
      setActivePreset(null);
    }
  }, [open]);

  const handleDayClick = useCallback((date: Date) => {
    setActivePreset(null);
    if (!pendingRange.from || (pendingRange.from && pendingRange.to)) {
      // Start new selection
      setPendingRange({ from: date, to: null });
    } else {
      // Complete selection
      const from = pendingRange.from;
      if (startOfDay(date).getTime() < startOfDay(from).getTime()) {
        setPendingRange({ from: date, to: from });
      } else {
        setPendingRange({ from, to: date });
      }
    }
  }, [pendingRange]);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const range = preset.getRange();
    setPendingRange(range);
    setActivePreset(preset.label);
  };

  const handleApply = () => {
    onChange(pendingRange);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingRange(value);
    setOpen(false);
  };

  const navLeft = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  };

  const navRight = () => {
    if (leftMonth === 10) { setLeftMonth(11); }
    else if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  };

  const triggerLabel = () => {
    if (!value.from && !value.to) return 'All time';
    if (value.from && !value.to) return formatDate(value.from);
    if (value.from && value.to) {
      if (isSameDay(value.from, value.to)) return formatDate(value.from);
      return `${formatDate(value.from)} – ${formatDate(value.to)}`;
    }
    return 'Select range';
  };

  const pendingLabel = () => {
    if (!pendingRange.from && !pendingRange.to) return 'All time';
    if (pendingRange.from && !pendingRange.to) return `${formatDate(pendingRange.from)} → pick end date`;
    if (pendingRange.from && pendingRange.to) return `${formatDate(pendingRange.from)} – ${formatDate(pendingRange.to)}`;
    return '';
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        id="date-range-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-zinc-300 transition-colors duration-150 bg-white dark:bg-zinc-900 shadow-sm"
      >
        <Calendar size={15} className="text-indigo-500 shrink-0" />
        <span className="max-w-[180px] sm:max-w-[220px] truncate font-medium">{triggerLabel()}</span>
      </button>

      {/* Floating Popover */}
      {open && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-20 sm:top-full sm:right-0 sm:mt-2 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-zinc-900/80 overflow-hidden animate-popover-fade-in max-h-[85vh] overflow-y-auto sm:min-w-max">
          <div className="flex flex-col sm:flex-row">
            {/* Top/Left Sidebar: Presets */}
            <div className="border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-zinc-800 p-3 sm:p-4 flex flex-row sm:flex-col gap-1 sm:gap-1 sm:min-w-[140px] overflow-x-auto sm:overflow-x-visible">
              <p className="hidden sm:block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Quick select</p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`whitespace-nowrap text-left px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    activePreset === preset.label
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Main Calendar Area */}
            <div className="flex flex-col">
              {/* Calendar navigation */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-4">
                <button
                  onClick={navLeft}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex gap-4 sm:gap-8">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 w-[200px] sm:w-[220px] text-center">
                    {MONTH_NAMES[leftMonth]} {leftYear}
                  </span>
                  <span className="hidden sm:inline-block text-xs font-semibold text-slate-500 dark:text-zinc-400 w-[220px] text-center">
                    {MONTH_NAMES[rightMonth]} {rightYear}
                  </span>
                </div>
                <button
                  onClick={navRight}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Dual Calendars — single on mobile, dual on sm+ */}
              <div className="flex gap-4 sm:gap-6 px-3 sm:px-4 pb-4">
                <CalendarMonth
                  year={leftYear}
                  month={leftMonth}
                  selected={pendingRange}
                  hovered={hovered}
                  onDayClick={handleDayClick}
                  onDayHover={setHovered}
                />
                <div className="hidden sm:block w-px bg-slate-100 dark:bg-zinc-800 self-stretch" />
                <div className="hidden sm:block">
                  <CalendarMonth
                    year={rightYear}
                    month={rightMonth}
                    selected={pendingRange}
                    hovered={hovered}
                    onDayClick={handleDayClick}
                    onDayHover={setHovered}
                  />
                </div>
              </div>

              {/* Footer Row */}
              <div className="border-t border-slate-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[160px] sm:max-w-[260px]">
                  Range: <span className="text-slate-700 dark:text-zinc-200 font-semibold">{pendingLabel()}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-200 dark:border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Check size={12} />
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
