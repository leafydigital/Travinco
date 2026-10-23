-- =========================================================
-- MIGRATION 050: Add Markup Tracking to Invoices
-- =========================================================

-- 1. Ensure markup columns exist on invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_amount NUMERIC(12,2) DEFAULT 0;

-- 2. Index for financial queries
CREATE INDEX IF NOT EXISTS idx_invoices_status_paid
  ON public.invoices (status) WHERE status = 'paid';
