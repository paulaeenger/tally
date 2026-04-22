'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/data/queries';
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
): Promise<{ imported: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { imported: 0, error: 'Not signed in' };
  if (rows.length === 0) return { imported: 0, error: 'No rows to import' };
  if (rows.length > 1000) {
    return { imported: 0, error: 'Too many rows — limit is 1000 per import' };
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
  if (error) return { imported: 0, error: error.message };

  revalidate();
  return { imported: rows.length };
}
