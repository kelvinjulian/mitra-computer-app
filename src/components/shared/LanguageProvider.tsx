'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'id' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'Dashboard': 'Dashboard',
    'POS Kasir': 'POS Cashier',
    'Inventory Stok': 'Inventory',
    'Pelacakan Service': 'Service Tracking',
    'Arus Kas / Finansial': 'Finance',
    'Kelola Staf': 'Staff Management',
    'Inventory': 'Inventory',
    'Service': 'Service Tracking',
    'Finance/Arus Kas': 'Finance',
    'Staff Management': 'Staff Management',

    // Dashboard & Stats Cards
    'TOTAL VALUE STOK': 'Total Stock Value',
    'TOTAL JENIS': 'Total Item Types',
    'OMSET HARI INI': "Today's Revenue",
    'ANTREAN SERVICE': 'Active Repairs',
    'Total Value Stok': 'Total Stock Value',
    'Total Jenis': 'Total Item Types',
    'Omset Hari Ini': "Today's Revenue",
    'Omset Periode Ini': "Today's Revenue",
    'Antrean Service': 'Active Repairs',
    'Stok Tipis': 'Stok Tipis',
    'Peringatan Stok': 'Stok Tipis',
    'Pengeluaran Periode': 'PENGELUARAN',

    // Chart
    'Analisis Penjualan': 'Sales Analytics',
    'Grafik tren pendapatan dari kasir dan reparasi selesai': 'Revenue trends from cashier and completed repairs',
    'Hari': 'Day',
    'Bulan': 'Month',
    'Tahun': 'Year',
    'Senin': 'Mon',
    'Selasa': 'Tue',
    'Rabu': 'Wed',
    'Kamis': 'Thu',
    'Jumat': 'Fri',
    'Sabtu': 'Sat',
    'Minggu': 'Sun',
    'Pendapatan': 'Revenue',
    'Laba vs Pengeluaran': 'Profit vs Expenses',
    'Laba Bersih vs Pengeluaran': 'Net Profit vs Expenses',
    'Total Penjualan POS': 'Total POS Sales',
    'Total Jasa Servis': 'Total Service Fees',
    'Volume Laptop Diservis': 'Volume of Laptops Serviced',
    'Servis Selesai': 'Completed Services',
    'Detail Margin (POS vs Servis)': 'Margin Details (POS vs Service)',
    'Total Pemasukan (Kotor)': 'Total Inflow (Gross)',
    'Total Pendapatan Hari Ini': 'Total Revenue',
    'Keuntungan Bersih': 'Net Profit',
    'Keuntungan Bersih Penjualan': 'Sales Net Profit',
    'Keuntungan Bersih Servis': 'Service Net Profit',
    'Total Pemasukan': 'Total Inflow',
    'Laptop Diservis': 'Laptop Under Repair',
    'Unit': 'Units',

    // Titles / Headers
    'Overview Dashboard': 'Overview Dashboard',
    'POS Kasir Baru': 'New POS Cashier',
    'Terima Service': 'Receive Service',
    'Antrean Service Aktif': 'Active Service Queue',
    'Aktivitas Log Terkini': 'Recent Audit Logs',
    'Log aktivitas sistem terbaru': 'Recent system activity logs',
    'Semua': 'All',
    'Cari di gudang...': 'Search in warehouse...',
    'Semua Kategori': 'All Categories',
    'Tambah Produk': 'Add Product',
    'Produk Hantu': 'Ghost Products',
    'Cari nama pelanggan / device...': 'Search customer name / device...',
    'Semua Status': 'All Statuses',
    'Antrean': 'Queue',
    'Dicek': 'Checked',
    'Menunggu Part': 'Waiting for Part',
    'Selesai': 'Completed',
    'Batal': 'Cancelled',
    'Profil Akun': 'Account Profile',
    'Keluar / Logout': 'Logout',
    'Keluar': 'Logout',
    'Kembalian': 'Change',
    'Total Tagihan': 'Total Bill',
    'Uang Diterima (Cash)': 'Cash Received',
    'Metode Pembayaran': 'Payment Method',
    'Nama Pembeli': 'Customer Name',
    'Cari nama barang...': 'Search item name...',
    'Tambah Barang Non-Inventory (Custom)': 'Add Non-Inventory Item (Custom)',
    'Harga Jual': 'Selling Price',
    'Harga Modal (Optional)': 'Cost Price (Optional)',
    'Jumlah': 'Quantity',
    'Keranjang Belanja': 'Shopping Cart',
    'Proses Transaksi & Cetak Struk': 'Process & Print Receipt',
    'Daftarkan Akun Staff Baru': 'Register New Staff Account',
    'Nama Lengkap': 'Full Name',
    'Alamat Email': 'Email Address',
    'Kata Sandi Awal': 'Initial Password',
    'Role / Hak Akses': 'Role / Access',
    'Daftar Staff Terdaftar': 'Registered Staff List',
    'Karyawan': 'Employee',
    'Administrator': 'Administrator',
    'Finance Staff': 'Finance Staff',
    'Viewer': 'Viewer',
    'Cabut Hak Akses': 'Revoke Access',
    'Reset Kata Sandi': 'Reset Password',
    'Reset Sandi': 'Reset Password',
    'Sandi': 'Password',
    'Hapus': 'Delete',
    'Ubah': 'Edit',
    'Batal Edit': 'Cancel Edit',
    'Simpan Perubahan': 'Save Changes',
    'Catatan Pemasukan': 'Income Record',
    'Buku Kas Pengeluaran': 'Expense Record',
    'Tambah Pengeluaran': 'Add Expense',
    'Today': 'Today',
    'Last 7 days': 'Last 7 days',
    'Last 30 days': 'Last 30 days',
    'Month to date': 'Month to date',
    'Year to date': 'Year to date',
    'All time': 'All time',
    'Select range': 'Select range',
    'pick end date': 'pick end date',
    'Quick select': 'Quick select',
    'Cancel': 'Cancel',
    'Apply': 'Apply',
    'Range:': 'Range:',
  },
  id: {
    // Navigation
    'Dashboard': 'Dashboard', // Keep specific term Dashboard unchanged
    'POS Kasir': 'Menu Kasir',
    'Inventory Stok': 'Stok Barang',
    'Pelacakan Service': 'Data Servis',
    'Arus Kas / Finansial': 'Buku Keuangan',
    'Kelola Staf': 'Akun Karyawan',
    'Inventory': 'Stok Barang',
    'Service': 'Data Servis',
    'Finance/Arus Kas': 'Buku Keuangan',
    'Staff Management': 'Akun Karyawan',

    // Dashboard & Stats Cards
    'TOTAL VALUE STOK': 'Total Modal Barang',
    'TOTAL JENIS': 'Macam Barang',
    'OMSET HARI INI': 'Pendapatan Hari Ini',
    'ANTREAN SERVICE': 'Laptop Diservis',
    'Total Value Stok': 'Total Modal Barang',
    'Total Jenis': 'Macam Barang',
    'Omset Hari Ini': 'Pendapatan Hari Ini',
    'Omset Periode Ini': 'Pendapatan Hari Ini',
    'Antrean Service': 'Laptop Diservis',
    'Stok Tipis': 'Stok Tipis',
    'Peringatan Stok': 'Stok Tipis',
    'Pengeluaran Periode': 'Buku Pengeluaran',

    // Chart
    'Analisis Penjualan': 'Analisis Penjualan',
    'Grafik tren pendapatan dari kasir dan reparasi selesai': 'Grafik tren pendapatan dari kasir dan reparasi selesai',
    'Hari': 'Hari',
    'Bulan': 'Bulan',
    'Tahun': 'Tahun',
    'Senin': 'Senin',
    'Selasa': 'Selasa',
    'Rabu': 'Rabu',
    'Kamis': 'Kamis',
    'Jumat': 'Jumat',
    'Sabtu': 'Sabtu',
    'Minggu': 'Minggu',
    'Pendapatan': 'Pendapatan',
    'Laba vs Pengeluaran': 'Laba vs Pengeluaran',
    'Laba Bersih vs Pengeluaran': 'Laba Bersih vs Pengeluaran',
    'Total Penjualan POS': 'Total Penjualan POS',
    'Total Jasa Servis': 'Total Jasa Servis',
    'Volume Laptop Diservis': 'Volume Laptop Diservis',
    'Servis Selesai': 'Servis Selesai',
    'Detail Margin (POS vs Servis)': 'Detail Margin (POS vs Servis)',
    'Total Pemasukan (Kotor)': 'Total Pemasukan (Kotor)',
    'Total Pendapatan Hari Ini': 'Total Pendapatan Hari Ini',
    'Keuntungan Bersih': 'Keuntungan Bersih',
    'Keuntungan Bersih Penjualan': 'Keuntungan Bersih Penjualan',
    'Keuntungan Bersih Servis': 'Keuntungan Bersih Servis',
    'Total Pemasukan': 'Total Pemasukan',
    'Laptop Diservis': 'Laptop Diservis',
    'Unit': 'Unit',

    // Titles / Headers
    'Overview Dashboard': 'Overview Dashboard',
    'POS Kasir Baru': 'POS Kasir Baru',
    'Terima Service': 'Terima Service',
    'Antrean Service Aktif': 'Antrean Service Aktif',
    'Aktivitas Log Terkini': 'Aktivitas Log Terkini',
    'Log aktivitas sistem terbaru': 'Log aktivitas sistem terbaru',
    'Semua': 'Semua',
    'Cari di gudang...': 'Cari di gudang...',
    'Semua Kategori': 'Semua Kategori',
    'Tambah Produk': 'Tambah Produk',
    'Produk Hantu': 'Produk Hantu',
    'Cari nama pelanggan / device...': 'Cari nama pelanggan / device...',
    'Semua Status': 'Semua Status',
    'Antrean': 'Antrean',
    'Dicek': 'Dicek',
    'Menunggu Part': 'Menunggu Part',
    'Selesai': 'Selesai',
    'Batal': 'Batal',
    'Profil Akun': 'Profil Akun',
    'Keluar / Logout': 'Keluar / Logout',
    'Keluar': 'Keluar',
    'Kembalian': 'Kembalian',
    'Total Tagihan': 'Total Tagihan',
    'Uang Diterima (Cash)': 'Uang Diterima (Cash)',
    'Metode Pembayaran': 'Metode Pembayaran',
    'Nama Pembeli': 'Nama Pembeli',
    'Cari nama barang...': 'Cari nama barang...',
    'Tambah Barang Non-Inventory (Custom)': 'Tambah Barang Non-Inventory (Custom)',
    'Harga Jual': 'Harga Jual',
    'Harga Modal (Optional)': 'Harga Modal (Optional)',
    'Jumlah': 'Jumlah',
    'Keranjang Belanja': 'Keranjang Belanja',
    'Proses Transaksi & Cetak Struk': 'Proses Transaksi & Cetak Struk',
    'Daftarkan Akun Staff Baru': 'Daftarkan Akun Staff Baru',
    'Nama Lengkap': 'Nama Lengkap',
    'Alamat Email': 'Alamat Email',
    'Kata Sandi Awal': 'Kata Sandi Awal',
    'Role / Hak Akses': 'Role / Hak Akses',
    'Daftar Staff Terdaftar': 'Daftar Staff Terdaftar',
    'Karyawan': 'Karyawan',
    'Administrator': 'Administrator',
    'Finance Staff': 'Staf Keuangan',
    'Viewer': 'Pengamat',
    'Cabut Hak Akses': 'Cabut Hak Akses',
    'Reset Kata Sandi': 'Reset Kata Sandi',
    'Reset Sandi': 'Reset Sandi',
    'Sandi': 'Sandi',
    'Hapus': 'Hapus',
    'Ubah': 'Ubah',
    'Batal Edit': 'Batal Edit',
    'Simpan Perubahan': 'Simpan Perubahan',
    'Catatan Pemasukan': 'Catatan Pemasukan',
    'Buku Kas Pengeluaran': 'Buku Kas Pengeluaran',
    'Tambah Pengeluaran': 'Tambah Pengeluaran',
    'Today': 'Hari ini',
    'Last 7 days': '7 hari terakhir',
    'Last 30 days': '30 hari terakhir',
    'Month to date': 'Bulan ini',
    'Year to date': 'Tahun ini',
    'All time': 'Semua waktu',
    'Select range': 'Pilih rentang',
    'pick end date': 'pilih tanggal akhir',
    'Quick select': 'Pilih cepat',
    'Cancel': 'Batal',
    'Apply': 'Terapkan',
    'Range:': 'Rentang:',
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');

  useEffect(() => {
    const stored = localStorage.getItem('mitra_lang') as Language;
    if (stored === 'en' || stored === 'id') {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('mitra_lang', lang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
