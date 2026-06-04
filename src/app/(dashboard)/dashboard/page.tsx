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

type Product = Database['public']['Tables']['products']['Row'];
type Service = Database['public']['Tables']['services']['Row'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  const [activeServicesCount, setActiveServicesCount] = useState(0);
  const [recentServices, setRecentServices] = useState<Service[]>([]);

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'antrean': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
      case 'dicek': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'menunggu_part': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      case 'selesai': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'batal': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
      default: return 'bg-zinc-100 text-zinc-800';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const fetchDashboardData = async () => {
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

      // 3. Fetch Transactions Today (POS)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const isoToday = startOfToday.toISOString();

      const { data: txs, error: txErr } = await supabase
        .from('transactions')
        .select('total_amount')
        .gte('created_at', isoToday);
      if (txErr) throw txErr;

      const posRevenue = (txs || []).reduce((sum, t) => sum + t.total_amount, 0);

      // 3b. Fetch Services Selesai Hari Ini
      const { data: svcToday, error: svcTodayErr } = await supabase
        .from('services')
        .select('service_cost, part_cost')
        .eq('status', 'selesai')
        .gte('updated_at', isoToday);
      if (svcTodayErr) throw svcTodayErr;

      const serviceRevenue = (svcToday || []).reduce(
        (sum, s) => sum + (s.service_cost || 0) + (s.part_cost || 0),
        0
      );

      setTodayRevenue(posRevenue + serviceRevenue);

      // 4. Fetch Monthly Expenses
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const firstDayOfMonthString = startOfMonth.toISOString().split('T')[0];

      const { data: exps, error: expErr } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDayOfMonthString);
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
        <p className="text-sm font-medium">Memuat ikhtisar dashboard...</p>
      </div>
    );
  }

  const stats = [
    { name: 'Omset Hari Ini', value: formatRupiah(todayRevenue), description: 'Gabungan Penjualan & Service Selesai Hari Ini', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-500/10' },
    { name: 'Antrean Service', value: `${activeServicesCount} Device`, description: 'Antrean & sedang dicek', icon: Wrench, color: 'text-blue-600 bg-blue-500/10' },
    { name: 'Peringatan Stok', value: `${lowStockCount} Barang`, description: 'Segera restok dari Jambi', icon: AlertCircle, color: 'text-amber-600 bg-amber-500/10' },
    { name: 'Pengeluaran Bulan Ini', value: formatRupiah(monthlyExpenses), description: 'Operasional ruko & operasional toko', icon: TrendingDown, color: 'text-rose-600 bg-rose-500/10' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Database Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-800 p-6 rounded-2xl border border-emerald-500/20 dark:border-zinc-800 text-white shadow-xl">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Selamat Datang di Mitra Computer</h2>
          <p className="text-emerald-100 dark:text-zinc-400 text-xs mt-1 md:text-sm">Pantau stok barang, catat penjualan kasir, dan pantau status service fisik secara real-time.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/kasir" className="bg-white text-emerald-700 hover:bg-zinc-50 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 shadow-md flex items-center gap-2">
            <ShoppingBag size={16} />
            POS Kasir Baru
          </Link>
          <Link href="/service" className="bg-emerald-700/50 hover:bg-emerald-750/50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white border border-emerald-500/30 dark:border-zinc-700 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 flex items-center gap-2">
            <Wrench size={16} />
            Terima Service
          </Link>
        </div>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 hover:border-emerald-500/30 transition-all duration-300 shadow-sm flex flex-col justify-between group text-slate-900 dark:text-zinc-50">
              <div className="flex items-start justify-between">
                <span className="text-slate-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">{stat.name}</span>
                <div className={`p-2.5 rounded-xl ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">{stat.value}</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{stat.description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Repairs / Service list (Col-span 2) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 lg:col-span-2 shadow-sm text-slate-900 dark:text-zinc-50">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">Antrean Service Aktif</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Daftar perangkat yang sedang dikerjakan atau menunggu keputusan</p>
            </div>
            <Link href="/service" className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1 transition-colors">
              Lihat Semua
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            {recentServices.length === 0 ? (
              <p className="text-center py-10 text-xs text-zinc-400">Tidak ada antrean service aktif.</p>
            ) : (
              recentServices.map((service) => (
                <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800/60 hover:bg-slate-100/50 dark:hover:bg-zinc-900/40 transition-colors gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 text-sm">{service.customer_name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">• {formatTime(service.created_at)}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-655 dark:text-zinc-400">{service.device_name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 italic">"{service.complaint}"</p>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusColor(service.status)}`}>
                      {service.status.replace('_', ' ')}
                    </span>
                    <Link href={`/service`} className="text-slate-400 hover:text-emerald-600 transition-colors">
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock alerts (Col-span 1) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between text-slate-900 dark:text-zinc-50">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">Peringatan Stok Tipis</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Stok berada di bawah batas minimum</p>
              </div>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase">Alert</span>
            </div>

            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <p className="text-center py-10 text-xs text-zinc-400">Semua stok produk mencukupi.</p>
              ) : (
                lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate block max-w-[150px] md:max-w-[180px]">{product.name}</span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">{product.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-500 block">Stok: {product.stock}</span>
                      <span className="text-[9px] font-medium text-slate-400 dark:text-zinc-500">Min: {product.min_stock_threshold}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link href="/inventory" className="w-full mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 py-2.5 rounded-xl text-center text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors block">
            Kelola Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
