'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useLanguage } from '@/components/shared/LanguageProvider';
import { useTheme } from 'next-themes';
import { DateRange } from '@/components/shared/DateRangePicker';
import { Loader2 } from 'lucide-react';

Chart.register(...registerables);

interface SalesChartProps {
  dateRange: DateRange;
}

type ChartView = 'total_inflow' | 'profit_vs_expense' | 'pos_sales' | 'service_fees' | 'completed_services';

export default function SalesChart({ dateRange }: SalesChartProps) {
  const { t, language } = useLanguage();
  const { theme, resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  
  const [granularity, setGranularity] = useState<'hari' | 'bulan' | 'tahun'>('hari');
  const [activeView, setActiveView] = useState<ChartView>('total_inflow');
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch active analytics data
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const fromStr = dateRange.from ? dateRange.from.toISOString() : '';
        const toStr = dateRange.to ? dateRange.to.toISOString() : '';
        
        const res = await fetch(`/api/analytics/sales?from=${fromStr}&to=${toStr}&granularity=${granularity}`);
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();
        
        if (active) {
          setChartData(json);
        }
      } catch (err) {
        console.error('Error loading analytics chart:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [dateRange, granularity]);

  // Redraw chart when data, theme, language, or activeView changes
  useEffect(() => {
    if (!canvasRef.current || !chartData) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const isDark = resolvedTheme === 'dark' || theme === 'dark';
    const gridColor = isDark ? '#27272a' : '#f1f5f9';
    const textColor = isDark ? '#a1a1aa' : '#64748b';

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const { labels, datasets } = chartData;

    // Helper to create gradient
    const createGradient = (colorStart: string, colorEnd: string) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 300);
      grad.addColorStop(0, colorStart);
      grad.addColorStop(1, colorEnd);
      return grad;
    };

    const datasetsToRender: any[] = [];

    // Set configuration dynamically based on activeView
    if (activeView === 'profit_vs_expense') {
      const grossRevenueGrad = createGradient('rgba(124, 58, 237, 0.35)', 'rgba(124, 58, 237, 0.0)');
      const netProfitGrad = createGradient('rgba(16, 185, 129, 0.35)', 'rgba(16, 185, 129, 0.0)');
      const expensesGrad = createGradient('rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.0)');

      datasetsToRender.push(
        {
          label: t('Total Pendapatan Hari Ini'),
          data: datasets.totalInflow,
          borderColor: '#7c3aed', // violet-600
          borderWidth: 3,
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: isDark ? '#09090b' : '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: 3.5,
          tension: 0.3,
          fill: true,
          backgroundColor: grossRevenueGrad,
        },
        {
          label: t('Keuntungan Bersih'),
          data: datasets.netProfit,
          borderColor: '#10b981', // emerald-500
          borderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: isDark ? '#09090b' : '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: 3.5,
          tension: 0.3,
          fill: true,
          backgroundColor: netProfitGrad,
        },
        {
          label: t('Total Pengeluaran'),
          data: datasets.expenses,
          borderColor: '#ef4444', // red-500
          borderWidth: 2,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: isDark ? '#09090b' : '#ffffff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          backgroundColor: expensesGrad,
        }
      );
    } else if (activeView === 'completed_services') {
      datasetsToRender.push({
        label: t('Laptop Diservis'),
        data: datasets.completedServices,
        backgroundColor: '#f59e0b', // amber-500
        borderColor: '#d97706', // amber-600
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: '#d97706',
      });
    } else if (activeView === 'pos_sales') {
      const posSalesGrad = createGradient('rgba(59, 130, 246, 0.35)', 'rgba(59, 130, 246, 0.0)');

      datasetsToRender.push({
        label: t('Total Penjualan POS'),
        data: datasets.posGross,
        borderColor: '#3b82f6', // blue-500
        borderWidth: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: isDark ? '#09090b' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointRadius: 3.5,
        tension: 0.3,
        fill: true,
        backgroundColor: posSalesGrad,
      });
    } else if (activeView === 'service_fees') {
      const serviceFeesGrad = createGradient('rgba(16, 185, 129, 0.35)', 'rgba(16, 185, 129, 0.0)');

      datasetsToRender.push({
        label: t('Total Jasa Servis'),
        data: datasets.serviceGross,
        borderColor: '#10b981', // emerald-500
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: isDark ? '#09090b' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointRadius: 3.5,
        tension: 0.3,
        fill: true,
        backgroundColor: serviceFeesGrad,
      });
    } else if (activeView === 'total_inflow') {
      const inflowGrad = createGradient('rgba(124, 58, 237, 0.35)', 'rgba(124, 58, 237, 0.0)');

      datasetsToRender.push({
        label: t('Total Pemasukan'),
        data: datasets.totalInflow,
        borderColor: '#7c3aed', // violet-600
        borderWidth: 3,
        pointBackgroundColor: '#7c3aed',
        pointBorderColor: isDark ? '#09090b' : '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointRadius: 3.5,
        tension: 0.4,
        cubicInterpolationMode: 'monotone',
        fill: true,
        backgroundColor: inflowGrad,
      });
    }

    chartRef.current = new Chart(ctx, {
      type: activeView === 'completed_services' ? 'bar' : 'line',
      data: {
        labels,
        datasets: datasetsToRender
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: datasetsToRender.length > 1,
            position: 'top',
            labels: {
              color: textColor,
              font: {
                size: 10,
                weight: 'bold'
              },
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#d4d4d8' : '#334155',
            borderColor: isDark ? '#27272a' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            cornerRadius: 12,
            titleFont: {
              size: 11,
              weight: 'bold'
            },
            bodyFont: {
              size: 12,
              weight: 'bold'
            },
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y ?? 0;
                
                if (activeView === 'completed_services') {
                  return ` ${label}: ${val} ${t('Unit')}`;
                }
                
                return ` ${label}: ` + new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textColor,
              font: {
                size: 9,
                weight: 'normal'
              }
            }
          },
          y: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textColor,
              font: {
                size: 9,
                weight: 'normal'
              },
              callback: (value) => {
                const num = Number(value);
                if (activeView === 'completed_services') {
                  return num;
                }
                
                if (num >= 1000000) {
                  return (num / 1000000).toFixed(0) + ' jt';
                }
                if (num >= 1000) {
                  return (num / 1000).toFixed(0) + ' rb';
                }
                return value;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData, activeView, resolvedTheme, theme, language]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 shadow-sm dark:border-zinc-800/80 text-slate-900 dark:text-zinc-50 relative min-h-[360px] flex flex-col justify-between">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-[1px] rounded-2xl z-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">{t('Analisis Penjualan')}</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{t('Grafik tren pendapatan dari kasir dan reparasi selesai')}</p>
        </div>

        {/* Action controllers cluster */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Analytical View Dropdown Selector */}
          <select
            value={activeView}
            onChange={(e) => setActiveView(e.target.value as ChartView)}
            className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 pr-10 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 outline-none cursor-pointer appearance-auto"
          >
            <option value="total_inflow">{t('Total Pendapatan Hari Ini')}</option>
            <option value="profit_vs_expense">{t('Laba Bersih vs Pengeluaran')}</option>
            <option value="pos_sales">{t('Total Penjualan POS')}</option>
            <option value="service_fees">{t('Total Jasa Servis')}</option>
            <option value="completed_services">{t('Volume Laptop Diservis')}</option>
          </select>

          {/* Granularity segmented controller tabs */}
          <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl">
            <button
              onClick={() => setGranularity('hari')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                granularity === 'hari'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t('Hari')}
            </button>
            <button
              onClick={() => setGranularity('bulan')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                granularity === 'bulan'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t('Bulan')}
            </button>
            <button
              onClick={() => setGranularity('tahun')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                granularity === 'tahun'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t('Tahun')}
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 relative flex-1">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
