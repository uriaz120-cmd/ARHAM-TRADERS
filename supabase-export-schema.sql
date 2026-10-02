-- ============================================================================
-- ARHAM TRADERS — EXPORT MANAGEMENT MODULE (SUPABASE CLOUD SQL SCHEMA)
-- Run this complete script in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 0. EXPORT SUPPLIERS (DEDICATED EXPORT MINERAL SUPPLIERS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    city_or_mine TEXT,
    minerals_supplied TEXT,
    bank_details TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_suppliers_name ON public.exp_suppliers(name);

-- ============================================================================
-- 1. EXPORT CUSTOMERS / FOREIGN BUYERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'International',
    port TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    contact TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_customers_country ON public.exp_customers(country);

-- ============================================================================
-- 2. EXPORT PURCHASE BOOKINGS (SUPPLIER MINERAL BOOKING)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_purchase_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_no TEXT NOT NULL UNIQUE,
    receipt_no TEXT,
    booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID REFERENCES public.exp_suppliers(id) ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL,
    mineral TEXT NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(10) NOT NULL DEFAULT 'TON' CHECK (unit IN ('TON', 'KG')),
    rate NUMERIC(15, 2) NOT NULL CHECK (rate >= 0),
    total_amount NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
    payment_type VARCHAR(20) NOT NULL DEFAULT 'credit' CHECK (payment_type IN ('cash', 'credit')),
    warehouse TEXT NOT NULL DEFAULT 'Main Export Yard',
    remarks TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'partial', 'received', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_pb_supplier ON public.exp_purchase_bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_exp_pb_date ON public.exp_purchase_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_exp_pb_mineral ON public.exp_purchase_bookings(mineral);

-- ============================================================================
-- 3. WAREHOUSE MATERIAL RECEIVING (INWARD STUFFING)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_warehouse_receivings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.exp_purchase_bookings(id) ON DELETE CASCADE,
    booking_no TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    mineral TEXT NOT NULL,
    received_quantity NUMERIC(15, 3) NOT NULL CHECK (received_quantity > 0),
    unit VARCHAR(10) NOT NULL DEFAULT 'TON' CHECK (unit IN ('TON', 'KG')),
    receiving_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse TEXT NOT NULL DEFAULT 'Main Export Yard',
    vehicle_no TEXT,
    bilty_no TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_rcv_booking ON public.exp_warehouse_receivings(booking_id);
CREATE INDEX IF NOT EXISTS idx_exp_rcv_mineral ON public.exp_warehouse_receivings(mineral);

-- ============================================================================
-- 4. INWARD MATERIAL EXPENSES (TRANSPORT / LOADING / LABOUR)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_material_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.exp_purchase_bookings(id) ON DELETE SET NULL,
    booking_no TEXT,
    mineral TEXT,
    expense_type VARCHAR(50) NOT NULL, -- Transport, Loading, Unloading, Labour, Other
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'supplier_account')),
    supplier_id TEXT,
    supplier_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_mat_exp_booking ON public.exp_material_expenses(booking_id);

