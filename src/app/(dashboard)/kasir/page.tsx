'use client';

import { useState, useEffect } from 'react';
import { useCartStore, CartItem } from '@/store/cartStore';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  CreditCard, 
  DollarSign, 
  CheckCircle,
  Tag,
  Loader2,
  AlertTriangle,
  Printer
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import { useLanguage } from '@/components/shared/LanguageProvider';
import { useAuth } from '@/components/shared/AuthProvider';

type DbProduct = Database['public']['Tables']['products']['Row'];

export default function KasirPage() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotalAmount } = useCartStore();
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [invoiceNum, setInvoiceNum] = useState('');
  const [lastTotal, setLastTotal] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [lastCashReceived, setLastCashReceived] = useState<number>(0);
  const [lastChangeDue, setLastChangeDue] = useState<number>(0);
  const [lastItems, setLastItems] = useState<CartItem[]>([]);
  const [lastCustomerName, setLastCustomerName] = useState('Umum');
  const [lastTimestamp, setLastTimestamp] = useState('');

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) {
        return;
      }
      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .gt('stock', 0)
        .order('name', { ascending: true });
      if (fetchErr) throw fetchErr;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err.message);
      setError(err.message || 'Gagal mengambil produk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCustomItemSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (role === 'viewer') {
      alert('Akses ditolak: Viewer tidak memiliki wewenang untuk menambahkan custom item.');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const name = formData.get('customName') as string;
    const sellingPrice = parseInt(formData.get('customSellingPrice') as string, 10);
    const costPriceStr = formData.get('customCostPrice') as string;
    const costPrice = costPriceStr ? parseInt(costPriceStr, 10) : 0;
    const quantity = parseInt(formData.get('customQuantity') as string, 10);

    const tempId = 'custom-' + Date.now();

    addItem({
      productId: tempId,
      name,
      sellingPrice,
      stock: 999999,
      isCustom: true,
      costPrice
    });

    if (quantity > 1) {
      updateQuantity(tempId, quantity);
    }

    setShowCustomModal(false);
  };

  const handleCheckout = async () => {
    if (items.length === 0 || checkingOut) return;
    if (role === 'viewer') {
      alert('Akses ditolak: Viewer tidak memiliki wewenang untuk melakukan checkout.');
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      // 1. Dapatkan staff_id dari tabel users (atau buat default)
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      if (usersErr) throw usersErr;

      let staffId = users?.[0]?.id;
      if (!staffId) {
        const { data: newUser, error: insertUserErr } = await supabase
          .from('users')
          .insert([{ name: 'Staff Toko', role: 'staff' }])
          .select('id')
          .single();

        if (insertUserErr) throw insertUserErr;
        staffId = newUser.id;
      }

      // 2. Buat Transaksi Baru
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      const { data: transaction, error: txErr } = await supabase
        .from('transactions')
        .insert([{
          invoice_number: invNum,
          staff_id: staffId,
          total_amount: getTotalAmount(),
          payment_method: paymentMethod,
          customer_name: customerName.trim() || 'Umum'
        }])
        .select('id')
        .single();

      if (txErr) throw txErr;
      const transactionId = transaction.id;

      // 3. Masukkan Detail Item Transaksi (transaction_items)
      // Custom items: product_id = null, nama & modal disimpan di kolom custom_item_name & cost_price_at_sale
      // Regular items: product_id = id produk dari inventory
      const transactionItems = items.map((item) => ({
        transaction_id: transactionId,
        product_id: item.isCustom ? null : item.productId,
        quantity: item.quantity,
        price_at_sale: item.sellingPrice,
        custom_item_name: item.isCustom ? `${item.name} [Custom Item]` : null,
        cost_price_at_sale: item.isCustom ? (item.costPrice ?? 0) : null,
      }));

      const { error: itemsErr } = await supabase
        .from('transaction_items')
        .insert(transactionItems);

      if (itemsErr) throw itemsErr;


      // 4. Update Stok di database (Read-then-Update per item; custom items dilewati)
      for (const item of items) {
        if (item.isCustom) continue;

        const { data: currentProduct, error: prodErr } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single();

        if (prodErr) throw prodErr;

        const newStock = Math.max(0, (currentProduct?.stock || 0) - item.quantity);
        const { error: updateStockErr } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.productId);

        if (updateStockErr) throw updateStockErr;
      }

      // Log activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert([{
          user_id: user?.id || null,
          email: user?.email || null,
          action: 'CHECKOUT_POS',
          details: {
            invoice_number: invNum,
            total_amount: getTotalAmount(),
            payment_method: paymentMethod,
            customer_name: customerName.trim() || 'Umum',
            items: items.map(item => ({
              id: item.productId,
              name: item.name,
              qty: item.quantity,
              price: item.sellingPrice
            }))
          }
        }]);
      } catch (logErr) {
        console.error('Failed to write audit log:', logErr);
      }

      // Sukses
      setLastTotal(getTotalAmount());
      setInvoiceNum(invNum);
      setLastCashReceived(paymentMethod === 'cash' ? (Number(cashReceived) || getTotalAmount()) : getTotalAmount());
      setLastChangeDue(paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || getTotalAmount()) - getTotalAmount()) : 0);
      setLastItems([...items]);
      setLastCustomerName(customerName.trim() || 'Umum');
      setLastTimestamp(new Date().toISOString());

      setCheckoutSuccess(true);
      setCustomerName('');
      setCashReceived('');
      clearCart();
      fetchProducts(); // Refresh stok cashier

      setTimeout(() => {
        setCheckoutSuccess(false);
      }, 20000);
    } catch (err: any) {
      console.error('Error during checkout:', err.message);
      alert('Transaksi gagal: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* 1. Force the page canvas to be exactly 58mm wide and height dynamic */
          @page {
            size: 58mm auto !important;
            margin: 0mm !important;
          }
          
          /* 2. Hide every single element in the DOM by default */
          body * {
            visibility: hidden !important;
          }

          /* 3. Unhide ONLY the receipt container and its direct children */
          .receipt-container,
          .receipt-container * {
            visibility: visible !important;
          }

          /* 4. Lock the print root position to the absolute top-left corner */
          .receipt-container {
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
      `}} />

      <div className="flex flex-col xl:flex-row gap-8 h-[calc(100vh-12rem)] md:h-[calc(100vh-8.5rem)] print:hidden">
      {/* Products Selection Panel (Left column - main) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden">
        {/* Search & Custom Item Row */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t("Cari nama barang...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-600 transition-colors"
            />
          </div>
          <button
            onClick={() => role !== 'viewer' && setShowCustomModal(true)}
            title={role === 'viewer' ? 'Viewer tidak dapat menambahkan custom item' : undefined}
            className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-indigo-600/10 min-h-[38px] ${
              role === 'viewer'
                ? 'pointer-events-none opacity-60 grayscale cursor-not-allowed'
                : 'hover:bg-indigo-700 active:scale-98 cursor-pointer'
            }`}
          >
            <Plus size={14} />
            {t("Custom Item")}
          </button>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-4 scrollbar-thin">
          <div className="flex gap-2">
            {['all', 'komputer', 'laptop', 'printer', 'aksesoris', 'part'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white rounded-lg font-semibold shadow-sm' 
                    : 'bg-slate-100 text-slate-500 dark:bg-zinc-950 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                }`}
              >
                {cat === 'all' ? t('Semua') : t(cat.charAt(0).toUpperCase() + cat.slice(1))}
              </button>
            ))}
          </div>
        </div>

        {/* Database Error Alert */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Error: {error}</span>
          </div>
        )}

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-medium">{t('Mengambil produk dari database...')}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ShoppingBag className="mx-auto text-slate-350 dark:text-slate-700 mb-3" size={36} />
              <p className="text-xs font-medium">{t('Tidak ada produk tersedia')}</p>
              <p className="text-[10px] text-slate-550">{t('Stok produk mungkin kosong atau tidak ditemukan.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const cartItem = items.find((i) => i.productId === product.id);
                const quantityInCart = cartItem?.quantity || 0;
                const remainingStock = product.stock - quantityInCart;

                return (
                  <div 
                    key={product.id}
                    className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                      remainingStock === 0
                        ? 'border-slate-105 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-950/40 opacity-60'
                        : 'border-slate-200 dark:border-zinc-805 hover:border-indigo-500/40 bg-white dark:bg-zinc-900/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                          {product.category}
                        </span>
                        <span className={`text-[10px] font-semibold ${remainingStock <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                          Stok: {remainingStock}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm line-clamp-2 leading-tight min-h-[2.5rem]">
                        {product.name}
                      </h4>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                        {formatRupiah(product.selling_price)}
                      </span>
                      <button
                        disabled={remainingStock === 0 || role === 'viewer'}
                        onClick={() => addItem({
                          productId: product.id,
                          name: product.name,
                          sellingPrice: product.selling_price,
                          stock: product.stock
                        })}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          (remainingStock === 0 || role === 'viewer')
                            ? 'bg-slate-100 text-slate-355 dark:bg-zinc-950 dark:text-slate-650 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cashier Checkout Cart (Right column) */}
      <div className="hidden md:flex w-full xl:w-96 flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">{t('Keranjang Belanja')}</h3>
          </div>
          <span className="text-xs font-bold bg-slate-100 dark:bg-zinc-950 px-2 py-0.5 rounded-full text-slate-500">
            {items.reduce((sum, i) => sum + i.quantity, 0)} item
          </span>
        </div>

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2 py-12">
              <ShoppingBag size={32} className="text-slate-350 dark:text-slate-700" />
              <p className="text-xs font-medium">{t('Keranjang masih kosong')}</p>
              <p className="text-[10px] text-slate-400">{t('Pilih barang di sebelah kiri')}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800">
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</h5>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{formatRupiah(item.sellingPrice)}</p>
                </div>
                <div className="flex flex-col items-end justify-between gap-2">
                  <button 
                    disabled={role === 'viewer'}
                    onClick={() => { if (role !== 'viewer') removeItem(item.productId); }}
                    className="text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 px-1 py-0.5">
                    <button 
                      disabled={role === 'viewer'}
                      onClick={() => { if (role !== 'viewer') updateQuantity(item.productId, item.quantity - 1); }}
                      className="p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 w-4 text-center">{item.quantity}</span>
                    <button 
                      disabled={role === 'viewer'}
                      onClick={() => { if (role !== 'viewer') updateQuantity(item.productId, item.quantity + 1); }}
                      className="p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Checkout */}
        {items.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-4">
            {/* Nama Pembeli (Customer Name) */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Nama Pembeli')}</span>
              <input
                type="text"
                disabled={role === 'viewer'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("Contoh: Ahmad (Kosongkan jika Umum)")}
                className="w-full mt-1.5 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50"
              />
            </div>

            {/* Payment Method */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Metode Pembayaran')}</span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  disabled={role === 'viewer'}
                  onClick={() => { if (role !== 'viewer') setPaymentMethod('cash'); }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                  }`}
                >
                  <DollarSign size={12} />
                  Cash
                </button>
                <button
                  disabled={role === 'viewer'}
                  onClick={() => { if (role !== 'viewer') setPaymentMethod('transfer'); }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                    paymentMethod === 'transfer'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                  }`}
                >
                  <CreditCard size={12} />
                  Transfer
                </button>
              </div>
            </div>

            {/* Cash Received Input (Only when Cash is selected) */}
            {paymentMethod === 'cash' && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Uang Diterima (Cash)')}</span>
                <input
                  type="text"
                  disabled={role === 'viewer'}
                  value={cashReceived === '' ? '' : cashReceived}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setCashReceived(val === '' ? '' : parseInt(val, 10));
                  }}
                  placeholder="Contoh: 50000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50"
                />
                {cashReceived !== '' && cashReceived < getTotalAmount() && (
                  <p className="text-[10px] text-rose-500 font-semibold">{t('Uang diterima kurang dari total tagihan!')}</p>
                )}
                {cashReceived !== '' && cashReceived >= getTotalAmount() && (
                  <div className="flex justify-between items-center px-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>{t('Kembalian')}:</span>
                    <span>{formatRupiah(cashReceived - getTotalAmount())}</span>
                  </div>
                )}
              </div>
            )}

            {/* Total Pricing */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80">
              <span className="text-xs font-semibold text-slate-550">{t('Total Tagihan')}:</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-slate-50">{formatRupiah(getTotalAmount())}</span>
            </div>

            {/* Checkout Action */}
            <button
              disabled={checkingOut || role === 'viewer' || (paymentMethod === 'cash' && cashReceived !== '' && cashReceived < getTotalAmount())}
              onClick={handleCheckout}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white min-h-[44px] rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {checkingOut && <Loader2 size={14} className="animate-spin" />}
              {checkingOut ? t('Memproses...') : t('Proses Transaksi & Cetak Struk')}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Floating Cart Button */}
      {items.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 md:hidden print:hidden">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white py-3.5 px-5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-between font-bold text-xs min-h-[44px] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag size={16} />
              <span>Lihat Keranjang ({items.reduce((sum, i) => sum + i.quantity, 0)} Item)</span>
            </span>
            <span>{formatRupiah(getTotalAmount())}</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Sheet Cart */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center md:hidden no-print animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-h-[85vh] flex flex-col p-6 overflow-hidden shadow-2xl text-slate-900 dark:text-zinc-50 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Keranjang Belanja</h3>
              </div>
              <button 
                onClick={() => setShowMobileCart(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cart List */}
            <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-3">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2 py-12">
                  <ShoppingBag size={32} className="text-slate-350 dark:text-slate-700" />
                  <p className="text-xs font-medium">Keranjang masih kosong</p>
                  <p className="text-[10px] text-slate-400">Pilih barang di belakang</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.productId} className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</h5>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{formatRupiah(item.sellingPrice)}</p>
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2">
                      <button 
                        disabled={role === 'viewer'}
                        onClick={() => { if (role !== 'viewer') removeItem(item.productId); }}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 px-1 py-0.5">
                        <button 
                          disabled={role === 'viewer'}
                          onClick={() => { if (role !== 'viewer') updateQuantity(item.productId, item.quantity - 1); }}
                          className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 w-4 text-center">{item.quantity}</span>
                        <button 
                          disabled={role === 'viewer'}
                          onClick={() => { if (role !== 'viewer') updateQuantity(item.productId, item.quantity + 1); }}
                          className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary & Checkout */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-4 space-y-4">
                {/* Nama Pembeli (Customer Name) */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Pembeli</span>
                  <input
                    type="text"
                    disabled={role === 'viewer'}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Ahmad (Kosongkan jika Umum)"
                    className="w-full mt-1.5 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode Pembayaran</span>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <button
                      type="button"
                      disabled={role === 'viewer'}
                      onClick={() => { if (role !== 'viewer') setPaymentMethod('cash'); }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                      }`}
                    >
                      <DollarSign size={12} />
                      Cash
                    </button>
                    <button
                      type="button"
                      disabled={role === 'viewer'}
                      onClick={() => { if (role !== 'viewer') setPaymentMethod('transfer'); }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                        paymentMethod === 'transfer'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                      }`}
                    >
                      <CreditCard size={12} />
                      Transfer
                    </button>
                  </div>
                </div>

                {/* Cash Received Input (Only when Cash is selected) */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uang Diterima (Cash)</span>
                    <input
                      type="text"
                      disabled={role === 'viewer'}
                      value={cashReceived === '' ? '' : cashReceived}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setCashReceived(val === '' ? '' : parseInt(val, 10));
                      }}
                      placeholder="Contoh: 50000"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50"
                    />
                    {cashReceived !== '' && cashReceived < getTotalAmount() && (
                      <p className="text-[10px] text-rose-500 font-semibold">Uang diterima kurang dari total tagihan!</p>
                    )}
                    {cashReceived !== '' && cashReceived >= getTotalAmount() && (
                      <div className="flex justify-between items-center px-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <span>Kembalian:</span>
                        <span>{formatRupiah(cashReceived - getTotalAmount())}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total Pricing */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80">
                  <span className="text-xs font-semibold text-slate-550">Total Tagihan:</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-50">{formatRupiah(getTotalAmount())}</span>
                </div>

                {/* Checkout Action */}
                <button
                  type="button"
                  disabled={checkingOut || role === 'viewer' || (paymentMethod === 'cash' && cashReceived !== '' && cashReceived < getTotalAmount())}
                  onClick={async () => {
                    await handleCheckout();
                    setShowMobileCart(false);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white py-3.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  {checkingOut && <Loader2 size={14} className="animate-spin" />}
                  {checkingOut ? 'Memproses...' : 'Proses Transaksi & Cetak Struk'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Success Modal overlay */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl max-w-sm w-full text-center border border-slate-200 dark:border-zinc-800/80 shadow-2xl flex flex-col items-center">
            <div className="bg-indigo-100 dark:bg-indigo-950/40 p-3 rounded-full text-indigo-600 dark:text-indigo-400 mb-4 animate-bounce animate-duration-1000">
              <CheckCircle size={36} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaksi Berhasil!</h3>
            <p className="text-xs text-slate-500 mt-1">Invoice berhasil diterbitkan dan stok otomatis terpotong.</p>
            <div className="my-4 bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 w-full text-left">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>No Invoice:</span>
                <span className="font-bold text-slate-705 dark:text-slate-200">{invoiceNum}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Total:</span>
                <span className="font-bold text-indigo-600">{formatRupiah(lastTotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Metode:</span>
                <span className="font-bold uppercase text-slate-705 dark:text-slate-200">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Pembeli:</span>
                <span className="font-bold text-slate-705 dark:text-slate-200">{lastCustomerName}</span>
              </div>
            </div>

            {/* Print & Control Buttons */}
            <div className="flex gap-3 w-full mt-2 mb-3">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                <Printer size={14} />
                Cetak Struk
              </button>
              <button
                onClick={() => setCheckoutSuccess(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
            
            <span className="text-[10px] text-slate-400 italic">Siap mencetak struk thermal...</span>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Tambah Barang Non-Inventory (Custom)</h3>
              <button 
                onClick={() => setShowCustomModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCustomItemSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Produk / Deskripsi</label>
                <input 
                  type="text" 
                  name="customName" 
                  placeholder="Contoh: Printer Canon MP287" 
                  required 
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Jual (Rp)</label>
                  <input 
                    type="text" 
                    name="customSellingPrice" 
                    placeholder="Contoh: 1500000" 
                    required 
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Modal (Rp - Opsional)</label>
                  <input 
                    type="text" 
                    name="customCostPrice" 
                    placeholder="Default 0" 
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kuantitas (Qty)</label>
                <input 
                  type="number" 
                  name="customQuantity" 
                  placeholder="Jumlah" 
                  required 
                  min="1"
                  defaultValue="1"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-100" 
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCustomModal(false)} 
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2"
                >
                  Tambahkan ke Keranjang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* Thermal Receipt Print Layout */}
      <div id="thermal-receipt" className="hidden print:block receipt-container text-black bg-white p-2">
        <div className="text-center font-bold uppercase">Mitra Computer</div>
        <div className="text-center mb-2 border-b border-dashed border-black pb-1.5">
          Jl. Kolonel Abunjani No. 24, Sipin<br/>
          Ruko Simpang III, Jambi<br/>
          Telp: 0811-7400-000
        </div>
        
        <div className="mb-2 space-y-0.5 border-b border-dashed border-black pb-1.5">
          <div>No. Invoice : {invoiceNum}</div>
          <div>Tanggal     : {formatDateTime(lastTimestamp)}</div>
          <div>Pelanggan   : {lastCustomerName}</div>
        </div>

        <div className="border-b border-dashed border-black pb-1.5">
          {lastItems.map((item, idx) => (
            <div key={idx} className="mb-1">
              <div className="truncate max-w-[190px]">{item.name}</div>
              <div className="flex justify-between">
                <span>{item.quantity} x {formatRupiah(item.sellingPrice)}</span>
                <span>{formatRupiah(item.sellingPrice * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-0.5 mt-1.5 pb-2">
          <div className="flex justify-between font-bold">
            <span>TOTAL:</span>
            <span>{formatRupiah(lastTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>BAYAR:</span>
            <span>{formatRupiah(lastCashReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span>KEMBALI:</span>
            <span>{formatRupiah(lastChangeDue)}</span>
          </div>
        </div>

        <div className="text-center border-t border-dashed border-black pt-2 mt-2">
          Terima Kasih atas Kunjungan Anda!
        </div>
      </div>
    </>
  );
}
