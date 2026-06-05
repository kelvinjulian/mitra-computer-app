'use client';

import { usePathname, useRouter } from 'next/navigation';
import { 
  Clock, 
  ChevronRight,
  Menu,
  LogOut,
  User
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/shared/AuthProvider';

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAuth();
  const [time, setTime] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

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

  const handleLogout = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Avatar initials & label
  const avatarInitials = role === 'owner' ? 'OW' : 'ST';
  const roleLabel = role === 'owner' ? 'Owner' : 'Staff Toko';

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 transition-colors duration-200 print:hidden">
      {/* Page Breadcrumbs */}
      <div className="flex items-center gap-2">
        {role === 'owner' && (
          <button
            onClick={onMenuClick}
            className="p-2 md:hidden text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg mr-1 cursor-pointer"
            title="Menu Utama"
          >
            <Menu size={18} />
          </button>
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hidden md:inline">Mitra Computer</span>
        <ChevronRight size={12} className="text-zinc-300 dark:text-zinc-700 hidden md:inline" />
        <span className="text-sm md:text-base font-semibold text-zinc-800 dark:text-zinc-100 max-w-[180px] md:max-w-none truncate" title={getPageTitle()}>
          <span className="inline md:hidden">
            {getPageTitle() === 'Dashboard Overview' ? 'Dashboard' :
             getPageTitle() === 'POS Kasir Toko' ? 'POS Kasir' :
             getPageTitle() === 'Manajemen Inventory' ? 'Inventory' :
             getPageTitle() === 'Pelacakan Reparasi' ? 'Service' :
             getPageTitle() === 'Arus Kas & Buku Keuangan' ? 'Arus Kas' : getPageTitle()}
          </span>
          <span className="hidden md:inline">
            {getPageTitle()}
          </span>
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-full">
          <Clock size={12} className="text-indigo-500" />
          <span>{time || '--:--:--'} WIB</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="user-avatar-btn"
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white font-bold text-sm select-none uppercase transition-colors duration-150 shadow-sm cursor-pointer"
            title={roleLabel}
          >
            {avatarInitials}
          </button>

          {/* Dropdown Panel */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-zinc-950/80 overflow-hidden z-50 animate-fade-in">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {avatarInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">{roleLabel}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider truncate">Mitra Computer</p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <button
                  onClick={() => { setDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <User size={13} className="text-slate-400 dark:text-zinc-500" />
                  Profil Akun
                </button>

                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer mt-0.5"
                >
                  <LogOut size={13} />
                  Keluar / Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
