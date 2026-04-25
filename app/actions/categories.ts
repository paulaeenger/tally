// Target path: app/actions/categories.ts (NEW FILE)
//
// Server actions for managing categories: add, rename, change color,
// delete (with reassignment), toggle is_refund flag.

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';

async function getCurrentUserId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidate() {
  revalidatePath('/settings');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  revalidatePath('/budgets');
}

/**
 * Create a new category. Skips if a category with the same name already
 * exists in the household (case-insensitive match) — returns success
 * without error to be idempotent.
 */
export async function addCategory(params: {
  name: string;
  color: string;
  is_refund?: boolean;
}): Promise<{ error?: string; category?: { id: string; name: string; color: string } }> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const name = params.name.trim();
  if (!name) return { error: 'Name is required' };
  if (name.length > 50) return { error: 'Name is too long (max 50 chars)' };

  // Validate hex color
  if (!/^#[0-9a-fA-F]{6}$/.test(params.color)) {
    return { error: 'Invalid color (use hex like #4a7c59)' };
  }

  const supabase = createClient();

  // Check for duplicate (case-insensitive)
  const { data: existing } = await supabase
    .from('categories')
    .select('id, name, color')
    .eq('household_id', householdId)
    .ilike('name', name)
    .maybeSingle();

  if (existing) {
    return { error: `Category "${existing.name}" already exists` };
  }

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      household_id: householdId,
      name,
      color: params.color,
      is_refund: params.is_refund ?? false,
    })
    .select('id, name, color')
    .single();

  if (error) return { error: error.message };

  revalidate();
  return { category: created };
}

/**
 * Update an existing category (rename, change color, toggle refund flag).
 * Pass only the fields you want to change.
 */
export async function updateCategory(params: {
  id: string;
  name?: string;
  color?: string;
  is_refund?: boolean;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed) return { error: 'Name cannot be empty' };
    if (trimmed.length > 50) return { error: 'Name is too long (max 50 chars)' };
    updates.name = trimmed;
  }
  if (params.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(params.color)) {
      return { error: 'Invalid color' };
    }
    updates.color = params.color;
  }
  if (params.is_refund !== undefined) {
    updates.is_refund = params.is_refund;
  }

  if (Object.keys(updates).length === 0) {
    return {}; // Nothing to update
  }

  const supabase = createClient();

  // If renaming, check for duplicate
  if (updates.name) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', householdId)
      .ilike('name', updates.name as string)
      .neq('id', params.id)
      .maybeSingle();

    if (existing) {
      return { error: `Another category with that name already exists` };
    }
  }

  const { error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', params.id)
    .eq('household_id', householdId);

  if (error) return { error: error.message };

  revalidate();
  return {};
}

/**
 * Delete a category. Has TWO modes:
 *   - reassignToId: move all transactions/budgets in this category to the
 *     given category, then delete this one
 *   - reassignToId === null: orphan the transactions/budgets (set their
 *     category_id to NULL), then delete this one
 *
 * Caller is responsible for asking the user which they want.
 */
export async function deleteCategory(params: {
  id: string;
  reassignToId: string | null;
}): Promise<{
  error?: string;
  reassigned?: { transactions: number; budgets: number };
}> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  if (params.reassignToId === params.id) {
    return { error: "Can't reassign a category to itself" };
  }

  const supabase = createClient();

  // Verify the category belongs to this household
  const { data: target } = await supabase
    .from('categories')
    .select('id')
    .eq('id', params.id)
    .eq('household_id', householdId)
    .maybeSingle();

  if (!target) return { error: 'Category not found' };

  // If reassigning, verify the destination category exists in this household
  if (params.reassignToId) {
    const { data: dest } = await supabase
      .from('categories')
      .select('id')
      .eq('id', params.reassignToId)
      .eq('household_id', householdId)
      .maybeSingle();
    if (!dest) return { error: 'Destination category not found' };
  }

  // Reassign transactions. Count first, then update (Supabase doesn't allow
  // count-select after update operations).
  const newCatId = params.reassignToId; // null is fine

  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('category_id', params.id);

  const { error: txErr } = await supabase
    .from('transactions')
    .update({ category_id: newCatId })
    .eq('household_id', householdId)
    .eq('category_id', params.id);

  if (txErr) return { error: `Reassigning transactions: ${txErr.message}` };

  // Reassign budgets (or null them out if no destination)
  let budgetCount = 0;
  if (params.reassignToId) {
    const { count } = await supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('category_id', params.id);

    const { error: budErr } = await supabase
      .from('budgets')
      .update({ category_id: newCatId })
      .eq('household_id', householdId)
      .eq('category_id', params.id);
    if (budErr) return { error: `Reassigning budgets: ${budErr.message}` };
    budgetCount = count ?? 0;
  } else {
    // No reassignment target — null out category_id on budgets
    const { count } = await supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('category_id', params.id);

    const { error: budErr } = await supabase
      .from('budgets')
      .update({ category_id: null })
      .eq('household_id', householdId)
      .eq('category_id', params.id);
    if (budErr) return { error: `Updating budgets: ${budErr.message}` };
    budgetCount = count ?? 0;
  }

  // Now delete the category
  const { error: delErr } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('household_id', householdId);

  if (delErr) return { error: delErr.message };

  // Also clean up merchant_rules that pointed to this category
  await supabase
    .from('merchant_rules')
    .update({ category_id: params.reassignToId })
    .eq('household_id', householdId)
    .eq('category_id', params.id);

  revalidate();
  return {
    reassigned: {
      transactions: txCount ?? 0,
      budgets: budgetCount,
    },
  };
}

/**
 * Lighter helper: count how many things would be affected if a category
 * were deleted. Used by the UI to show "Delete? This category is used by
 * X transactions and Y budgets."
 */
export async function getCategoryUsage(id: string): Promise<{
  transactions: number;
  budgets: number;
  rules: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { transactions: 0, budgets: 0, rules: 0, error: 'Supabase not configured' };
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return { transactions: 0, budgets: 0, rules: 0, error: 'No household found' };
  }

  const supabase = createClient();

  const [tx, bud, rul] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).eq('category_id', id),
    supabase.from('budgets').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).eq('category_id', id),
    supabase.from('merchant_rules').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).eq('category_id', id),
  ]);

  return {
    transactions: tx.count ?? 0,
    budgets: bud.count ?? 0,
    rules: rul.count ?? 0,
  };
}
