-- =====================================================================
-- Travinco Hotel Rate Master – normalized schema (PostgreSQL)
-- Source: "Rate Master" sheet (2,068 rows, 200 hotels, 37 locations,
--         575 hotel+season+date-range combinations, 534 room names)
-- =====================================================================

-- ---------- 1. Lookups ------------------------------------------------
CREATE TABLE locations (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE          -- 'Munnar', 'Alleppey Houseboat'
);

CREATE TABLE hotel_categories (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE,         -- 'Budget', '4-Star', ...
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE seasons (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(20) NOT NULL UNIQUE,         -- LEAN / ON_PEAK / PEAK_SURGE
    name        VARCHAR(40) NOT NULL UNIQUE,         -- text exactly as in the sheet
    priority    SMALLINT NOT NULL                    -- 1 / 2 / 3  (higher wins on overlap)
);

INSERT INTO seasons (code, name, priority) VALUES
 ('LEAN',       'Lean / Off-Peak Season', 1),
 ('ON_PEAK',    'On-Peak Season',         2),
 ('PEAK_SURGE', 'Peak Surge Window',      3);

-- ---------- 2. Import tracking ---------------------------------------
CREATE TABLE import_batches (
    id            BIGSERIAL PRIMARY KEY,
    file_name     VARCHAR(255) NOT NULL,
    file_hash     CHAR(64),                          -- SHA-256, blocks duplicate uploads
    tariff_year   VARCHAR(9)   NOT NULL,             -- '2026-27'
    uploaded_by   BIGINT,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    status        VARCHAR(15)  NOT NULL DEFAULT 'STAGED'
                  CHECK (status IN ('STAGED','VALIDATED','PUBLISHED','FAILED','ROLLED_BACK')),
    rows_total    INT,
    rows_ok       INT,
    rows_failed   INT
);

-- Raw copy of every Excel row (columns A–O) – nothing is lost, easy to re-process
CREATE TABLE rate_master_staging (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            BIGINT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    excel_row_no        INT    NOT NULL,
    location            TEXT, hotel_name TEXT, hotel_category TEXT,
    season              TEXT, date_range TEXT, room_category TEXT,
    cp_cost             NUMERIC(10,2), map_cost NUMERIC(10,2),
    extra_adult_cp      NUMERIC(10,2), extra_adult_map NUMERIC(10,2),
    child_bed_cost      NUMERIC(10,2), child_no_bed_cost NUMERIC(10,2),
    infant_policy       TEXT, mandatory_surcharges TEXT, notes TEXT,
    row_status          VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                        CHECK (row_status IN ('PENDING','OK','WARNING','ERROR')),
    row_message         TEXT
);
CREATE INDEX ix_staging_batch ON rate_master_staging(batch_id);

-- ---------- 3. Hotels & rooms ----------------------------------------
CREATE TABLE hotels (
    id                    BIGSERIAL PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    location_id           SMALLINT NOT NULL REFERENCES locations(id),
    default_category_id   SMALLINT REFERENCES hotel_categories(id),
    area                  VARCHAR(80),               -- 'Nedumudy', 'Muhamma'
    gst_basis             VARCHAR(40),               -- 'INCL_GST' / 'UNCONFIRMED'
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (location_id, name)
);
CREATE INDEX ix_hotels_loc_cat ON hotels(location_id, default_category_id);

-- Category lives here too because houseboat operators have boats in
-- different grades (Budget-3★ / Premium-3★ / 4★ under one hotel name).
CREATE TABLE room_types (
    id            BIGSERIAL PRIMARY KEY,
    hotel_id      BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,             -- 'Lake View Room', '2 Bedroom Houseboat'
    category_id   SMALLINT REFERENCES hotel_categories(id),  -- overrides hotel default
    UNIQUE (hotel_id, name)
);

-- ---------- 4. Rate periods (hotel + season + date range) ------------
CREATE TABLE rate_periods (
    id                    BIGSERIAL PRIMARY KEY,
    hotel_id              BIGINT   NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    season_id             SMALLINT NOT NULL REFERENCES seasons(id),
    date_range_label      VARCHAR(150) NOT NULL,     -- original text '01 Oct – 19 Dec 2026 & 06 Jan – 31 Mar 2027'
    infant_policy         VARCHAR(200),              -- 'Below 6 yrs FOC'
    infant_free_below_age SMALLINT,                  -- parsed 6 (optional)
    mandatory_surcharges  TEXT,                      -- raw text from sheet
    import_batch_id       BIGINT NOT NULL REFERENCES import_batches(id),
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,   -- only latest published batch is active
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (import_batch_id, hotel_id, season_id, date_range_label)
);
CREATE INDEX ix_periods_lookup ON rate_periods(hotel_id, season_id) WHERE is_active;

-- Real dates for a period (replaces the Season Calendar sheet: From1/To1 … From4/To4, Excl.)
CREATE TABLE rate_period_dates (
    id               BIGSERIAL PRIMARY KEY,
    rate_period_id   BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    valid_from       DATE NOT NULL,
    valid_to         DATE NOT NULL,
    is_exclusion     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = rate does NOT apply in this window
    CHECK (valid_to >= valid_from)
);
CREATE INDEX ix_period_dates_range ON rate_period_dates(valid_from, valid_to);
CREATE INDEX ix_period_dates_period ON rate_period_dates(rate_period_id);

-- ---------- 5. The actual prices (one row per room per period) -------
-- Extra-adult / child prices sit here, NOT on rate_periods, because
-- ~50 periods in your data have different values for different rooms.
CREATE TABLE room_rates (
    id                   BIGSERIAL PRIMARY KEY,
    rate_period_id       BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    room_type_id         BIGINT NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    cp_cost              NUMERIC(10,2) CHECK (cp_cost  >= 0),   -- room/night, breakfast
    map_cost             NUMERIC(10,2) CHECK (map_cost >= 0),   -- room/night, breakfast + dinner
    extra_adult_cp       NUMERIC(10,2),
    extra_adult_map      NUMERIC(10,2),
    child_bed_cost       NUMERIC(10,2),
    child_no_bed_cost    NUMERIC(10,2),
    notes                TEXT,
    UNIQUE (rate_period_id, room_type_id)
);
CREATE INDEX ix_room_rates_room ON room_rates(room_type_id);

-- ---------- 6. Optional: structured surcharges -----------------------
-- Filled by a parser from rate_periods.mandatory_surcharges
-- ('Xmas Eve dinner Rs2000/person (24 Dec)', 'Peak supplement Rs1000/room/night (included)')
CREATE TABLE period_surcharges (
    id               BIGSERIAL PRIMARY KEY,
    rate_period_id   BIGINT NOT NULL REFERENCES rate_periods(id) ON DELETE CASCADE,
    surcharge_type   VARCHAR(30) NOT NULL,           -- GALA_DINNER / PEAK_SUPPLEMENT / FESTIVAL_HIKE
    applies_on       DATE,                           -- 2026-12-24
    amount_adult     NUMERIC(10,2),
    amount_child     NUMERIC(10,2),
    per_unit         VARCHAR(15),                    -- PERSON / ROOM_NIGHT / ROOM
    is_mandatory     BOOLEAN NOT NULL DEFAULT TRUE,
    is_included      BOOLEAN NOT NULL DEFAULT FALSE, -- already inside CP/MAP price
    raw_text         TEXT
);

-- ---------- 7. Follow-ups (sheet "Follow-ups") -----------------------
CREATE TABLE hotel_followups (
    id          BIGSERIAL PRIMARY KEY,
    hotel_id    BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    issue       TEXT NOT NULL,
    action      TEXT,
    status      VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 8. Vehicle tariff (sheet "Vehicle Tariff") ----------------
CREATE TABLE vehicle_tariffs (
    id               SERIAL PRIMARY KEY,
    category         VARCHAR(80) NOT NULL UNIQUE,    -- dropdown name
    display_name     VARCHAR(120),
    ac_type          VARCHAR(10),
    max_pax          SMALLINT,
    rate_per_km      NUMERIC(8,2),
    min_km_per_day   INT,
    driver_bata_day  NUMERIC(8,2),
    other_per_day    NUMERIC(8,2) DEFAULT 0,
    notes            TEXT
);

-- =====================================================================
-- Replacing the Excel formulas
-- =====================================================================

-- A) "Date check" column  ->  periods that have no real dates yet
-- SELECT p.* FROM rate_periods p
-- WHERE p.is_active AND NOT EXISTS (SELECT 1 FROM rate_period_dates d WHERE d.rate_period_id = p.id);

-- B) Quote Builder: rate for a hotel on a given night (highest season priority wins)
-- SELECT rt.name AS room, s.name AS season, rr.cp_cost, rr.map_cost
-- FROM rate_periods p
-- JOIN seasons s       ON s.id = p.season_id
-- JOIN room_rates rr   ON rr.rate_period_id = p.id
-- JOIN room_types rt   ON rt.id = rr.room_type_id
-- WHERE p.is_active AND p.hotel_id = :hotel_id AND rt.id = :room_type_id
--   AND EXISTS (SELECT 1 FROM rate_period_dates d
--               WHERE d.rate_period_id = p.id AND NOT d.is_exclusion
--                 AND :night BETWEEN d.valid_from AND d.valid_to)
--   AND NOT EXISTS (SELECT 1 FROM rate_period_dates x
--               WHERE x.rate_period_id = p.id AND x.is_exclusion
--                 AND :night BETWEEN x.valid_from AND x.valid_to)
-- ORDER BY s.priority DESC LIMIT 1;

-- C) Best Value Finder (view)
-- CREATE VIEW v_best_value AS
-- SELECT l.name AS location, c.name AS category, s.name AS season,
--        MIN(rr.cp_cost)  FILTER (WHERE rr.cp_cost  > 0) AS lowest_cp,
--        MIN(rr.map_cost) FILTER (WHERE rr.map_cost > 0) AS lowest_map
-- FROM room_rates rr
-- JOIN rate_periods p  ON p.id = rr.rate_period_id AND p.is_active
-- JOIN seasons s       ON s.id = p.season_id
-- JOIN room_types rt   ON rt.id = rr.room_type_id
-- JOIN hotels h        ON h.id = rt.hotel_id
-- JOIN locations l     ON l.id = h.location_id
-- JOIN hotel_categories c ON c.id = COALESCE(rt.category_id, h.default_category_id)
-- GROUP BY l.name, c.name, s.name;
