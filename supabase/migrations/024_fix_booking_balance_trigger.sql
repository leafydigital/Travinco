-- Fixes a genuine bug in trg_bookings_balance (migration 004): it was
-- a BEFORE INSERT/UPDATE trigger reading new.total_amount, but
-- total_amount is a GENERATED column, and Postgres only computes
-- generated columns AFTER before-triggers run. So new.total_amount was
-- always null at the moment this trigger read it, which made
-- new.balance_amount null too — violating balance_amount's not-null
-- constraint on every insert into bookings.
--
-- Fix: compute the balance directly from the same source columns the
-- generated total_amount column itself uses, instead of reading
-- total_amount (which isn't available yet at this point).
create or replace function public.recalc_booking_balance()
returns trigger
language plpgsql
as $$
declare
  computed_total numeric(10, 2);
begin
  computed_total := new.base_amount - new.discount_amount + new.tax_amount;
  new.balance_amount := computed_total - new.amount_received;

  if new.amount_received <= 0 then
    new.payment_status := 'pending';
  elsif new.amount_received >= computed_total then
    new.payment_status := 'paid';
  else
    new.payment_status := 'partial';
  end if;

  return new;
end;
$$;
