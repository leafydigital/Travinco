-- =========================================================
-- MIGRATION 048: Add 'booked' to enquiry_status enum
-- =========================================================

alter type public.enquiry_status add value if not exists 'booked';
