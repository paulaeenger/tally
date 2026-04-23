-- ============================================================================
-- Migration: transaction deduplication + query performance indexes
-- Target path in your repo: supabase/migrations/20260422_transaction_dedup.sql
-- ============================================================================
--
-- This migration adds:
--
--   1. `external_id` (nullable text) — for bank-provided transaction IDs
--      from CSV imports. When present, this is the strongest dedup key:
--      re-importing the same CSV can never create duplicates.
--
--   2. `fingerprint` (generated column) — an md5 hash of
--      (account_id, date_trunc('day', occurred_at), amount, lower(merchant),
--       type) used for dedup when no external_id is available. Restricted to
--      income and expense transactions; transfers are excluded because they
--      legitimately appear as paired rows in some bank CSVs.
--
--   3. Two partial unique indexes enforcing dedup at the database level:
--      - (user_id, account_id, external_id) where external_id IS NOT NULL
--      - (user_id, fingerprint) where external_id IS NULL
--        AND type IN ('income', 'expense')
--
--   4. Query performance indexes on (user_id, occurred_at DESC) and
--      (user_id, category_id, occurred_at DESC). These speed up every
--      dashboard and budgets query.
-- ============================================================================

BEGIN;

-- 1. external_id column
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT;

COMMENT ON COLUMN transactions.external_id IS
  'Optional bank-provided transaction ID from CSV imports. When present, used as the primary dedup key.';

-- 2. fingerprint generated column - computed by Postgres automatically on insert/update
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fingerprint TEXT
  GENERATED ALWAYS AS (
    md5(
      account_id::text
      || '|' || to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      || '|' || to_char(amount, 'FM999999999990.00')
      || '|' || lower(trim(COALESCE(merchant, description, '')))
      || '|' || type
    )
  ) STORED;

COMMENT ON COLUMN transactions.fingerprint IS
  'Deterministic hash for duplicate detection when external_id is absent. Computed from account, date, amount, merchant, and type.';

-- 3. Check for pre-existing duplicates before adding unique constraints
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id, account_id, external_id
    FROM transactions
    WHERE external_id IS NOT NULL
    GROUP BY user_id, account_id, external_id
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % existing (user_id, account_id, external_id) duplicate groups found. Resolve before re-running.', dup_count;
  END IF;
END$$;

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id, fingerprint
    FROM transactions
    WHERE external_id IS NULL
      AND type IN ('income', 'expense')
    GROUP BY user_id, fingerprint
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE WARNING 'Found % pre-existing fingerprint duplicate groups. See cleanup query at the bottom of this file.', dup_count;
  END IF;
END$$;

-- 4. Unique indexes for dedup enforcement
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_unique
  ON transactions (user_id, account_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_fingerprint_unique
  ON transactions (user_id, fingerprint)
  WHERE external_id IS NULL AND type IN ('income', 'expense');

-- 5. Query-speed indexes
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_user_category_date_idx
  ON transactions (user_id, category_id, occurred_at DESC)
  WHERE type = 'expense';

CREATE INDEX IF NOT EXISTS accounts_user_archived_idx
  ON accounts (user_id, is_archived);

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, for reference only)
-- ============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS accounts_user_archived_idx;
-- DROP INDEX IF EXISTS transactions_user_category_date_idx;
-- DROP INDEX IF EXISTS transactions_user_date_idx;
-- DROP INDEX IF EXISTS transactions_fingerprint_unique;
-- DROP INDEX IF EXISTS transactions_external_id_unique;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS fingerprint;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS external_id;
-- COMMIT;

-- ============================================================================
-- CLEANUP QUERY for pre-existing fingerprint duplicates (manual)
-- ============================================================================
-- If the fingerprint index creation fails due to existing duplicates, run
-- this to delete the later copies (keeping the earliest by created_at):
--
-- WITH ranked AS (
--   SELECT id, ROW_NUMBER() OVER (
--     PARTITION BY user_id, fingerprint
--     ORDER BY created_at ASC
--   ) AS rn
--   FROM transactions
--   WHERE external_id IS NULL AND type IN ('income', 'expense')
-- )
-- DELETE FROM transactions WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
-- ============================================================================
