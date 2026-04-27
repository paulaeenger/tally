// Target path in your repo: lib/data/queries.ts (REPLACE existing file)
//
// All queries now filter by household_id instead of user_id. Users see the
// data of whichever household they most recently joined.
//
// With RLS enabled in the migration, these filters are actually redundant —
// Postgres would refuse to return other households' rows even without the
// WHERE clause. We keep the filter explicit for clarity and so the code
// is safe even if someone accidentally disables RLS.

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

/**
 * Returns the current user's household_id — the household they most recently
 * joined. Used by every data query.
 */
export async function getCurrentHouseholdId(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.household_id;
}

/**
 * Returns the current household's info (for display in settings / header).
 */
export async function getCurrentHousehold() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', householdId)
    .single();

  return data;
}

/**
 * Returns all members of the current household (for the settings page).
 */
export async function getHouseholdMembers() {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });

  return data ?? [];
}

// ---------- Accounts ----------
export async function getAccounts(): Promise<Account[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleAccounts;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  if (error || !data) return sampleAccounts;
  return data as Account[];
}

// ---------- Categories ----------
export async function getCategories(): Promise<Category[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleCategories;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  if (error || !data) return sampleCategories;
  return data as Category[];
}

// ---------- Transactions ----------
export async function getTransactions(limit = 100): Promise<Transaction[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleTransactions.slice(0, limit);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `*,
       account:accounts(id, name, type),
       category:categories(id, name, color, is_refund)`
    )
    .eq('household_id', householdId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error || !data) return sampleTransactions.slice(0, limit);
  return data as unknown as Transaction[];
}

/**
 * Fetch transactions occurring in or after the given date.
 * Used by the dashboard to show historical months.
 *
 * No upper bound, no limit — returns everything from `since` onward.
 * Caller is responsible for filtering to a specific month if needed.
 */
export async function getTransactionsSince(since: Date): Promise<Transaction[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleTransactions;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `*,
       account:accounts(id, name, type),
       category:categories(id, name, color, is_refund)`
    )
    .eq('household_id', householdId)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false });

  if (error || !data) return sampleTransactions;
  return data as unknown as Transaction[];
}

// ---------- Budgets ----------
export async function getBudgets(forMonth?: Date): Promise<Budget[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleBudgets;

  const supabase = createClient();
  const { data: budgetsData, error } = await supabase
    .from('budgets')
    .select(`*, category:categories(id, name, color, is_refund)`)
    .eq('household_id', householdId);

  if (error || !budgetsData) return sampleBudgets;

  const budgets = budgetsData as unknown as Budget[];
  if (budgets.length === 0) return budgets;

  // Use the provided month for budget calculations if given, else "now"
  const now = forMonth ?? new Date();
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

  // For monthly budgets viewed historically, also bound the END date
  const periodEndFor = (period: Budget['period'], start: Date): Date => {
    const d = new Date(start);
    if (period === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else if (period === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (period === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    }
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
    .eq('household_id', householdId)
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
    const bEnd = periodEndFor(b.period, bStart);
    let spent = 0;
    for (const t of transactions) {
      if (t.category_id !== b.category_id) continue;
      const tDate = new Date(t.occurred_at);
      if (tDate < bStart || tDate >= bEnd) continue;
      spent += Number(t.amount);
    }
    b.spent = spent;
  }

  return budgets;
}

// ---------- Goals ----------
export async function getGoals(): Promise<Goal[]> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return sampleGoals;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('household_id', householdId)
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

/**
 * A lightweight transaction record returned for probable-match detection.
 * Just enough fields for the client to run fuzzy comparison.
 */
export interface DupCandidate {
  occurred_at: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  type: 'income' | 'expense' | 'transfer';
}

export async function findExistingFingerprints(params: {
  accountId: string;
  fromDate: string;
  toDate: string;
  externalIds: string[];
  fingerprints: string[];
}): Promise<{
  externalIds: Set<string>;
  fingerprints: Set<string>;
  candidates: DupCandidate[];
}> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return { externalIds: new Set(), fingerprints: new Set(), candidates: [] };
  }

  const supabase = createClient();

  const result = {
    externalIds: new Set<string>(),
    fingerprints: new Set<string>(),
    candidates: [] as DupCandidate[],
  };

  if (params.externalIds.length > 0) {
    const { data } = await supabase
      .from('transactions')
      .select('external_id')
      .eq('household_id', householdId)
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
      .eq('household_id', householdId)
      .gte('occurred_at', params.fromDate)
      .lte('occurred_at', params.toDate)
      .in('fingerprint', params.fingerprints);

    for (const row of data ?? []) {
      if (row.fingerprint) result.fingerprints.add(row.fingerprint);
    }
  }

  // Fetch candidates for probable-duplicate detection. We pull all
  // transactions within the import date range plus a 60-day buffer
  // on each side to catch pending/settled timing shifts and recurring
  // payments imported from a previous month's statement.
  // The client runs the actual fuzzy matching locally to keep this
  // query simple.
  const fromDate = new Date(params.fromDate);
  fromDate.setDate(fromDate.getDate() - 60);
  const toDate = new Date(params.toDate);
  toDate.setDate(toDate.getDate() + 60);

  const { data: candidatesData } = await supabase
    .from('transactions')
    .select('occurred_at, amount, merchant, description, type')
    .eq('household_id', householdId)
    .gte('occurred_at', fromDate.toISOString())
    .lte('occurred_at', toDate.toISOString())
    .limit(2000); // cap to avoid runaway queries; 2000 is generous

  if (candidatesData) {
    result.candidates = candidatesData.map((c) => ({
      occurred_at: c.occurred_at,
      amount: Number(c.amount),
      merchant: c.merchant,
      description: c.description,
      type: c.type,
    }));
  }

  return result;
}
