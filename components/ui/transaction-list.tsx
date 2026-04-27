// Target path: components/ui/transaction-list.tsx (REPLACE existing file)

'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  CheckSquare,
  Square,
  X,
  Tag,
  ArrowLeftRight,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { EditableTransactionRow } from '@/components/ui/transaction-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import {
  bulkUpdateTransactions,
  bulkDeleteTransactions,
} from '@/app/actions/transactions';
import { cn, formatCurrency } from '@/lib/utils/cn';
import type { Account, Category, Transaction, TransactionType } from '@/lib/data/types';

type Filter = 'all' | 'income' | 'expense' | 'transfer' | 'uncategorized';
type BulkAction = 'category' | 'type' | 'delete' | null;

interface Props {
  transactions: Transaction[];
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

export function TransactionList({ transactions, accounts, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven filters from clicking into a budget. These are sticky to the
  // URL — refresh-safe and shareable. The user can clear them via the
  // "Clear filter" pill that appears when any are active.
  const urlCategoryId = searchParams.get('category');
  const urlFromDate = searchParams.get('from'); // YYYY-MM-DD
  const urlToDate = searchParams.get('to');     // YYYY-MM-DD

  // Resolve the category name for the breadcrumb pill (if present)
  const urlCategoryName = useMemo(() => {
    if (!urlCategoryId) return null;
    const cat = categories.find((c) => c.id === urlCategoryId);
    return cat?.name ?? null;
  }, [urlCategoryId, categories]);

  const hasUrlFilter = !!(urlCategoryId || urlFromDate || urlToDate);

  function clearUrlFilter() {
    router.push('/transactions');
  }

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      // URL-driven filters (from clicking into a budget) — applied first
      if (urlCategoryId && tx.category_id !== urlCategoryId) return false;
      if (urlFromDate) {
        const txDate = tx.occurred_at.slice(0, 10); // YYYY-MM-DD
        if (txDate < urlFromDate) return false;
      }
      if (urlToDate) {
        const txDate = tx.occurred_at.slice(0, 10);
        if (txDate > urlToDate) return false;
      }
      // Filter by type, or by uncategorized status
      if (filter === 'uncategorized') {
        if (tx.category_id) return false;
      } else if (filter !== 'all' && tx.type !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.merchant?.toLowerCase().includes(q) ?? false) ||
        (tx.category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [transactions, query, filter, urlCategoryId, urlFromDate, urlToDate]);

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

  // Tab-aware total. The label and which transactions to sum changes
  // based on the active filter.
  const tabTotal = useMemo(() => {
    if (filter === 'expense' || filter === 'uncategorized') {
      return filtered
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0);
    }
    if (filter === 'income') {
      return filtered
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0);
    }
    if (filter === 'transfer') {
      return filtered
        .filter((t) => t.type === 'transfer')
        .reduce((s, t) => s + Number(t.amount), 0);
    }
    // 'all' tab: net flow (income - expenses)
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += Number(t.amount);
      else if (t.type === 'expense') expense += Number(t.amount);
    }
    return income - expense;
  }, [filtered, filter]);

  const tabTotalLabel =
    filter === 'expense' ? 'Total spent'
    : filter === 'income' ? 'Total earned'
    : filter === 'transfer' ? 'Total transferred'
    : filter === 'uncategorized' ? 'Total spent'
    : 'Net flow'; // 'all'

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'expense', label: 'Expenses' },
    { key: 'income', label: 'Income' },
    { key: 'transfer', label: 'Transfers' },
    { key: 'uncategorized', label: 'No category' },
  ];

  // Count of uncategorized transactions for a small badge in the chip
  const uncategorizedCount = transactions.filter((t) => !t.category_id).length;

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    clearSelection();
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const selectedArray = Array.from(selectedIds);

  return (
    <div className="space-y-4">
      {/* Active URL filter breadcrumb — shows when navigated from a budget click.
          The user can dismiss to go back to the unfiltered transactions list. */}
      {hasUrlFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm">
          <span className="text-muted">Viewing:</span>
          <span className="text-foreground font-medium">
            {urlCategoryName ?? 'Filtered'}
          </span>
          {urlFromDate && urlToDate && (
            <span className="text-muted">
              · {format(parseISO(urlFromDate), 'MMM d')} – {format(parseISO(urlToDate), 'MMM d, yyyy')}
            </span>
          )}
          <button
            type="button"
            onClick={clearUrlFilter}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-subtle hover:text-foreground"
          >
            <X size={12} strokeWidth={2} />
            Clear
          </button>
        </div>
      )}

      {/* Controls — search + filters */}
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle/60 p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'bg-surface text-foreground shadow-subtle'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {f.label}
                {f.key === 'uncategorized' && uncategorizedCount > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      filter === f.key
                        ? 'bg-foreground/10 text-foreground'
                        : 'bg-muted/20 text-muted'
                    )}
                  >
                    {uncategorizedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {!selectionMode ? (
            <button
              onClick={() => setSelectionMode(true)}
              className="btn-outline text-xs"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={exitSelectionMode}
              className="btn-ghost inline-flex items-center gap-1 text-xs"
            >
              <X size={13} strokeWidth={2} />
              Done
            </button>
          )}
        </div>
      </div>

      {/* Bulk action toolbar (only in selection mode with selections) */}
      {selectionMode && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                allVisibleSelected ? clearSelection() : selectAllVisible()
              }
              className="inline-flex items-center gap-1.5 text-sm text-foreground"
            >
              {allVisibleSelected ? (
                <CheckSquare size={15} strokeWidth={1.75} />
              ) : (
                <Square size={15} strokeWidth={1.75} />
              )}
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all visible'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkAction('category')}
              disabled={selectedIds.size === 0}
              className="btn-ghost inline-flex items-center gap-1 text-xs disabled:opacity-40"
            >
              <Tag size={13} strokeWidth={1.75} />
              Set category
            </button>
            <button
              onClick={() => setBulkAction('type')}
              disabled={selectedIds.size === 0}
              className="btn-ghost inline-flex items-center gap-1 text-xs disabled:opacity-40"
            >
              <ArrowLeftRight size={13} strokeWidth={1.75} />
              Set type
            </button>
            <button
              onClick={() => setBulkAction('delete')}
              disabled={selectedIds.size === 0}
              className="btn-ghost inline-flex items-center gap-1 text-xs text-negative disabled:opacity-40"
            >
              <Trash2 size={13} strokeWidth={1.75} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <span>
          {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
        </span>
        <span className="tabular">
          {tabTotalLabel}:{' '}
          <span
            className={cn(
              'text-foreground',
              // For "Net flow" on All tab, color based on sign
              filter === 'all' && tabTotal > 0 && 'text-positive',
              filter === 'all' && tabTotal < 0 && 'text-negative'
            )}
          >
            {filter === 'all' && tabTotal > 0 && '+'}
            {formatCurrency(Math.abs(tabTotal))}
            {filter === 'all' && tabTotal < 0 && ' (out)'}
          </span>
        </span>
      </div>

      {/* List */}
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
                  <TransactionRowWithSelection
                    key={tx.id}
                    tx={tx}
                    accounts={accounts}
                    categories={categories}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(tx.id)}
                    onToggle={() => toggleId(tx.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action modals */}
      {bulkAction === 'category' && (
        <BulkCategoryModal
          ids={selectedArray}
          categories={categories}
          onClose={(success) => {
            setBulkAction(null);
            if (success) {
              exitSelectionMode();
              router.refresh();
            }
          }}
        />
      )}
      {bulkAction === 'type' && (
        <BulkTypeModal
          ids={selectedArray}
          onClose={(success) => {
            setBulkAction(null);
            if (success) {
              exitSelectionMode();
              router.refresh();
            }
          }}
        />
      )}
      {bulkAction === 'delete' && (
        <BulkDeleteModal
          ids={selectedArray}
          onClose={(success) => {
            setBulkAction(null);
            if (success) {
              exitSelectionMode();
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

function TransactionRowWithSelection({
  tx,
  accounts,
  categories,
  selectionMode,
  selected,
  onToggle,
}: {
  tx: Transaction;
  accounts: Pick<Account, 'id' | 'name' | 'type'>[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  if (!selectionMode) {
    return (
      <EditableTransactionRow tx={tx} accounts={accounts} categories={categories} />
    );
  }

  // In selection mode, render with a checkbox and disable inline editing.
  // Tapping the row toggles selection.
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border/60 py-3 text-left transition-colors hover:bg-subtle/40 last:border-b-0',
        selected && 'bg-subtle/40'
      )}
    >
      {selected ? (
        <CheckSquare
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-foreground"
        />
      ) : (
        <Square
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-muted"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {tx.merchant || tx.description}
      </span>
      <span className="text-xs text-muted">
        {tx.category?.name ?? 'Uncategorized'}
      </span>
      <span
        className={cn(
          'shrink-0 text-sm tabular',
          tx.type === 'income' && 'text-positive',
          tx.type === 'expense' && 'text-foreground',
          tx.type === 'transfer' && 'text-muted'
        )}
      >
        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
        {formatCurrency(Number(tx.amount))}
      </span>
    </button>
  );
}

function BulkCategoryModal({
  ids,
  categories,
  onClose,
}: {
  ids: string[];
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
  onClose: (success: boolean) => void;
}) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const res = await bulkUpdateTransactions({
        ids,
        category_id: categoryId || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose(true);
    });
  }

  return (
    <Modal open={true} onClose={() => onClose(false)} title="Set category">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Assign a category to {ids.length} transaction{ids.length === 1 ? '' : 's'}.
        </p>

        <div>
          <label className="label mb-1.5 block">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input"
            autoFocus
          >
            <option value="">— Uncategorized —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <p className="rounded-lg bg-subtle/40 p-3 text-xs text-muted">
          ✨ A merchant rule will be saved for each unique merchant in your selection.
          Future imports will auto-classify these merchants the same way.
        </p>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={isPending}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="btn-primary"
          >
            {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BulkTypeModal({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: (success: boolean) => void;
}) {
  const [type, setType] = useState<TransactionType>('expense');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const res = await bulkUpdateTransactions({ ids, type });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose(true);
    });
  }

  const types: { value: TransactionType; label: string }[] = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'transfer', label: 'Transfer' },
  ];

  return (
    <Modal open={true} onClose={() => onClose(false)} title="Set type">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Change the type of {ids.length} transaction{ids.length === 1 ? '' : 's'}.
        </p>

        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                type === t.value
                  ? 'border-foreground bg-foreground text-surface'
                  : 'border-border bg-surface text-muted hover:border-foreground/30'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="rounded-lg bg-subtle/40 p-3 text-xs text-muted">
          ✨ A merchant rule will be saved for each unique merchant.
        </p>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={isPending}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="btn-primary"
          >
            {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BulkDeleteModal({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: (success: boolean) => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirmed = confirmText === 'DELETE';

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await bulkDeleteTransactions(ids);
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose(true);
    });
  }

  return (
    <Modal
      open={true}
      onClose={() => onClose(false)}
      title={`Delete ${ids.length} transaction${ids.length === 1 ? '' : 's'}?`}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>This cannot be undone.</span>
        </div>

        <div>
          <label className="label mb-1.5 block">
            Type <span className="font-mono text-foreground">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="input font-mono"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={isPending}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-negative/90 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={15} className="animate-spin" strokeWidth={2} />
            ) : (
              <Trash2 size={15} strokeWidth={2} />
            )}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
