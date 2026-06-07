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
  Wrench,
  FileDown,
  Printer,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import DateRangePicker, { DateRange } from '@/components/shared/DateRangePicker';
import { useAuth } from '@/components/shared/AuthProvider';

type Expense = Database['public']['Tables']['expenses']['Row'];
interface MappedIncome {
  id: string;
  source: string;
  amount: number;
  date: string;
  type: 'pos' | 'service';
  netMargin: number;
  customerName?: string;
}

export default function FinancePage() {
  const { role } = useAuth();

  const getLocalDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
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
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
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
          .select('id, invoice_number, total_amount, payment_method, created_at, staff_id, customer_name')
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

        let completedByName = null;
        if (svc.completed_by_id) {
          const { data: usr } = await supabase
            .from('users')
            .select('name')
            .eq('id', svc.completed_by_id)
            .maybeSingle();
          if (usr) {
            completedByName = usr.name;
          }
        }

        setServiceDetail({
          ...svc,
          completed_by: completedByName ? { name: completedByName } : null
        });
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
    if (role === 'manager' || role === 'finance_staff' || role === 'staff' || role === 'viewer') {
      showToast('Akses ditolak: Anda tidak memiliki wewenang untuk menghapus transaksi.', 'error');
      return;
    }

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

      // Log delete transaction activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert([{
          user_id: user?.id || null,
          email: user?.email || null,
          action: 'DELETE_TRANSACTION',
          details: {
            target_id: selectedIncome.id,
            type: selectedIncome.type,
            source: selectedIncome.source,
            amount: selectedIncome.amount
          }
        }]);
      } catch (logErr) {
        console.error('Failed to write audit log:', logErr);
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        return;
      }

      // 1. Ambil data transactions
      const { data: txs, error: txsErr } = await supabase
        .from('transactions')
        .select('id, invoice_number, total_amount, created_at, customer_name');
      if (txsErr) throw txsErr;

      // 2. Ambil data service yang selesai (selesai)
      const { data: svcs, error: svcsErr } = await supabase
        .from('services')
        .select('id, device_name, customer_name, service_cost, part_cost, created_at, updated_at')
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
        date: getLocalDateStr(new Date(t.created_at)),
        type: 'pos' as const,
        netMargin: txMarginMap[t.id] || 0,
        customerName: t.customer_name || 'Umum'
      }));

      const mappedSvcs = (svcs || []).map((s) => ({
        id: s.id,
        source: `Service - ${s.device_name} (${s.customer_name})`,
        amount: (s.service_cost || 0) + (s.part_cost || 0),
        date: getLocalDateStr(new Date(s.updated_at)),
        type: 'service' as const,
        netMargin: s.service_cost || 0,  // margin bersih service = biaya jasa teknisi
        customerName: s.customer_name
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

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (role === 'staff' || role === 'viewer') {
      showToast('Akses ditolak: Anda tidak memiliki wewenang untuk mencatat pengeluaran.', 'error');
      return;
    }
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

        // Log audit trail for UPDATE_EXPENSE
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert([{
            user_id: user?.id || null,
            email: user?.email || null,
            action: 'UPDATE_EXPENSE',
            details: {
              target_id: editingExpense.id,
              data_sebelumnya: {
                description: editingExpense.description,
                amount: editingExpense.amount,
                date: editingExpense.date,
                tanggal_dibuat: editingExpense.created_at
              },
              data_sesudah: {
                description: description,
                amount: amount,
                date: date,
                tanggal_diedit: new Date().toISOString()
              }
            }
          }]);
        } catch (logErr) {
          console.error('Failed to write audit log:', logErr);
        }

        showToast('Catatan pengeluaran berhasil diperbarui!');
        setEditingExpense(null);
      } else {
        // Insert flow
        const { data: newExp, error: insertErr } = await supabase
          .from('expenses')
          .insert([{ description, amount, date }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        // Log audit trail for CREATE_EXPENSE
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert([{
            user_id: user?.id || null,
            email: user?.email || null,
            action: 'CREATE_EXPENSE',
            details: {
              target_id: newExp.id,
              amount: newExp.amount,
              context: newExp.description,
              description: newExp.description,
              date: newExp.date,
              timestamp: new Date().toISOString()
            }
          }]);
        } catch (logErr) {
          console.error('Failed to write audit log:', logErr);
        }

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
    if (role === 'staff' || role === 'viewer') {
      showToast('Akses ditolak: Anda tidak memiliki wewenang untuk menghapus pengeluaran.', 'error');
      return;
    }
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) {
      return;
    }

    try {
      // Fetch the old expense data first to log details
      const { data: oldExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .maybeSingle();

      const { error: deleteErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteErr) throw deleteErr;

      if (oldExp) {
        // Log audit trail for DELETE_EXPENSE
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('audit_logs').insert([{
            user_id: user?.id || null,
            email: user?.email || null,
            action: 'DELETE_EXPENSE',
            details: {
              target_id: expenseId,
              amount: oldExp.amount,
              context: oldExp.description,
              description: oldExp.description,
              date: oldExp.date,
              timestamp: new Date().toISOString()
            }
          }]);
        } catch (logErr) {
          console.error('Failed to write audit log:', logErr);
        }
      }

      showToast('Catatan pengeluaran berhasil dihapus!');
      fetchIncomesAndExpenses();
    } catch (err: any) {
      console.error('Error deleting expense:', err.message);
      showToast('Gagal menghapus pengeluaran: ' + err.message, 'error');
    }
  };

  // Convert DateRange to date string for comparison
  const dateFrom = dateRange.from ? getLocalDateStr(dateRange.from) : '';
  const dateTo = dateRange.to ? getLocalDateStr(dateRange.to) : '';

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

  const grossPosRevenue = dateFilteredIncomes
    .filter((i) => i.type === 'pos')
    .reduce((sum, i) => sum + i.amount, 0);
  const grossServiceRevenue = dateFilteredIncomes
    .filter((i) => i.type === 'service')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalIncome = dateFilteredIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = filteredExpensesForTotal.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = filteredPosMargin + filteredServiceMargin - totalExpense;

  const handleExportPDF = () => {
    // Remove any existing print style elements
    document.getElementById('print-style-injector')?.remove();

    // Create style element
    const style = document.createElement('style');
    style.id = 'print-style-injector';
    style.innerHTML = `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 15mm !important;
        }
        html, body, main {
          height: auto !important;
          overflow: visible !important;
          position: static !important;
        }
        body * {
          visibility: hidden !important;
        }
        #print-financial-statement,
        #print-financial-statement * {
          visibility: visible !important;
        }
        #print-financial-statement {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: white !important;
          color: black !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Set page title temporarily for browser PDF export filename
    const originalTitle = document.title;
    document.title = `Laporan_Keuangan_Periodik_${dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'all_time'}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handleExportExcel = () => {
    const csvRows = [];
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    csvRows.push("MITRA COMPUTER - LAPORAN KEUANGAN PERIODIK");
    csvRows.push(`Periode: ${dateFrom && dateTo ? `${dateFrom} s/d ${dateTo}` : 'Semua Sesi/Waktu'}`);
    csvRows.push(`Tanggal Ekspor: ${new Date().toLocaleString('id-ID')}`);
    csvRows.push("");
    
    csvRows.push("IKHTISAR FINANSIAL");
    csvRows.push("Metrik,Nominal");
    csvRows.push(`Omzet Penjualan POS,${grossPosRevenue}`);
    csvRows.push(`Omzet Jasa Service,${grossServiceRevenue}`);
    csvRows.push(`Total Pendapatan Kotor,${totalIncome}`);
    csvRows.push(`Total Pengeluaran Operasional,-${totalExpense}`);
    csvRows.push(`Keuntungan Bersih Operasional,${netProfit}`);
    csvRows.push("");
    
    csvRows.push("LOG ALIRAN KAS MASUK (PEMASUKAN)");
    csvRows.push("Tanggal,Sumber Transaksi,Pembeli,Omzet,Margin Bersih");
    dateFilteredIncomes.forEach(inc => {
      csvRows.push(`${escapeCsv(inc.date)},${escapeCsv(inc.source)},${escapeCsv(inc.customerName || 'Umum')},${inc.amount},${inc.netMargin}`);
    });
    csvRows.push("");
    
    csvRows.push("LOG BUKU KAS PENGELUARAN (PENGELUARAN)");
    csvRows.push("Tanggal,Deskripsi Pengeluaran,Nominal");
    filteredExpensesForTotal.forEach(exp => {
      csvRows.push(`${escapeCsv(exp.date)},${escapeCsv(exp.description)},-${exp.amount}`);
    });
    
    const csvString = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `Laporan_Keuangan_Mitra_Computer_${dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'all_time'}.csv`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintThermal = () => {
    if (!posDetail) return;

    // 1. Remove any existing print style elements
    document.getElementById('print-style-injector')?.remove();

    // 2. Create new style element
    const style = document.createElement('style');
    style.id = 'print-style-injector';
    style.innerHTML = `
      @media print {
        @page {
          size: 58mm auto !important;
          margin: 0mm !important;
        }
        html, body, main {
          height: auto !important;
          overflow: visible !important;
          position: static !important;
        }
        body * {
          visibility: hidden !important;
        }
        #thermal-receipt,
        #thermal-receipt * {
          visibility: visible !important;
        }
        #thermal-receipt {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 58mm !important;
          max-width: 58mm !important;
          padding: 3mm !important;
          box-sizing: border-box !important;
          background: white !important;
          color: black !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          font-family: monospace !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);

    // 3. Temporarily set page title to "CustomerName - InvoiceNumber" for browser PDF export filename
    const originalTitle = document.title;
    const customer = posDetail.customer_name || 'Umum';
    document.title = `${customer} - ${posDetail.invoice_number}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    // 4. Print
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintDigital = () => {
    if (!posDetail) return;

    // 1. Remove any existing print style elements
    document.getElementById('print-style-injector')?.remove();

    // 2. Create new style element
    const style = document.createElement('style');
    style.id = 'print-style-injector';
    style.innerHTML = `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 15mm 15mm 15mm 15mm !important;
        }
        html, body, main {
          height: auto !important;
          overflow: visible !important;
          position: static !important;
        }
        body * {
          visibility: hidden !important;
        }
        #digital-invoice,
        #digital-invoice * {
          visibility: visible !important;
        }
        #digital-invoice {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: white !important;
          color: black !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);

    // 3. Temporarily set page title to "CustomerName - InvoiceNumber" for browser PDF export filename
    const originalTitle = document.title;
    const customer = posDetail.customer_name || 'Umum';
    document.title = `${customer} - ${posDetail.invoice_number}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    // 4. Print
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const isFiltered = !!dateFrom || !!dateTo;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <p className="text-sm font-medium">Memuat data keuangan dari database...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6 animate-fade-in print:hidden">
      {/* Database Error Alert */}
      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Page Header with Global Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm no-print">
        <div className="flex flex-col max-w-xl">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">Laporan &amp; Analisis Finansial</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Kelola arus kas masuk, pengeluaran operasional ruko, dan pantau profit bersih.</p>
        </div>
        
        {/* Date Range Filter (Global) — uses shared DateRangePicker component */}
        <div className="w-full sm:w-auto shrink-0 flex flex-wrap items-center gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handleExportPDF}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
          >
            <FileDown size={14} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/10 cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <div className="border-l border-slate-200 dark:border-zinc-800 h-6 mx-1 hidden sm:block"></div>
          <DateRangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range)}
          />
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => setDateRange({ from: null, to: null })}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3 gap-3">
        {/* Net Profit Card */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Keuntungan Bersih</span>
            <div className="p-1.5 md:p-2 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0">
              <Wallet size={14} className="md:w-[18px] md:h-[18px]" />
            </div>
          </div>
          <div className="mt-2 md:mt-4 min-w-0">
            <h3 className="text-xs min-[360px]:text-sm sm:text-base md:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight truncate select-all" title={formatRupiah(netProfit)}>{formatRupiah(netProfit)}</h3>
            <p className="text-[9px] md:text-[10px] text-indigo-600 font-semibold mt-0.5 md:mt-1 flex items-center gap-1">
              <TrendingUp size={10} />
              {netProfit >= 0 ? 'Arus Kas Positif' : 'Arus Kas Negatif'}
            </p>
          </div>
        </div>

        {/* Total Cash In */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Pemasukan</span>
            <div className="p-1.5 md:p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
              <TrendingUp size={14} className="md:w-[18px] md:h-[18px]" />
            </div>
          </div>
          <div className="mt-2 md:mt-4 min-w-0">
            <h3 className="text-xs min-[360px]:text-sm sm:text-base md:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight truncate select-all" title={formatRupiah(totalIncome)}>{formatRupiah(totalIncome)}</h3>
            <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 md:mt-1 truncate">Berdasarkan {incomes.length} transaksi</p>
          </div>
        </div>

        {/* Total Cash Out */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between col-span-1 min-[380px]:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Pengeluaran</span>
            <div className="p-1.5 md:p-2 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <TrendingDown size={14} className="md:w-[18px] md:h-[18px]" />
            </div>
          </div>
          <div className="mt-2 md:mt-4 min-w-0">
            <h3 className="text-xs min-[360px]:text-sm sm:text-base md:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight truncate select-all" title={formatRupiah(totalExpense)}>{formatRupiah(totalExpense)}</h3>
            <p className="text-[9px] md:text-[10px] text-rose-600 font-semibold mt-0.5 md:mt-1 truncate">Operasional toko</p>
          </div>
        </div>
      </div>

      {/* Main Ledger Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pemasukan Logs */}
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm">
          
          {/* Profit Breakdown Cards */}
          <div className="space-y-3 mb-6">
            
            {/* Baris 1: Total Keuntungan Bersih Gabungan (Full Width) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Total Keuntungan Bersih (Gabungan)</span>
                <span className="text-xl font-extrabold text-zinc-900 dark:text-white block mt-1 truncate select-all" title={formatRupiah(filteredPosMargin + filteredServiceMargin)}>
                  {formatRupiah(filteredPosMargin + filteredServiceMargin)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5 truncate" title={isFiltered ? `Filter aktif: ${dateFrom || '...'} s/d ${dateTo || '...'}` : 'Total laba bersih operasional sebelum dikurangi pengeluaran toko'}>
                  {isFiltered ? `Filter aktif: ${dateFrom || '...'} s/d ${dateTo || '...'}` : 'Total laba bersih operasional sebelum dikurangi pengeluaran toko'}
                </span>
              </div>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0 ml-2">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Baris 2: Sub-Keuntungan Bersih Sejajar (2 Kolom) */}
            <div className="grid grid-cols-1 min-[320px]:grid-cols-2 gap-2">
              {/* Kartu Kiri: Keuntungan Bersih Penjualan (POS) */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 md:p-4 rounded-xl flex justify-between items-start shadow-sm min-w-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Margin POS</span>
                  <span className="text-xs md:text-base font-extrabold text-zinc-900 dark:text-white block mt-1 truncate select-all" title={formatRupiah(filteredPosMargin)}>{formatRupiah(filteredPosMargin)}</span>
                  <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5 truncate">Produk di kasir</span>
                </div>
                <div className="p-1.5 md:p-2 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0 ml-2">
                  <ShoppingBag size={14} className="md:w-4 md:h-4" />
                </div>
              </div>

              {/* Kartu Kanan: Keuntungan Bersih Jasa Service */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 md:p-4 rounded-xl flex justify-between items-start shadow-sm min-w-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Jasa Service</span>
                  <span className="text-xs md:text-base font-extrabold text-zinc-900 dark:text-white block mt-1 truncate select-all" title={formatRupiah(filteredServiceMargin)}>{formatRupiah(filteredServiceMargin)}</span>
                  <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5 truncate">Jasa reparasi</span>
                </div>
                <div className="p-1.5 md:p-2 bg-amber-500/10 text-amber-500 rounded-lg shrink-0 ml-2">
                  <Wrench size={14} className="md:w-4 md:h-4" />
                </div>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-sm sm:text-base">Catatan Pemasukan</h3>
              <p className="text-xs text-slate-500">Log transaksi masuk dari kasir &amp; service selesai</p>
            </div>
            
            <div className="flex items-center gap-2 flex-1 max-w-xs sm:justify-end w-full">
              <div className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari no. invoice..."
                  value={searchInvoiceTerm}
                  onChange={(e) => setSearchInvoiceTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500 transition-colors"
                />
                {searchInvoiceTerm && (
                  <button
                    onClick={() => {
                      setSearchInvoiceTerm('');
                      // Clean URL query param
                      const newUrl = window.location.pathname;
                      window.history.pushState({}, '', newUrl);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shrink-0">
                <FileSpreadsheet size={16} className="text-indigo-500" />
              </div>
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
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 block leading-tight">{inc.source}</span>
                      {inc.type === 'pos' && (
                        <div className="text-zinc-500 text-sm">{inc.customerName || 'Umum'}</div>
                      )}
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
                          isProfit ? 'text-indigo-500' : 'text-red-500'
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
        <div className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-50 text-sm sm:text-base">Buku Kas Pengeluaran</h3>
                <p className="text-xs text-slate-500">Catat semua pengeluaran ruko & operasional Bangko</p>
              </div>
              {role !== 'staff' && role !== 'viewer' && (
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1"
                >
                  <Plus size={12} />
                  Catat
                </button>
              )}
            </div>

            {/* Search Input for Expenses */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari deskripsi pengeluaran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors"
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
                      {role !== 'staff' && role !== 'viewer' && (
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
                      )}
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
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-modal-backdrop">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-modal-content">
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

      {/* Detail Invoice / Nota Servis Modal Overlay */}
      {selectedIncome && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-modal-backdrop">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden text-slate-900 dark:text-zinc-100 transition-colors animate-modal-content">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {selectedIncome.type === 'service' ? 'Detail Nota Servis' : 'Detail Invoice'}
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
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
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
                    <div className="text-left sm:text-right text-xs sm:text-sm font-normal text-slate-500 dark:text-zinc-400 space-y-1">
                      <div>
                        No. Invoice: <span className="font-medium text-slate-800 dark:text-zinc-200">{posDetail.invoice_number}</span>
                      </div>
                      <div>
                        Tanggal & Jam: <span className="font-medium text-slate-800 dark:text-zinc-200">{formatDateTime(posDetail.created_at)}</span>
                      </div>
                      <div>
                        Nama Pembeli: <span className="font-medium text-slate-800 dark:text-zinc-200">{posDetail.customer_name || 'Umum'}</span>
                      </div>
                      <div>
                        Kasir/Staff: <span className="font-medium text-slate-800 dark:text-zinc-200">{posDetail.staff_name || 'Staff Toko'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Product Summary Card Container */}
                  <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-slate-100/50 dark:border-zinc-800/50 space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">Item Terjual</span>
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 space-y-3">
                      {posDetail.items.map((item: any, idx: number) => {
                        const name = item.products?.name || 'Produk Custom / Non-Inventory';
                        const qty = item.quantity;
                        const price = item.price_at_sale;
                        return (
                          <div key={item.id} className={`flex justify-between items-start gap-4 ${idx > 0 ? 'pt-3' : ''}`}>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <span className="font-semibold text-slate-800 dark:text-zinc-100 text-xs sm:text-sm block truncate" title={name}>
                                {name}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                Qty: <span className="font-bold text-slate-650 dark:text-zinc-300">{qty}</span>
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs sm:text-sm">
                                {formatRupiah(price)}
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-zinc-550 block mt-0.5">
                                Total: {formatRupiah(price * qty)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Cost Breakdown */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Rincian Biaya Keuangan</span>
                    
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-zinc-400 font-normal">Total Harga Jual (Gross):</span>
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">{formatRupiah(posDetail.total_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-zinc-400 font-normal">Keuntungan Bersih Toko (Net Margin):</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{formatRupiah(
                          posDetail.items.reduce((sum: number, item: any) => {
                            const sell = item.price_at_sale;
                            const cost = item.products?.cost_price || 0;
                            return sum + (sell - cost) * item.quantity;
                          }, 0)
                        )}</span>
                      </div>
                    </div>

                    <div className="border-t-2 border-slate-100 dark:border-zinc-800/80 pt-3 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Total Akhir (Dibayar Konsumen):</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {formatRupiah(posDetail.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : selectedIncome.type === 'service' && serviceDetail ? (
                // --- SERVICE NOTE LAYOUT ---
                <div className="space-y-6">
                  {/* Service Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-dashed border-slate-200 dark:border-zinc-800 pb-4 gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">Mitra Computer</h4>
                      <p className="text-xs text-slate-500">Nota Service Selesai</p>
                    </div>
                    <div className="text-left sm:text-right text-xs sm:text-sm font-normal text-slate-600 dark:text-zinc-400 space-y-1">
                      <div>
                        ID Service: <span className="font-medium text-slate-800 dark:text-zinc-200">{serviceDetail.id}</span>
                      </div>
                      <div>
                        Diterima Pada: <span className="font-medium text-slate-800 dark:text-zinc-200">{formatDateTime(serviceDetail.created_at)}</span>
                      </div>
                      <div>
                        Selesai Pada: <span className="font-medium text-slate-800 dark:text-zinc-200">{formatDateTime(serviceDetail.updated_at)}</span>
                      </div>
                      {serviceDetail.completed_by?.name && (
                        <div>
                          Diselesaikan Oleh: <span className="font-medium text-slate-800 dark:text-zinc-200">{serviceDetail.completed_by.name}</span>
                        </div>
                      )}
                      <div>
                        Nama Pelanggan: <span className="font-medium text-slate-800 dark:text-zinc-200">{serviceDetail.customer_name}</span>
                      </div>
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
                        <span className="font-semibold text-indigo-600 dark:text-indigo-500">{formatRupiah(serviceDetail.service_cost || 0)}</span>
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

              {/* Action Buttons: Print, Cancel and Delete */}
              {!loadingDetail && (
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-6 mt-6 w-full">
                  <div>
                    {role !== 'manager' && role !== 'finance_staff' && role !== 'staff' && role !== 'viewer' && (
                      <button 
                        type="button" 
                        disabled={deletingTx}
                        onClick={handleDeleteTransaction}
                        className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800/50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} />
                        {deletingTx ? 'Menghapus...' : 'Hapus Transaksi'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto justify-end items-center">
                    {selectedIncome.type === 'pos' && posDetail && (
                      <div className="flex gap-2.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handlePrintThermal}
                          className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                        >
                          <Printer size={14} />
                          Cetak Thermal
                        </button>
                        <button
                          type="button"
                          onClick={handlePrintDigital}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer"
                        >
                          <FileText size={14} />
                          Cetak Invoice
                        </button>
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedIncome(null);
                        setPosDetail(null);
                        setServiceDetail(null);
                      }} 
                      className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/85 transition-colors text-center cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Periodic Financial Statement Printable Layout (A4 formatted) */}
      <div id="print-financial-statement" className="hidden print:block font-serif text-black p-8 bg-white max-w-4xl mx-auto">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Mitra Computer</h1>
          <p className="text-xs italic mt-0.5">Jejak Transaksi &amp; Laporan Keuangan Ruko Jambi</p>
          <p className="text-sm font-semibold mt-2">LAPORAN KEUANGAN PERIODIK</p>
          <p className="text-xs mt-1">Periode: {dateFrom && dateTo ? `${dateFrom} s/d ${dateTo}` : 'Semua Sesi/Waktu'}</p>
        </div>

        <div className="space-y-6">
          {/* Section 1: Ringkasan Pendapatan & Pengeluaran */}
          <div>
            <h2 className="text-sm font-bold border-b border-gray-400 pb-1 uppercase mb-3">1. Ikhtisar Finansial (Financial Summary)</h2>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 font-medium">Omzet Kotor Penjualan POS (POS Cashier Gross)</td>
                  <td className="py-2 text-right">{formatRupiah(grossPosRevenue)}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 font-medium">Omzet Kotor Jasa Service (Service Jasa Gross)</td>
                  <td className="py-2 text-right">{formatRupiah(grossServiceRevenue)}</td>
                </tr>
                <tr className="border-b-2 border-black font-semibold">
                  <td className="py-2">Total Pendapatan Kotor (Total Gross Revenue)</td>
                  <td className="py-2 text-right">{formatRupiah(totalIncome)}</td>
                </tr>
                <tr className="border-b border-gray-200 text-red-650">
                  <td className="py-2 font-medium">Total Pengeluaran Operasional (Operating Expenses)</td>
                  <td className="py-2 text-right">-{formatRupiah(totalExpense)}</td>
                </tr>
                <tr className="border-b-2 border-black font-bold text-sm bg-gray-50">
                  <td className="py-3">KEUNTUNGAN BERSIH OPERASIONAL (Net Profit Margin)</td>
                  <td className="py-3 text-right">{formatRupiah(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Rincian Pemasukan */}
          <div>
            <h2 className="text-sm font-bold border-b border-gray-400 pb-1 uppercase mb-3">2. Log Aliran Kas Masuk (Incomes Detail)</h2>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-gray-400 font-bold bg-gray-150 text-gray-700">
                  <th className="py-1.5 text-left pl-2">Tanggal</th>
                  <th className="py-1.5 text-left">Sumber Transaksi</th>
                  <th className="py-1.5 text-left">Nama Pembeli</th>
                  <th className="py-1.5 text-right">Omzet</th>
                  <th className="py-1.5 text-right pr-2">Margin Bersih</th>
                </tr>
              </thead>
              <tbody>
                {dateFilteredIncomes.map((inc) => (
                  <tr key={inc.id} className="border-b border-gray-200">
                    <td className="py-1.5 pl-2">{inc.date}</td>
                    <td className="py-1.5 font-medium">{inc.source}</td>
                    <td className="py-1.5">{inc.customerName || 'Umum'}</td>
                    <td className="py-1.5 text-right">{formatRupiah(inc.amount)}</td>
                    <td className="py-1.5 text-right pr-2 font-semibold">{formatRupiah(inc.netMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Rincian Pengeluaran */}
          <div>
            <h2 className="text-sm font-bold border-b border-gray-400 pb-1 uppercase mb-3">3. Log Buku Kas Pengeluaran (Expenses Detail)</h2>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-gray-400 font-bold bg-gray-150 text-gray-700">
                  <th className="py-1.5 text-left pl-2">Tanggal</th>
                  <th className="py-1.5 text-left">Deskripsi Pengeluaran</th>
                  <th className="py-1.5 text-right pr-2">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpensesForTotal.map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-200">
                    <td className="py-1.5 pl-2">{exp.date}</td>
                    <td className="py-1.5 font-medium">{exp.description}</td>
                    <td className="py-1.5 text-right pr-2 text-rose-650 font-semibold">-{formatRupiah(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-300 flex justify-between text-[10px] text-gray-500">
          <div>Dicetak secara sistem oleh Staff Mitra Computer pada: {new Date().toLocaleString('id-ID')}</div>
          <div className="font-semibold uppercase tracking-wider">Mitra Computer Jambi</div>
        </div>
      </div>

      {/* Thermal Receipt Print Layout */}
      {posDetail && (
        <div id="thermal-receipt" className="hidden print:block receipt-container text-black bg-white p-2">
          <div className="text-center font-bold uppercase">Mitra Computer</div>
          <div className="text-center mb-2 border-b border-dashed border-black pb-1.5">
            Jl. Kolonel Abunjani No. 24, Sipin<br/>
            Ruko Simpang III, Jambi<br/>
            Telp: 0811-7400-000
          </div>
          
          <div className="mb-2 space-y-0.5 border-b border-dashed border-black pb-1.5">
            <div>No. Invoice : {posDetail.invoice_number}</div>
            <div>Tanggal     : {formatDateTime(posDetail.created_at)}</div>
            <div>Pelanggan   : {posDetail.customer_name || 'Umum'}</div>
          </div>

          <div className="border-b border-dashed border-black pb-1.5">
            {posDetail.items.map((item: any, idx: number) => {
              const name = item.products?.name || 'Produk Custom / Non-Inventory';
              return (
                <div key={idx} className="mb-1">
                  <div className="truncate max-w-[190px]">{name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {formatRupiah(item.price_at_sale)}</span>
                    <span>{formatRupiah(item.price_at_sale * item.quantity)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-0.5 mt-1.5 pb-2">
            <div className="flex justify-between font-bold">
              <span>TOTAL:</span>
              <span>{formatRupiah(posDetail.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>BAYAR:</span>
              <span>{formatRupiah(posDetail.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>KEMBALI:</span>
              <span>{formatRupiah(0)}</span>
            </div>
          </div>

          <div className="text-center border-t border-dashed border-black pt-2 mt-2">
            Terima Kasih atas Kunjungan Anda!
          </div>
        </div>
      )}

      {/* Digital Invoice Print Layout (E-Commerce Style) */}
      {posDetail && (
        <div id="digital-invoice" className="hidden print:block text-black bg-white p-8 font-sans w-full max-w-4xl mx-auto border border-gray-200 rounded-xl">
          {/* Header / Logo */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-indigo-650">MITRA COMPUTER</h1>
              <p className="text-xs text-gray-500 mt-1">
                Jl. Kolonel Abunjani No. 24, Sipin<br/>
                Ruko Simpang III, Jambi<br/>
                Telp: 0811-7400-000
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-gray-800">INVOICE DIGITAL</h2>
              <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase tracking-wider">
                LUNAS (PAID)
              </span>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-6 border-b border-gray-200 pb-6 mb-6 text-sm">
            {/* Metadata */}
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Rincian Invoice</span>
              <div className="space-y-1">
                <div><span className="text-gray-500 font-medium">No. Invoice:</span> <span className="font-semibold">{posDetail.invoice_number}</span></div>
                <div><span className="text-gray-500 font-medium">Tanggal Transaksi:</span> <span className="font-semibold">{formatDateTime(posDetail.created_at)}</span></div>
                <div><span className="text-gray-500 font-medium">Metode Pembayaran:</span> <span className="font-semibold uppercase">{posDetail.payment_method}</span></div>
              </div>
            </div>
            
            {/* Customer */}
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tujuan Pengiriman / Pembeli</span>
              <div className="space-y-1">
                <div className="font-bold text-gray-800">{posDetail.customer_name || 'Umum'}</div>
                <div className="text-xs text-gray-500">Pelanggan Umum Mitra Computer</div>
              </div>
            </div>
          </div>

          {/* Itemized List Table */}
          <div className="mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 font-bold bg-gray-50 text-gray-700">
                  <th className="py-3 text-left pl-3">Nama Produk / Barang</th>
                  <th className="py-3 text-right">Harga Satuan</th>
                  <th className="py-3 text-center">Kuantitas (Qty)</th>
                  <th className="py-3 text-right pr-3">Total Harga</th>
                </tr>
              </thead>
              <tbody>
                {posDetail.items.map((item: any, idx: number) => {
                  const name = item.products?.name || 'Produk Custom / Non-Inventory';
                  return (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-3 pl-3 font-semibold text-gray-800">{name}</td>
                      <td className="py-3 text-right text-gray-600">{formatRupiah(item.price_at_sale)}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right pr-3 font-bold text-gray-800">{formatRupiah(item.price_at_sale * item.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Box */}
          <div className="flex justify-end">
            <div className="w-80 bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatRupiah(posDetail.total_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Uang Diterima:</span>
                <span className="font-semibold">{formatRupiah(posDetail.total_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-600 border-b border-gray-200 pb-2">
                <span>Uang Kembali:</span>
                <span className="font-semibold">{formatRupiah(0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-gray-900 pt-1">
                <span>Total Tagihan:</span>
                <span className="text-indigo-650">{formatRupiah(posDetail.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 mt-12 border-t border-gray-100 pt-6">
            Terima kasih telah berbelanja di Mitra Computer Jambi.<br/>
            Simpan invoice digital ini sebagai bukti transaksi resmi Anda.
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
    </>
  );
}
