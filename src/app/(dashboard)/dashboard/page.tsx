'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Wrench, 
  AlertCircle, 
  ArrowUpRight,
  TrendingDown,
  ShoppingBag,
  Clock,
  ArrowRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import AuditLogsTimeline from './AuditLogsTimeline';
import DateRangePicker, { DateRange } from '@/components/shared/DateRangePicker';
import { useLanguage } from '@/components/shared/LanguageProvider';
import SalesChart from './SalesChart';

type Product = Database['public']['Tables']['products']['Row'];
type Service = Database['public']['Tables']['services']['Row'];

export default function DashboardPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  const [activeServicesCount, setActiveServicesCount] = useState(0);
  const [recentServices, setRecentServices] = useState<Service[]>([]);

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  // Date range state — default to today
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'antrean': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
      case 'dicek': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'menunggu_part': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      case 'selesai': return 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-950/30 dark:text-blue-400';
      case 'batal': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
      default: return 'bg-zinc-100 text-zinc-800';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const fetchDashboardData = async (range: DateRange) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Products
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('*');
      if (prodErr) throw prodErr;

      const allProds = prods || [];
      const lowStock = allProds.filter((p) => p.stock <= p.min_stock_threshold);
      setTotalProductsCount(allProds.length);
      setLowStockCount(lowStock.length);
      setLowStockProducts(lowStock.slice(0, 5));

      // 2. Fetch Services
      const { data: svcs, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
      if (svcErr) throw svcErr;

      const allSvcs = svcs || [];
      const activeSvcs = allSvcs.filter((s) => s.status === 'antrean' || s.status === 'dicek');
      setActiveServicesCount(activeSvcs.length);
      setRecentServices(allSvcs.slice(0, 5));

      // 3. Fetch Transactions for the selected date range (POS)
      const rangeFrom = range.from
        ? (() => { const d = new Date(range.from!); d.setHours(0, 0, 0, 0); return d.toISOString(); })()
        : new Date(0).toISOString();

      const rangeTo = range.to
        ? (() => { const d = new Date(range.to!); d.setHours(23, 59, 59, 999); return d.toISOString(); })()
        : new Date().toISOString();

      const { data: txs, error: txErr } = await supabase
        .from('transactions')
        .select('total_amount')
        .gte('created_at', rangeFrom)
        .lte('created_at', rangeTo);
      if (txErr) throw txErr;

      const posRevenue = (txs || []).reduce((sum, t) => sum + t.total_amount, 0);

      // 3b. Fetch Services Selesai in date range
      const { data: svcToday, error: svcTodayErr } = await supabase
        .from('services')
        .select('service_cost, part_cost')
        .eq('status', 'selesai')
        .gte('updated_at', rangeFrom)
        .lte('updated_at', rangeTo);
      if (svcTodayErr) throw svcTodayErr;

      const serviceRevenue = (svcToday || []).reduce(
        (sum, s) => sum + (s.service_cost || 0) + (s.part_cost || 0),
        0
      );

      setTodayRevenue(posRevenue + serviceRevenue);

      // 4. Fetch Expenses in date range
      const fromDateStr = range.from
        ? new Date(range.from).toISOString().split('T')[0]
        : '1970-01-01';
      const toDateStr = range.to
        ? new Date(range.to).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const { data: exps, error: expErr } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', fromDateStr)
        .lte('date', toDateStr);
      if (expErr) throw expErr;

      const expensesSum = (exps || []).reduce((sum, e) => sum + e.amount, 0);
      setMonthlyExpenses(expensesSum);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err.message);
      setError(err.message || 'Gagal memuat ringkasan dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData(dateRange);
  }, []);

  // Re-fetch when dateRange changes (triggered by Apply)
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    fetchDashboardData(range);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <p className="text-sm font-medium">{t('Memuat ikhtisar dashboard...')}</p>
      </div>
    );
  }

  const stats = [
    { name: 'Omset Periode Ini', value: formatRupiah(todayRevenue), description: t('Gabungan Penjualan & Service Selesai'), icon: TrendingUp, color: 'text-indigo-600 bg-indigo-500/10' },
    { name: 'Antrean Service', value: `${activeServicesCount} Device`, description: t('Antrean & sedang dicek'), icon: Wrench, color: 'text-blue-600 bg-blue-500/10' },
    { name: 'Peringatan Stok', value: `${lowStockCount} Barang`, description: t('Segera restok dari Jambi'), icon: AlertCircle, color: 'text-amber-600 bg-amber-500/10' },
    { name: 'Pengeluaran Periode', value: formatRupiah(monthlyExpenses), description: t('Operasional ruko & toko'), icon: TrendingDown, color: 'text-rose-600 bg-rose-500/10' },
  ];

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in transition-all ease-in-out duration-200">
      {/* Database Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Streamlined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Page Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">{t('Overview Dashboard')}</h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">
            {t('Pantau metrik real-time — data diperbarui otomatis setiap sesi.')}
          </p>
        </div>

        {/* Right: Date Range Picker */}
        <div className="shrink-0">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/kasir"
          className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/20 cursor-pointer"
        >
          <ShoppingBag size={14} />
          {t('POS Kasir Baru')}
        </Link>
        <Link
          href="/service"
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <Wrench size={14} />
          {t('Terima Service')}
        </Link>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white dark:bg-zinc-900 p-2.5 md:p-6 rounded-2xl border border-slate-100 shadow-sm dark:border-zinc-800/80 hover:border-indigo-500/20 transition-all duration-300 hover:shadow-md flex flex-col justify-between group text-slate-900 dark:text-zinc-50">
              <div className="flex items-start justify-between gap-1">
                <span className="text-slate-400 dark:text-zinc-500 text-[9px] md:text-xs font-semibold uppercase tracking-wider">{t(stat.name)}</span>
                <div className={`p-1.5 md:p-2.5 rounded-xl ${stat.color} transition-transform duration-300 group-hover:scale-110 shrink-0`}>
                  <Icon size={14} className="md:w-5 md:h-5" />
                </div>
              </div>
              <div className="mt-2 md:mt-4">
                <h3 className="text-sm md:text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">{stat.value}</h3>
                <div className="flex items-center gap-1.5 mt-0.5 md:mt-2">
                  <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-zinc-500 font-medium line-clamp-1">{stat.description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Sales Chart */}
      <SalesChart todayRevenue={todayRevenue} />

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Repairs / Service list (Col-span 2) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 shadow-sm dark:border-zinc-800/80 lg:col-span-2 text-slate-900 dark:text-zinc-50">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">{t('Antrean Service Aktif')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{t('Daftar perangkat yang sedang dikerjakan atau menunggu keputusan')}</p>
            </div>
            <Link href="/service" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 transition-colors">
              {t('Lihat Semua')}
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            {recentServices.length === 0 ? (
              <p className="text-center py-10 text-xs text-zinc-400">{t('Tidak ada antrean service aktif.')}</p>
            ) : (
              recentServices.map((service) => (
                <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800/60 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40 transition-colors gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 text-sm">{service.customer_name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">• {formatTime(service.created_at)}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-655 dark:text-zinc-400">{service.device_name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic">&ldquo;{service.complaint}&rdquo;</p>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusColor(service.status)}`}>
                      {t(service.status === 'antrean' ? 'Antrean' : service.status === 'dicek' ? 'Dicek' : service.status === 'menunggu_part' ? 'Menunggu Part' : service.status === 'selesai' ? 'Selesai' : 'Batal')}
                    </span>
                    <Link href={`/service`} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock alerts (Col-span 1) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 shadow-sm dark:border-zinc-800/80 flex flex-col justify-between text-slate-900 dark:text-zinc-50">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">{t('Peringatan Stok Tipis')}</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{t('Stok berada di bawah batas minimum')}</p>
              </div>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase">Alert</span>
            </div>

            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <p className="text-center py-10 text-xs text-zinc-400">{t('Semua stok produk mencukupi.')}</p>
              ) : (
                lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate block max-w-[150px] md:max-w-[180px]">{product.name}</span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">{t(product.category.charAt(0).toUpperCase() + product.category.slice(1))}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-500 block">{t('Stok')}: {product.stock}</span>
                      <span className="text-[9px] font-medium text-slate-400 dark:text-zinc-500">Min: {product.min_stock_threshold}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link href="/inventory" className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors py-2.5 rounded-xl text-center text-xs font-semibold block shadow-sm shadow-indigo-600/10 cursor-pointer">
            {t('Kelola Inventory')}
          </Link>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <AuditLogsTimeline />
    </div>
  );
}
