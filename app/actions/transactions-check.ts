// Target path: app/actions/transactions-check.ts (REPLACE existing)

'use server';

import { findExistingFingerprints } from '@/lib/data/queries';

/**
 * Server action wrapping findExistingFingerprints. Used by the CSV import
 * modal to detect both exact and probable duplicates.
 *
 * Returns:
 *   - externalIds: array of external_ids that already exist
 *   - fingerprints: array of fingerprints that already exist
 *   - candidates: existing transactions in the date range, used for fuzzy
 *     (probable) duplicate detection on the client side
 */
export async function checkForDuplicates(params: {
  accountId: string;
  fromDate: string;
  toDate: string;
  externalIds: string[];
  fingerprints: string[];
}): Promise<{
  externalIds: string[];
  fingerprints: string[];
  candidates: Array<{
    occurred_at: string;
    amount: number;
    merchant: string | null;
    description: string | null;
    type: 'income' | 'expense' | 'transfer';
  }>;
}> {
  const result = await findExistingFingerprints(params);
  return {
    externalIds: Array.from(result.externalIds),
    fingerprints: Array.from(result.fingerprints),
    candidates: result.candidates,
  };
}
