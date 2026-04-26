'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';
import { upsertMerchantRule } from '@/app/actions/merchant-rules';
import type { TransactionType } from '@/lib/data/types';

// ============================================================
// Helpers
// ============================================================

async function getCurrentUserId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidate() {
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  revalidatePath('/budgets');
}

// ============================================================
// Create
// ============================================================

export async function createTransaction(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const supabase = createClient();

  const type = formData.get('type') as TransactionType | null;
  const amountRaw = formData.get('amount') as string | null;
  const merchant = (formData.get('merchant') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  const accountId = formData.get('account_id') as string | null;
  const categoryId = (formData.get('category_id') as string | null) || null;
  const occurredAt = formData.get('occurred_at') as string | null;
  const isRefund = formData.get('is_refund') === 'true';

  if (!type) return { error: 'Type is required' };
  if (!accountId) return { error: 'Account is required' };
  if (!merchant) return { error: 'Merchant is required' };

  const amount = Number(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than zero' };
  }

  // Use merchant as description (the display field is merchant; description
  // stays populated for the legacy data model and CSV imports)
  const description = merchant;

  const occurredAtIso = occurredAt
    ? new Date(occurredAt).toISOString()
    : new Date().toISOString();

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    household_id: householdId,
    account_id: accountId,
    category_id: categoryId,
    type,
    amount,
    description,
    merchant,
    notes: notes || null,
    is_refund: type === 'expense' ? isRefund : false,
    occurred_at: occurredAtIso,
  });

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

// ============================================================
// Update
// ============================================================