-- ============================================================================
-- 5. PRODUCTION & PROCESSING (RAW MINERAL → READY STOCK + WASTAGE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_no TEXT NOT NULL UNIQUE,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse TEXT NOT NULL DEFAULT 'Main Export Yard',
    mineral TEXT NOT NULL,
    input_quantity NUMERIC(15, 3) NOT NULL CHECK (input_quantity > 0),
    unit VARCHAR(10) NOT NULL DEFAULT 'TON' CHECK (unit IN ('TON', 'KG')),
    machine TEXT DEFAULT 'Plant 1',
    wastage_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0 CHECK (wastage_quantity >= 0),
    ready_quantity NUMERIC(15, 3) NOT NULL CHECK (ready_quantity >= 0),
    bags INTEGER DEFAULT 0,
    bag_weight NUMERIC(10, 2) DEFAULT 50.00,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_prod_mineral ON public.exp_production(mineral);
CREATE INDEX IF NOT EXISTS idx_exp_prod_date ON public.exp_production(production_date);

-- ============================================================================
-- 6. EXPORT SALES BOOKING (CUSTOMER PURCHASE ORDER)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_sales_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_no TEXT NOT NULL UNIQUE,
    booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID REFERENCES public.exp_customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    mineral TEXT NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(10) NOT NULL DEFAULT 'TON' CHECK (unit IN ('TON', 'KG')),
    bags INTEGER DEFAULT 0,
    bag_weight NUMERIC(10, 2) DEFAULT 50.00,
    rate NUMERIC(15, 2) NOT NULL CHECK (rate > 0),
    total_sale_amount NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
    payment_terms VARCHAR(20) NOT NULL DEFAULT 'credit' CHECK (payment_terms IN ('cash', 'credit')),
    destination_country TEXT,
    destination_port TEXT,
    remarks TEXT,
    container_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (container_status IN ('pending', 'in_process', 'shipped', 'delivered')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_sb_customer ON public.exp_sales_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_exp_sb_mineral ON public.exp_sales_bookings(mineral);
CREATE INDEX IF NOT EXISTS idx_exp_sb_date ON public.exp_sales_bookings(booking_date);

-- ============================================================================
-- 7. CONTAINER MANAGEMENT & SHIPMENT LOGISTICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_no TEXT NOT NULL UNIQUE,
    container_size VARCHAR(20) NOT NULL DEFAULT '20ft',
    seal_no TEXT,
    sales_booking_id UUID REFERENCES public.exp_sales_bookings(id) ON DELETE SET NULL,
    booking_no TEXT,
    customer_id UUID REFERENCES public.exp_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    mineral TEXT NOT NULL,
    bags INTEGER NOT NULL CHECK (bags > 0),
    bag_weight NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    total_kg NUMERIC(15, 2) GENERATED ALWAYS AS (bags * bag_weight) STORED,
    total_ton NUMERIC(15, 3) GENERATED ALWAYS AS ((bags * bag_weight) / 1000.0) STORED,
    vehicle_no TEXT,
    stuffing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    port TEXT NOT NULL DEFAULT 'Karachi Port',
    destination_country TEXT,
    shipment_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Ready' CHECK (status IN ('Ready', 'Booked', 'Stuffed', 'Shipped', 'Delivered')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_cnt_customer ON public.exp_containers(customer_id);
CREATE INDEX IF NOT EXISTS idx_exp_cnt_status ON public.exp_containers(status);

-- ============================================================================
-- 8. EXPORT OUTWARD EXPENSES (CUSTOMS / PORT / FREIGHT / CLEARING)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_shipment_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_booking_id UUID REFERENCES public.exp_sales_bookings(id) ON DELETE SET NULL,
    booking_no TEXT,
    container_id UUID REFERENCES public.exp_containers(id) ON DELETE SET NULL,
    container_no TEXT,
    expense_type VARCHAR(50) NOT NULL, -- Transport, Customs, Port Charges, Freight, Clearing, Docs, etc.
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'customer_account')),
    customer_id UUID REFERENCES public.exp_customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_ship_exp_sb ON public.exp_shipment_expenses(sales_booking_id);
CREATE INDEX IF NOT EXISTS idx_exp_ship_exp_cnt ON public.exp_shipment_expenses(container_id);

-- ============================================================================
-- 9. FOREIGN CUSTOMER PAYMENTS & CONVERSION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exp_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_no TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.exp_customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    sales_booking_id UUID REFERENCES public.exp_sales_bookings(id) ON DELETE SET NULL,
    booking_no TEXT,
    container_id UUID REFERENCES public.exp_containers(id) ON DELETE SET NULL,
    container_no TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    foreign_amount NUMERIC(15, 2) NOT NULL CHECK (foreign_amount > 0),
    exchange_rate NUMERIC(15, 4) NOT NULL CHECK (exchange_rate > 0),
    pkr_amount NUMERIC(15, 2) GENERATED ALWAYS AS (foreign_amount * exchange_rate) STORED,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_or_cash TEXT NOT NULL DEFAULT 'Meezan Bank Ltd',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_pay_customer ON public.exp_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_exp_pay_date ON public.exp_payments(payment_date);

