'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Plus, 
  Trash2, 
  KeyRound, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  UserPlus,
  Mail,
  ShieldAlert,
  Calendar,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  role: string;
  email: string;
  created_at: string;
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<StaffUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    };
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getHeaders();
      const res = await fetch('/api/admin/staff', { headers });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Gagal memuat daftar staf.');
      setStaffList(json.data || []);
    } catch (err: any) {
      console.error('Error fetching staff:', err.message);
      setError(err.message || 'Gagal memuat daftar staf.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password, name })
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Gagal membuat staf baru.');

      showToast(`Staf "${name}" berhasil didaftarkan!`);
      setShowAddModal(false);
      setShowPassword(false);
      fetchStaff();
    } catch (err: any) {
      console.error('Error creating staff:', err.message);
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showResetModal) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;

    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/staff', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id: showResetModal.id, password })
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Gagal mereset kata sandi.');

      showToast(`Kata sandi untuk ${showResetModal.name} berhasil diperbarui!`);
      setShowResetModal(null);
      setShowResetPassword(false);
    } catch (err: any) {
      console.error('Error resetting password:', err.message);
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staff: StaffUser) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus akses login untuk staff "${staff.name}" (${staff.email}) secara permanen?\n\nCatatan: Histori transaksi POS yang bersangkutan akan tetap dipertahankan, namun akun loginnya akan dicabut.`
    );
    if (!confirmed) return;

    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/admin/staff?id=${staff.id}`, {
        method: 'DELETE',
        headers
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Gagal mencabut akses staf.');

      showToast(`Akses staf "${staff.name}" berhasil dicabut!`);
      fetchStaff();
    } catch (err: any) {
      console.error('Error deleting staff:', err.message);
      showToast(err.message, 'error');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-zinc-50">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Manajemen Akses Pegawai</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Daftarkan akun kasir staff baru, kelola sandi login, atau cabut hak akses sistem.</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setShowPassword(false); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 min-h-[44px] rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} />
          Daftarkan Staff Baru
        </button>
      </div>

      {/* Database Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Main Table view */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Users size={16} className="text-slate-400" />
          <h3 className="font-bold text-sm">Daftar Akun Kasir / Staff Terdaftar</h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-xs font-medium">Memuat data pegawai...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ShieldAlert className="mx-auto text-slate-350 dark:text-zinc-700 mb-3" size={36} />
            <p className="text-xs font-medium">Belum ada akun staff kasir terdaftar</p>
            <p className="text-[10px] text-slate-500 mt-1">Daftarkan akun kasir staff baru untuk mulai memproses transaksi POS.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-semibold bg-slate-50/50 dark:bg-zinc-950/20">
                  <th className="py-3.5 px-6">Nama Lengkap</th>
                  <th className="py-3.5 px-6 hidden sm:table-cell">Alamat Email</th>
                  <th className="py-3.5 px-6">Peran Akses</th>
                  <th className="py-3.5 px-6 hidden md:table-cell">Tanggal Terdaftar</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/10">
                    <td className="py-4 px-6 font-semibold">{staff.name}</td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400 hidden sm:table-cell">{staff.email}</td>
                    <td className="py-4 px-6">
                      <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400 dark:text-zinc-550 hidden md:table-cell">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {formatDate(staff.created_at)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => { setShowResetModal(staff); setShowResetPassword(false); }}
                        className="py-2.5 px-3 text-slate-555 hover:text-indigo-655 dark:text-zinc-450 dark:hover:text-indigo-400 bg-slate-50 hover:bg-indigo-500/10 dark:bg-zinc-950 dark:hover:bg-indigo-950/30 rounded-xl transition-all inline-flex items-center gap-1 font-semibold text-[10px] cursor-pointer"
                        title="Reset Kata Sandi"
                      >
                        <KeyRound size={12} />
                        Sandi
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(staff)}
                        className="py-2.5 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all inline-flex items-center gap-1 font-semibold text-[10px] cursor-pointer"
                        title="Cabut Hak Akses"
                      >
                        <Trash2 size={12} />
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base">Daftarkan Akun Staff Baru</h3>
              <button 
                onClick={() => { setShowAddModal(false); setShowPassword(false); }} 
                className="text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap</label>
                <div className="relative">
                  <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    name="name" 
                    placeholder="Contoh: Ahmad Fauzi" 
                    required 
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Alamat Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    name="email" 
                    placeholder="ahmad@mitracomputer.com" 
                    required 
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Kata Sandi Awal</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="password" 
                    placeholder="Minimal 6 karakter" 
                    required 
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); setShowPassword(false); }} 
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-550 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Daftarkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base">Reset Sandi - {showResetModal.name}</h3>
              <button 
                onClick={() => { setShowResetModal(null); setShowResetPassword(false); }} 
                className="text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showResetPassword ? 'text' : 'password'} 
                    name="password" 
                    placeholder="Masukkan sandi baru (min 6 karakter)" 
                    required 
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowResetModal(null); setShowResetPassword(false); }} 
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-550 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center gap-2 disabled:opacity-50 animate-pulse animate-duration-1000"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Simpan Sandi Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300' 
            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
