-- =====================================================================
-- Migration 028 (Down): Hotel Rate Master Schema Reversal
-- =====================================================================

DROP VIEW IF EXISTS v_rate_master CASCADE;
DROP TABLE IF EXISTS vehicle_tariffs CASCADE;
DROP TABLE IF EXISTS hotel_followups CASCADE;
DROP TABLE IF EXISTS period_surcharges CASCADE;
DROP TABLE IF EXISTS room_rates CASCADE;
DROP TABLE IF EXISTS rate_period_dates CASCADE;
DROP TABLE IF EXISTS rate_periods CASCADE;
DROP TABLE IF EXISTS room_types CASCADE;
DROP TABLE IF EXISTS hotels CASCADE;
DROP TABLE IF EXISTS rate_master_staging CASCADE;
DROP TABLE IF EXISTS import_batches CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS hotel_categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
