-- =====================================================================
-- Migration 029: Tour operations
--   Hotels (contact details), Transportation, Pickup & Drop points,
--   Locations & Activities (sightseeing, distances, day plans),
--   Quotations (replaces the stand-alone Itinerary Builder) and
--   Invoices (created from a quotation with "Convert to Invoice").
--
-- Requires: 001-028 (profiles, customers, income, payment_method enum,
-- public.is_staff()/is_admin()/is_finance_staff(), touch_updated_at(),
-- and the Hotel Rate Master tables from 028).
-- Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE / guards.
-- =====================================================================

-- ---------- 1. Hotels: contact & operational details ------------------
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS contact_person     VARCHAR(120),
    ADD COLUMN IF NOT EXISTS phone              VARCHAR(30),
    ADD COLUMN IF NOT EXISTS alt_phone          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS whatsapp           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS email              VARCHAR(150),
    ADD COLUMN IF NOT EXISTS reservation_email  VARCHAR(150),
    ADD COLUMN IF NOT EXISTS website            VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address            TEXT,
    ADD COLUMN IF NOT EXISTS google_maps_url    TEXT,
    ADD COLUMN IF NOT EXISTS check_in_time      VARCHAR(10),
    ADD COLUMN IF NOT EXISTS check_out_time     VARCHAR(10),
    ADD COLUMN IF NOT EXISTS gstin              VARCHAR(20),
    ADD COLUMN IF NOT EXISTS amenities          TEXT,
    ADD COLUMN IF NOT EXISTS payment_terms      TEXT,
    ADD COLUMN IF NOT EXISTS bank_details       TEXT,
    ADD COLUMN IF NOT EXISTS notes              TEXT,
    ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------- 2. Locations: details used by the quotation engine --------
-- parent_id groups sub-locations under a main town (Fort Kochi and Cochin
-- Airport under Cochin; Alleppey Houseboat under Alleppey). Hotels in a
-- non-houseboat child are offered when a stay is in the parent town;
-- day plans and distances fall back to the parent.
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS state         VARCHAR(60) DEFAULT 'Kerala',
    ADD COLUMN IF NOT EXISTS display_name  VARCHAR(80),
    ADD COLUMN IF NOT EXISTS description   TEXT,
    ADD COLUMN IF NOT EXISTS parent_id     SMALLINT REFERENCES locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_houseboat  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS sort_order    SMALLINT NOT NULL DEFAULT 100;

-- ---------- 3. Sightseeing & activities --------------------------------
CREATE TABLE IF NOT EXISTS location_activities (
    id                BIGSERIAL PRIMARY KEY,
    location_id       SMALLINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name              VARCHAR(150) NOT NULL,
    kind              VARCHAR(20)  NOT NULL DEFAULT 'sightseeing'
                      CHECK (kind IN ('sightseeing','activity','experience','temple','shopping')),
    description       TEXT,
    duration          VARCHAR(60),
    timings           VARCHAR(120),
    closed_on         VARCHAR(120),
    entry_fee_adult   NUMERIC(10,2),
    entry_fee_child   NUMERIC(10,2),
    is_optional_paid  BOOLEAN NOT NULL DEFAULT FALSE,   -- listed under "Optional activities"
    approx_cost_text  VARCHAR(120),                      -- e.g. "Rs 3,800 (for 7 pax)"
    sort_order        SMALLINT NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (location_id, name)
);
CREATE INDEX IF NOT EXISTS ix_activities_location ON location_activities(location_id);

-- ---------- 4. Distances between locations -----------------------------
-- Stored once per pair (from_id < to_id); the app looks both ways.
CREATE TABLE IF NOT EXISTS location_distances (
    id                BIGSERIAL PRIMARY KEY,
    from_location_id  SMALLINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    to_location_id    SMALLINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    distance_km       NUMERIC(7,1) NOT NULL CHECK (distance_km >= 0),
    duration_text     VARCHAR(40),
    notes             TEXT,
    CHECK (from_location_id < to_location_id),
    UNIQUE (from_location_id, to_location_id)
);

