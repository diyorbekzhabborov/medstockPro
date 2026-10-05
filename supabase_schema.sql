-- ====================================================================
-- Схема базы данных MedStock Pro для Supabase (PostgreSQL)
-- Выполните этот SQL в Supabase Dashboard -> SQL Editor
-- URL: https://mljkzfoghenkawgnesoc.supabase.co
-- ====================================================================

-- 1. Таблица товаров (Номенклатура)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Медикаменты',
    unit TEXT DEFAULT 'шт.',
    stock_quantity NUMERIC DEFAULT 0,
    retail_price NUMERIC DEFAULT 0.0,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Таблица операций (Списания, Продажи, Оприходования)
CREATE TABLE IF NOT EXISTS public.operations (
    id TEXT PRIMARY KEY,
    operation_code TEXT NOT NULL,
    type TEXT NOT NULL, -- SALE, CLINIC_WRITE_OFF, RECEIVE, ADJUSTMENT
    payment_type TEXT NOT NULL, -- CASH, BANK_TRANSFER, DEBT, NONE
    bank_name TEXT, -- Dushanbe City (DC), Банк Эсхата, Алиф Банк / Alif Mobi, Амонатбонк
    transaction_reference TEXT,
    total_amount NUMERIC DEFAULT 0.0,
    counterparty_name TEXT,
    counterparty_phone TEXT,
    due_date TEXT,
    status TEXT NOT NULL, -- PAID, DEBT, CLINIC_INTERNAL, RECEIVED
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    client_id TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Позиции операций
CREATE TABLE IF NOT EXISTS public.operation_items (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL
);

-- 4. Реестр дебиторской задолженности (Кто мне должен)
CREATE TABLE IF NOT EXISTS public.debts (
    id TEXT PRIMARY KEY,
    operation_id TEXT,
    debtor_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    initial_amount NUMERIC NOT NULL,
    remaining_amount NUMERIC NOT NULL,
    issue_date TIMESTAMPTZ NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL, -- ACTIVE, PARTIALLY_PAID, PAID, OVERDUE
    items_summary TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Погашения долгов
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем RLS и разрешаем доступ для работы с API
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated/service role products" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated/service role operations" ON public.operations FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated/service role operation_items" ON public.operation_items FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated/service role debts" ON public.debts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated/service role debt_payments" ON public.debt_payments FOR ALL USING (true);
