'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import { 
  History, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { useAuth } from '@/components/shared/AuthProvider';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export default function AuditLogsTimeline() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (role !== 'owner') {
      setLogs([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err.message);
      setError(err.message || 'Gagal mengambil log aktivitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'owner') {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [role]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day} ${month} ${year} - ${hours}:${minutes}:${seconds} WIB`;
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CHECKOUT_POS':
        return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50';
      case 'DELETE_TRANSACTION':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50';
      case 'LOGIN':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50';
      case 'CREATE_EXPENSE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-400 dark:border-emerald-800';
      case 'UPDATE_EXPENSE':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/45 dark:text-amber-400 dark:border-amber-800';
      case 'DELETE_EXPENSE':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/45 dark:text-rose-400 dark:border-rose-800';
      default:
        return 'bg-slate-500/10 text-slate-655 border-slate-500/20 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700';
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedLogId === id) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(id);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const emailMatch = log.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const actionMatch = log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const detailsMatch = JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());
    return emailMatch || actionMatch || detailsMatch;
  });

  if (role !== 'owner') {
    return (
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <History size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">Log Audit Aktivitas Karyawan</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Jejak audit permanen transaksi kasir dan perubahan buku kas.</p>
          </div>
        </div>

        {/* Secure clear notification card */}
        <div className="bg-slate-50 dark:bg-zinc-950/40 border border-slate-150 dark:border-zinc-800/60 rounded-xl p-6 text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center">
            <History size={20} />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Akses Log Terbatas</h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Jejak audit riwayat transaksi dan data internal ruko hanya dapat dipantau secara penuh oleh Owner utama Mitra Computer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <History size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-base">Log Audit Aktivitas Karyawan</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Jejak audit permanen transaksi kasir dan perubahan buku kas.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari email, aksi, detail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors dark:text-zinc-100"
            />
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl transition-all text-slate-600 dark:text-zinc-300 disabled:opacity-50"
            title="Muat Ulang Log"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* Database Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Timeline List */}
      <div className="max-h-[500px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-xs font-medium">Memuat riwayat log audit...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Activity className="mx-auto text-slate-350 dark:text-zinc-700 mb-3" size={36} />
            <p className="text-xs font-medium">Belum ada catatan log aktivitas</p>
            <p className="text-[10px] text-slate-555">Segala transaksi kasir dan penghapusan kas akan dicatat secara otomatis di sini.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-100 dark:border-zinc-800 ml-4 pl-6 space-y-6">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              return (
                <div key={log.id} className="relative group">
                  {/* Circle Indicator on the line */}
                  <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-sm z-10">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  </span>

                  <div className="bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl space-y-3 shadow-sm hover:border-slate-200 dark:hover:border-zinc-700 transition-all duration-200">
                    {/* Log Entry Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span>{log.email || 'System'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                        <Clock size={12} className="shrink-0" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </div>

                    {/* Expandable Details Button */}
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-800 text-[10px] font-bold text-slate-555 dark:text-zinc-400 transition-colors"
                    >
                      <span>Detail Metadata</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {/* Expandable Details Panel */}
                    {isExpanded && (
                      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 overflow-x-auto text-[10px] font-mono text-indigo-300 max-h-60 shadow-inner">
                        {log.action === 'UPDATE_EXPENSE' && log.details && typeof log.details === 'object' && 'data_sebelumnya' in log.details ? (
                          <div className="space-y-3 min-w-[480px]">
                            <div className="text-amber-400 font-bold border-b border-zinc-800 pb-1.5 uppercase tracking-wider">Perubahan Catatan Pengeluaran (Expense Update Comparison)</div>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1.5 border-r border-zinc-800/80 pr-4">
                                <div className="text-zinc-500 font-bold uppercase tracking-wide">Data Sebelumnya (Original)</div>
                                <div><span className="text-zinc-500">Deskripsi:</span> <span className="text-rose-400/90 line-through">{(log.details as any).data_sebelumnya?.description || '-'}</span></div>
                                <div><span className="text-zinc-500">Nominal:</span> <span className="text-rose-400/90 line-through">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format((log.details as any).data_sebelumnya?.amount || 0)}</span></div>
                                <div><span className="text-zinc-500">Tanggal:</span> <span className="text-zinc-400">{(log.details as any).data_sebelumnya?.date || '-'}</span></div>
                                <div className="text-[9px] text-zinc-600 mt-2"><span className="text-zinc-500">Dibuat:</span> {formatDateTime((log.details as any).data_sebelumnya?.tanggal_dibuat)}</div>
                              </div>
                              <div className="space-y-1.5 pl-2">
                                <div className="text-emerald-450 font-bold uppercase tracking-wide text-emerald-400/90">Data Sesudah (Updated)</div>
                                <div><span className="text-zinc-500">Deskripsi:</span> <span className="text-emerald-400">{(log.details as any).data_sesudah?.description || '-'}</span></div>
                                <div><span className="text-zinc-500">Nominal:</span> <span className="text-emerald-400">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format((log.details as any).data_sesudah?.amount || 0)}</span></div>
                                <div><span className="text-zinc-500">Tanggal:</span> <span className="text-zinc-400">{(log.details as any).data_sesudah?.date || '-'}</span></div>
                                <div className="text-[9px] text-zinc-650 mt-2"><span className="text-zinc-500">Diedit:</span> {formatDateTime((log.details as any).data_sesudah?.tanggal_diedit)}</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
