-- Supabase Row Level Security (RLS) Policies for Mitra Komputer POS & Store Management
-- Tables: products, transactions, transaction_items, services, expenses, users, audit_logs

-- 1. Ensure 'viewer' role exists in user_role ENUM type if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
  END IF;
END $$;

-- 2. Helper function to safely retrieve current user's role from public.users table.
-- SECURITY DEFINER allows bypassing RLS on public.users during policy evaluation.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

-- 3. Enable RLS on all 7 target tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Clean up existing policies to avoid conflicts
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;

DROP POLICY IF EXISTS "transaction_items_select_policy" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_insert_policy" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_update_policy" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_delete_policy" ON public.transaction_items;

DROP POLICY IF EXISTS "services_select_policy" ON public.services;
DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
DROP POLICY IF EXISTS "services_update_policy" ON public.services;
DROP POLICY IF EXISTS "services_delete_policy" ON public.services;

DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

DROP POLICY IF EXISTS "users_owner_all_policy" ON public.users;
DROP POLICY IF EXISTS "audit_logs_owner_all_policy" ON public.audit_logs;

-- Also drop initial schema default policies if existing
DROP POLICY IF EXISTS "Allow all access to authenticated users for users" ON public.users;
DROP POLICY IF EXISTS "Allow all access to authenticated users for products" ON public.products;
DROP POLICY IF EXISTS "Allow all access to authenticated users for transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all access to authenticated users for transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Allow all access to authenticated users for services" ON public.services;
DROP POLICY IF EXISTS "Allow all access to authenticated users for expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow owners to read audit logs" ON public.audit_logs;

-- ============================================================================
-- 1. OPERATIONAL TABLES (products, transactions, transaction_items, services)
-- Rules: owner, staff, and viewer can SELECT. Only owner and staff can INSERT, UPDATE, DELETE.
-- ============================================================================

-- products
CREATE POLICY "products_select_policy" ON public.products
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff', 'viewer'));

CREATE POLICY "products_insert_policy" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "products_update_policy" ON public.products
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'))
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "products_delete_policy" ON public.products
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'));

-- transactions
CREATE POLICY "transactions_select_policy" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff', 'viewer'));

CREATE POLICY "transactions_insert_policy" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "transactions_update_policy" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'))
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'));

-- transaction_items
CREATE POLICY "transaction_items_select_policy" ON public.transaction_items
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff', 'viewer'));

CREATE POLICY "transaction_items_insert_policy" ON public.transaction_items
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "transaction_items_update_policy" ON public.transaction_items
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'))
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "transaction_items_delete_policy" ON public.transaction_items
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'));

-- services
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff', 'viewer'));

CREATE POLICY "services_insert_policy" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "services_update_policy" ON public.services
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'))
  WITH CHECK (public.get_user_role() IN ('owner', 'staff'));

CREATE POLICY "services_delete_policy" ON public.services
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff'));

-- ============================================================================
-- 2. FINANCE TABLE (expenses)
-- Rules: owner, staff, and viewer can SELECT. Only owner can INSERT, UPDATE, DELETE.
-- ============================================================================

CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('owner', 'staff', 'viewer'));

CREATE POLICY "expenses_insert_policy" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'owner');

CREATE POLICY "expenses_update_policy" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'owner')
  WITH CHECK (public.get_user_role() = 'owner');

CREATE POLICY "expenses_delete_policy" ON public.expenses
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'owner');

-- ============================================================================
-- 3. SENSITIVE TABLES (users, audit_logs)
-- Rules: Only owner has full access (SELECT, INSERT, UPDATE, DELETE). staff and viewer have NO access.
-- ============================================================================

-- users
CREATE POLICY "users_owner_all_policy" ON public.users
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'owner')
  WITH CHECK (public.get_user_role() = 'owner');

-- audit_logs
CREATE POLICY "audit_logs_owner_all_policy" ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'owner')
  WITH CHECK (public.get_user_role() = 'owner');