-- ============================================================================
-- 10. POSTGRES TRIGGERS (AUTOMATIC UPDATES & AUDIT TRAILS)
-- ============================================================================

-- Function to update updated_at on all export tables
CREATE OR REPLACE FUNCTION public.handle_exp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'exp_suppliers', 'exp_customers', 'exp_purchase_bookings', 'exp_warehouse_receivings',
            'exp_material_expenses', 'exp_production', 'exp_sales_bookings',
            'exp_containers', 'exp_shipment_expenses', 'exp_payments'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
            CREATE TRIGGER trg_%I_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_exp_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- Trigger: Update Purchase Booking status when receiving is added/deleted
CREATE OR REPLACE FUNCTION public.sync_exp_purchase_receiving_status()
RETURNS TRIGGER AS $$
DECLARE
    target_booking_id UUID;
    total_received NUMERIC;
    target_qty NUMERIC;
BEGIN
    target_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
    
    SELECT COALESCE(SUM(received_quantity), 0) INTO total_received
    FROM public.exp_warehouse_receivings
    WHERE booking_id = target_booking_id;

    SELECT quantity INTO target_qty
    FROM public.exp_purchase_bookings
    WHERE id = target_booking_id;

    IF total_received >= target_qty THEN
        UPDATE public.exp_purchase_bookings SET status = 'received' WHERE id = target_booking_id;
    ELSIF total_received > 0 THEN
        UPDATE public.exp_purchase_bookings SET status = 'partial' WHERE id = target_booking_id;
    ELSE
        UPDATE public.exp_purchase_bookings SET status = 'booked' WHERE id = target_booking_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_exp_receiving ON public.exp_warehouse_receivings;
CREATE TRIGGER trg_sync_exp_receiving
AFTER INSERT OR UPDATE OR DELETE ON public.exp_warehouse_receivings
FOR EACH ROW
EXECUTE FUNCTION public.sync_exp_purchase_receiving_status();

-- ============================================================================
-- 11. CLOUD ANALYTICAL VIEWS (PROFIT & LEDGER ENGINES)
-- ============================================================================

-- VIEW: Real-time Raw Warehouse Stock Balance (Cloud Calculated)
CREATE OR REPLACE VIEW public.vw_exp_raw_stock_balance AS
SELECT 
    r.mineral,
    r.warehouse,
    COALESCE(SUM(CASE WHEN r.unit = 'TON' THEN r.received_quantity ELSE r.received_quantity / 1000.0 END), 0) -
    COALESCE(p.used_ton, 0) AS available_raw_ton
FROM public.exp_warehouse_receivings r
LEFT JOIN (
    SELECT mineral, warehouse, SUM(CASE WHEN unit = 'TON' THEN input_quantity ELSE input_quantity / 1000.0 END) AS used_ton
    FROM public.exp_production
    GROUP BY mineral, warehouse
) p ON r.mineral = p.mineral AND r.warehouse = p.warehouse
GROUP BY r.mineral, r.warehouse, p.used_ton;

-- VIEW: Real-time Ready Stock & Reservation Summary
CREATE OR REPLACE VIEW public.vw_exp_ready_stock_balance AS
SELECT 
    p.mineral,
    COALESCE(SUM(CASE WHEN p.unit = 'TON' THEN p.ready_quantity ELSE p.ready_quantity / 1000.0 END), 0) AS total_ready_ton,
    COALESCE(s.booked_ton, 0) AS reserved_ton,
    COALESCE(SUM(CASE WHEN p.unit = 'TON' THEN p.ready_quantity ELSE p.ready_quantity / 1000.0 END), 0) - COALESCE(s.booked_ton, 0) AS available_for_export_ton,
    COALESCE(SUM(p.bags), 0) AS total_bags_produced
FROM public.exp_production p
LEFT JOIN (
    SELECT mineral, SUM(CASE WHEN unit = 'TON' THEN quantity ELSE quantity / 1000.0 END) AS booked_ton
    FROM public.exp_sales_bookings
    GROUP BY mineral
) s ON p.mineral = s.mineral
GROUP BY p.mineral, s.booked_ton;

