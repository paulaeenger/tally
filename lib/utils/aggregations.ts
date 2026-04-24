// Target path: lib/utils/aggregations.ts (REPLACE existing file)

import { format, parseISO, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import type { Transaction } from '@/lib/data/types';
import type { CashflowPoint } from '@/components/charts/cashflow-chart';
import type { CategorySlice } from '@/components/charts/category-donut';

/**
 * A transaction is a refund if its category is flagged as a refund category
 * (e.g., "Refunds", "Returns", "Reimbursements"). Refunds are expense-type
 * transactions that REDUCE net spending rather than counting as income.
 */
function isRefund(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.category?.is_refund === true;
}

export function buildCashflow(transactions: Transaction[], months = 6): CashflowPoint[] {
  const now = new Date();
  const result: CashflowPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const label = format(monthStart, 'MMM');

    let income = 0;
    let expense = 0;
    let refund = 0;

    for (const tx of transactions) {
      const d = parseISO(tx.occurred_at);
      if (!isSameMonth(d, monthStart)) continue;
      if (tx.type === 'income') {
        income += Number(tx.amount);
      } else if (tx.type === 'expense') {
        if (isRefund(tx)) {
          refund += Number(tx.amount);
        } else {
          expense += Number(tx.amount);
        }
      }
    }

    // Refunds reduce the expense bar. Net is income minus actual (net) spending.
    const netExpense = Math.max(0, expense - refund);
    result.push({
      date: label,
      income,
      expense: netExpense,
      net: income - netExpense,
    });
  }

  return result;
}

export function buildCategorySlices(transactions: Transaction[]): {
  slices: CategorySlice[];
  total: number;
} {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const totals = new Map<string, { value: number; color: string }>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    // Refunds don't appear in the category donut — they'd show as inverse
    // slices which is confusing. The "Spending MTD" number already reflects
    // them at the top level.
    if (isRefund(tx)) continue;
    if (parseISO(tx.occurred_at) < monthStart) continue;
    const name = tx.category?.name ?? 'Uncategorized';
    const color = tx.category?.color ?? '#9c9891';
    const existing = totals.get(name);
    if (existing) {
      existing.value += Number(tx.amount);
    } else {
      totals.set(name, { value: Number(tx.amount), color });
    }
  }

  const slices = Array.from(totals.entries())
    .map(([name, { value, color }]) => ({ name, value, color }))
    .sort((a, b) => b.value - a.value);

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return { slices, total };
}

/**
 * Returns income, net expense (expenses minus refunds), and refund totals
 * for a given date range. The dashboard uses `expense` as the "Spending MTD"
 * figure — which is net of refunds.
 */
export function sumByType(
  transactions: Transaction[],
  within?: Date
): { income: number; expense: number; net: number; refund: number } {
  let income = 0;
  let expense = 0;
  let refund = 0;
  for (const tx of transactions) {
    if (within && parseISO(tx.occurred_at) < within) continue;
    if (tx.type === 'income') {
      income += Number(tx.amount);
    } else if (tx.type === 'expense') {
      if (isRefund(tx)) {
        refund += Number(tx.amount);
      } else {
        expense += Number(tx.amount);
      }
    }
  }
  const netExpense = Math.max(0, expense - refund);
  return {
    income,
    expense: netExpense,
    net: income - netExpense,
    refund,
  };
}
