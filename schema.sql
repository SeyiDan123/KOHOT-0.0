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
  admin_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, department_id, graduation_year)
);

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

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reg_lookup ON registrations(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_reg_email ON registrations(applicant_email);
CREATE INDEX IF NOT EXISTS idx_sets_lookup ON class_sets(institution_id, department_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_reminder_log_lookup ON reminder_logs(student_email, set_id, year);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(sent_at);
