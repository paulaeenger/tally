// Target path: lib/utils/aggregations.ts (REPLACE existing)

import { format, parseISO, startOfMonth, endOfMonth, subMonths, isSameMonth } from 'date-fns';
import type { Transaction } from '@/lib/data/types';
import type { CashflowPoint } from '@/components/charts/cashflow-chart';
import type { CategorySlice } from '@/components/charts/category-donut';

/**
 * A transaction is a refund if its category is flagged as a refund.
 */
function isRefund(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.category?.is_refund === true;
}

/**
 * 6-month cashflow chart. Always relative to "now" — this is the trend
 * view, not a per-month view.
 */
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

/**
 * Build category slices for a specific month. Defaults to current month.
 */
export function buildCategorySlices(
  transactions: Transaction[],
  forMonth?: Date
): { slices: CategorySlice[]; total: number } {
  const target = forMonth ?? new Date();
  const monthStart = startOfMonth(target);
  const monthEnd = endOfMonth(target);
  const totals = new Map<string, { value: number; color: string }>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (isRefund(tx)) continue;
    const d = parseISO(tx.occurred_at);
    if (d < monthStart || d > monthEnd) continue;
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
 * Returns income, net expense (expenses minus refunds), refund, and net.
 * If `forMonth` is provided, sums only transactions in that month.
 * If `since` is provided (legacy single-arg form), sums everything after.
 *
 * Two argument forms supported for backwards compatibility:
 *   sumByType(txs)              - all transactions
 *   sumByType(txs, monthStart)  - transactions from monthStart onward
 *   sumByType(txs, { for: d })  - transactions in the month of d
 */
export function sumByType(
  transactions: Transaction[],
  range?: Date | { for: Date }
): { income: number; expense: number; net: number; refund: number } {
  let start: Date | null = null;
  let end: Date | null = null;

  if (range instanceof Date) {
    start = range;
  } else if (range && 'for' in range) {
    start = startOfMonth(range.for);
    end = endOfMonth(range.for);
  }

  let income = 0;
  let expense = 0;
  let refund = 0;
  for (const tx of transactions) {
    const d = parseISO(tx.occurred_at);
    if (start && d < start) continue;
    if (end && d > end) continue;
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
