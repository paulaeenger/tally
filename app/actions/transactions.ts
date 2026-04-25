'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/data/queries';
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

  const supabase = createClient();

  const type = formData.get('type') as TransactionType | null;
  const amountRaw = formData.get('amount') as string | null;
  const merchant = (formData.get('merchant') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  const accountId = formData.get('account_id') as string | null;
  const categoryId = (formData.get('category_id') as string | null) || null;
  const occurredAt = formData.get('occurred_at') as string | null;

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
    account_id: accountId,
    category_id: categoryId,
    type,
    amount,
    description,
    merchant,
    notes: notes || null,
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

  const supabase = createClient();

  const inserts = rows.map((r) => ({
    user_id: userId,
    account_id: r.account_id,
    category_id: r.category_id,
    type: r.type,
    amount: Math.abs(r.amount),
    description: r.merchant,
    merchant: r.merchant,
    notes: r.notes ?? null,
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
