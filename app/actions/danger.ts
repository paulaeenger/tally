// Target path: app/actions/danger.ts (NEW FILE)
//
// Destructive operations for the Settings "Danger Zone." Both are protected
// behind a confirmation text match in the UI, but we do NOT rely on that
// alone — each action double-checks auth and household membership.
//
// Scope: these operate on the CURRENT HOUSEHOLD, not just the current user.
// That means when Paul and Hayley share a household, either one deleting
// wipes the shared data. UI copy must make this clear.

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';

/**
 * Delete every transaction in the current household.
 * Accounts, budgets, goals, categories, merchant rules are preserved.
 * Useful for starting fresh with a clean CSV import.
 */
export async function deleteAllTransactions(): Promise<{
  deleted?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  // Count before delete so we can report to the user
  const { count: beforeCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('household_id', householdId);

  if (error) return { error: error.message };

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  revalidatePath('/budgets');
  revalidatePath('/goals');

  return { deleted: beforeCount ?? 0 };
}

/**
 * Delete all transactional data in the current household:
 *   - transactions
 *   - accounts
 *   - budgets
 *   - goals
 *   - categories
 *   - merchant rules
 *
 * Does NOT delete: the household itself, household members, user accounts,
 * profiles. Those are relationship data and destroying them breaks the
 * multi-user setup.
 */
export async function wipeAllHouseholdData(): Promise<{
  error?: string;
  summary?: {
    transactions: number;
    accounts: number;
    budgets: number;
    goals: number;
    categories: number;
    rules: number;
  };
}> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  // Count everything before deleting for the summary
  const counts = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
    supabase.from('budgets').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
    supabase.from('goals').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
    supabase.from('categories').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
    supabase.from('merchant_rules').select('*', { count: 'exact', head: true }).eq('household_id', householdId),
  ]);

  const summary = {
    transactions: counts[0].count ?? 0,
    accounts: counts[1].count ?? 0,
    budgets: counts[2].count ?? 0,
    goals: counts[3].count ?? 0,
    categories: counts[4].count ?? 0,
    rules: counts[5].count ?? 0,
  };

  // Delete in order — transactions first because they reference accounts and
  // categories. Then budgets/goals (both reference categories and accounts).
  // Then accounts and categories (top-level data).

  const deletes = await Promise.all([
    supabase.from('transactions').delete().eq('household_id', householdId),
    supabase.from('budgets').delete().eq('household_id', householdId),
    supabase.from('goals').delete().eq('household_id', householdId),
    supabase.from('merchant_rules').delete().eq('household_id', householdId),
  ]);

  for (const d of deletes) {
    if (d.error) return { error: d.error.message };
  }

  // Accounts and categories last (nothing references them anymore)
  const accountsDel = await supabase.from('accounts').delete().eq('household_id', householdId);
  if (accountsDel.error) return { error: accountsDel.error.message };

  const categoriesDel = await supabase.from('categories').delete().eq('household_id', householdId);
  if (categoriesDel.error) return { error: categoriesDel.error.message };

  revalidatePath('/', 'layout');

  return { summary };
}
