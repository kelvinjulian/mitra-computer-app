'use client';

import { useState, useEffect } from 'react';
import { 
  Wrench, 
  Search, 
  Plus, 
  MessageSquare, 
  Clock, 
  User, 
  CheckCircle2, 
  Phone,
  Settings,
  ChevronRight,
  TrendingUp,
  Loader2,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import { useLanguage } from '@/components/shared/LanguageProvider';
import { useAuth } from '@/components/shared/AuthProvider';

type Service = Database['public']['Tables']['services']['Row'];

export default function ServicePage() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // States for right side editing console
  const [detailStatus, setDetailStatus] = useState<string>('');
  const [detailNotes, setDetailNotes] = useState<string>('');
  const [detailServiceCost, setDetailServiceCost] = useState<number>(0);
  const [detailPartCost, setDetailPartCost] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const formatRupiah = (value: number | null) => {
    if (value === null) return 'Belum ditentukan';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setServices(data || []);
    } catch (err: any) {
      console.error('Error fetching services:', err.message);
      setError(err.message || 'Gagal mengambil data service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedService) {
      setDetailStatus(selectedService.status);
      setDetailNotes(selectedService.technician_notes || '');
      setDetailServiceCost(selectedService.service_cost || 0);
      setDetailPartCost(selectedService.part_cost || 0);
    }
  }, [selectedService]);

  const filteredServices = services.filter((svc) => {
    const matchesSearch = svc.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          svc.device_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || svc.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'antrean': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
      case 'dicek': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'menunggu_part': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      case 'selesai': return 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-950/30 dark:text-blue-400';
      case 'batal': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
      default: return 'bg-zinc-100 text-zinc-800';
    }
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const customer_name = formData.get('customer_name') as string;
    const customer_whatsapp = formData.get('customer_whatsapp') as string;
    const device_name = formData.get('device_name') as string;
    const complaint = formData.get('complaint') as string;

    try {
      const { error: insertErr } = await supabase
        .from('services')
        .insert([
          {
            customer_name,
            customer_whatsapp,
            device_name,
            complaint,
            status: 'antrean',
            part_cost: 0,
            service_cost: null
          }
        ]);

      if (insertErr) throw insertErr;
      
      setShowAddModal(false);
      fetchServices();
      showToast('Pendaftaran service berhasil!');
    } catch (err: any) {
      console.error('Error registering service:', err.message);
      showToast('Gagal mendaftarkan service: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || updating) return;
    setUpdating(true);

    try {
      const { error: updateErr } = await supabase
        .from('services')
        .update({
          status: detailStatus as any,
          technician_notes: detailNotes,
          service_cost: detailServiceCost,
          part_cost: detailPartCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedService.id);

      if (updateErr) throw updateErr;

      await fetchServices();
      // Update selectedService state
      setSelectedService(prev => prev ? {
        ...prev,
        status: detailStatus as any,
        technician_notes: detailNotes,
        service_cost: detailServiceCost,
        part_cost: detailPartCost
      } : null);

      showToast('Perubahan service berhasil disimpan!');
    } catch (err: any) {
      console.error('Error updating service:', err.message);
      showToast('Gagal menyimpan perubahan: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data service ini?")) return;
    try {
      const { error: deleteErr } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      showToast("Data service berhasil dihapus!");
      
      if (selectedService?.id === id) {
        setSelectedService(null);
      }
      fetchServices();
    } catch (err: any) {
      console.error('Error deleting service:', err.message);
      showToast('Gagal menghapus data service: ' + err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 h-auto xl:h-[calc(100vh-8.5rem)]">
      {/* Service Queue List Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/80 p-4 md:p-6 overflow-hidden shadow-sm">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama pelanggan / device..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500 transition-colors"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 pr-10 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-50 outline-none cursor-pointer appearance-auto"
            >
              <option value="all">Semua Status</option>
              <option value="antrean">Antrean</option>
              <option value="dicek">Dicek</option>
              <option value="menunggu_part">Menunggu Part</option>
              <option value="selesai">Selesai</option>
              <option value="batal">Batal</option>
            </select>
          </div>

          {role !== 'finance_staff' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus size={14} />
              Terima Device Baru
            </button>
          )}
        </div>

        {/* Database Error Alert */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Error: {error}</span>
          </div>
        )}

        {/* Service Cards Queue */}
        <div className="h-[50vh] md:h-auto flex-1 overflow-y-auto pr-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <p className="text-xs font-medium">Mengambil data service dari database...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Wrench className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={36} />
              <p className="text-xs font-medium">Tidak ada antrean service ditemukan</p>
              <p className="text-[10px] text-slate-500">Gunakan tombol "Terima Device Baru" untuk menambahkan.</p>
            </div>
          ) : (
            filteredServices.map((svc) => (
              <div 
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className={`p-3 md:p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 ${
                  selectedService?.id === svc.id 
                    ? 'border-indigo-500 bg-indigo-50/[0.02] dark:bg-indigo-950/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/20'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">{svc.customer_name}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(svc.status)}`}>
                      {svc.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{svc.device_name}</p>
                  <p className="text-[11px] text-zinc-400 line-clamp-1 italic">"{svc.complaint}"</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">Total Biaya</span>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">
                      {formatRupiah((svc.service_cost || 0) + (svc.part_cost || 0))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`https://wa.me/${svc.customer_whatsapp}`} 
                      target="_blank" 
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform"
                      title="Hubungi via WhatsApp"
                    >
                      <Phone size={14} />
                    </a>
                    <ChevronRight size={16} className="text-slate-350 dark:text-slate-655" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Service Details & Control Console (Right column) */}
      <div className={`w-full xl:w-96 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800/80 p-4 md:p-6 overflow-hidden shadow-sm ${
        selectedService ? 'flex' : 'hidden xl:flex'
      }`}>
        {selectedService ? (
          <form onSubmit={handleUpdateService} className="flex flex-col h-full justify-between">
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {/* Back button for mobile/tablet */}
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="p-2 xl:hidden text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                    title="Tutup Detail"
                  >
                    <ChevronRight className="rotate-180" size={16} />
                  </button>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Detail Pelacakan Service</span>
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base mt-1">
                      {selectedService.device_name}
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 block">
                      Pelanggan: <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedService.customer_name}</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-2 ${getStatusColor(selectedService.status)}`}>
                      {selectedService.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {role !== 'finance_staff' && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteService(selectedService.id)}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 hover:scale-105 transition-transform self-start"
                    title="Hapus Data Service"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Info Grid */}
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <p className="font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-1">Data Pelanggan</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedService.customer_name}</p>
                  <p className="text-[10px] text-slate-550 mt-0.5 flex items-center gap-1">
                    <Phone size={10} />
                    {selectedService.customer_whatsapp}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Keluhan Kerusakan</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 italic">
                    "{selectedService.complaint}"
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Status Progres</span>
                  <select 
                    value={detailStatus}
                    onChange={(e) => setDetailStatus(e.target.value)}
                    disabled={role === 'finance_staff'}
                    className="w-full px-3 pr-10 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="antrean">Antrean</option>
                    <option value="dicek">Dicek</option>
                    <option value="menunggu_part">Menunggu Part</option>
                    <option value="selesai">Selesai</option>
                    <option value="batal">Batal</option>
                  </select>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Catatan Teknisi</span>
                  <textarea 
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="Tulis diagnosa & tindakan di sini..."
                    disabled={role === 'finance_staff'}
                    className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-zinc-50 dark:placeholder:text-zinc-500 min-h-[5rem] resize-none"
                  />
                </div>

                {/* Costs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="font-bold text-slate-450 uppercase text-[9px] tracking-wider block mb-1">Biaya Jasa (Rp)</span>
                    <input 
                      type="text" 
                      value={detailServiceCost === 0 ? '' : detailServiceCost}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                        setDetailServiceCost(cleanVal === '' ? 0 : parseInt(cleanVal, 10));
                      }}
                      disabled={role === 'finance_staff'}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-slate-455 uppercase text-[9px] tracking-wider block mb-1">Biaya Part (Rp)</span>
                    <input 
                      type="text" 
                      value={detailPartCost === 0 ? '' : detailPartCost}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                        setDetailPartCost(cleanVal === '' ? 0 : parseInt(cleanVal, 10));
                      }}
                      disabled={role === 'finance_staff'}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6 space-y-2">
              <div className="flex justify-between items-center bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Total Biaya:</span>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatRupiah(detailServiceCost + detailPartCost)}
                </span>
              </div>
              {role !== 'finance_staff' && (
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-slate-900 dark:bg-zinc-50 text-white dark:text-slate-900 hover:opacity-90 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {updating && <Loader2 size={12} className="animate-spin" />}
                  Simpan Perubahan
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2 py-12">
            <Wrench size={32} className="text-slate-300 dark:text-zinc-700 animate-pulse" />
            <p className="text-xs font-medium">Belum ada perangkat terpilih</p>
            <p className="text-[10px] text-slate-400">Klik salah satu kartu service di sebelah kiri untuk melihat detail & memasukkan biaya</p>
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-modal-backdrop">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-modal-content">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Terima Perangkat Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-650 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddService} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Pelanggan</label>
                  <input type="text" name="customer_name" placeholder="Nama Lengkap" required className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">WhatsApp (WA)</label>
                  <input type="text" name="customer_whatsapp" placeholder="Contoh: 0812..." required className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Perangkat / Device</label>
                <input type="text" name="device_name" placeholder="Contoh: Epson L3110 / Asus ROG" required className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Keluhan Kerusakan</label>
                <textarea name="complaint" required placeholder="Tuliskan keluhan kerusakan secara detail..." className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none min-h-[4rem] resize-none dark:text-zinc-50 dark:placeholder:text-zinc-500" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">Batal</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-50">
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Daftarkan Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
