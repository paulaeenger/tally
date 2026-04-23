// Target path in your repo: app/actions/transactions-check.ts (NEW FILE)
//
// Client components can't call query functions directly because they run in
// the browser. This server action wraps findExistingFingerprints so the CSV
// import modal can invoke it during the preview step.

'use server';

import { findExistingFingerprints } from '@/lib/data/queries';

export async function checkForDuplicates(params: {
  accountId: string;
  fromDate: string;
  toDate: string;
  externalIds: string[];
  fingerprints: string[];
}): Promise<{ externalIds: string[]; fingerprints: string[] }> {
  const result = await findExistingFingerprints(params);
  return {
    externalIds: Array.from(result.externalIds),
    fingerprints: Array.from(result.fingerprints),
  };
}
