-- =========================================================================
-- MIGRATION 051: Location Activities Schema, Preferred Types & Excel Import Support
-- Ensures locations and location_activities tables exist with preferred_types
-- and soft-delete capabilities.
-- =========================================================================

-- 1. Ensure locations table exists
CREATE TABLE IF NOT EXISTS public.locations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  state TEXT DEFAULT 'Kerala',
  parent_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL,
  description TEXT,
  sort_order INT DEFAULT 100,
  is_houseboat BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_is_deleted ON public.locations (is_deleted);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations (name);

-- 2. Ensure location_activities table exists
CREATE TABLE IF NOT EXISTS public.location_activities (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'sightseeing',
  preferred_types TEXT,
  kind TEXT DEFAULT 'sightseeing',
  description TEXT,
  duration TEXT,
  timings TEXT,
  closed_on TEXT,
  entry_fee_adult NUMERIC(10,2),
  entry_fee_child NUMERIC(10,2),
  approx_cost_text TEXT,
  sort_order INT DEFAULT 100,
  is_optional_paid BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure category, preferred_types, and is_deleted exist on pre-existing tables
ALTER TABLE public.location_activities 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'sightseeing';

ALTER TABLE public.location_activities 
  ADD COLUMN IF NOT EXISTS preferred_types TEXT;

ALTER TABLE public.location_activities 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_location_activities_loc_id ON public.location_activities (location_id);
CREATE INDEX IF NOT EXISTS idx_location_activities_is_deleted ON public.location_activities (is_deleted);
CREATE INDEX IF NOT EXISTS idx_location_activities_name ON public.location_activities (name);

-- 3. Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_activities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Locations policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow select locations for authenticated') THEN
    CREATE POLICY "Allow select locations for authenticated" ON public.locations FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow insert locations for authenticated') THEN
    CREATE POLICY "Allow insert locations for authenticated" ON public.locations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow update locations for authenticated') THEN
    CREATE POLICY "Allow update locations for authenticated" ON public.locations FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow delete locations for authenticated') THEN
    CREATE POLICY "Allow delete locations for authenticated" ON public.locations FOR DELETE TO authenticated USING (true);
  END IF;

  -- Location activities policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_activities' AND policyname = 'Allow select location_activities for authenticated') THEN
    CREATE POLICY "Allow select location_activities for authenticated" ON public.location_activities FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_activities' AND policyname = 'Allow insert location_activities for authenticated') THEN
    CREATE POLICY "Allow insert location_activities for authenticated" ON public.location_activities FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_activities' AND policyname = 'Allow update location_activities for authenticated') THEN
    CREATE POLICY "Allow update location_activities for authenticated" ON public.location_activities FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'location_activities' AND policyname = 'Allow delete location_activities for authenticated') THEN
    CREATE POLICY "Allow delete location_activities for authenticated" ON public.location_activities FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 4. Soft Delete RPC for location activities
CREATE OR REPLACE FUNCTION public.soft_delete_location_activity(act_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.location_activities
  SET is_deleted = TRUE,
      updated_at = NOW()
  WHERE id = act_id;
  RETURN TRUE;
END;
$$;

-- 5. Optional cleanup for old dummy seed data:
-- To purge previous seed data from location_activities, execute:
-- TRUNCATE TABLE public.location_activities CASCADE;
