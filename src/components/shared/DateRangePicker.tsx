'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';

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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 + 6 }, (_, i) => 2020 + i);

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

// ─── Calendar Grid ────────────────────────────────────────────────────────────

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
  const isEnd   = (date: Date) => selected.to   && isSameDay(date, selected.to);

  const isInRange = (date: Date) => {
    const from = selected.from;
    const to   = selected.to || hovered;
    if (!from) return false;
    const d  = startOfDay(date).getTime();
    const f  = startOfDay(from).getTime();
    const t  = to ? startOfDay(to).getTime() : null;
    if (!t) return false;
    return d > Math.min(f, t) && d < Math.max(f, t);
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="w-full">
      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase h-7 w-8 mx-auto"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          if (!date) return <div key={`blank-${idx}`} className="w-8 h-8 mx-auto" />;

          const start   = isStart(date);
          const end     = isEnd(date);
          const inRange = isInRange(date);
          const today   = isToday(date);

          let cellClass =
            'relative flex items-center justify-center h-8 w-8 mx-auto text-xs cursor-pointer select-none transition-all duration-100 ';

          if (start || end) cellClass += 'z-10 ';

          if (inRange) {
            cellClass += 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ';
          } else if (!start && !end) {
            cellClass += 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-full ';
          }

          const innerClass =
            start || end
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

// ─── Month/Year Dropdowns ─────────────────────────────────────────────────────

interface MonthYearSelectProps {
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}

function MonthYearSelect({ month, year, onMonthChange, onYearChange }: MonthYearSelectProps) {
  const selectBase =
    'bg-transparent font-bold text-sm text-slate-800 dark:text-zinc-200 cursor-pointer focus:outline-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors appearance-none pr-1';

  return (
    <div className="flex items-center gap-1 select-none">
      <select
        id="month-select"
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        className={selectBase}
        aria-label="Select month"
      >
        {MONTH_NAMES.map((name, idx) => (
          <option key={name} value={idx}>
            {name}
          </option>
        ))}
      </select>
      <select
        id="year-select"
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className={selectBase}
        aria-label="Select year"
      >
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Today',         getRange: () => { const d = new Date(); return { from: d, to: d }; } },
  { label: 'Last 7 days',   getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from, to }; } },
  { label: 'Last 30 days',  getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from, to }; } },
  { label: 'Month to date', getRange: () => { const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth(), 1); return { from, to }; } },
  { label: 'Year to date',  getRange: () => { const to = new Date(); const from = new Date(to.getFullYear(), 0, 1); return { from, to }; } },
  { label: 'All time',      getRange: () => ({ from: null, to: null }) },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open,         setOpen]         = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange>(value);
  const [hovered,      setHovered]      = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Left calendar state — right is always left + 1 month
  const today = new Date();
  const [leftYear,  setLeftYear]  = useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = useState(
    today.getMonth() === 0 ? 11 : today.getMonth() - 1
  );

  const rightMonth = leftMonth === 11 ? 0  : leftMonth + 1;
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;

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

  // Sync pending range when picker opens
  useEffect(() => {
    if (open) {
      setPendingRange(value);
      setActivePreset(null);
    }
  }, [open]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const navLeft = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear((y) => y - 1); }
    else setLeftMonth((m) => m - 1);
  };

  const navRight = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear((y) => y + 1); }
    else setLeftMonth((m) => m + 1);
  };

  // Jump left calendar directly to a month/year; keep right = left + 1
  const handleLeftMonthChange = (m: number) => setLeftMonth(m);
  const handleLeftYearChange  = (y: number) => setLeftYear(y);

  // Right column dropdowns navigate the left calendar too (right = left + 1)
  const handleRightMonthChange = (m: number) => {
    if (m === 0) { setLeftMonth(11); setLeftYear((y) => y - 1); }
    else setLeftMonth(m - 1);
  };
  const handleRightYearChange = (y: number) => {
    // If right year changes, adjust left year so right stays = left + 1
    if (rightMonth === 0) setLeftYear(y - 1);
    else setLeftYear(y);
  };

  // ── Day selection ───────────────────────────────────────────────────────────

  const handleDayClick = useCallback((date: Date) => {
    setActivePreset(null);
    if (!pendingRange.from || (pendingRange.from && pendingRange.to)) {
      setPendingRange({ from: date, to: null });
    } else {
      const from = pendingRange.from;
      if (startOfDay(date).getTime() < startOfDay(from).getTime()) {
        setPendingRange({ from: date, to: from });
      } else {
        setPendingRange({ from, to: date });
      }
    }
  }, [pendingRange]);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setPendingRange(preset.getRange());
    setActivePreset(preset.label);
  };

  const handleApply = () => { onChange(pendingRange); setOpen(false); };
  const handleCancel = () => { setPendingRange(value); setOpen(false); };

  // ── Labels ──────────────────────────────────────────────────────────────────

  const triggerLabel = () => {
    if (!value.from && !value.to) return 'All time';
    if (value.from && !value.to)  return formatDate(value.from);
    if (value.from && value.to) {
      if (isSameDay(value.from, value.to)) return formatDate(value.from);
      return `${formatDate(value.from)} – ${formatDate(value.to)}`;
    }
    return 'Select range';
  };

  const pendingLabel = () => {
    if (!pendingRange.from && !pendingRange.to) return 'All time';
    if (pendingRange.from && !pendingRange.to)   return `${formatDate(pendingRange.from)} → pick end date`;
    if (pendingRange.from && pendingRange.to)     return `${formatDate(pendingRange.from)} – ${formatDate(pendingRange.to)}`;
    return '';
  };

  // ── Shared button/select classes ────────────────────────────────────────────

  const chevronBtn =
    'shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Trigger Button ── */}
      <button
        id="date-range-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-zinc-300 transition-colors duration-150 bg-white dark:bg-zinc-900 shadow-sm"
      >
        <Calendar size={15} className="text-indigo-500 shrink-0" />
        <span className="max-w-[180px] sm:max-w-[260px] truncate font-medium">{triggerLabel()}</span>
      </button>

      {/* ── Floating Popover ── */}
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 mt-2 z-50 w-[calc(100vw-32px)] sm:w-auto max-w-[360px] sm:max-w-none bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden mx-auto animate-popover-fade-in">
          <div className="flex flex-col lg:flex-row w-full">

            {/* ── Quick Select: horizontal chip bar on <lg, left sidebar on lg+ ── */}
            <div className="flex flex-row overflow-x-auto lg:overflow-x-visible lg:flex-col gap-1 p-3 border-b border-slate-100 dark:border-zinc-800 lg:border-b-0 lg:border-r shrink-0 lg:w-40 bg-slate-50/50 dark:bg-zinc-800/40">
              <p className="hidden lg:block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1 whitespace-nowrap">
                Quick select
              </p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 text-left ${
                    activePreset === preset.label
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ── Calendar Area ── */}
            <div className="flex flex-col min-w-0">

              {/* ── Dual calendar columns ── */}
              <div className="flex flex-col sm:flex-row">

                {/* ── Left Month Column ── */}
                <div className="flex flex-col px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
                  {/* Left header: ‹ | Month Year dropdowns | (spacer on mobile) */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <button onClick={navLeft} className={chevronBtn} aria-label="Previous month">
                      <ChevronLeft size={16} />
                    </button>

                    <MonthYearSelect
                      month={leftMonth}
                      year={leftYear}
                      onMonthChange={handleLeftMonthChange}
                      onYearChange={handleLeftYearChange}
                    />

                    {/* On mobile (single calendar view) show the right chevron here */}
                    <button
                      onClick={navRight}
                      className={`${chevronBtn} sm:hidden`}
                      aria-label="Next month"
                    >
                      <ChevronRight size={16} />
                    </button>

                    {/* On desktop the right column owns the › — spacer keeps symmetry */}
                    <div className="hidden sm:block shrink-0 w-8" />
                  </div>

                  <CalendarMonth
                    year={leftYear}
                    month={leftMonth}
                    selected={pendingRange}
                    hovered={hovered}
                    onDayClick={handleDayClick}
                    onDayHover={setHovered}
                  />
                </div>

                {/* ── Vertical divider (desktop only) ── */}
                <div className="hidden sm:block w-px bg-slate-100 dark:bg-zinc-800 self-stretch my-3" />

                {/* ── Right Month Column (desktop only) ── */}
                <div className="hidden sm:flex flex-col px-4 pt-4 pb-2">
                  {/* Right header: (spacer) | Month Year dropdowns | › */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="shrink-0 w-8" />

                    <MonthYearSelect
                      month={rightMonth}
                      year={rightYear}
                      onMonthChange={handleRightMonthChange}
                      onYearChange={handleRightYearChange}
                    />

                    <button onClick={navRight} className={chevronBtn} aria-label="Next month">
                      <ChevronRight size={16} />
                    </button>
                  </div>

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

              {/* ── Footer ── */}
              <div className="border-t border-slate-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[140px] sm:max-w-[280px]">
                  Range:{' '}
                  <span className="text-slate-700 dark:text-zinc-200 font-semibold">
                    {pendingLabel()}
                  </span>
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
