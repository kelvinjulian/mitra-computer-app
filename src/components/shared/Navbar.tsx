'use client';

import { usePathname } from 'next/navigation';
import { 
  Bell, 
  Search, 
  Clock, 
  User, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/components/shared/ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simple breadcrumbs mapping
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Beranda';
    const rawTitle = segments[segments.length - 1];
    switch (rawTitle) {
      case 'dashboard': return 'Dashboard Overview';
      case 'kasir': return 'POS Kasir Toko';
      case 'inventory': return 'Manajemen Inventory';
      case 'service': return 'Pelacakan Reparasi';
      case 'finance': return 'Arus Kas & Buku Keuangan';
      default: return rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    }
  };

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 transition-colors duration-200">
      {/* Page Breadcrumbs */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Mitra Computer</span>
        <ChevronRight size={12} className="text-zinc-300 dark:text-zinc-700" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{getPageTitle()}</span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-6">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-full">
          <Clock size={12} className="text-emerald-500" />
          <span>{time || '10:43:00'} WIB</span>
        </div>

        {/* Search Bar */}
        <div className="relative w-48 md:w-64 hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Cari transaksi, barang..." 
            className="w-full pl-9 pr-4 py-1.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-600 transition-colors"
          />
        </div>

        {/* Theme & Notifications */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Component */}
          <ThemeToggle />

          {/* Low Stock Alert Trigger */}
          <button className="relative p-2 rounded-lg text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-950/20 transition-all duration-200" title="Peringatan Stok Menipis">
            <AlertTriangle size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
          </button>

          {/* Standard Notifications */}
          <button className="relative p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
          </button>
        </div>

        {/* Staff Identity Widget */}
        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-650 dark:text-zinc-350">
            <User size={16} />
          </div>
          <div className="text-left hidden lg:block">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Bangko Staff</p>
            <span className="text-[9px] font-semibold text-zinc-400 uppercase">Toko POS</span>
          </div>
        </div>
      </div>
    </header>
  );
}
