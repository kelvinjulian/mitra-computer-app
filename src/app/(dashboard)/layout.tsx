import Sidebar from '@/components/shared/Sidebar';
import Navbar from '@/components/shared/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      {/* Sidebar - static on desktop */}
      <Sidebar className="hidden md:flex flex-shrink-0" />

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar />

        {/* Dynamic page contents */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/10 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