-- ---------- 5. Pickup & drop points ------------------------------------
CREATE TABLE IF NOT EXISTS pickup_drop_points (
    id                SERIAL PRIMARY KEY,
    code              VARCHAR(20) UNIQUE,
    name              VARCHAR(150) NOT NULL,
    point_type        VARCHAR(20) NOT NULL DEFAULT 'airport'
                      CHECK (point_type IN ('airport','railway','bus','hotel','port','other')),
    location_id       SMALLINT REFERENCES locations(id) ON DELETE SET NULL,
    km_from_location  NUMERIC(6,1) NOT NULL DEFAULT 0,
    address           TEXT,
    google_maps_url   TEXT,
    contact_phone     VARCHAR(30),
    use_for_pickup    BOOLEAN NOT NULL DEFAULT TRUE,
    use_for_drop      BOOLEAN NOT NULL DEFAULT TRUE,
    notes             TEXT,
    sort_order        SMALLINT NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 6. Transportation (vendor vehicles) -------------------------
CREATE TABLE IF NOT EXISTS transport_vehicles (
    id                  SERIAL PRIMARY KEY,
    vehicle_type        VARCHAR(80)  NOT NULL,            -- Car type, e.g. Innova Crysta
    company_name        VARCHAR(150) NOT NULL,
    contact_person      VARCHAR(120),
    contact_number      VARCHAR(30)  NOT NULL,
    alt_contact_number  VARCHAR(30),
    seats               SMALLINT,
    is_ac               BOOLEAN NOT NULL DEFAULT TRUE,
    rate_basis          VARCHAR(10) NOT NULL DEFAULT 'per_day'
                        CHECK (rate_basis IN ('per_day','per_trip')),
    amount              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),       -- amount given
    free_km             INT NOT NULL DEFAULT 0 CHECK (free_km >= 0),                 -- per day, or per trip
    extra_per_km        NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (extra_per_km >= 0),
    driver_bata_per_day NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (driver_bata_per_day >= 0),
    notes               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_name, vehicle_type)
);

