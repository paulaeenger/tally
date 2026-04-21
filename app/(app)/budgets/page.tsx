import { Plus, PieChart } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { getBudgets } from '@/lib/data/queries';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/cn';

export default async function BudgetsPage() {
  const budgets = await getBudgets();

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent ?? 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Spending"
        title="Budgets"
        description="Set intentions, then see how they hold up."
        actions={
          <button className="btn-primary">
            <Plus size={15} strokeWidth={2} />
            New budget
          </button>
        }
      />

      {/* Summary card */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Month-to-date</p>
            <p className="mt-2 font-display text-display-lg tabular text-foreground">
              {formatCurrency(totalSpent)}
              <span className="ml-2 text-lg text-faint">/ {formatCurrency(totalBudget)}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatCurrency(totalRemaining)} remaining across {budgets.length} categories
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl tabular text-foreground">{formatPercent(pct, 0)}</p>
            <p className="text-xs text-muted">used</p>
          </div>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct > 1 ? 'bg-negative' : pct > 0.85 ? 'bg-warning' : 'bg-accent'
            )}
            style={{ width: Math.min(100, pct * 100) + '%' }}
          />
        </div>
      </div>

      {/* Budget list */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budgets yet"
          description="Create your first budget to start tracking spending by category."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {budgets.map((b) => {
            const spent = Number(b.spent ?? 0);
            const amount = Number(b.amount);
            const remaining = amount - spent;
            const pctUsed = amount > 0 ? spent / amount : 0;
            const over = spent > amount;
            const status = over ? 'over' : pctUsed > 0.85 ? 'warn' : 'ok';

            return (
              <div key={b.id} className="card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: b.category?.color ?? 'rgb(var(--muted))' }}
                      />
                      <h3 className="font-display text-lg text-foreground">{b.name}</h3>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wider text-faint">{b.period}</p>
                  </div>
                  <span
                    className={cn(
                      'chip tabular',
                      status === 'over' && 'border-negative/30 bg-negative/10 text-negative',
                      status === 'warn' && 'border-warning/30 bg-warning/10 text-warning',
                      status === 'ok' && 'text-muted'
                    )}
                  >
                    {formatPercent(pctUsed, 0)}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between text-sm">
                  <span className="tabular text-foreground">{formatCurrency(spent)}</span>
                  <span className="tabular text-faint">of {formatCurrency(amount)}</span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      status === 'over' && 'bg-negative',
                      status === 'warn' && 'bg-warning',
                      status === 'ok' && 'bg-accent'
                    )}
                    style={{ width: Math.min(100, pctUsed * 100) + '%' }}
                  />
                </div>

                <p className="mt-3 text-xs text-muted tabular">
                  {over ? (
                    <span className="text-negative">
                      {formatCurrency(Math.abs(remaining))} over
                    </span>
                  ) : (
                    <>{formatCurrency(remaining)} left this {b.period.replace('ly', '')}</>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
