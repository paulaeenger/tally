import { format, parseISO } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils/cn';
import type { Transaction } from '@/lib/data/types';

interface TransactionRowProps {
  tx: Transaction;
  compact?: boolean;
}

export function TransactionRow({ tx, compact = false }: TransactionRowProps) {
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const isRefund = tx.type === 'expense' && tx.category?.is_refund === true;

  // Refunds visually look like money-in (green +). They're technically
  // expenses in the data model, but visually they're the opposite.
  const amountColor = isIncome || isRefund
    ? 'text-positive'
    : isTransfer
      ? 'text-muted'
      : 'text-foreground';
  const prefix = isIncome || isRefund ? '+' : isTransfer ? '' : '−';

  const dotColor = tx.category?.color ?? 'rgb(var(--muted))';
  const initial =
    tx.merchant?.[0] ??
    tx.description[0] ??
    (tx.category?.name?.[0] ?? '?');

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0',
        !compact && 'sm:py-4'
      )}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-xs font-medium uppercase text-muted"
        style={{ borderColor: dotColor + '40' }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {tx.merchant ?? tx.description}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {tx.category && (
            <>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tx.category.color }}
                  aria-hidden
                />
                {tx.category.name}
              </span>
              <span className="text-faint">·</span>
            </>
          )}
          <span>{format(parseISO(tx.occurred_at), 'MMM d')}</span>
          {tx.account && !compact && (
            <>
              <span className="text-faint">·</span>
              <span className="truncate">{tx.account.name}</span>
            </>
          )}
        </div>
      </div>
      <div className={cn('shrink-0 text-right font-medium tabular text-sm', amountColor)}>
        {prefix}
        {formatCurrency(Math.abs(Number(tx.amount)))}
      </div>
    </div>
  );
}
