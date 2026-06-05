'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Loader2, AlertTriangle } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: 'owner' | 'staff' | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'owner' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check active session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          setUser(session.user);
          const userRole = session.user.app_metadata?.role || session.user.user_metadata?.role || 'staff';
          setRole(userRole as 'owner' | 'staff');
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error('Error getting session:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        const userRole = session.user.app_metadata?.role || session.user.user_metadata?.role || 'staff';
        setRole(userRole as 'owner' | 'staff');
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    router.push('/login');
    setLoading(false);
  };

  // Redirect handling
  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login';

    if (!user) {
      // If guest and trying to access protected dashboard routes, redirect to login
      if (!isAuthPage) {
        router.push('/login');
      }
    } else {
      // If logged in and on login page, redirect to landing dashboard
      if (isAuthPage) {
        if (role === 'owner') {
          router.push('/dashboard');
        } else {
          router.push('/kasir');
        }
      }
    }
  }, [user, role, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <p className="text-sm font-medium">Memeriksa hak akses keamanan...</p>
      </div>
    );
  }

  // Access check for role protection
  const isStaff = role === 'staff';
  const isRestrictedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/finance') || pathname.startsWith('/owner') || pathname === '/';

  if (user && isStaff && isRestrictedPath) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-lg text-center space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Akses Ditolak</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Maaf, akun Anda dengan peran <strong>Staf Toko</strong> tidak memiliki izin untuk mengakses halaman ini. Halaman ini khusus untuk <strong>Owner</strong>.
            </p>
          </div>
          <button
            onClick={() => router.push('/kasir')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all duration-200 shadow-md"
          >
            Kembali ke POS Kasir
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
