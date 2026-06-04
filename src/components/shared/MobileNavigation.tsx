'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Package, Wrench, LogOut } from 'lucide-react';
import { useAuth } from '@/components/shared/AuthProvider';

export default function MobileNavigation() {
  const pathname = usePathname();
  const { role, logout } = useAuth();

  if (role !== 'staff') return null;

  const navItems = [
    { name: 'POS Kasir', href: '/kasir', icon: ShoppingCart },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Service', href: '/service', icon: Wrench },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around z-50 md:hidden print:hidden transition-colors duration-200 shadow-lg">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-zinc-500 dark:text-zinc-400 ${
              isActive 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold' 
                : 'hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Icon size={20} className={isActive ? 'text-emerald-600 dark:text-emerald-400' : ''} />
            <span className="text-[10px] tracking-tight">{item.name}</span>
          </Link>
        );
      })}
      
      <button
        onClick={logout}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-zinc-500 dark:text-zinc-400 hover:text-rose-650 dark:hover:text-rose-450 cursor-pointer"
      >
        <LogOut size={20} />
        <span className="text-[10px] tracking-tight">Keluar</span>
      </button>
    </div>
  );
}
