-- =============================================
-- ARHAM TRADERS — SUPABASE DATABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =============================================

-- Single generic store table (mirrors localStorage structure)
-- store_key = collection name  (e.g. 'suppliers', 'bookings')
-- item_id   = item's unique id
-- item_data = full item as JSON

CREATE TABLE IF NOT EXISTS public.at_store (
  store_key   TEXT          NOT NULL,
  item_id     TEXT          NOT NULL,
  item_data   JSONB         NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_key, item_id)
);

-- Index for fast lookups by store_key
CREATE INDEX IF NOT EXISTS idx_at_store_key
  ON public.at_store (store_key);

-- Enable Row Level Security
ALTER TABLE public.at_store ENABLE ROW LEVEL SECURITY;

-- Allow full access with the public/anon key
CREATE POLICY "anon_all"
  ON public.at_store
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at timestamp on row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_updated_at
  BEFORE UPDATE ON public.at_store
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