-- ---------- 7. Day plans (itinerary building blocks) --------------------
-- plan_type: arrival   = first day when the guest lands in the stay town
--            transfer  = travel day from_location -> to_location
--            stay      = extra day in to_location
--            departure = last day from_location -> drop town (to_location)
-- items: [{"kind":"text","text":"..."} | {"kind":"sight","name":"...","desc":"optional override"}]
CREATE TABLE IF NOT EXISTS day_plans (
    id                BIGSERIAL PRIMARY KEY,
    plan_type         VARCHAR(10) NOT NULL CHECK (plan_type IN ('arrival','transfer','stay','departure')),
    from_location_id  SMALLINT REFERENCES locations(id) ON DELETE CASCADE,
    to_location_id    SMALLINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    label             VARCHAR(120) NOT NULL,      -- short variant name shown in the picker
    title             VARCHAR(200) NOT NULL,      -- day heading on the quotation
    first_day_title   VARCHAR(200),               -- heading when this transfer is also Day 1
    items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    tip               TEXT,
    no_opener         BOOLEAN NOT NULL DEFAULT FALSE,
    source            VARCHAR(200),
    sort_order        SMALLINT NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (plan_type IN ('arrival','stay') OR from_location_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_day_plans_route ON day_plans(plan_type, from_location_id, to_location_id);
-- One variant name per route (NULL from_location counts as equal).
CREATE UNIQUE INDEX IF NOT EXISTS ux_day_plans_variant
    ON day_plans(plan_type, from_location_id, to_location_id, label) NULLS NOT DISTINCT;

-- ---------- 8. Quotation templates (ready packages) ---------------------
CREATE TABLE IF NOT EXISTS quotation_templates (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(200) NOT NULL UNIQUE,
    trip_type          VARCHAR(40) NOT NULL DEFAULT 'Tour',
    pickup_point_id    INT REFERENCES pickup_drop_points(id) ON DELETE SET NULL,
    drop_point_id      INT REFERENCES pickup_drop_points(id) ON DELETE SET NULL,
    category_id        SMALLINT REFERENCES hotel_categories(id) ON DELETE SET NULL,
    vehicle_type       VARCHAR(80),
    adults             SMALLINT NOT NULL DEFAULT 2,
    stays              JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{"location_id":1,"nights":2}]
    plan_picks         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [day_plan_id, ...] preferred variants
    extra_inclusions   TEXT,
    sort_order         SMALLINT NOT NULL DEFAULT 100,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 9. Quotation / invoice settings (single row) ----------------
-- Kept out of website_settings because that table is publicly readable.
CREATE TABLE IF NOT EXISTS tour_settings (
    id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    markup_pct       NUMERIC(5,2) NOT NULL DEFAULT 15,
    gst_pct          NUMERIC(5,2) NOT NULL DEFAULT 5,
    round_to         INT NOT NULL DEFAULT 100,
    quote_valid_days INT NOT NULL DEFAULT 7,
    sightseeing_km_per_day INT NOT NULL DEFAULT 40,   -- local running added to each stay day
    company_name     VARCHAR(150) DEFAULT 'Travinco Travel Solutions',
    company_address  TEXT,
    company_phone    VARCHAR(60) DEFAULT '+91-6235892269',
    company_email    VARCHAR(150) DEFAULT 'info@travinco.com',
    company_website  VARCHAR(150),
    company_gstin    VARCHAR(20),
    company_state    VARCHAR(60) DEFAULT 'Kerala',
    sac_code         VARCHAR(10) DEFAULT '998555',
    bank_details     TEXT,
    invoice_due_days INT NOT NULL DEFAULT 0,
    invoice_terms    TEXT,
    exclusions       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["..."]
    cancellation     JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [["timeline","charge"]]
    important_notes  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["..."]
    updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tour_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- 10. Quotations ----------------------------------------------
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1;

CREATE TABLE IF NOT EXISTS quotations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number       VARCHAR(30) NOT NULL UNIQUE
                       DEFAULT ('QT-' || to_char(now(), 'YYYY') || '-' ||
                                lpad(nextval('quotation_number_seq')::text, 5, '0')),
    status             VARCHAR(12) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','accepted','rejected','expired','invoiced')),
    customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
    enquiry_id         UUID REFERENCES enquiries(id) ON DELETE SET NULL,
    guest_name         VARCHAR(150) NOT NULL,
    guest_phone        VARCHAR(30),
    guest_email        VARCHAR(150),
    title              VARCHAR(200),
    trip_type          VARCHAR(40) NOT NULL DEFAULT 'Tour',
    start_date         DATE NOT NULL,
    end_date           DATE NOT NULL,
    nights             SMALLINT NOT NULL,
    adults             SMALLINT NOT NULL DEFAULT 2 CHECK (adults >= 1),
    children_with_bed  SMALLINT NOT NULL DEFAULT 0 CHECK (children_with_bed >= 0),
    children_no_bed    SMALLINT NOT NULL DEFAULT 0 CHECK (children_no_bed >= 0),
    child_ages         VARCHAR(60),
    rooms              SMALLINT NOT NULL DEFAULT 1 CHECK (rooms >= 1),
    meal_plan          VARCHAR(3) NOT NULL DEFAULT 'CP' CHECK (meal_plan IN ('CP','MAP')),
    category_id        SMALLINT REFERENCES hotel_categories(id) ON DELETE SET NULL,
    category2_id       SMALLINT REFERENCES hotel_categories(id) ON DELETE SET NULL,
    pickup_point_id    INT REFERENCES pickup_drop_points(id) ON DELETE SET NULL,
    drop_point_id      INT REFERENCES pickup_drop_points(id) ON DELETE SET NULL,
    transport_vehicle_id INT REFERENCES transport_vehicles(id) ON DELETE SET NULL,
    template_id        INT REFERENCES quotation_templates(id) ON DELETE SET NULL,
    inputs             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- builder state (stays, day edits, vehicle, extras)
    snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- rendered document (hotels, days, totals) at save time
    hotel_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
    vehicle_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
    markup_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,
    markup_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst_pct            NUMERIC(5,2)  NOT NULL DEFAULT 0,
    gst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount2      NUMERIC(12,2),                       -- Option 2 (second category), if quoted
    valid_until        DATE,
    notes              TEXT,                                 -- internal notes
    sent_at            TIMESTAMPTZ,
    created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS ix_quotations_status ON quotations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS ix_quotations_start ON quotations(start_date);

-- ---------- 11. Invoices --------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number   VARCHAR(30) NOT NULL UNIQUE
                     DEFAULT ('INV-' || to_char(now(), 'YYYY') || '-' ||
                              lpad(nextval('invoice_number_seq')::text, 5, '0')),
    quotation_id     UUID REFERENCES quotations(id) ON DELETE SET NULL,
    quote_option     SMALLINT NOT NULL DEFAULT 1 CHECK (quote_option IN (1,2)),
    customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
    bill_to_name     VARCHAR(150) NOT NULL,
    bill_to_phone    VARCHAR(30),
    bill_to_email    VARCHAR(150),
    bill_to_address  TEXT,
    bill_to_gstin    VARCHAR(20),
    place_of_supply  VARCHAR(60) DEFAULT 'Kerala',
    invoice_date     DATE NOT NULL DEFAULT current_date,
    due_date         DATE,
    travel_start     DATE,
    travel_end       DATE,
    items            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"description","sac","qty","rate","amount"}]
    subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    taxable_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst_pct          NUMERIC(5,2)  NOT NULL DEFAULT 5,
    tax_mode         VARCHAR(10) NOT NULL DEFAULT 'cgst_sgst' CHECK (tax_mode IN ('cgst_sgst','igst')),
    cgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    sgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    igst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    round_off        NUMERIC(8,2)  NOT NULL DEFAULT 0,
    total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_amount   NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    status           VARCHAR(15) NOT NULL DEFAULT 'issued'
                     CHECK (status IN ('draft','issued','partially_paid','paid','cancelled')),
    notes            TEXT,
    terms            TEXT,
    created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live invoice per quotation (a cancelled one can be re-issued).
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_quotation_live
    ON invoices(quotation_id) WHERE status <> 'cancelled' AND quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices(status, invoice_date DESC);

CREATE TABLE IF NOT EXISTS invoice_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    paid_on         DATE NOT NULL DEFAULT current_date,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method          payment_method NOT NULL DEFAULT 'bank_transfer',
    reference       VARCHAR(100),
    notes           TEXT,
    income_id       UUID REFERENCES income(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_invoice_payments_invoice ON invoice_payments(invoice_id);

ALTER TABLE income ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Keep invoices.amount_paid / status in step with invoice_payments.
CREATE OR REPLACE FUNCTION public.sync_invoice_amount_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_invoice UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
    v_paid NUMERIC(12,2);
BEGIN
    v_paid := (SELECT COALESCE(SUM(amount), 0) FROM invoice_payments WHERE invoice_id = v_invoice);
    UPDATE invoices
       SET amount_paid = v_paid,
           status = CASE
                      WHEN status IN ('cancelled','draft') THEN status
                      WHEN v_paid <= 0 THEN 'issued'
                      WHEN v_paid >= total_amount THEN 'paid'
                      ELSE 'partially_paid'
                    END,
           updated_at = now()
     WHERE id = v_invoice;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_payments_sync ON invoice_payments;
CREATE TRIGGER trg_invoice_payments_sync
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_amount_paid();

-- ---------- 12. updated_at triggers ----------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['hotels','location_activities','pickup_drop_points','transport_vehicles',
                             'day_plans','quotations','invoices']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON %I', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t, t);
    END LOOP;
END $$;

-- ---------- 13. Rate lookup view for the quotation engine ------------------
-- One row per active room rate, with the period's date windows as JSON.
CREATE OR REPLACE VIEW v_quote_rates AS
SELECT
    rr.id                AS rate_id,
    h.id                 AS hotel_id,
    h.name               AS hotel_name,
    h.location_id,
    COALESCE(rt.category_id, h.default_category_id) AS category_id,
    rt.id                AS room_type_id,
    rt.name              AS room_name,
    s.name               AS season,
    s.priority           AS season_priority,
    p.id                 AS rate_period_id,
    p.date_range_label,
    rr.cp_cost, rr.map_cost, rr.extra_adult_cp, rr.extra_adult_map,
    rr.child_bed_cost, rr.child_no_bed_cost,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_array(d.valid_from, d.valid_to, d.is_exclusion) ORDER BY d.valid_from)
          FROM rate_period_dates d WHERE d.rate_period_id = p.id
    ), '[]'::jsonb)      AS windows
