// Target path in your repo: app/actions/goals.ts (REPLACE existing file)

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getCurrentHouseholdId } from '@/lib/data/queries';

async function getCurrentUserId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidate() {
  revalidatePath('/goals');
  revalidatePath('/dashboard');
}

export async function createGoal(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: 'No household found' };

  const name = (formData.get('name') as string | null)?.trim();
  const targetRaw = formData.get('target_amount') as string | null;
  const currentRaw = formData.get('current_amount') as string | null;
  const targetDate = (formData.get('target_date') as string | null) || null;
  const color = (formData.get('color') as string | null) || '#1e293b';
  const accountId = (formData.get('account_id') as string | null) || null;

  if (!name) return { error: 'Name is required' };

  const target = Number(targetRaw);
  const current = Number(currentRaw ?? 0);

  if (!isFinite(target) || target < 0) return { error: 'Target amount must be zero or more' };
  if (!isFinite(current) || current < 0) return { error: 'Current amount must be zero or more' };

  const supabase = createClient();
  const { error } = await supabase.from('goals').insert({
    user_id: userId,
    household_id: householdId,
    name,
    target_amount: target,
    current_amount: current,
    target_date: targetDate,
    color,
    account_id: accountId,
  });

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function updateGoal(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const id = formData.get('id') as string | null;
  if (!id) return { error: 'Missing goal id' };

  const name = (formData.get('name') as string | null)?.trim();
  const targetRaw = formData.get('target_amount') as string | null;
  const currentRaw = formData.get('current_amount') as string | null;
  const targetDate = (formData.get('target_date') as string | null) || null;
  const color = (formData.get('color') as string | null) || '#1e293b';

  if (!name) return { error: 'Name is required' };

  const target = Number(targetRaw);
  const current = Number(currentRaw ?? 0);

  if (!isFinite(target) || target < 0) return { error: 'Target amount must be zero or more' };
  if (!isFinite(current) || current < 0) return { error: 'Current amount must be zero or more' };

  const supabase = createClient();
  const { error } = await supabase
    .from('goals')
    .update({
      name,
      target_amount: target,
      current_amount: current,
      target_date: targetDate,
      color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function deleteGoal(id: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };

  const supabase = createClient();
  const { error } = await supabase.from('goals').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function bumpGoalProgress(id: string, delta: number) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };
  if (!isFinite(delta)) return { error: 'Invalid amount' };

  const supabase = createClient();

  const { data: existing, error: readErr } = await supabase
    .from('goals')
    .select('current_amount')
    .eq('id', id)
    .single();

  if (readErr || !existing) return { error: 'Goal not found' };

  const nextAmount = Math.max(0, Number(existing.current_amount) + delta);

  const { error } = await supabase
    .from('goals')
    .update({
      current_amount: nextAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidate();
  return { success: true, newAmount: nextAmount };
}
