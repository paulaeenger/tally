import { createClient } from '@/lib/supabase/server';
import {
  sampleAccounts,
  sampleBudgets,
  sampleCategories,
  sampleGoals,
  sampleTransactions,
} from './sample';
import type { Account, Budget, Category, Goal, Transaction } from './types';

/**
 * Returns true when Supabase env vars are configured. When false, pages fall
 * back to sample data so the UI is always viewable in development.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------- Accounts ----------
export async function getAccounts(): Promise<Account[]> {
  const userId = await getUserId();
  if (!userId) return sampleAccounts;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  if (error || !data) return sampleAccounts;
  return data as Account[];
}

// ---------- Categories ----------
export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  if (!userId) return sampleCategories;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error || !data) return sampleCategories;
  return data as Category[];
}

// ---------- Transactions ----------
export async function getTransactions(limit = 100): Promise<Transaction[]> {
  const userId = await getUserId();
  if (!userId) return sampleTransactions.slice(0, limit);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `*,
       account:accounts(id, name, type),
       category:categories(id, name, color)`
    )
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error || !data) return sampleTransactions.slice(0, limit);
  return data as unknown as Transaction[];
}

// ---------- Budgets ----------
export async function getBudgets(): Promise<Budget[]> {
  const userId = await getUserId();
  if (!userId) return sampleBudgets;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('budgets')
    .select(`*, category:categories(id, name, color)`)
    .eq('user_id', userId);

  if (error || !data) return sampleBudgets;

  // Compute spent amounts for current period
  const now = new Date();
  const budgets = data as unknown as Budget[];

  for (const b of budgets) {
    if (!b.category_id) {
      b.spent = 0;
      continue;
    }
    const periodStart = new Date(now);
    if (b.period === 'monthly') periodStart.setDate(1);
    else if (b.period === 'weekly') periodStart.setDate(now.getDate() - now.getDay());
    else if (b.period === 'yearly') {
      periodStart.setMonth(0);
      periodStart.setDate(1);
    }
    periodStart.setHours(0, 0, 0, 0);

    const { data: txData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', b.category_id)
      .eq('type', 'expense')
      .gte('occurred_at', periodStart.toISOString());

    b.spent = (txData ?? []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
  }

  return budgets;
}

// ---------- Goals ----------
export async function getGoals(): Promise<Goal[]> {
  const userId = await getUserId();
  if (!userId) return sampleGoals;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) return sampleGoals;
  return data as Goal[];
}

// ---------- Profile ----------
export async function getProfile() {
  const userId = await getUserId();
  if (!userId) {
    return { id: 'sample', full_name: 'Demo User', currency: 'USD', avatar_url: null };
  }
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}
