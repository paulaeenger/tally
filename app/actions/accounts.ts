// Target path in your repo: app/actions/accounts.ts (REPLACE existing file)

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', color: '#4a7c59' },
  { name: 'Dining', color: '#c45a3d' },
  { name: 'Transport', color: '#3d5a80' },
  { name: 'Shopping', color: '#7d5ba6' },
  { name: 'Utilities', color: '#8b7355' },
  { name: 'Entertainment', color: '#a64d79' },
  { name: 'Health', color: '#2d6a6a' },
  { name: 'Housing', color: '#6b6863' },
  { name: 'Subscriptions', color: '#c89960' },
  { name: 'Travel', color: '#5f8ca8' },
  { name: 'Gifts', color: '#b57289' },
  { name: 'Income', color: '#15803d' },
  { name: 'Other', color: '#9c9891' },
];

/**
 * Ensure the current household has the default category set. Safe to call
 * repeatedly — categories are keyed by (household_id, name).
 */
export async function seedCategoriesIfNeeded() {
  if (!isSupabaseConfigured()) return { seeded: 0 };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { seeded: 0 };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { seeded: 0 };

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);

  if (existing && existing.length > 0) return { seeded: 0 };

  const rows = DEFAULT_CATEGORIES.map((c) => ({
    user_id: user.id,
    household_id: householdId,
    name: c.name,
    color: c.color,
  }));

  const { error } = await supabase.from('categories').insert(rows);
  if (error) {
    console.error('seedCategoriesIfNeeded error:', error);
    return { seeded: 0, error: error.message };
  }

  return { seeded: rows.length };
}

export interface CreateAccountInput {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'loan';
  institution?: string;
  balance: number;
}

export async function createAccount(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: 'Supabase is not configured' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const name = (formData.get('name') as string | null)?.trim();
  const type = formData.get('type') as CreateAccountInput['type'] | null;
  const institution = (formData.get('institution') as string | null)?.trim();
  const balanceRaw = formData.get('balance') as string | null;

  if (!name) return { error: 'Name is required' };
  if (!type) return { error: 'Account type is required' };
  const balance = Number(balanceRaw);
  if (!isFinite(balance)) return { error: 'Balance must be a number' };

  const signedBalance = type === 'credit' || type === 'loan' ? -Math.abs(balance) : balance;

  const { error } = await supabase.from('accounts').insert({
    user_id: user.id,
    household_id: householdId,
    name,
    type,
    institution: institution || null,
    balance: signedBalance,
    currency: 'USD',
  });

  if (error) return { error: error.message };

  await seedCategoriesIfNeeded();

  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateAccount(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: 'Supabase is not configured' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'Missing account id' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const name = (formData.get('name') as string | null)?.trim();
  const type = formData.get('type') as CreateAccountInput['type'] | null;
  const institution = (formData.get('institution') as string | null)?.trim();
  const balanceRaw = formData.get('balance') as string | null;

  if (!name) return { error: 'Name is required' };
  if (!type) return { error: 'Account type is required' };
  const balance = Number(balanceRaw);
  if (!isFinite(balance)) return { error: 'Balance must be a number' };

  const signedBalance = type === 'credit' || type === 'loan' ? -Math.abs(balance) : balance;

  // RLS handles authorization — user can only update rows in their household
  const { error } = await supabase
    .from('accounts')
    .update({
      name,
      type,
      institution: institution || null,
      balance: signedBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function archiveAccount(id: string) {
  if (!isSupabaseConfigured()) return { error: 'Supabase is not configured' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const { error } = await supabase
    .from('accounts')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  return { success: true };
}
