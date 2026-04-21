'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search } from 'lucide-react';
import { TransactionRow } from '@/components/ui/transaction-row';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatCurrency } from '@/lib/utils/cn';
import type { Transaction } from '@/lib/data/types';

type Filter = 'all' | 'income' | 'expense' | 'transfer';

interface Props {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter !== 'all' && tx.type !== filter) return false;
      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.merchant?.toLowerCase().includes(q) ?? false) ||
        (tx.category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, query, filter]);

  // group by day
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const key = format(parseISO(tx.occurred_at), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totalSpent = filtered
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'expense', label: 'Expenses' },
    { key: 'income', label: 'Income' },
    { key: 'transfer', label: 'Transfers' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            size={15}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="text"
            placeholder="Search merchants, categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle/60 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.key
                  ? 'bg-surface text-foreground shadow-subtle'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <span>
          {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
        </span>
        <span className="tabular">
          Total spent: <span className="text-foreground">{formatCurrency(totalSpent)}</span>
        </span>
      </div>

      {/* List grouped by day */}
      {groups.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different search or filter."
        />
      ) : (
        <div className="card overflow-hidden">
          {groups.map(([date, txs], idx) => (
            <div key={date} className={idx > 0 ? 'border-t border-border' : ''}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-2 backdrop-blur-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-faint">
                  {format(parseISO(date), 'EEEE, MMM d')}
                </span>
                <span className="text-xs tabular text-faint">
                  {txs.length} {txs.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="px-5">
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
