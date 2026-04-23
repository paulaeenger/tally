// Target path in your repo: lib/data/types.ts (REPLACE existing file)

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'loan';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export interface Profile {
  id: string;
  full_name: string | null;
  currency: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  balance: number;
  currency: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  merchant: string | null;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  // Dedup fields (added by 20260422_transaction_dedup migration)
  external_id?: string | null;
  fingerprint?: string | null;
  // joined fields
  account?: Pick<Account, 'id' | 'name' | 'type'>;
  category?: Pick<Category, 'id' | 'name' | 'color'> | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  period: BudgetPeriod;
  created_at: string;
  updated_at: string;
  spent?: number;
  category?: Pick<Category, 'id' | 'name' | 'color'> | null;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  account_id: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}
