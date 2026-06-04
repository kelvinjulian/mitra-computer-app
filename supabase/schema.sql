-- PostgreSQL Database Schema for store-management-app

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TYPES Definition
CREATE TYPE user_role AS ENUM ('owner', 'staff');
CREATE TYPE product_category AS ENUM ('komputer', 'laptop', 'printer', 'aksesoris', 'part');
CREATE TYPE payment_method AS ENUM ('cash', 'transfer');
CREATE TYPE service_status AS ENUM ('antrean', 'dicek', 'menunggu_part', 'selesai', 'batal');

-- 2. users (Management Staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. products (Inventory dari Jambi)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category product_category NOT NULL,
    cost_price BIGINT NOT NULL, -- modal
    selling_price BIGINT NOT NULL, -- jual
    stock INT NOT NULL DEFAULT 0,
    min_stock_threshold INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. transactions (Buku Kas POS Kasir)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    staff_id UUID NOT NULL REFERENCES users(id),
    total_amount BIGINT NOT NULL,
    payment_method payment_method NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. transaction_items (Detail Barang Terjual)
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    price_at_sale BIGINT NOT NULL
);

-- 6. services (Pelacakan Reparasi Laptop/Printer)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_whatsapp VARCHAR(50) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    complaint TEXT NOT NULL,
    status service_status NOT NULL DEFAULT 'antrean',
    service_cost BIGINT, -- Nullable if not set yet
    part_cost BIGINT NOT NULL DEFAULT 0,
    technician_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. expenses (Arus Kas Pengeluaran Toko)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security) - Optional but highly recommended for Supabase
-- By default, we will enable it but we can write simple policy definitions or keep it open for internal usage.
-- Since this is an internal store management app, we can either configure policy or just write standard policies.
-- We can enable RLS on all tables and create full access policies for authenticated users.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies allowing all operations for authenticated users (or standard public for simplified local setup if needed)
-- For Supabase, standard internal management typically accesses via service_role or authenticated users.
CREATE POLICY "Allow all access to authenticated users for users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users for products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users for transactions" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users for transaction_items" ON transaction_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users for services" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users for expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
