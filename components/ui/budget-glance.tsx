import Link from 'next/link';
import { ArrowRight, PieChart } from 'lucide-react';
import type { Budget } from '@/lib/data/types';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/cn';

interface BudgetGlanceProps {
  budgets: Budget[];
}

/**
 * Compact dashboard card that shows the top N monthly budgets by amount spent,
 * with inline progress bars. Links to the full Budgets page.
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

          return (
            <div key={b.id}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
