-- =====================================================================
-- Migration 028: Hotel Rate Master Schema (PostgreSQL / Supabase)
-- =====================================================================

-- ---------- 1. Lookups ------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS hotel_categories (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE,
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seasons (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(40) NOT NULL UNIQUE,
    priority    SMALLINT NOT NULL
);

INSERT INTO seasons (code, name, priority) VALUES
 ('LEAN',       'Lean / Off-Peak Season', 1),
 ('ON_PEAK',    'On-Peak Season',         2),
 ('PEAK_SURGE', 'Peak Surge Window',      3)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, priority = EXCLUDED.priority;

-- ---------- 2. Import tracking ---------------------------------------
CREATE TABLE IF NOT EXISTS import_batches (
    id            BIGSERIAL PRIMARY KEY,
    file_name     VARCHAR(255) NOT NULL,
    file_hash     CHAR(64),
    tariff_year   VARCHAR(9)   NOT NULL,
    uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    status        VARCHAR(15)  NOT NULL DEFAULT 'STAGED'
                  CHECK (status IN ('STAGED','VALIDATED','PUBLISHED','FAILED','ROLLED_BACK')),
    rows_total    INT,
    rows_ok       INT,
    rows_failed   INT
);

CREATE TABLE IF NOT EXISTS rate_master_staging (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            BIGINT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    excel_row_no        INT    NOT NULL,
    location            TEXT, 
    hotel_name          TEXT, 
    hotel_category      TEXT,
    season              TEXT, 
    date_range          TEXT, 
    room_category       TEXT,
    cp_cost             NUMERIC(10,2), 
    map_cost            NUMERIC(10,2),
    extra_adult_cp      NUMERIC(10,2), 
    extra_adult_map     NUMERIC(10,2),
    child_bed_cost      NUMERIC(10,2), 
    child_no_bed_cost   NUMERIC(10,2),
    infant_policy       TEXT, 
    mandatory_surcharges TEXT, 
    notes               TEXT,
    row_status          VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                        CHECK (row_status IN ('PENDING','OK','WARNING','ERROR')),
    row_message         TEXT
);
CREATE INDEX IF NOT EXISTS ix_staging_batch ON rate_master_staging(batch_id);

-- ---------- 3. Hotels & rooms ----------------------------------------
CREATE TABLE IF NOT EXISTS hotels (
    id                    BIGSERIAL PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    location_id           SMALLINT NOT NULL REFERENCES locations(id),
    default_category_id   SMALLINT REFERENCES hotel_categories(id),
    area                  VARCHAR(80),
    gst_basis             VARCHAR(40),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (location_id, name)
);
CREATE INDEX IF NOT EXISTS ix_hotels_loc_cat ON hotels(location_id, default_category_id);

CREATE TABLE IF NOT EXISTS room_types (
    id            BIGSERIAL PRIMARY KEY,
    hotel_id      BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    category_id   SMALLINT REFERENCES hotel_categories(id),
    UNIQUE (hotel_id, name)
);

-- ---------- 4. Rate periods (hotel + season + date range) ------------
CREATE TABLE IF NOT EXISTS rate_periods (
    id                    BIGSERIAL PRIMARY KEY,
    hotel_id              BIGINT   NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    season_id             SMALLINT NOT NULL REFERENCES seasons(id),
    date_range_label      VARCHAR(150) NOT NULL,
    infant_policy         VARCHAR(200),
    infant_free_below_age SMALLINT,
    mandatory_surcharges  TEXT,
    import_batch_id       BIGINT NOT NULL REFERENCES import_batches(id),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (import_batch_id, hotel_id, season_id, date_range_label)
);
CREATE INDEX IF NOT EXISTS ix_periods_lookup ON rate_periods(hotel_id, season_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS rate_period_dates (
    id               BIGSERIAL PRIMARY KEY,
    rate_period_id   BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    valid_from       DATE NOT NULL,
    valid_to         DATE NOT NULL,
    is_exclusion     BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (valid_to >= valid_from)
);
CREATE INDEX IF NOT EXISTS ix_period_dates_range ON rate_period_dates(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS ix_period_dates_period ON rate_period_dates(rate_period_id);

-- ---------- 5. Room rates --------------------------------------------
CREATE TABLE IF NOT EXISTS room_rates (
    id                   BIGSERIAL PRIMARY KEY,
    rate_period_id       BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    room_type_id         BIGINT NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    cp_cost              NUMERIC(10,2) CHECK (cp_cost >= 0),
    map_cost             NUMERIC(10,2) CHECK (map_cost >= 0),
    extra_adult_cp       NUMERIC(10,2),
    extra_adult_map      NUMERIC(10,2),
    child_bed_cost       NUMERIC(10,2),
    child_no_bed_cost    NUMERIC(10,2),
    notes                TEXT,
    UNIQUE (rate_period_id, room_type_id)
);
CREATE INDEX IF NOT EXISTS ix_room_rates_room ON room_rates(room_type_id);

-- ---------- 6. Structured surcharges ---------------------------------
CREATE TABLE IF NOT EXISTS period_surcharges (
    id               BIGSERIAL PRIMARY KEY,
    rate_period_id   BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    surcharge_type   VARCHAR(30) NOT NULL,
    applies_on       DATE,
    amount_adult     NUMERIC(10,2),
    amount_child     NUMERIC(10,2),
    per_unit         VARCHAR(15),
    is_mandatory     BOOLEAN NOT NULL DEFAULT TRUE,
    is_included      BOOLEAN NOT NULL DEFAULT FALSE,
    raw_text         TEXT
);

-- ---------- 7. Hotel followups ---------------------------------------
CREATE TABLE IF NOT EXISTS hotel_followups (
    id          BIGSERIAL PRIMARY KEY,
    hotel_id    BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    issue       TEXT NOT NULL,
    action      TEXT,
    status      VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 8. Vehicle tariffs ---------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_tariffs (
    id               SERIAL PRIMARY KEY,
    category         VARCHAR(80) NOT NULL UNIQUE,
    display_name     VARCHAR(120),
    ac_type          VARCHAR(10),
    max_pax          SMALLINT,
    rate_per_km      NUMERIC(8,2),
    min_km_per_day   INT,
    driver_bata_day  NUMERIC(8,2),
    other_per_day    NUMERIC(8,2) DEFAULT 0,
    notes            TEXT
);

-- ---------- 9. Views -------------------------------------------------
CREATE OR REPLACE VIEW v_rate_master AS
SELECT 
    rr.id AS rate_id,
    l.name AS location,
    h.name AS hotel_name,
    COALESCE(rc.name, hc.name, 'Standard') AS hotel_category,
    s.name AS season,
    p.date_range_label AS date_range,
    rt.name AS room_category,
    rr.cp_cost,
    rr.map_cost,
    rr.extra_adult_cp,
    rr.extra_adult_map,
    rr.child_bed_cost,
    rr.child_no_bed_cost,
    p.infant_policy,
    p.mandatory_surcharges,
    rr.notes,
    h.id AS hotel_id,
    p.id AS rate_period_id,
    rt.id AS room_type_id,
    p.import_batch_id,
    p.is_active
FROM room_rates rr
JOIN rate_periods p ON p.id = rr.rate_period_id
JOIN seasons s ON s.id = p.season_id
JOIN room_types rt ON rt.id = rr.room_type_id
JOIN hotels h ON h.id = rt.hotel_id
JOIN locations l ON l.id = h.location_id
LEFT JOIN hotel_categories hc ON hc.id = h.default_category_id
LEFT JOIN hotel_categories rc ON rc.id = rt.category_id;

-- ---------- 10. RLS Security -----------------------------------------
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_master_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_period_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_tariffs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated staff/admin
CREATE POLICY "Allow staff to read rate master lookups" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read hotel categories" ON hotel_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read seasons" ON seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read hotels" ON hotels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read room types" ON room_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read rate periods" ON rate_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read rate period dates" ON rate_period_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read room rates" ON room_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read import batches" ON import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read staging" ON rate_master_staging FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read surcharges" ON period_surcharges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read followups" ON hotel_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to read vehicle tariffs" ON vehicle_tariffs FOR SELECT TO authenticated USING (true);

-- Allow full access for admin and super_admin
CREATE POLICY "Allow admin to manage locations" ON locations FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage hotel categories" ON hotel_categories FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage seasons" ON seasons FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage hotels" ON hotels FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage room types" ON room_types FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage rate periods" ON rate_periods FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage rate period dates" ON rate_period_dates FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage room rates" ON room_rates FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage import batches" ON import_batches FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage staging" ON rate_master_staging FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage surcharges" ON period_surcharges FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage followups" ON hotel_followups FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Allow admin to manage vehicle tariffs" ON vehicle_tariffs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
