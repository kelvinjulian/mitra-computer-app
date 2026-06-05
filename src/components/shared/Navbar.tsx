'use client';

import { usePathname, useRouter } from 'next/navigation';
import { 
  Clock, 
  ChevronRight,
  Menu,
  LogOut,
  User,
  Globe
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/shared/AuthProvider';
import { useLanguage } from '@/components/shared/LanguageProvider';

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
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
    if (segments.length === 0) return t('Beranda');
    const rawTitle = segments[segments.length - 1];
    switch (rawTitle) {
      case 'dashboard': return 'Dashboard'; // Keep "Dashboard" unchanged
      case 'kasir': return t('POS Kasir');
      case 'inventory': return t('Inventory Stok');
      case 'service': return t('Pelacakan Service');
      case 'finance': return t('Arus Kas / Finansial');
      case 'staff': return t('Kelola Staf');
      default: return rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    }
  };

  // Avatar initials & label
  const avatarInitials = role === 'owner' ? 'OW' : role === 'manager' ? 'MN' : role === 'finance_staff' ? 'FS' : role === 'viewer' ? 'VI' : 'ST';
  const roleLabel = role === 'owner' ? t('Administrator') : role === 'manager' ? t('Manager') : role === 'finance_staff' ? t('Finance Staff') : role === 'viewer' ? t('Viewer') : t('Karyawan');

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 transition-colors duration-200 print:hidden">
      {/* Page Breadcrumbs */}
      <div className="flex items-center gap-2">
        {(role === 'owner' || role === 'manager') && (
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
          <span>{getPageTitle()}</span>
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-full">
          <Clock size={12} className="text-indigo-500" />
          <span>{time || '--:--:--'} WIB</span>
        </div>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title={language === 'id' ? 'Switch to English' : 'Ubah ke Bahasa Indonesia'}
        >
          <Globe size={16} />
          <span className="uppercase">{language}</span>
        </button>

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
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-zinc-950/80 overflow-hidden z-50 animate-popover-fade-in p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm shrink-0">
                  {avatarInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                    {user?.user_metadata?.name || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {user?.email || ''}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-zinc-800 pt-2">
                <span className="text-[9px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wider block mb-1">Peran Akses</span>
                <span className="inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/30">
                  {role ? role.replace('_', ' ').toUpperCase() : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
