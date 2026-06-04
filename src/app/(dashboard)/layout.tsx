'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import Navbar from '@/components/shared/Navbar';
import MobileNavigation from '@/components/shared/MobileNavigation';
import { X } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close the mobile drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      {/* Sidebar - static on desktop */}
      <Sidebar className="hidden md:flex flex-shrink-0" />

      {/* Mobile Drawer Backdrop & Container */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden no-print animate-fade-in"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div 
            className="w-64 h-full bg-zinc-50 dark:bg-zinc-900 shadow-2xl relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button inside Drawer */}
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="absolute right-4 top-3.5 p-1.5 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 bg-zinc-150 dark:bg-zinc-800/80 rounded-lg z-50 md:hidden cursor-pointer"
            >
              <X size={16} />
            </button>
            <Sidebar className="flex h-full w-full border-r-0" />
          </div>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar onMenuClick={() => setIsDrawerOpen(true)} />

        {/* Dynamic page contents with extra bottom padding on mobile to not overlap bottom nav */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/10 p-6 md:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Bottom Nav Bar for Staff on Mobile */}
        <MobileNavigation />
      </div>
    </div>
  );
}
