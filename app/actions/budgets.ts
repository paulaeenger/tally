// Target path in your repo: app/actions/budgets.ts (REPLACE existing file)

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';

type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

async function getCurrentUserId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidate() {
  revalidatePath('/budgets');
  revalidatePath('/dashboard');
}

export async function createBudget(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const name = (formData.get('name') as string | null)?.trim();
  const categoryId = formData.get('category_id') as string | null;
  const amountRaw = formData.get('amount') as string | null;
  const period = formData.get('period') as BudgetPeriod | null;

  if (!name) return { error: 'Name is required' };
  if (!categoryId) return { error: 'Category is required' };
  if (!period) return { error: 'Period is required' };
  if (!['monthly', 'yearly', 'weekly'].includes(period)) {
    return { error: 'Invalid period' };
  }

  const amount = Number(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than zero' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('budgets').insert({
    user_id: userId,
    household_id: householdId,
    name,
    category_id: categoryId,
    amount,
    period,
  });

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function updateBudget(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const id = formData.get('id') as string | null;
  if (!id) return { error: 'Missing budget id' };

  const name = (formData.get('name') as string | null)?.trim();
  const categoryId = formData.get('category_id') as string | null;
  const amountRaw = formData.get('amount') as string | null;
  const period = formData.get('period') as BudgetPeriod | null;

  if (!name) return { error: 'Name is required' };
  if (!categoryId) return { error: 'Category is required' };
  if (!period) return { error: 'Period is required' };

  const amount = Number(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return { error: 'Amount must be greater than zero' };
  }

  const supabase = createClient();
  // RLS handles authorization
  const { error } = await supabase
    .from('budgets')
    .update({
      name,
      category_id: categoryId,
      amount,
      period,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function deleteBudget(id: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const supabase = createClient();
  const { error } = await supabase.from('budgets').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}
