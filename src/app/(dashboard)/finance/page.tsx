'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Search, 
  ArrowUpRight, 
  Calendar,
  DollarSign,
  Briefcase,
  FileSpreadsheet,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'];
interface MappedIncome {
  id: string;
  source: string;
  amount: number;
  date: string;
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<MappedIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const fetchIncomesAndExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Ambil data transactions
      const { data: txs, error: txsErr } = await supabase
        .from('transactions')
        .select('id, invoice_number, total_amount, created_at');
      if (txsErr) throw txsErr;

      // 2. Ambil data service yang selesai (selesai)
      const { data: svcs, error: svcsErr } = await supabase
        .from('services')
        .select('id, device_name, customer_name, service_cost, part_cost, created_at')
        .eq('status', 'selesai');
      if (svcsErr) throw svcsErr;

      // 3. Ambil data expenses
      const { data: exps, error: expsErr } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (expsErr) throw expsErr;

      // Map dan gabungkan data pemasukan
      const mappedTxs = (txs || []).map((t) => ({
        id: t.id,
        source: `Penjualan POS (${t.invoice_number})`,
        amount: t.total_amount,
        date: new Date(t.created_at).toISOString().split('T')[0]
      }));

      const mappedSvcs = (svcs || []).map((s) => ({
        id: s.id,
        source: `Service - ${s.device_name} (${s.customer_name})`,
        amount: (s.service_cost || 0) + (s.part_cost || 0),
        date: new Date(s.created_at).toISOString().split('T')[0]
      }));

      const combinedIncomes = [...mappedTxs, ...mappedSvcs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setIncomes(combinedIncomes);
      setExpenses(exps || []);
    } catch (err: any) {
      console.error('Error fetching financial records:', err.message);
      setError(err.message || 'Gagal mengambil catatan keuangan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomesAndExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    const amount = parseInt(formData.get('amount') as string, 10);
    const date = formData.get('date') as string;

    try {
      const { error: insertErr } = await supabase
        .from('expenses')
        .insert([{ description, amount, date }]);

      if (insertErr) throw insertErr;

      setShowAddExpense(false);
      fetchIncomesAndExpenses();
    } catch (err: any) {
      console.error('Error adding expense:', err.message);
      alert('Gagal mencatat pengeluaran: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const filteredExpenses = expenses.filter(exp => 
    exp.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
        <p className="text-sm font-medium">Memuat data keuangan dari database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Database Error Alert */}
      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Net Profit Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keuntungan Bersih</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">{formatRupiah(netProfit)}</h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp size={10} />
              {netProfit >= 0 ? 'Arus Kas Positif' : 'Arus Kas Negatif'}
            </p>
          </div>
        </div>

        {/* Total Cash In */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pemasukan (POS & Service)</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">{formatRupiah(totalIncome)}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Berdasarkan {incomes.length} transaksi terverifikasi</p>
          </div>
        </div>

        {/* Total Cash Out */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pengeluaran Toko</span>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight">{formatRupiah(totalExpense)}</h3>
            <p className="text-[10px] text-rose-600 font-semibold mt-1">Operasional, listrik, & operasional Jambi</p>
          </div>
        </div>
      </div>

      {/* Main Ledger Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pemasukan Logs */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-sm sm:text-base">Catatan Pemasukan</h3>
              <p className="text-xs text-slate-500">Log transaksi masuk dari kasir & service selesai</p>
            </div>
            <FileSpreadsheet size={18} className="text-emerald-500" />
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {incomes.length === 0 ? (
              <p className="text-center py-20 text-xs text-slate-400">Belum ada catatan pemasukan.</p>
            ) : (
              incomes.map((inc) => (
                <div key={inc.id} className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">{inc.source}</span>
                    <span className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Calendar size={10} />
                      {inc.date}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-600">{formatRupiah(inc.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pengeluaran Logs (Editable) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-sm sm:text-base">Buku Kas Pengeluaran</h3>
                <p className="text-xs text-slate-500">Catat semua pengeluaran ruko & operasional Bangko</p>
              </div>
              <button
                onClick={() => setShowAddExpense(true)}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1"
              >
                <Plus size={12} />
                Catat
              </button>
            </div>

            {/* Search Input for Expenses */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari deskripsi pengeluaran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Expenses List */}
            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {filteredExpenses.length === 0 ? (
                <p className="text-center py-20 text-xs text-slate-400">Belum ada catatan pengeluaran.</p>
              ) : (
                filteredExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">{exp.description}</span>
                      <span className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {exp.date}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-rose-600">-{formatRupiah(exp.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal Overlay */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Catat Pengeluaran Baru</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deskripsi Pengeluaran</label>
                <input type="text" name="description" placeholder="Contoh: Bensin motor untuk kirim barang" required className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nominal (Rp)</label>
                  <input 
                    type="text" 
                    name="amount" 
                    placeholder="Nominal Rupiah" 
                    required 
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal</label>
                  <input type="date" name="date" required className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none cursor-pointer dark:text-zinc-100" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowAddExpense(false)} className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center gap-2 disabled:opacity-50">
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
