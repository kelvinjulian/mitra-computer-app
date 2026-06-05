'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  SlidersHorizontal, 
  AlertTriangle, 
  Edit, 
  Trash2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';

type Product = Database['public']['Tables']['products']['Row'];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // 1. Ambil Data (Read) dari Supabase
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (fetchErr) throw fetchErr;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err.message);
      setError(err.message || 'Gagal mengambil data produk dari database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. Tambah Data (Create) ke Supabase
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category = formData.get('category') as any;
    const stock = parseInt(formData.get('stock') as string, 10);
    const cost_price = parseInt(formData.get('cost_price') as string, 10);
    const selling_price = parseInt(formData.get('selling_price') as string, 10);
    const min_stock_threshold = parseInt(formData.get('min_stock_threshold') as string, 10);

    try {
      const { error: insertErr } = await supabase
        .from('products')
        .insert([
          {
            name,
            category,
            stock,
            cost_price,
            selling_price,
            min_stock_threshold
          }
        ]);

      if (insertErr) throw insertErr;
      
      setShowAddModal(false);
      fetchProducts();
    } catch (err: any) {
      console.error('Error adding product:', err.message);
      alert('Gagal menambah produk: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Edit Data (Update) di Supabase
  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setUpdating(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category = formData.get('category') as any;
    const stock = parseInt(formData.get('stock') as string, 10);
    const cost_price = parseInt(formData.get('cost_price') as string, 10);
    const selling_price = parseInt(formData.get('selling_price') as string, 10);
    const min_stock_threshold = parseInt(formData.get('min_stock_threshold') as string, 10);

    try {
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          name,
          category,
          stock,
          cost_price,
          selling_price,
          min_stock_threshold
        })
        .eq('id', editingProduct.id);

      if (updateErr) throw updateErr;

      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      console.error('Error updating product:', err.message);
      alert('Gagal memperbarui produk: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // 4. Hapus Data (Delete) dari Supabase
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) return;

    try {
      const { error: deleteErr } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      fetchProducts();
    } catch (err: any) {
      console.error('Error deleting product:', err.message);
      alert('Gagal menghapus produk: ' + err.message);
    }
  };

  // 5. Bersih-bersih Produk Hantu (produk berstok 0 hasil custom item lama)
  const [cleaning, setCleaning] = useState(false);
  const handleCleanGhostProducts = async () => {
    const confirmed = window.confirm(
      'Ini akan menghapus SEMUA produk berstok 0 yang bukan terikat stok aktif dari inventory. Pastikan Anda sudah menghapus relasi transaction_items di Supabase terlebih dahulu (atau jalankan SQL: ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL).\n\nLanjutkan?'
    );
    if (!confirmed) return;
    setCleaning(true);
    try {
      // Ambil semua produk dengan stock = 0
      const { data: zeroProd, error: fetchErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('stock', 0);
      if (fetchErr) throw fetchErr;

      if (!zeroProd || zeroProd.length === 0) {
        alert('Tidak ada produk berstok 0 yang ditemukan.');
        return;
      }

      const ids = zeroProd.map((p) => p.id);

      // Hapus produk berstok 0 (transaction_items.product_id harus sudah nullable di Supabase)
      const { error: deleteErr } = await supabase
        .from('products')
        .delete()
        .in('id', ids);

      if (deleteErr) throw deleteErr;

      alert(`✅ Berhasil menghapus ${ids.length} produk hantu berstok 0 dari inventory!`);
      fetchProducts();
    } catch (err: any) {
      console.error('Error cleaning ghost products:', err.message);
      alert('Gagal menghapus produk hantu: ' + err.message + '\n\nPastikan kolom product_id pada tabel transaction_items sudah di-set nullable di Supabase SQL Editor.');
    } finally {
      setCleaning(false);
    }
  };

  // Filter & Search Logic
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.min_stock_threshold).length;
  const totalValueStok = products.reduce((sum, p) => sum + p.cost_price * p.stock, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Upper Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-2.5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex items-center gap-2 md:gap-4">
          <div className="p-1.5 md:p-3 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <Package size={14} className="md:w-[22px] md:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Jenis</p>
            <h4 className="text-sm md:text-xl font-extrabold text-slate-800 dark:text-white mt-0.5 truncate">
              {loading ? '...' : `${products.length} Item`}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-2.5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex items-center gap-2 md:gap-4">
          <div className="p-1.5 md:p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 rounded-xl shrink-0">
            <AlertTriangle size={14} className="md:w-[22px] md:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stok Tipis</p>
            <h4 className="text-sm md:text-xl font-extrabold text-slate-800 dark:text-white mt-0.5 truncate">
              {loading ? '...' : `${lowStockCount} Barang`}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-2.5 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex items-center gap-2 md:gap-4 col-span-2 md:col-span-1">
          <div className="p-1.5 md:p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <SlidersHorizontal size={14} className="md:w-[22px] md:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Value Stok</p>
            <h4 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white mt-0.5 truncate">
              {loading ? '...' : formatRupiah(totalValueStok)}
            </h4>
          </div>
        </div>
      </div>

      {/* Main Inventory Panel */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/80 p-6 shadow-sm">
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari di gudang..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500 transition-all duration-200"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 pr-10 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-50 outline-none cursor-pointer appearance-auto"
            >
              <option value="all">Semua Kategori</option>
              <option value="komputer">Komputer</option>
              <option value="laptop">Laptop</option>
              <option value="printer">Printer</option>
              <option value="aksesoris">Aksesoris</option>
              <option value="part">Sparepart / Part</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-start md:items-auto self-start md:self-auto">
            <button
              onClick={handleCleanGhostProducts}
              disabled={cleaning}
              title="Hapus semua produk berstok 0 (produk hantu hasil Custom Item lama)"
              className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm flex items-center gap-1.5"
            >
              {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {cleaning ? 'Membersihkan...' : 'Hapus Produk Hantu'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm flex items-center gap-1.5"
            >
              <Plus size={14} />
              Tambah Produk Baru
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

        {/* Inventory Catalog Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <p className="text-xs font-medium">Mengambil data dari Supabase...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Package className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={36} />
              <p className="text-xs font-medium">Tidak ada produk ditemukan</p>
              <p className="text-[10px] text-slate-500">Tambahkan barang baru ke dalam sistem.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-900/10">
                  <th className="py-3.5 px-4 rounded-l-xl">Nama Barang</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Kategori</th>
                  <th className="py-3.5 px-4 text-right hidden md:table-cell">Harga Modal</th>
                  <th className="py-3.5 px-4 text-right">Harga Jual</th>
                  <th className="py-3.5 px-4 text-center">Stok</th>
                  <th className="py-3.5 px-4 text-center hidden sm:table-cell">Batas Min</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product) => {
                  const isAlert = product.stock <= product.min_stock_threshold;
                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-slate-50/60 dark:hover:bg-zinc-800/50 transition-colors ${
                        isAlert ? 'bg-amber-500/[0.02] dark:bg-amber-500/[0.01]' : ''
                      }`}
                    >
                      <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col gap-0.5">
                          <span>{product.name}</span>
                          {isAlert && (
                            <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={10} />
                              Stok hampir habis
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden sm:table-cell">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        {formatRupiah(product.cost_price)}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-slate-800 dark:text-slate-100">
                        {formatRupiah(product.selling_price)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`font-extrabold text-xs px-2.5 py-1 rounded-full ${
                          product.stock === 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                          isAlert ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-slate-400 hidden sm:table-cell">{product.min_stock_threshold}</td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            onClick={() => setEditingProduct(product)}
                            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer" 
                            title="Edit Barang"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer" 
                            title="Hapus Barang"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Product Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Tambah Produk Baru</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-655 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  placeholder="Contoh: Asus VivoBook Intel i3" 
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kategori</label>
                  <select 
                    name="category"
                    className="w-full px-3 pr-10 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none cursor-pointer dark:text-zinc-50"
                  >
                    <option value="komputer">Komputer</option>
                    <option value="laptop">Laptop</option>
                    <option value="printer">Printer</option>
                    <option value="aksesoris">Aksesoris</option>
                    <option value="part">Sparepart / Part</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stok Awal</label>
                  <input 
                    type="number" 
                    name="stock"
                    defaultValue="5"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Min Alert</label>
                  <input 
                    type="number" 
                    name="min_stock_threshold"
                    defaultValue="5"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Modal (Rp)</label>
                  <input 
                    type="text" 
                    name="cost_price"
                    placeholder="Beli"
                    required
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Jual (Rp)</label>
                  <input 
                    type="text" 
                    name="selling_price"
                    placeholder="Jual"
                    required
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal Overlay */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Edit Produk</h3>
              <button 
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-655 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  defaultValue={editingProduct.name}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kategori</label>
                  <select 
                    name="category"
                    defaultValue={editingProduct.category}
                    className="w-full px-3 pr-10 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none cursor-pointer dark:text-zinc-50"
                  >
                    <option value="komputer">Komputer</option>
                    <option value="laptop">Laptop</option>
                    <option value="printer">Printer</option>
                    <option value="aksesoris">Aksesoris</option>
                    <option value="part">Sparepart / Part</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stok</label>
                  <input 
                    type="number" 
                    name="stock"
                    defaultValue={editingProduct.stock}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Min Alert</label>
                  <input 
                    type="number" 
                    name="min_stock_threshold"
                    defaultValue={editingProduct.min_stock_threshold}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Modal (Rp)</label>
                  <input 
                    type="text" 
                    name="cost_price"
                    defaultValue={editingProduct.cost_price}
                    required
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Harga Jual (Rp)</label>
                  <input 
                    type="text" 
                    name="selling_price"
                    defaultValue={editingProduct.selling_price}
                    required
                    onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-50"
                >
                  {updating && <Loader2 size={12} className="animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
