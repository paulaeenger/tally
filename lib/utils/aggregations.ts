import { format, parseISO, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import type { Transaction } from '@/lib/data/types';
import type { CashflowPoint } from '@/components/charts/cashflow-chart';
import type { CategorySlice } from '@/components/charts/category-donut';

export function buildCashflow(transactions: Transaction[], months = 6): CashflowPoint[] {
  const now = new Date();
  const result: CashflowPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const label = format(monthStart, 'MMM');

    let income = 0;
    let expense = 0;

    for (const tx of transactions) {
      const d = parseISO(tx.occurred_at);
      if (!isSameMonth(d, monthStart)) continue;
      if (tx.type === 'income') income += Number(tx.amount);
      else if (tx.type === 'expense') expense += Number(tx.amount);
    }

    result.push({ date: label, income, expense, net: income - expense });
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

export function sumByType(transactions: Transaction[], within?: Date) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (within && parseISO(tx.occurred_at) < within) continue;
    if (tx.type === 'income') income += Number(tx.amount);
    else if (tx.type === 'expense') expense += Number(tx.amount);
  }
  return { income, expense, net: income - expense };
}
