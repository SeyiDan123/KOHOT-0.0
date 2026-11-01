-- ============================================================================
-- KOHOT ADDITIVE MIGRATION 0004: R2 MEDIA ASSETS & PAYSTACK PAYMENTS INDEXES
-- Safe to run in Cloudflare D1 Console (Additive only, reuses existing tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT UNIQUE NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_name TEXT,
  uploader_email TEXT,
  set_id TEXT,
  category TEXT DEFAULT 'candid',
  public_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_key ON media_assets(object_key);
CREATE INDEX IF NOT EXISTS idx_media_set ON media_assets(set_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_profile_submissions_paid_ref ON profile_submissions(paid_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_purchases_ref ON slot_purchases(reference);
