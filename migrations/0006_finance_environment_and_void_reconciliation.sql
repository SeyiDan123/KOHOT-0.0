-- Migration 0006: Finance Environment Separation & Host Transaction Void/Reversal Reconciliation
-- Preserves all historical records, transaction amounts, and ledger history.
-- Historical records default to environment = 'legacy' (never automatically assumed 'live').

-- 1. Add environment and void/restore audit columns to transactions
ALTER TABLE transactions ADD COLUMN environment TEXT DEFAULT 'legacy';
ALTER TABLE transactions ADD COLUMN voided_at TEXT;
ALTER TABLE transactions ADD COLUMN voided_by TEXT;
ALTER TABLE transactions ADD COLUMN void_reason TEXT;
ALTER TABLE transactions ADD COLUMN previous_status TEXT;
ALTER TABLE transactions ADD COLUMN restored_at TEXT;
ALTER TABLE transactions ADD COLUMN restored_by TEXT;
ALTER TABLE transactions ADD COLUMN restore_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_env_status ON transactions(environment, status);

-- 2. Add environment and void metadata columns to slot_purchases
ALTER TABLE slot_purchases ADD COLUMN environment TEXT DEFAULT 'legacy';
ALTER TABLE slot_purchases ADD COLUMN voided_at TEXT;
ALTER TABLE slot_purchases ADD COLUMN voided_by TEXT;
ALTER TABLE slot_purchases ADD COLUMN void_reason TEXT;

-- 3. Add environment, payment reference traceability, and reversal linkage to slot_ledger
ALTER TABLE slot_ledger ADD COLUMN environment TEXT DEFAULT 'legacy';
ALTER TABLE slot_ledger ADD COLUMN reference TEXT;
ALTER TABLE slot_ledger ADD COLUMN reversal_of_ledger_id TEXT;
ALTER TABLE slot_ledger ADD COLUMN note TEXT;

CREATE INDEX IF NOT EXISTS idx_slot_ledger_reference ON slot_ledger(reference);