export async function updateTransaction(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const id = formData.get('id') as string | null;
  if (!id) return { error: 'Missing transaction id' };

  const supabase = createClient();

  const type = formData.get('type') as TransactionType | null;
  const amountRaw = formData.get('amount') as string | null;
  const merchant = (formData.get('merchant') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  const accountId = formData.get('account_id') as string | null;
  const categoryId = (formData.get('category_id') as string | null) || null;
  const occurredAt = formData.get('occurred_at') as string | null;
  const isRefund = formData.get('is_refund') === 'true';

  if (!type) return { error: 'Type is required' };
  if (!accountId) return { error: 'Account is required' };
  if (!merchant) return { error: 'Merchant is required' };

  const amount = Number(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than zero' };
  }

  const occurredAtIso = occurredAt
    ? new Date(occurredAt).toISOString()
    : new Date().toISOString();

  // Fetch the original transaction so we can detect what changed.
  // We use this to teach the merchant rules system from manual edits:
  // when a user changes type or category, we save that as a rule so
  // future imports of the same merchant auto-classify the same way.
  const { data: original } = await supabase
    .from('transactions')
    .select('type, category_id, merchant')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await supabase
    .from('transactions')
    .update({
      account_id: accountId,
      category_id: categoryId,
      type,
      amount,
      description: merchant,
      merchant,
      notes: notes || null,
      is_refund: type === 'expense' ? isRefund : false,
      occurred_at: occurredAtIso,
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return { error: error.message };

  // Learn from manual reclassifications. If the user changed type OR
  // category, save a merchant rule so future imports remember this choice.
  // Conditions for saving:
  //   1. The original transaction was found (not null)
  //   2. Either type or category_id actually changed
  //   3. Merchant is at least 3 chars (avoids "X" or "ABC" creating noise)
  //
  // The rule is upserted on (household_id, pattern), so saving the same
  // merchant repeatedly just updates the existing rule — no duplicates.
  // If the user later changes their mind, the next manual edit overwrites
  // the rule. The system is self-correcting.
  if (original && merchant.length >= 3) {
    const typeChanged = original.type !== type;
    const categoryChanged = original.category_id !== categoryId;

    if (typeChanged || categoryChanged) {
      // We await this rather than fire-and-forget — Next.js server actions
      // can terminate background Promises when the response returns. The
      // upsert is fast (single SQL statement) so the latency cost is small.
      // Errors are caught silently so a rule-save failure doesn't break
      // the user's primary action of editing the transaction.
      try {
        await upsertMerchantRule({
          pattern: merchant,
          type,
          category_id: categoryId,
        });
      } catch {
        // Intentional: don't surface rule-save errors to the user.
      }
    }
  }

  revalidate();
  return { success: true };
}

// ============================================================
// Delete
// ============================================================

export async function deleteTransaction(id: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const supabase = createClient();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

// ============================================================
// Bulk operations (multi-select edit)
// ============================================================

/**
 * Bulk-update one or more transactions. Pass any combination of fields
 * to apply to every transaction in `ids`. Fields not passed remain unchanged.
 *
 * Also creates merchant rules — ONE rule per unique merchant in the
 * selection — so future imports remember the classification.
 */
export async function bulkUpdateTransactions(params: {
  ids: string[];
  type?: TransactionType;
  category_id?: string | null;
}): Promise<{ updated: number; rulesCreated: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { updated: 0, rulesCreated: 0, error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { updated: 0, rulesCreated: 0, error: 'No household found' };

  if (params.ids.length === 0) {
    return { updated: 0, rulesCreated: 0, error: 'No transactions selected' };
  }
  if (params.ids.length > 500) {
    return { updated: 0, rulesCreated: 0, error: 'Too many — limit is 500 per bulk update' };
  }

  // Need at least one field to update
  if (params.type === undefined && params.category_id === undefined) {
    return { updated: 0, rulesCreated: 0, error: 'Nothing to update' };
  }

  const supabase = createClient();

  // Fetch the transactions BEFORE updating so we know:
  //   1. The merchants for each (for rule creation)
  //   2. The original values (so we can avoid creating no-op rules)
  const { data: originals } = await supabase
    .from('transactions')
    .select('id, merchant, type, category_id')
    .in('id', params.ids)
    .eq('household_id', householdId);

  if (!originals || originals.length === 0) {
    return { updated: 0, rulesCreated: 0, error: 'No transactions found' };
  }

  // Build the update payload — only include fields the caller specified
  const updates: Record<string, unknown> = {};
  if (params.type !== undefined) updates.type = params.type;
  if (params.category_id !== undefined) updates.category_id = params.category_id;

  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .in('id', params.ids)
    .eq('household_id', householdId);

  if (error) return { updated: 0, rulesCreated: 0, error: error.message };

  // We trust the input array length as the updated count. RLS would have
  // filtered out any IDs the user can't access; for those, the update is
  // a no-op rather than an error, so this is a slight over-count in
  // adversarial cases. For normal usage it's accurate.
  const updatedCount = originals.length;

  // Create merchant rules — one per unique merchant in the selection.
  // Only create a rule if the change was meaningful (something actually changed
  // for that merchant) and the merchant is at least 3 chars.
  let rulesCreated = 0;
  const uniqueMerchants = new Map<string, { type: TransactionType; category_id: string | null; changed: boolean }>();

  for (const orig of originals) {
    if (!orig.merchant || orig.merchant.length < 3) continue;
    const merchantKey = orig.merchant.toLowerCase();

    const newType = params.type ?? orig.type;
    const newCategoryId = params.category_id !== undefined ? params.category_id : orig.category_id;

    const changed =
      (params.type !== undefined && orig.type !== params.type) ||
      (params.category_id !== undefined && orig.category_id !== params.category_id);

    if (!uniqueMerchants.has(merchantKey)) {
      uniqueMerchants.set(merchantKey, {
        type: newType,
        category_id: newCategoryId,
        changed,
      });
    } else {
      // If we've seen this merchant already, mark as changed if any of its
      // transactions had a meaningful change
      const existing = uniqueMerchants.get(merchantKey)!;
      if (changed) existing.changed = true;
    }
  }

  // Save rules for changed merchants. We import upsertMerchantRule via dynamic
  // import to keep this server action self-contained even if the merchant rules
  // module isn't available (graceful degradation).
  for (const [merchantKey, rule] of uniqueMerchants) {
    if (!rule.changed) continue;

    // Use the original-cased merchant name (find it from any original with this key)
    const original = originals.find((o) => o.merchant?.toLowerCase() === merchantKey);
    if (!original?.merchant) continue;

    try {
      await upsertMerchantRule({
        pattern: original.merchant,
        type: rule.type,
        category_id: rule.category_id,
      });
      rulesCreated++;
    } catch {
      // Don't fail the whole bulk update if a rule save fails
    }
  }

  revalidate();
  return { updated: updatedCount, rulesCreated };
}

/**
 * Bulk-delete transactions. No reassignment — they're just gone.
 * The UI is responsible for confirming this is what the user wants.
 */
export async function bulkDeleteTransactions(
  ids: string[]
): Promise<{ deleted: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { deleted: 0, error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { deleted: 0, error: 'No household found' };

  if (ids.length === 0) return { deleted: 0, error: 'No transactions selected' };
  if (ids.length > 500) return { deleted: 0, error: 'Too many — limit is 500 per bulk delete' };

  const supabase = createClient();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids)
    .eq('household_id', householdId);

  if (error) return { deleted: 0, error: error.message };

  revalidate();
  return { deleted: ids.length };
}

// ============================================================
// Bulk import (for CSV)
// ============================================================

export interface ImportRow {
  occurred_at: string; // ISO
  merchant: string;
  amount: number; // positive
  type: TransactionType;
  account_id: string;
  category_id: string | null;
  notes?: string | null;
  is_refund?: boolean;
}

export async function bulkImportTransactions(
  rows: ImportRow[]
): Promise<{ imported: number; skipped: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { imported: 0, skipped: 0, error: 'Not signed in' };
  if (rows.length === 0) return { imported: 0, skipped: 0, error: 'No rows to import' };
  if (rows.length > 1000) {
    return { imported: 0, skipped: 0, error: 'Too many rows — limit is 1000 per import' };
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { imported: 0, skipped: 0, error: 'No household found' };

  const supabase = createClient();

  const inserts = rows.map((r) => ({
    user_id: userId,
    household_id: householdId,
    account_id: r.account_id,
    category_id: r.category_id,
    type: r.type,
    amount: Math.abs(r.amount),
    description: r.merchant,
    merchant: r.merchant,
    notes: r.notes ?? null,
    is_refund: r.type === 'expense' && r.is_refund === true,
    occurred_at: r.occurred_at,
  }));

  const { error } = await supabase.from('transactions').insert(inserts);
  if (error) return { imported: 0, skipped: 0, error: error.message };

  revalidate();
  // Skipped count is 0 because the modal pre-filters duplicates before
  // calling this function. If the database fingerprint constraint rejects
  // any rows, the whole batch errors out rather than silent-skipping.
  return { imported: rows.length, skipped: 0 };
}