-- VIEW: Customer Live Statements & Outstanding Balances
CREATE OR REPLACE VIEW public.vw_exp_customer_balances AS
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.country,
    c.currency,
    COALESCE(s.total_sales, 0) AS total_sales_pkr,
    COALESCE(e.billed_expenses, 0) AS billed_expenses_pkr,
    COALESCE(p.total_paid, 0) AS total_paid_pkr,
    (COALESCE(s.total_sales, 0) + COALESCE(e.billed_expenses, 0)) - COALESCE(p.total_paid, 0) AS outstanding_balance_pkr
FROM public.exp_customers c
LEFT JOIN (
    SELECT customer_id, SUM(total_sale_amount) AS total_sales
    FROM public.exp_sales_bookings
    GROUP BY customer_id
) s ON c.id = s.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(amount) AS billed_expenses
    FROM public.exp_shipment_expenses
    WHERE payment_method = 'customer_account'
    GROUP BY customer_id
) e ON c.id = e.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(pkr_amount) AS total_paid
    FROM public.exp_payments
    GROUP BY customer_id
) p ON c.id = p.customer_id;

-- VIEW: Multi-Dimensional Net Profit Engine (Cloud-Based)
CREATE OR REPLACE VIEW public.vw_exp_consolidated_profit AS
SELECT 
    (SELECT COALESCE(SUM(total_sale_amount), 0) FROM public.exp_sales_bookings) AS total_sales_revenue,
    (SELECT COALESCE(SUM(total_amount), 0) FROM public.exp_purchase_bookings) AS total_purchase_cost,
    (SELECT COALESCE(SUM(amount), 0) FROM public.exp_material_expenses) AS total_material_expenses,
    (SELECT COALESCE(SUM(amount), 0) FROM public.exp_shipment_expenses) AS total_shipment_expenses,
    (SELECT COALESCE(SUM(total_amount), 0) FROM public.exp_purchase_bookings) + 
    (SELECT COALESCE(SUM(amount), 0) FROM public.exp_material_expenses) + 
    (SELECT COALESCE(SUM(amount), 0) FROM public.exp_shipment_expenses) AS total_consolidated_costs,
    (SELECT COALESCE(SUM(total_sale_amount), 0) FROM public.exp_sales_bookings) - (
        (SELECT COALESCE(SUM(total_amount), 0) FROM public.exp_purchase_bookings) + 
        (SELECT COALESCE(SUM(amount), 0) FROM public.exp_material_expenses) + 
        (SELECT COALESCE(SUM(amount), 0) FROM public.exp_shipment_expenses)
    ) AS net_export_profit;

-- VIEW: Order-Wise Net Profit Breakdown
CREATE OR REPLACE VIEW public.vw_exp_order_wise_profit AS
SELECT 
    sb.id AS sales_booking_id,
    sb.booking_no,
    sb.customer_name,
    sb.mineral,
    sb.quantity,
    sb.unit,
    sb.total_sale_amount AS sales_revenue,
    COALESCE(ship_exp.total_exp, 0) AS shipment_expenses,
    sb.total_sale_amount - COALESCE(ship_exp.total_exp, 0) AS gross_order_margin
FROM public.exp_sales_bookings sb
LEFT JOIN (
    SELECT sales_booking_id, SUM(amount) AS total_exp
    FROM public.exp_shipment_expenses
    GROUP BY sales_booking_id
) ship_exp ON sb.id = ship_exp.sales_booking_id;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.exp_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_purchase_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_warehouse_receivings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_material_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_sales_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_shipment_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_payments ENABLE ROW LEVEL SECURITY;

-- Allow full access to authorized/anon users matching the existing policy pattern
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'exp_suppliers', 'exp_customers', 'exp_purchase_bookings', 'exp_warehouse_receivings',
            'exp_material_expenses', 'exp_production', 'exp_sales_bookings',
            'exp_containers', 'exp_shipment_expenses', 'exp_payments'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS %I_anon_all ON public.%I;
            CREATE POLICY %I_anon_all ON public.%I
            FOR ALL TO anon USING (true) WITH CHECK (true);
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ============================================================================
-- SUCCESS CONFIRMATION
-- ============================================================================
SELECT 'Arham Traders Export Cloud Database Schema created successfully!' AS status;
