-- Migration 0002: Production Upgrade for KoHot
-- Adds tables for R2 media assets, department requests, website content overrides, testimonials, relay handoffs, and disputes.

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

CREATE TABLE IF NOT EXISTS department_addition_requests (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  university_id TEXT NOT NULL,
  university_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  faculty_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS website_content_overrides (
  id TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'Class Album Admin',
  university TEXT NOT NULL,
  university_id TEXT NOT NULL,
  faculty TEXT,
  department TEXT NOT NULL,
  department_id TEXT NOT NULL,
  class_year INTEGER NOT NULL,
  class_set_name TEXT NOT NULL,
  set_id TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  submission_date TEXT NOT NULL,
  publication_permission TEXT DEFAULT 'public',
  review_status TEXT DEFAULT 'pending',
  is_featured INTEGER DEFAULT 0,
  request_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS next_class_invites (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  target_year INTEGER NOT NULL,
  rep_name TEXT NOT NULL,
  rep_email TEXT,
  rep_phone TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS album_disputes (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_key ON media_assets(object_key);
CREATE INDEX IF NOT EXISTS idx_media_set ON media_assets(set_id);
CREATE INDEX IF NOT EXISTS idx_dept_req_status ON department_addition_requests(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured, review_status);
CREATE INDEX IF NOT EXISTS idx_next_class_token ON next_class_invites(token);
CREATE INDEX IF NOT EXISTS idx_disputes_set ON album_disputes(set_id);
