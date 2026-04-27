import Link from 'next/link';
import { ArrowRight, PieChart } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, format } from 'date-fns';
import type { Budget } from '@/lib/data/types';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/cn';

interface BudgetGlanceProps {
  budgets: Budget[];
}

/**
 * Build the URL for "view transactions in this budget's category and period".
 * Budgets without a category_id link nowhere — they're configured wrong but
 * shouldn't crash the UI.
 */
function buildBudgetTxUrl(b: Budget): string | null {
  if (!b.category_id) return null;
  const now = new Date();
  let from: Date;
  let to: Date;
  if (b.period === 'weekly') {
    from = startOfWeek(now);
    to = endOfWeek(now);
  } else if (b.period === 'yearly') {
    from = startOfYear(now);
    to = endOfYear(now);
  } else {
    // monthly (default)
    from = startOfMonth(now);
    to = endOfMonth(now);
  }
  const params = new URLSearchParams({
    category: b.category_id,
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  });
  return `/transactions?${params.toString()}`;
}

/**
 * Compact dashboard card that shows the top N monthly budgets by amount spent,
 * with inline progress bars. Links to the full Budgets page.
 *
 * Each individual budget row is also clickable — drills into the transactions
 * page filtered to that category and the budget's current period.
 */
export function BudgetGlance({ budgets }: BudgetGlanceProps) {
  // Only monthly budgets in the glance — yearly would skew the comparison
  const monthly = budgets
    .filter((b) => b.period === 'monthly')
    .slice()
    .sort((a, b) => Number(b.spent ?? 0) - Number(a.spent ?? 0));

  if (monthly.length === 0) return null;

  const top = monthly.slice(0, 4);

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart size={14} strokeWidth={1.5} className="text-muted" />
          <h2 className="font-display text-lg text-foreground">Budgets</h2>
        </div>
        <Link
          href="/budgets"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div className="space-y-3.5">
        {top.map((b) => {
          const spent = Number(b.spent ?? 0);
          const amount = Number(b.amount);
          const pct = amount > 0 ? spent / amount : 0;
          const over = spent > amount;
          const status = over ? 'over' : pct > 0.85 ? 'warn' : 'ok';
          const url = buildBudgetTxUrl(b);

          // Render content as a Link if we have a URL, else as a plain div.
          // The hover affordance only appears on the linked variant.
          const inner = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: b.category?.color ?? 'rgb(var(--muted))' }}
                  />
                  <span className="truncate text-foreground">{b.name}</span>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-xs tabular',
                    status === 'over' && 'text-negative',
                    status === 'warn' && 'text-warning',
                    status === 'ok' && 'text-muted'
                  )}
                >
                  {formatCurrency(spent)} / {formatCurrency(amount)}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-subtle">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    status === 'over' && 'bg-negative',
                    status === 'warn' && 'bg-warning',
                    status === 'ok' && 'bg-accent'
                  )}
                  style={{ width: Math.min(100, pct * 100) + '%' }}
                />
              </div>
            </>
          );

          if (url) {
            return (
              <Link
                key={b.id}
                href={url}
                className="block rounded-md -mx-2 px-2 py-1 transition-colors hover:bg-subtle/40"
              >
                {inner}
              </Link>
            );
          }
          return <div key={b.id}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
