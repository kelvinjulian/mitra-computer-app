'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wrench, 
  TrendingUp, 
  Settings, 
  LogOut,
  Laptop
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'POS Kasir', href: '/kasir', icon: ShoppingCart },
    { name: 'Inventory Stok', href: '/inventory', icon: Package },
    { name: 'Pelacakan Service', href: '/service', icon: Wrench },
    { name: 'Arus Kas / Finansial', href: '/finance', icon: TrendingUp },
  ];

  return (
    <aside className={`w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 flex flex-col h-screen sticky top-0 transition-colors duration-200 ${className}`}>
      {/* Header / Logo */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="bg-emerald-600 p-2 rounded-lg text-white">
          <Laptop size={20} />
        </div>
        <div>
          <h1 className="font-bold text-zinc-900 dark:text-white text-sm tracking-tight leading-tight">Mitra Computer</h1>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Internal POS & Service</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500 pl-3.5' 
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Icon 
                size={18} 
                className={`transition-colors duration-200 ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                }`} 
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info / Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 mb-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            O
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">Owner Mitra Computer</p>
            <p className="text-[10px] text-zinc-550 truncate">Administrator</p>
          </div>
        </div>

        <button 
          onClick={() => alert('Log out clicked')}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-150 dark:hover:bg-zinc-800/80 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200"
        >
          <LogOut size={14} />
          <span>Keluar Aplikasi</span>
        </button>
      </div>
    </aside>
  );
}
