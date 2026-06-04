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
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';

type DbProduct = Database['public']['Tables']['products']['Row'];

export default function KasirPage() {
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

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
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
          payment_method: paymentMethod
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

      // Sukses
      setLastTotal(getTotalAmount());
      setInvoiceNum(invNum);
      setCheckoutSuccess(true);
      clearCart();
      fetchProducts(); // Refresh stok cashier

      setTimeout(() => {
        setCheckoutSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error('Error during checkout:', err.message);
      alert('Transaksi gagal: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 h-[calc(100vh-8.5rem)]">
      {/* Products Selection Panel (Left column - main) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden">
        {/* Search, Categories & Custom Item Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama barang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-600 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div className="flex gap-2">
              {['all', 'komputer', 'laptop', 'printer', 'aksesoris', 'part'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    selectedCategory === cat 
                      ? 'bg-slate-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm' 
                      : 'bg-slate-100 text-slate-500 dark:bg-zinc-950 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center gap-1 shrink-0"
            >
              <Plus size={12} />
              Custom Item
            </button>
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
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <p className="text-xs font-medium">Mengambil produk dari database...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ShoppingBag className="mx-auto text-slate-350 dark:text-slate-700 mb-3" size={36} />
              <p className="text-xs font-medium">Tidak ada produk tersedia</p>
              <p className="text-[10px] text-slate-550">Stok produk mungkin kosong atau tidak ditemukan.</p>
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
                        : 'border-slate-200 dark:border-zinc-805 hover:border-emerald-500/40 bg-white dark:bg-zinc-900/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
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
                        disabled={remainingStock === 0}
                        onClick={() => addItem({
                          productId: product.id,
                          name: product.name,
                          sellingPrice: product.selling_price,
                          stock: product.stock
                        })}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          remainingStock === 0
                            ? 'bg-slate-100 text-slate-350 dark:bg-zinc-950 dark:text-slate-650 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:scale-105 active:scale-95'
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
      <div className="w-full xl:w-96 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Keranjang Belanja</h3>
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
              <p className="text-xs font-medium">Keranjang masih kosong</p>
              <p className="text-[10px] text-slate-400">Pilih barang di sebelah kiri</p>
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
                    onClick={() => removeItem(item.productId)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 px-1 py-0.5">
                    <button 
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded"
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
            {/* Payment Method */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode Pembayaran</span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                  }`}
                >
                  <DollarSign size={12} />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                    paymentMethod === 'transfer'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950 text-slate-500'
                  }`}
                >
                  <CreditCard size={12} />
                  Transfer
                </button>
              </div>
            </div>

            {/* Total Pricing */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80">
              <span className="text-xs font-semibold text-slate-550">Total Tagihan:</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-slate-50">{formatRupiah(getTotalAmount())}</span>
            </div>

            {/* Checkout Action */}
            <button
              disabled={checkingOut}
              onClick={handleCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white py-3 rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkingOut && <Loader2 size={14} className="animate-spin" />}
              {checkingOut ? 'Memproses...' : 'Proses Transaksi & Cetak Struk'}
            </button>
          </div>
        )}
      </div>

      {/* Checkout Success Modal overlay */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl max-w-sm w-full text-center border border-slate-200 dark:border-zinc-800/80 shadow-2xl flex flex-col items-center">
            <div className="bg-emerald-100 dark:bg-emerald-950/40 p-3 rounded-full text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce">
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
                <span className="font-bold text-emerald-600">{formatRupiah(lastTotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Metode:</span>
                <span className="font-bold uppercase text-slate-705 dark:text-slate-200">{paymentMethod}</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 italic">Mencetak struk kasir thermal...</span>
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-2"
                >
                  Tambahkan ke Keranjang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
