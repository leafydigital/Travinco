-- =========================================================
-- MIGRATION 052: Customer RLS Policies for Quotations & Invoices
--
-- Enables authenticated customer accounts to securely read
-- their own bespoke quotations that have been converted to invoice
-- (status = 'invoiced') and their associated invoices.
-- =========================================================

-- 1. Helper function to safely extract customer email from JWT or customer_accounts
CREATE OR REPLACE FUNCTION public.customer_auth_email()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email')::text,
    (SELECT email::text FROM public.customer_accounts WHERE id = auth.uid())
  );
$$;

-- 2. Quotations: Allow customers to view quotations converted to invoice matching their email or customer ID
DROP POLICY IF EXISTS "customers can view their own invoiced quotations" ON public.quotations;
CREATE POLICY "customers can view their own invoiced quotations" ON public.quotations
  FOR SELECT USING (
    status = 'invoiced'
    AND (is_deleted = false OR is_deleted IS NULL)
    AND (
      guest_email ILIKE public.customer_auth_email()
      OR customer_id IN (
        SELECT id FROM public.customers WHERE email ILIKE public.customer_auth_email()
      )
    )
  );

-- 3. Invoices: Allow customers to view non-cancelled invoices matching their email or customer ID
DROP POLICY IF EXISTS "customers can view their own invoices" ON public.invoices;
CREATE POLICY "customers can view their own invoices" ON public.invoices
  FOR SELECT USING (
    status != 'cancelled'
    AND (is_deleted = false OR is_deleted IS NULL)
    AND (
      bill_to_email ILIKE public.customer_auth_email()
      OR customer_id IN (
        SELECT id FROM public.customers WHERE email ILIKE public.customer_auth_email()
      )
      OR quotation_id IN (
        SELECT id FROM public.quotations
        WHERE guest_email ILIKE public.customer_auth_email()
      )
    )
  );

-- 4. Tour Settings: Allow authenticated customers to view public company details (address, bank, logos)
DROP POLICY IF EXISTS "authenticated read tour_settings" ON public.tour_settings;
CREATE POLICY "authenticated read tour_settings" ON public.tour_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Invoice Payments: Allow customers to view payments for their own invoices
DROP POLICY IF EXISTS "customers read invoice_payments" ON public.invoice_payments;
CREATE POLICY "customers read invoice_payments" ON public.invoice_payments
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE bill_to_email ILIKE public.customer_auth_email()
    )
  );

GRANT EXECUTE ON FUNCTION public.customer_auth_email() TO authenticated;
