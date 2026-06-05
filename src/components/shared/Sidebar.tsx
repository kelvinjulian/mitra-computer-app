'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wrench, 
  TrendingUp, 
  LogOut,
  Laptop,
  Users
} from 'lucide-react';
import { useAuth } from '@/components/shared/AuthProvider';
import { useLanguage } from '@/components/shared/LanguageProvider';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const { role, user, logout } = useAuth();
  const { t } = useLanguage();

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'POS Kasir', href: '/kasir', icon: ShoppingCart },
    { name: 'Inventory Stok', href: '/inventory', icon: Package },
    { name: 'Pelacakan Service', href: '/service', icon: Wrench },
    { name: 'Arus Kas / Finansial', href: '/finance', icon: TrendingUp },
    { name: 'Kelola Staf', href: '/owner/staff', icon: Users },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    if (role === 'staff' && (item.href === '/dashboard' || item.href === '/finance' || item.href === '/owner/staff')) {
      return false;
    }
    return true;
  });

  return (
    <aside className={`w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 flex flex-col h-screen sticky top-0 transition-colors duration-200 print:hidden ${className}`}>
      {/* Header / Logo */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <Laptop size={20} />
        </div>
        <div>
          <h1 className="font-bold text-zinc-900 dark:text-white text-sm tracking-tight leading-tight">Mitra Computer</h1>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">Internal POS &amp; Service</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border-l-2 border-indigo-600 pl-3.5' 
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Icon 
                size={18} 
                className={`transition-colors duration-200 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                }`} 
              />
              <span>{t(item.name)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info / Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 mb-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm uppercase">
            {role === 'owner' ? 'OW' : 'ST'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
              {user?.user_metadata?.name || user?.email || 'User'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate capitalize">
              {role === 'owner' ? t('Administrator') : t('Karyawan')}
            </p>
          </div>
        </div>

        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-150 dark:hover:bg-zinc-800/80 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 cursor-pointer"
        >
          <LogOut size={14} />
          <span>{t('Keluar')}</span>
        </button>
      </div>
    </aside>
  );
}
