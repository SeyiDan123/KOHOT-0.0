-- Cloudflare D1 Database Schema for KoHot
-- Database Name: kohot-production-d1

-- 1. Users Table (Google OAuth verified users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'class_rep', -- 'master_host' | 'class_rep' | 'visitor'
  avatar_url TEXT,
  assigned_set_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Registrations Table (Tracks Founding & Standard Paid Class Album Registrations)
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  applicant_email TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  class_set_name TEXT NOT NULL,
  class_motto TEXT,
  estimated_graduates INTEGER DEFAULT 100,
  years_together INTEGER DEFAULT 4,
  applicant_role TEXT DEFAULT 'Class Representative',
  backup_contact_name TEXT,
  backup_contact_phone TEXT,
  backup_contact_email TEXT,
  backup_contact_role TEXT,
  registration_type TEXT NOT NULL, -- 'founding' (free, needs host approval) | 'standard' (paid, instant)
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'rejected'
  payment_ref TEXT,
  payment_amount INTEGER DEFAULT 0, -- In kobo (5000000 = 50,000 NGN)
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, department_id, graduation_year)
);

-- 3. Institutions Table (Governed strictly by Master Host)
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  location TEXT,
  logo_url TEXT,
  official_website TEXT,
  motto TEXT,
  institution_type TEXT DEFAULT 'university', -- 'university' | 'polytechnic' | 'college_of_education'
  is_priority INTEGER DEFAULT 0, -- 1 = true, 0 = false
  order_number INTEGER DEFAULT 99,
  data_json TEXT, -- Serialized departments, faculties, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Class Sets / Albums Table
CREATE TABLE IF NOT EXISTS class_sets (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  class_set_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
  data_json TEXT NOT NULL, -- Full ClassSet JSON structure
  invite_code TEXT,
  admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, department_id, graduation_year)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sets_invite_code ON class_sets(invite_code);

-- 5. Financial Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  set_id TEXT,
  set_name TEXT,
  institution TEXT,
  amount INTEGER NOT NULL, -- in NGN
  amount_kobo INTEGER NOT NULL, -- in kobo
  currency TEXT DEFAULT 'NGN',
  status TEXT NOT NULL, -- 'Paid' | 'paid, duplicate class, needs refund' | 'paid, album not created'
  payer_name TEXT,
  payer_email TEXT,
  programme_id TEXT,
  list_price_kobo INTEGER,
  discount_kobo INTEGER DEFAULT 0,
  paystack_data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Audit & Activity Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Annual Reminder Logs (Tracks reminder dispatch per student per year)
CREATE TABLE IF NOT EXISTS reminder_logs (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  set_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'sent' | 'failed' | 'bounced' | 'skipped'
  provider TEXT NOT NULL, -- 'resend' | 'cloudflare'
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Unsubscribed Students (Honors unsubscribe link via signed token)
CREATE TABLE IF NOT EXISTS unsubscribed_students (
  email TEXT PRIMARY KEY,
  set_id TEXT,
  unsubscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Support Messages (Visitor and Admin support inquiries)
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  message TEXT NOT NULL,
  set_id TEXT, -- Album if known
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'read' | 'closed'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. General Email Logs (Provider independent audit and daily send cap enforcement)
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'resend' | 'cloudflare'
  status TEXT NOT NULL, -- 'sent' | 'failed'
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. Media Assets (R2 Object Storage Metadata & Reference Index)
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT UNIQUE NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_name TEXT,
  uploader_email TEXT,
  set_id TEXT,
  category TEXT DEFAULT 'candid', -- 'portrait' | 'candid' | 'award' | 'plaque' | 'banner' | 'voice'
  public_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. Department Addition Requests
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
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Website Content Overrides (Master Host Branding & Homepage Customization)
CREATE TABLE IF NOT EXISTS website_content_overrides (
  id TEXT PRIMARY KEY, -- 'current'
  content_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. Testimonials (Class Rep Reflections & Milestone Endorsements)
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
  publication_permission TEXT DEFAULT 'public', -- 'public' | 'private'
  review_status TEXT DEFAULT 'pending', -- 'approved' | 'rejected' | 'pending'
  is_featured INTEGER DEFAULT 0, -- 1 = true, 0 = false
  is_visible INTEGER DEFAULT 1, -- 1 = visible on website, 0 = hidden
  is_demo INTEGER DEFAULT 0, -- 1 = sample testimonial, 0 = real submission
  display_order INTEGER DEFAULT 0,
  request_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. Next Class Handoff Invites (Relay-Race Baton Tracking)
CREATE TABLE IF NOT EXISTS next_class_invites (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  target_year INTEGER NOT NULL,
  rep_name TEXT NOT NULL,
  rep_email TEXT,
  rep_phone TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'followed_up' | 'onboarded'
  notes TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. Album Disputes
CREATE TABLE IF NOT EXISTS album_disputes (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'open', -- 'open' | 'investigating' | 'resolved' | 'dismissed'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reg_lookup ON registrations(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_reg_email ON registrations(applicant_email);
CREATE INDEX IF NOT EXISTS idx_sets_lookup ON class_sets(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_reminder_log_lookup ON reminder_logs(student_email, set_id, year);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_media_key ON media_assets(object_key);
CREATE INDEX IF NOT EXISTS idx_media_set ON media_assets(set_id);
CREATE INDEX IF NOT EXISTS idx_dept_req_status ON department_addition_requests(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured, review_status);
CREATE INDEX IF NOT EXISTS idx_next_class_token ON next_class_invites(token);
CREATE INDEX IF NOT EXISTS idx_disputes_set ON album_disputes(set_id);

-- 14. Platform Settings
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
  ('recovery_period_days', '14'),
  ('gate_mode', 'publish'),
  ('default_kohot_slots_per_album', '0'),
  ('public_directory_enabled', '0'),
  ('hidden_directory_institutions', '[]'),
  ('hidden_directory_albums', '[]'),
  ('institution_currencies', '{}');

-- 15. Profile Submissions
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

-- 16. Slot Ledger
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

-- 17. Slot Purchases
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

-- 18. Slot Allocations
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

-- 19. Programmes (Funding & Discount Offers; Standard price is never stored here)
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_programmes_kind_status ON programmes(kind, status);

-- 20. Cohort Allocations (No row means Standard; never create rows for Standard)
CREATE TABLE IF NOT EXISTS cohort_allocations (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  programme_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT DEFAULT '',
  UNIQUE(institution_id, department_id, graduation_year),
  FOREIGN KEY (programme_id) REFERENCES programmes(id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_allocations_cohort ON cohort_allocations(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_cohort_allocations_programme ON cohort_allocations(programme_id);