FROM room_rates rr
JOIN rate_periods p ON p.id = rr.rate_period_id AND p.is_active
JOIN seasons s      ON s.id = p.season_id
JOIN room_types rt  ON rt.id = rr.room_type_id
JOIN hotels h       ON h.id = rt.hotel_id AND h.is_active;

-- ---------- 14. Row Level Security -------------------------------------------
ALTER TABLE location_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_distances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_drop_points  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    -- Master data: every staff member reads, admins write.
    FOREACH t IN ARRAY ARRAY['location_activities','location_distances','pickup_drop_points',
                             'transport_vehicles','day_plans','tour_settings']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "staff read %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "staff read %1$s" ON %1$I FOR SELECT USING (public.is_staff())', t);
        EXECUTE format('DROP POLICY IF EXISTS "admin write %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "admin write %1$s" ON %1$I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    END LOOP;
END $$;

-- Templates: staff read and may save new ones; admins edit/delete.
DROP POLICY IF EXISTS "staff read quotation_templates" ON quotation_templates;
CREATE POLICY "staff read quotation_templates" ON quotation_templates FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "staff insert quotation_templates" ON quotation_templates;
CREATE POLICY "staff insert quotation_templates" ON quotation_templates FOR INSERT WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "admin manage quotation_templates" ON quotation_templates;
CREATE POLICY "admin manage quotation_templates" ON quotation_templates FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Quotations & invoices: staff create/read/update; only admins delete.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['quotations','invoices','invoice_payments']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "staff read %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "staff read %1$s" ON %1$I FOR SELECT USING (public.is_staff())', t);
        EXECUTE format('DROP POLICY IF EXISTS "staff insert %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "staff insert %1$s" ON %1$I FOR INSERT WITH CHECK (public.is_staff())', t);
        EXECUTE format('DROP POLICY IF EXISTS "staff update %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "staff update %1$s" ON %1$I FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff())', t);
        EXECUTE format('DROP POLICY IF EXISTS "admin delete %1$s" ON %1$I', t);
        EXECUTE format('CREATE POLICY "admin delete %1$s" ON %1$I FOR DELETE USING (public.is_admin())', t);
    END LOOP;
END $$;

-- Rate Master tables from 028 already allow authenticated read; the view
-- runs with the caller's rights (security_invoker) so RLS still applies.
ALTER VIEW v_quote_rates SET (security_invoker = true);

GRANT SELECT ON v_quote_rates TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE quotation_number_seq, invoice_number_seq TO authenticated;
