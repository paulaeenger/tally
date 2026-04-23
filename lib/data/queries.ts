// Target path in your repo: lib/data/queries.ts (REPLACE existing file)

import { createClient } from '@/lib/supabase/server';
import {
  sampleAccounts,
  sampleBudgets,
  sampleCategories,
  sampleGoals,
  sampleTransactions,
} from './sample';
import type { Account, Budget, Category, Goal, Transaction } from './types';

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
// Previous implementation ran one SELECT per budget (N+1 problem).
// Rewritten to fetch all current-period expenses in a single query,
// then group in memory.
export async function getBudgets(): Promise<Budget[]> {
  const userId = await getUserId();
  if (!userId) return sampleBudgets;

  const supabase = createClient();
  const { data: budgetsData, error } = await supabase
    .from('budgets')
    .select(`*, category:categories(id, name, color)`)
    .eq('user_id', userId);

  if (error || !budgetsData) return sampleBudgets;

  const budgets = budgetsData as unknown as Budget[];
  if (budgets.length === 0) return budgets;

  const now = new Date();
  const periodStartFor = (period: Budget['period']): Date => {
    const d = new Date(now);
    if (period === 'monthly') d.setDate(1);
    else if (period === 'weekly') d.setDate(now.getDate() - now.getDay());
    else if (period === 'yearly') {
      d.setMonth(0);
      d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const periodStarts = budgets.map((b) => periodStartFor(b.period));
  const earliestStart = periodStarts.reduce((min, d) => (d < min ? d : min));
  const categoryIds = Array.from(
    new Set(budgets.map((b) => b.category_id).filter((id): id is string => !!id))
  );

  if (categoryIds.length === 0) {
    for (const b of budgets) b.spent = 0;
    return budgets;
  }

  const { data: txData } = await supabase
    .from('transactions')
    .select('amount, category_id, occurred_at')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .in('category_id', categoryIds)
    .gte('occurred_at', earliestStart.toISOString());

  const transactions = (txData ?? []) as {
    amount: number;
    category_id: string;
    occurred_at: string;
  }[];

  for (let i = 0; i < budgets.length; i++) {
    const b = budgets[i];
    if (!b.category_id) {
      b.spent = 0;
      continue;
    }
    const bStart = periodStarts[i];
    let spent = 0;
    for (const t of transactions) {
      if (t.category_id !== b.category_id) continue;
      if (new Date(t.occurred_at) < bStart) continue;
      spent += Number(t.amount);
    }
    b.spent = spent;
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

// ---------- CSV import: duplicate detection ----------
// Belt-and-suspenders pairing with the DB unique indexes: we pre-flag likely
// duplicates in the CSV preview, but the DB enforces uniqueness regardless
// of whether the UI catches them first.
export async function findExistingFingerprints(params: {
  accountId: string;
  fromDate: string;
  toDate: string;
  externalIds: string[];
  fingerprints: string[];
}): Promise<{ externalIds: Set<string>; fingerprints: Set<string> }> {
  const userId = await getUserId();
  if (!userId) return { externalIds: new Set(), fingerprints: new Set() };

  const supabase = createClient();

  const result = {
    externalIds: new Set<string>(),
    fingerprints: new Set<string>(),
  };

  if (params.externalIds.length > 0) {
    const { data } = await supabase
      .from('transactions')
      .select('external_id')
      .eq('user_id', userId)
      .eq('account_id', params.accountId)
      .in('external_id', params.externalIds);

    for (const row of data ?? []) {
      if (row.external_id) result.externalIds.add(row.external_id);
    }
  }

  if (params.fingerprints.length > 0) {
    const { data } = await supabase
      .from('transactions')
      .select('fingerprint')
      .eq('user_id', userId)
      .gte('occurred_at', params.fromDate)
      .lte('occurred_at', params.toDate)
      .in('fingerprint', params.fingerprints);

    for (const row of data ?? []) {
      if (row.fingerprint) result.fingerprints.add(row.fingerprint);
    }
  }

  return result;
}
