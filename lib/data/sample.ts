import type { Account, Budget, Category, Goal, Transaction } from './types';

const userId = 'sample-user';
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

export const sampleAccounts: Account[] = [
  {
    id: 'a1', user_id: userId, name: 'Everyday Checking', type: 'checking',
    institution: 'First National', balance: 4284.52, currency: 'USD',
    is_archived: false, created_at: daysAgo(365), updated_at: daysAgo(1),
  },
  {
    id: 'a2', user_id: userId, name: 'High-Yield Savings', type: 'savings',
    institution: 'Marcus', balance: 18920.10, currency: 'USD',
    is_archived: false, created_at: daysAgo(365), updated_at: daysAgo(3),
  },
  {
    id: 'a3', user_id: userId, name: 'Sapphire Preferred', type: 'credit',
    institution: 'Chase', balance: -1247.89, currency: 'USD',
    is_archived: false, created_at: daysAgo(180), updated_at: daysAgo(1),
  },
  {
    id: 'a4', user_id: userId, name: 'Brokerage', type: 'investment',
    institution: 'Fidelity', balance: 42380.00, currency: 'USD',
    is_archived: false, created_at: daysAgo(500), updated_at: daysAgo(1),
  },
];

export const sampleCategories: Category[] = [
  { id: 'c1', user_id: userId, name: 'Groceries', color: '#4a7c59', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c2', user_id: userId, name: 'Dining', color: '#c45a3d', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c3', user_id: userId, name: 'Transport', color: '#3d5a80', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c4', user_id: userId, name: 'Shopping', color: '#7d5ba6', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c5', user_id: userId, name: 'Utilities', color: '#8b7355', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c6', user_id: userId, name: 'Entertainment', color: '#a64d79', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c7', user_id: userId, name: 'Health', color: '#2d6a6a', icon: null, parent_id: null, created_at: daysAgo(365) },
  { id: 'c8', user_id: userId, name: 'Income', color: '#15803d', icon: null, parent_id: null, created_at: daysAgo(365) },
];

const mk = (
  id: string,
  accountId: string,
  categoryId: string | null,
  type: Transaction['type'],
  amount: number,
  description: string,
  merchant: string,
  daysBack: number,
): Transaction => ({
  id, user_id: userId, account_id: accountId, category_id: categoryId,
  type, amount, description, merchant, notes: null,
  occurred_at: daysAgo(daysBack), created_at: daysAgo(daysBack),
  account: sampleAccounts.find(a => a.id === accountId),
  category: sampleCategories.find(c => c.id === categoryId) ?? null,
});

export const sampleTransactions: Transaction[] = [
  mk('t1', 'a1', 'c8', 'income', 4850.00, 'Payroll', 'Acme Corp', 2),
  mk('t2', 'a1', 'c1', 'expense', 87.42, 'Weekly groceries', 'Whole Foods', 2),
  mk('t3', 'a3', 'c2', 'expense', 48.20, 'Dinner', 'Sushi Sho', 3),
  mk('t4', 'a1', 'c5', 'expense', 124.00, 'Electric bill', 'ConEd', 4),
  mk('t5', 'a3', 'c4', 'expense', 189.99, 'New jacket', 'Uniqlo', 5),
  mk('t6', 'a1', 'c3', 'expense', 32.50, 'Gas', 'Shell', 6),
  mk('t7', 'a3', 'c2', 'expense', 22.75, 'Coffee & pastry', 'Blue Bottle', 6),
  mk('t8', 'a1', 'c6', 'expense', 15.99, 'Streaming', 'Netflix', 7),
  mk('t9', 'a1', 'c1', 'expense', 64.20, 'Groceries', 'Trader Joe\'s', 9),
  mk('t10', 'a1', 'c7', 'expense', 75.00, 'Pharmacy', 'CVS', 10),
  mk('t11', 'a3', 'c2', 'expense', 112.40, 'Dinner with friends', 'Via Carota', 11),
  mk('t12', 'a1', 'c3', 'expense', 18.75, 'Rideshare', 'Uber', 12),
  mk('t13', 'a2', null, 'transfer', 500.00, 'Monthly savings', 'Transfer from Checking', 14),
  mk('t14', 'a1', 'c1', 'expense', 92.18, 'Groceries', 'Whole Foods', 16),
  mk('t15', 'a3', 'c4', 'expense', 45.00, 'Bookstore', 'Strand', 18),
  mk('t16', 'a1', 'c5', 'expense', 89.00, 'Internet', 'Verizon Fios', 20),
  mk('t17', 'a1', 'c8', 'income', 4850.00, 'Payroll', 'Acme Corp', 16),
  mk('t18', 'a1', 'c2', 'expense', 28.50, 'Lunch', 'Sweetgreen', 22),
  mk('t19', 'a3', 'c6', 'expense', 42.00, 'Concert tickets', 'Bowery Ballroom', 24),
  mk('t20', 'a1', 'c1', 'expense', 71.33, 'Groceries', 'Trader Joe\'s', 25),
];

export const sampleBudgets: Budget[] = [
  { id: 'b1', user_id: userId, category_id: 'c1', name: 'Groceries', amount: 500, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 315.13, category: sampleCategories[0] },
  { id: 'b2', user_id: userId, category_id: 'c2', name: 'Dining', amount: 300, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 211.85, category: sampleCategories[1] },
  { id: 'b3', user_id: userId, category_id: 'c3', name: 'Transport', amount: 200, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 51.25, category: sampleCategories[2] },
  { id: 'b4', user_id: userId, category_id: 'c4', name: 'Shopping', amount: 250, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 234.99, category: sampleCategories[3] },
  { id: 'b5', user_id: userId, category_id: 'c5', name: 'Utilities', amount: 250, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 213.00, category: sampleCategories[4] },
  { id: 'b6', user_id: userId, category_id: 'c6', name: 'Entertainment', amount: 150, period: 'monthly', created_at: daysAgo(30), updated_at: daysAgo(1), spent: 57.99, category: sampleCategories[5] },
];

export const sampleGoals: Goal[] = [
  { id: 'g1', user_id: userId, name: 'Emergency Fund', target_amount: 25000, current_amount: 18920, target_date: '2026-12-31', account_id: 'a2', color: '#2d6a6a', created_at: daysAgo(200), updated_at: daysAgo(1) },
  { id: 'g2', user_id: userId, name: 'Japan Trip', target_amount: 6000, current_amount: 2400, target_date: '2026-10-01', account_id: null, color: '#c45a3d', created_at: daysAgo(90), updated_at: daysAgo(1) },
  { id: 'g3', user_id: userId, name: 'New Laptop', target_amount: 3500, current_amount: 1200, target_date: '2026-08-15', account_id: null, color: '#3d5a80', created_at: daysAgo(60), updated_at: daysAgo(1) },
  { id: 'g4', user_id: userId, name: 'Down Payment', target_amount: 80000, current_amount: 22500, target_date: '2028-06-01', account_id: null, color: '#7d5ba6', created_at: daysAgo(400), updated_at: daysAgo(1) },
];
