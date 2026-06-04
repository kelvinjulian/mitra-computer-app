'use client';

import { usePathname, useRouter } from 'next/navigation';
import { 
  Bell, 
  Search, 
  Clock, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/shared/AuthProvider';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAuth();
  const [time, setTime] = useState<string>('');
  const [hasLowStock, setHasLowStock] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check low stock once on mount — ping only if real low stock exists
  useEffect(() => {
    const checkLowStock = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('stock, min_stock_threshold');
        if (error || !data) return;
        const hasLow = data.some((p) => p.stock <= p.min_stock_threshold);
        setHasLowStock(hasLow);
      } catch {
        // silently fail — not critical
      }
    };
    checkLowStock();
  }, []);

  // Page title mapping
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

  const handleInvoiceSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = invoiceSearch.trim();
      router.push(`/finance?search=${encodeURIComponent(term)}`);
      // Dispatch custom event in case we are already on the finance page
      window.dispatchEvent(new CustomEvent('global-invoice-search', { detail: term }));
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
          <span>{time || '--:--:--'} WIB</span>
        </div>

        {/* Global Invoice Search */}
        <div className="relative w-48 md:w-60 hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Cari no. invoice..." 
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            onKeyDown={handleInvoiceSearch}
            className="w-full pl-9 pr-4 py-1.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-600 transition-colors placeholder:text-zinc-400"
          />
        </div>

        {/* Theme & Notifications */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Component */}
          <ThemeToggle />

          {/* Low Stock Alert — ping ONLY when real low-stock products exist */}
          <button 
            className={`relative p-2 rounded-lg transition-all duration-200 ${
              hasLowStock 
                ? 'text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-950/20 animate-pulse' 
                : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`} 
            title={hasLowStock ? 'Ada produk stok menipis!' : 'Stok semua aman'}
          >
            <AlertTriangle size={18} />
            {hasLowStock && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </button>

          {/* Standard Notifications */}
          <button className="relative p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200">
            <Bell size={18} />
          </button>
        </div>

        {/* Staff Identity Widget */}
        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm select-none uppercase">
            {role === 'owner' ? 'OW' : 'ST'}
          </div>
          <div className="text-left hidden lg:block">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              {role === 'owner' ? 'Owner' : 'Staff Toko'}
            </p>
            <span className="text-[9px] font-semibold text-zinc-400 uppercase">Mitra Computer</span>
          </div>
        </div>
      </div>
    </header>
  );
}
