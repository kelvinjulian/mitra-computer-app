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
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
  ShoppingBag,
  Wrench
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'];
interface MappedIncome {
  id: string;
  source: string;
  amount: number;
  date: string;
  type: 'pos' | 'service';
  netMargin: number;
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<MappedIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [posMargin, setPosMargin] = useState(0);
  const [serviceCostSum, setServiceCostSum] = useState(0);
  const [selectedIncome, setSelectedIncome] = useState<MappedIncome | null>(null);
  const [posDetail, setPosDetail] = useState<any | null>(null);
  const [serviceDetail, setServiceDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingTx, setDeletingTx] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInvoiceTerm, setSearchInvoiceTerm] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} - ${hours}:${minutes} WIB`;
  };

  const handleIncomeClick = async (income: MappedIncome) => {
    setSelectedIncome(income);
    setLoadingDetail(true);
    setPosDetail(null);
    setServiceDetail(null);
    try {
      if (income.type === 'pos') {
        // Fetch transaction details
        const { data: tx, error: txErr } = await supabase
          .from('transactions')
          .select('id, invoice_number, total_amount, payment_method, created_at, staff_id')
          .eq('id', income.id)
          .single();

        if (txErr) throw txErr;

        // Fetch staff name
        let staffName = 'Staff Toko';
        if (tx.staff_id) {
          const { data: usr, error: usrErr } = await supabase
            .from('users')
            .select('name')
            .eq('id', tx.staff_id)
            .single();
          if (!usrErr && usr) {
            staffName = usr.name;
          }
        }

        // Fetch transaction items (termasuk custom items)
        const { data: items, error: itemsErr } = await supabase
          .from('transaction_items')
          .select('id, quantity, price_at_sale, product_id, custom_item_name, cost_price_at_sale')
          .eq('transaction_id', income.id);

        if (itemsErr) throw itemsErr;

        // Fetch related products (hanya item yang punya product_id — bukan custom)
        let itemsWithProducts: any[] = [];
        if (items && items.length > 0) {
          const productIds = items
            .map((i) => i.product_id)
            .filter((id): id is string => id !== null);

          let products: any[] = [];
          if (productIds.length > 0) {
            const { data: prodData, error: productsErr } = await supabase
              .from('products')
              .select('id, name, cost_price')
              .in('id', productIds);

            if (productsErr) throw productsErr;
            products = prodData || [];
          }

          itemsWithProducts = items.map((item) => {
            if (item.product_id === null) {
              // Custom item — gunakan data dari kolom custom
              return {
                ...item,
                products: {
                  name: item.custom_item_name || 'Custom Item',
                  cost_price: item.cost_price_at_sale ?? 0
                }
              };
            }
            const prod = products.find((p) => p.id === item.product_id);
            return {
              ...item,
              products: prod ? {
                name: prod.name,
                cost_price: prod.cost_price
              } : {
                name: 'Produk Tidak Ditemukan',
                cost_price: 0
              }
            };
          });
        }

        setPosDetail({
          ...tx,
          staff_name: staffName,
          items: itemsWithProducts
        });
      } else {
        // Fetch service detail
        const { data: svc, error: svcErr } = await supabase
          .from('services')
          .select('*')
          .eq('id', income.id)
          .single();

        if (svcErr) throw svcErr;

        setServiceDetail(svc);
      }
    } catch (err: any) {
      console.error('Error fetching income detail:', err.message);
      showToast('Gagal memuat detail transaksi: ' + err.message, 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedIncome) return;

    const confirmDelete = window.confirm(
      "Apakah Anda yakin ingin menghapus/membatalkan catatan transaksi ini secara permanen dari database?"
    );
    if (!confirmDelete) return;

    setDeletingTx(true);
    try {
      if (selectedIncome.type === 'pos') {
        // Delete transaction items first
        const { error: itemsDelErr } = await supabase
          .from('transaction_items')
          .delete()
          .eq('transaction_id', selectedIncome.id);
        
        if (itemsDelErr) throw itemsDelErr;

        // Delete transaction
        const { error: txDelErr } = await supabase
          .from('transactions')
          .delete()
          .eq('id', selectedIncome.id);

        if (txDelErr) throw txDelErr;
      } else {
        // Delete service
        const { error: svcDelErr } = await supabase
          .from('services')
          .delete()
          .eq('id', selectedIncome.id);

        if (svcDelErr) throw svcDelErr;
      }

      // Close modal
      setSelectedIncome(null);
      setPosDetail(null);
      setServiceDetail(null);

      // Show toast
      showToast("Transaksi berhasil dihapus secara permanen!");

      // Refresh finance list
      fetchIncomesAndExpenses();
    } catch (err: any) {
      console.error('Error deleting transaction:', err.message);
      showToast('Gagal menghapus transaksi: ' + err.message, 'error');
    } finally {
      setDeletingTx(false);
    }
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

      // 4. Ambil detail item transaksi dengan harga modal dari produk untuk menghitung margin POS
      // Custom items (product_id = null) memakai kolom cost_price_at_sale sebagai harga modal
      const { data: txItemsRaw, error: txItemsErr } = await supabase
        .from('transaction_items')
        .select(`
          transaction_id,
          quantity,
          price_at_sale,
          cost_price_at_sale,
          products (
            cost_price
          )
        `);
      if (txItemsErr) throw txItemsErr;

      const txItems = (txItemsRaw as any[]) || [];

      // Hitung total margin per-transaction (Map: transaction_id -> margin)
      const txMarginMap: Record<string, number> = {};
      let marginSum = 0;
      txItems.forEach((item) => {
        const cost = item.products?.cost_price ?? item.cost_price_at_sale ?? 0;
        const sell = item.price_at_sale || 0;
        const qty = item.quantity || 0;
        const lineMargin = (sell - cost) * qty;
        marginSum += lineMargin;
        if (item.transaction_id) {
          txMarginMap[item.transaction_id] = (txMarginMap[item.transaction_id] || 0) + lineMargin;
        }
      });

      const svcSum = (svcs || []).reduce((sum, s) => sum + (s.service_cost || 0), 0);

      // Map dan gabungkan data pemasukan
      const mappedTxs = (txs || []).map((t) => ({
        id: t.id,
        source: `Penjualan POS (${t.invoice_number})`,
        amount: t.total_amount,
        date: new Date(t.created_at).toISOString().split('T')[0],
        type: 'pos' as const,
        netMargin: txMarginMap[t.id] || 0
      }));

      const mappedSvcs = (svcs || []).map((s) => ({
        id: s.id,
        source: `Service - ${s.device_name} (${s.customer_name})`,
        amount: (s.service_cost || 0) + (s.part_cost || 0),
        date: new Date(s.created_at).toISOString().split('T')[0],
        type: 'service' as const,
        netMargin: s.service_cost || 0  // margin bersih service = biaya jasa teknisi
      }));

      const combinedIncomes = [...mappedTxs, ...mappedSvcs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setIncomes(combinedIncomes);
      setExpenses(exps || []);
      setPosMargin(marginSum);
      setServiceCostSum(svcSum);
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

  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const term = (e as CustomEvent).detail;
      setSearchInvoiceTerm(term || '');
    };
    window.addEventListener('global-invoice-search', handleGlobalSearch as EventListener);
    
    // Check initial search param on mount
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get('search');
    if (initialSearch) {
      setSearchInvoiceTerm(initialSearch);
    }
    
    return () => {
      window.removeEventListener('global-invoice-search', handleGlobalSearch as EventListener);
    };
  }, []);

  const handleQuickDateFilter = (type: 'today' | 'month' | 'all') => {
    const now = new Date();
    if (type === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(startOfMonth.toISOString().split('T')[0]);
      setDateTo(endOfMonth.toISOString().split('T')[0]);
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    const amount = parseInt(formData.get('amount') as string, 10);
    const date = formData.get('date') as string;

    try {
      if (editingExpense) {
        // Edit flow
        const { error: updateErr } = await supabase
          .from('expenses')
          .update({ description, amount, date })
          .eq('id', editingExpense.id);

        if (updateErr) throw updateErr;

        showToast('Catatan pengeluaran berhasil diperbarui!');
        setEditingExpense(null);
      } else {
        // Insert flow
        const { error: insertErr } = await supabase
          .from('expenses')
          .insert([{ description, amount, date }]);

        if (insertErr) throw insertErr;

        showToast('Catatan pengeluaran berhasil disimpan!');
        setShowAddExpense(false);
      }
      
      fetchIncomesAndExpenses();
    } catch (err: any) {
      console.error('Error saving expense:', err.message);
      showToast('Gagal menyimpan pengeluaran: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) {
      return;
    }

    try {
      const { error: deleteErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteErr) throw deleteErr;

      showToast('Catatan pengeluaran berhasil dihapus!');
      fetchIncomesAndExpenses();
    } catch (err: any) {
      console.error('Error deleting expense:', err.message);
      showToast('Gagal menghapus pengeluaran: ' + err.message, 'error');
    }
  };

  // Date filter logic for incomes (general date range filter)
  const dateFilteredIncomes = incomes.filter((inc) => {
    if (dateFrom && inc.date < dateFrom) return false;
    if (dateTo && inc.date > dateTo) return false;
    return true;
  });

  // Filter for actual display in list (date range + invoice search)
  const filteredIncomes = incomes.filter((inc) => {
    if (dateFrom && inc.date < dateFrom) return false;
    if (dateTo && inc.date > dateTo) return false;
    if (searchInvoiceTerm && !inc.source.toLowerCase().includes(searchInvoiceTerm.toLowerCase())) return false;
    return true;
  });

  // Recompute profit margins based on date filter (for metric cards)
  const filteredPosMargin = dateFilteredIncomes
    .filter((i) => i.type === 'pos')
    .reduce((sum, i) => sum + i.netMargin, 0);
  const filteredServiceMargin = dateFilteredIncomes
    .filter((i) => i.type === 'service')
    .reduce((sum, i) => sum + i.netMargin, 0);

  const filteredExpensesForTotal = expenses.filter((exp) => {
    if (dateFrom && exp.date < dateFrom) return false;
    if (dateTo && exp.date > dateTo) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((exp) => {
    if (dateFrom && exp.date < dateFrom) return false;
    if (dateTo && exp.date > dateTo) return false;
    return exp.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalIncome = dateFilteredIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = filteredExpensesForTotal.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = filteredPosMargin + filteredServiceMargin - totalExpense;

  const isFiltered = !!dateFrom || !!dateTo;

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

      {/* Page Header with Global Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">Laporan &amp; Analisis Finansial</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Kelola arus kas masuk, pengeluaran operasional ruko, dan pantau profit bersih.</p>
        </div>
        
        {/* Date Range Filter (Global) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800/80">
            <button
              onClick={() => handleQuickDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                dateFrom === new Date().toISOString().split('T')[0] && dateTo === new Date().toISOString().split('T')[0]
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handleQuickDateFilter('month')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                dateFrom === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] &&
                dateTo === new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => handleQuickDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                !dateFrom && !dateTo
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Date Picker Range Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl px-3 py-1.5">
              <Calendar size={12} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-[11px] text-slate-700 dark:text-zinc-300 outline-none cursor-pointer w-28"
                title="Dari tanggal"
              />
            </div>
            <span className="text-[10px] text-slate-400">s/d</span>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-xl px-3 py-1.5">
              <Calendar size={12} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-[11px] text-slate-700 dark:text-zinc-300 outline-none cursor-pointer w-28"
                title="Hingga tanggal"
              />
            </div>
          </div>

          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

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
          
          {/* Profit Breakdown Cards */}
          <div className="space-y-3 mb-6">
            
            {/* Baris 1: Total Keuntungan Bersih Gabungan (Full Width) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Total Keuntungan Bersih (Gabungan)</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-white block mt-1">
                  {formatRupiah(filteredPosMargin + filteredServiceMargin)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
                  {isFiltered ? `Filter aktif: ${dateFrom || '...'} s/d ${dateTo || '...'}` : 'Total laba bersih operasional sebelum dikurangi pengeluaran toko'}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Baris 2: Sub-Keuntungan Bersih Sejajar (2 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Kartu Kiri: Keuntungan Bersih Penjualan (POS) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-start shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Keuntungan Bersih Penjualan (POS)</span>
                  <span className="text-base font-extrabold text-zinc-900 dark:text-white block mt-1">{formatRupiah(filteredPosMargin)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">Berdasarkan produk terjual di kasir</span>
                </div>
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                  <ShoppingBag size={16} />
                </div>
              </div>

              {/* Kartu Kanan: Keuntungan Bersih Jasa Service */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-start shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Keuntungan Bersih Jasa Service</span>
                  <span className="text-base font-extrabold text-zinc-900 dark:text-white block mt-1">{formatRupiah(filteredServiceMargin)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">Berdasarkan biaya jasa reparasi perangkat</span>
                </div>
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                  <Wrench size={16} />
                </div>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-sm sm:text-base">Catatan Pemasukan</h3>
              <p className="text-xs text-slate-500">Log transaksi masuk dari kasir &amp; service selesai</p>
            </div>
            
            {/* Active search filter indicator */}
            {searchInvoiceTerm && (
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl px-3 py-1 text-[10px] text-blue-700 dark:text-blue-300 font-semibold">
                <span>Pencarian: "{searchInvoiceTerm}"</span>
                <button
                  onClick={() => {
                    setSearchInvoiceTerm('');
                    // Clean URL query param
                    const newUrl = window.location.pathname;
                    window.history.pushState({}, '', newUrl);
                  }}
                  className="hover:text-blue-900 dark:hover:text-blue-150 font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-emerald-500" />
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {filteredIncomes.length === 0 ? (
              <p className="text-center py-20 text-xs text-slate-400">
                {isFiltered ? 'Tidak ada transaksi di rentang tanggal ini.' : 'Belum ada catatan pemasukan.'}
              </p>
            ) : (
              filteredIncomes.map((inc) => {
                const isProfit = inc.netMargin >= 0;
                return (
                  <div 
                    key={inc.id} 
                    onClick={() => handleIncomeClick(inc)}
                    className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 transition-all duration-200"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0 pr-3">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">{inc.source}</span>
                      <span className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {inc.date}
                      </span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      {/* Omzet kotor — warna netral */}
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Omzet</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                          {formatRupiah(inc.amount)}
                        </span>
                      </div>
                      
                      {/* Keuntungan Bersih — hijau/merah */}
                      <div className="flex flex-col items-end border-l border-slate-200 dark:border-zinc-800 pl-3">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Keuntungan</span>
                        <span className={`text-xs font-extrabold ${
                          isProfit ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {isProfit ? '+' : ''}{formatRupiah(inc.netMargin)}
                          <span className="text-[9px] font-semibold opacity-80 ml-1">
                            {isProfit ? '(Net)' : '(Rugi)'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
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
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-rose-600">-{formatRupiah(exp.amount)}</span>
                      <div className="flex items-center gap-1.5 border-l border-slate-100 dark:border-zinc-800 pl-3">
                        <button
                          onClick={() => setEditingExpense(exp)}
                          className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors p-1"
                          title="Edit Pengeluaran"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                          title="Hapus Pengeluaran"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Expense Modal Overlay */}
      {(showAddExpense || editingExpense) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                {editingExpense ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddExpense(false);
                  setEditingExpense(null);
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form key={editingExpense ? editingExpense.id : 'new'} onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deskripsi Pengeluaran</label>
                <input 
                  type="text" 
                  name="description" 
                  defaultValue={editingExpense ? editingExpense.description : ''} 
                  placeholder="Contoh: Bensin motor untuk kirim barang" 
                  required 
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nominal (Rp)</label>
                  <input 
                    type="text" 
                    name="amount" 
                    defaultValue={editingExpense ? editingExpense.amount : ''} 
                    placeholder="Nominal Rupiah" 
                    required 
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal</label>
                  <input 
                    type="date" 
                    name="date" 
                    defaultValue={editingExpense ? editingExpense.date : ''} 
                    required 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none cursor-pointer dark:text-zinc-100" 
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddExpense(false);
                    setEditingExpense(null);
                  }} 
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  {editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Invoice Modal Overlay */}
      {selectedIncome && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-slate-900 dark:text-zinc-100 transition-colors">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Detail Invoice
              </h3>
              <button 
                onClick={() => {
                  setSelectedIncome(null);
                  setPosDetail(null);
                  setServiceDetail(null);
                }} 
                className="text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                  <p className="text-xs text-slate-500 font-medium">Memuat rincian transaksi...</p>
                </div>
              ) : selectedIncome.type === 'pos' && posDetail ? (
                // --- POS INVOICE OFFICIAL LAYOUT ---
                <div className="space-y-6">
                  {/* Shop Details & Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-dashed border-slate-200 dark:border-zinc-800 pb-4 gap-4">
                    <div>
                      <h4 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Mitra Computer</h4>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">Invoice Resmi Penjualan POS</p>
                    </div>
                    <div className="text-left sm:text-right text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">No. Invoice:</span> {posDetail.invoice_number}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">ID Transaksi:</span> {posDetail.id}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">Tanggal & Jam:</span> {formatDateTime(posDetail.created_at)}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">Kasir/Staff:</span> {posDetail.staff_name || 'Staff Toko'}</div>
                    </div>
                  </div>

                  {/* Detail Item Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-semibold">
                          <th className="py-2.5">Nama Produk</th>
                          <th className="py-2.5 text-center">Qty</th>
                          <th className="py-2.5 text-right">Harga Jual</th>
                          <th className="py-2.5 text-right">Harga Modal</th>
                          <th className="py-2.5 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                        {posDetail.items.map((item: any) => {
                          const sell = item.price_at_sale;
                          const cost = item.products?.cost_price || 0;
                          const qty = item.quantity;
                          const margin = (sell - cost) * qty;
                          return (
                            <tr key={item.id} className="text-slate-800 dark:text-zinc-300">
                              <td className="py-3 font-medium max-w-[200px] truncate">{item.products?.name || 'Produk Custom / Non-Inventory'}</td>
                              <td className="py-3 text-center font-bold">{qty}</td>
                              <td className="py-3 text-right">{formatRupiah(sell)}</td>
                              <td className="py-3 text-right text-slate-400 dark:text-zinc-550">{formatRupiah(cost)}</td>
                              <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-500">{formatRupiah(margin)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Invoice Summary */}
                  <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 flex justify-between items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Total Omzet (Kotor)</span>
                      <span className="text-base font-bold text-slate-700 dark:text-zinc-300">{formatRupiah(posDetail.total_amount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Total Margin Keuntungan (Bersih)</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-500">{formatRupiah(
                        posDetail.items.reduce((sum: number, item: any) => {
                          const sell = item.price_at_sale;
                          const cost = item.products?.cost_price || 0;
                          return sum + (sell - cost) * item.quantity;
                        }, 0)
                      )}</span>
                    </div>
                  </div>
                </div>
              ) : selectedIncome.type === 'service' && serviceDetail ? (
                // --- SERVICE NOTE LAYOUT ---
                <div className="space-y-6">
                  {/* Service Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-dashed border-slate-200 dark:border-zinc-800 pb-4 gap-4">
                    <div>
                      <h4 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Mitra Computer</h4>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">Nota Service Selesai</p>
                    </div>
                    <div className="text-left sm:text-right text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">ID Service:</span> {serviceDetail.id}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">Selesai Pada:</span> {formatDateTime(serviceDetail.updated_at)}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-zinc-300">Nama Pelanggan:</span> {serviceDetail.customer_name}</div>
                    </div>
                  </div>

                  {/* Device and Complaint Section */}
                  <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Nama Device / Unit</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{serviceDetail.device_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Keluhan Utama</span>
                      <span className="text-xs text-slate-600 dark:text-zinc-400 block italic">"{serviceDetail.complaint}"</span>
                    </div>
                  </div>

                  {/* Financial Cost Breakdown */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Rincian Biaya Keuangan</span>
                    
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-zinc-450">Biaya Sparepart (Sparepart Cost):</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">{formatRupiah(serviceDetail.part_cost || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-zinc-450">Biaya Jasa Teknisi (Service Fee / Margin Bersih Toko):</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-500">{formatRupiah(serviceDetail.service_cost || 0)}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Total Akhir (Dibayar Konsumen):</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {formatRupiah((serviceDetail.service_cost || 0) + (serviceDetail.part_cost || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-450">Data detail tidak ditemukan atau terjadi kesalahan.</div>
              )}

              {/* Action Buttons: Cancel and Delete */}
              {!loadingDetail && (
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-6 mt-6">
                  <button 
                    type="button" 
                    disabled={deletingTx}
                    onClick={handleDeleteTransaction}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800/50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    {deletingTx ? 'Menghapus...' : 'Hapus Transaksi'}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setSelectedIncome(null);
                      setPosDetail(null);
                      setServiceDetail(null);
                    }} 
                    className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/85 transition-colors text-center"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
