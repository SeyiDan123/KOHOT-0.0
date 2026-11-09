-- ============================================================================
-- MIGRATION 0005: Cohort Offers & Programmes Manager (Additive)
-- ============================================================================
-- Rules:
-- 1. Standard Price (student_fee_kobo in platform_settings) is never stored as
--    a programme and never assigned in cohort_allocations. No row = Standard.
-- 2. Only two optional programme kinds: 'funding' and 'discount' (1..99%).
-- 3. Funding coverage reuses slot_ledger grant rows carrying the programme's
--    sponsor_name so approvals, funded counts, and the album sponsor footer
--    keep working. Existing slot_allocations (KoHot slots) are merged into
--    programmes + cohort_allocations.
-- ============================================================================

-- 1. Programmes Table
CREATE TABLE IF NOT EXISTS programmes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('funding', 'discount')),
    discount_percent INTEGER CHECK(discount_percent IS NULL OR (discount_percent >= 1 AND discount_percent <= 99)),
    coverage_mode TEXT CHECK(coverage_mode IS NULL OR coverage_mode IN ('all', 'per_album_cap')),
    coverage_cap INTEGER,
    sponsor_name TEXT DEFAULT '',
    show_recognition INTEGER NOT NULL DEFAULT 1,
    valid_from TEXT,
    valid_to TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_programmes_kind_status ON programmes(kind, status);

-- 2. Cohort Allocations Table (No row means Standard; never create rows for Standard)
CREATE TABLE IF NOT EXISTS cohort_allocations (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    graduation_year INTEGER NOT NULL,
    programme_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT DEFAULT '',
    UNIQUE(institution_id, department_id, graduation_year),
    FOREIGN KEY (programme_id) REFERENCES programmes(id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_allocations_cohort
    ON cohort_allocations(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_cohort_allocations_programme
    ON cohort_allocations(programme_id);

-- 3. Additive Columns on transactions
ALTER TABLE transactions ADD COLUMN programme_id TEXT;
ALTER TABLE transactions ADD COLUMN list_price_kobo INTEGER;
ALTER TABLE transactions ADD COLUMN discount_kobo INTEGER DEFAULT 0;

-- 4. Merge existing slot_allocations (KoHot slots) into programmes + cohort_allocations
INSERT OR IGNORE INTO programmes (
    id, name, kind, discount_percent, coverage_mode, coverage_cap,
    sponsor_name, show_recognition, valid_from, valid_to, status, created_at, updated_at
)
SELECT
    'prog-kohot-alloc-' || CAST(quantity AS TEXT),
    'KoHot Funded Access (' || CAST(quantity AS TEXT) || ' profiles)',
    'funding',
    NULL,
    'per_album_cap',
    quantity,
    'KoHot',
    1,
    NULL,
    NULL,
    'active',
    created_at,
    updated_at
FROM slot_allocations
WHERE quantity > 0
GROUP BY quantity;

INSERT OR IGNORE INTO cohort_allocations (
    id, institution_id, department_id, graduation_year, programme_id, assigned_by, assigned_at, note
)
SELECT
    'calloc-' || institution_id || '-' || department_id || '-' || CAST(graduation_year AS TEXT),
    institution_id,
    department_id,
    graduation_year,
    'prog-kohot-alloc-' || CAST(quantity AS TEXT),
    COALESCE(created_by, 'system'),
    created_at,
    COALESCE(note, 'Merged from KoHot slot_allocations')
FROM slot_allocations
WHERE quantity > 0;
