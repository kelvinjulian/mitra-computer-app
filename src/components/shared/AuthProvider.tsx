'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  role: 'owner' | 'staff' | 'manager' | 'finance_staff' | 'viewer' | null;
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
  const [role, setRole] = useState<'owner' | 'staff' | 'manager' | 'finance_staff' | 'viewer' | null>(null);
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
          setRole(userRole as 'owner' | 'staff' | 'manager' | 'finance_staff' | 'viewer');
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
        setRole(userRole as 'owner' | 'staff' | 'manager' | 'finance_staff' | 'viewer');
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

  // Redirect handling — runs only after auth resolves (loading=false)
  // Uses a stable effect; per-page synchronous guards handle role-specific page protection.
  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login';

    if (!user) {
      // Guest trying to access any protected route → login
      if (!isAuthPage) {
        router.push('/login');
      }
    } else {
      // Already logged in and landed on login page → redirect to home
      if (isAuthPage) {
        // staff goes to POS, everyone else goes to dashboard
        if (role === 'staff') {
          router.push('/kasir');
        } else {
          router.push('/dashboard');
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

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
