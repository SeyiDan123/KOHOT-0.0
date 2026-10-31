-- ============================================================================
-- KoHot Migration 0003: Platform Settings, Profile Submissions & Slot Ledger
-- Additive-only migration (safe to run on existing D1 database)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO platform_settings (key, value) VALUES
  ('student_fee_kobo', '50000'),
  ('min_funded_to_publish', '10'),
  ('profile_cap_default', '200'),
  ('reinstate_days', '7'),
  ('draft_retention_days', '30'),
  ('gate_mode', 'publish'),
  ('default_kohot_slots_per_album', '0');

CREATE TABLE IF NOT EXISTS profile_submissions (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  photo_key TEXT,
  email TEXT NOT NULL,
  consent_at TEXT,
  source TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  paid_reference TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  decline_reason TEXT,
  declined_at TEXT,
  status_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profile_submissions_album ON profile_submissions(album_id, status);
CREATE INDEX IF NOT EXISTS idx_profile_submissions_email ON profile_submissions(album_id, email);
CREATE INDEX IF NOT EXISTS idx_profile_submissions_token ON profile_submissions(status_token_hash);

CREATE TABLE IF NOT EXISTS slot_ledger (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,
  purchase_id TEXT,
  allocation_id TEXT,
  sponsor_name TEXT,
  unit_value_kobo INTEGER,
  idempotency_key TEXT UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slot_ledger_album ON slot_ledger(album_id, created_at DESC);

CREATE TABLE IF NOT EXISTS slot_purchases (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_kobo INTEGER NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  sponsor_name TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slot_purchases_album ON slot_purchases(album_id, created_at DESC);

CREATE TABLE IF NOT EXISTS slot_allocations (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  album_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, department_id, graduation_year)
);

CREATE INDEX IF NOT EXISTS idx_slot_allocations_lookup ON slot_allocations(institution_id, department_id, graduation_year);
