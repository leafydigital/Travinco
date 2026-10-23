-- =========================================================
-- MIGRATION 038: Customer Enquiry Submission Function (Security Definer)
-- =========================================================

create or replace function public.submit_customer_enquiry(
  p_customer_name text,
  p_phone text,
  p_whatsapp_number text default null,
  p_email text default null,
  p_package_id uuid default null,
  p_destination text default null,
  p_travel_date date default null,
  p_number_of_adults int default 1,
  p_number_of_children int default 0,
  p_number_of_infants int default 0,
  p_budget numeric default null,
  p_message text default null,
  p_priority text default 'medium'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enquiry_num text;
  v_customer_id uuid := null;
begin
  -- Link customer record if matching email exists
  if p_email is not null and p_email <> '' then
    select id into v_customer_id from public.customers where email = p_email limit 1;
  end if;

  insert into public.enquiries (
    customer_id,
    customer_name,
    phone,
    whatsapp_number,
    email,
    package_id,
    destination,
    travel_date,
    number_of_adults,
    number_of_children,
    number_of_infants,
    budget,
    message,
    source,
    status,
    priority,
    is_deleted
  ) values (
    v_customer_id,
    p_customer_name,
    p_phone,
    p_whatsapp_number,
    p_email,
    p_package_id,
    p_destination,
    p_travel_date,
    coalesce(p_number_of_adults, 1),
    coalesce(p_number_of_children, 0),
    coalesce(p_number_of_infants, 0),
    p_budget,
    p_message,
    'website',
    'new',
    p_priority::enquiry_priority,
    false
  )
  returning enquiry_number into v_enquiry_num;

  return v_enquiry_num;
end;
$$;

grant execute on function public.submit_customer_enquiry to anon, authenticated;
