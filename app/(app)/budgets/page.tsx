import { PieChart, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, format } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AddBudgetButton, EditableBudgetCard } from '@/components/ui/budget-actions';
import { getBudgets, getCategories } from '@/lib/data/queries';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/cn';

export const revalidate = 60;

export default async function BudgetsPage() {
  const [budgets, categories] = await Promise.all([getBudgets(), getCategories()]);

  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }));

  // Split into monthly and yearly for separate display sections.
  // Sorted alphabetically within each group for easy scanning — earlier we
  // sorted by amount spent, but alphabetical is more predictable and lets
  // users quickly find a specific budget by name.
  const monthly = budgets
    .filter((b) => b.period === 'monthly' || b.period === 'weekly')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const yearly = budgets
    .filter((b) => b.period === 'yearly')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalBudget = monthly.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = monthly.reduce((s, b) => s + Number(b.spent ?? 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Spending"
        title="Budgets"
        description="Set intentions, then see how they hold up."
        actions={<AddBudgetButton categories={categoriesLite} />}
      />

      {budgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budgets yet"
          description="Create your first budget to start tracking spending by category. Monthly is the common starting point."
          action={
            <AddBudgetButton categories={categoriesLite} label="Add your first budget" />
          }
        />
      ) : (
        <>
          {/* Summary card — reflects monthly/weekly budgets only */}
          {monthly.length > 0 && (
            <div className="card p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="label">Month-to-date</p>
                  <p className="mt-2 font-display text-display-lg tabular text-foreground">
                    {formatCurrency(totalSpent)}
                    <span className="ml-2 text-lg text-faint">
                      / {formatCurrency(totalBudget)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {totalRemaining >= 0
                      ? `${formatCurrency(totalRemaining)} remaining across ${monthly.length} ${
                          monthly.length === 1 ? 'budget' : 'budgets'
                        }`
                      : `${formatCurrency(Math.abs(totalRemaining))} over budget`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-3xl tabular text-foreground">
                    {formatPercent(pct, 0)}
                  </p>
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
          )}

          {/* Monthly / Weekly budgets grid */}
          {monthly.length > 0 && (
            <section>
              <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-faint">
                Monthly
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {monthly.map((b) => {
                  const url = budgetTxUrl(b);
                  return (
                    <div key={b.id} className="space-y-1.5">
                      <EditableBudgetCard
                        budget={b}
                        categories={categoriesLite}
                      >
                        <BudgetCard budget={b} />
                      </EditableBudgetCard>
                      {url && (
                        <Link
                          href={url}
                          className="inline-flex items-center gap-1 px-2 text-xs text-muted hover:text-foreground"
                        >
                          View transactions <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Yearly budgets grid */}
          {yearly.length > 0 && (
            <section>
              <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-faint">
                Yearly
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {yearly.map((b) => {
                  const url = budgetTxUrl(b);
                  return (
                    <div key={b.id} className="space-y-1.5">
                      <EditableBudgetCard
                        budget={b}
                        categories={categoriesLite}
                      >
                        <BudgetCard budget={b} />
                      </EditableBudgetCard>
                      {url && (
                        <Link
                          href={url}
                          className="inline-flex items-center gap-1 px-2 text-xs text-muted hover:text-foreground"
                        >
                          View transactions <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// BudgetCard — the visual for an individual budget
// ----------------------------------------------------------------
function BudgetCard({ budget: b }: { budget: any }) {
  const spent = Number(b.spent ?? 0);
  const amount = Number(b.amount);
  const remaining = amount - spent;
  const pctUsed = amount > 0 ? spent / amount : 0;
  const over = spent > amount;
  const status = over ? 'over' : pctUsed > 0.85 ? 'warn' : 'ok';

  return (
    <div className="card p-5 sm:p-6 transition-all hover:shadow-subtle w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: b.category?.color ?? 'rgb(var(--muted))' }}
            />
            <h3 className="font-display text-lg text-foreground truncate">{b.name}</h3>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wider text-faint">{b.period}</p>
        </div>
        <span
          className={cn(
            'chip tabular shrink-0',
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
          <span className="text-negative">{formatCurrency(Math.abs(remaining))} over</span>
        ) : (
          <>
            {formatCurrency(remaining)} left this {b.period.replace('ly', '')}
          </>
        )}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Build URL for filtered transactions matching this budget
// ----------------------------------------------------------------
function budgetTxUrl(b: any): string | null {
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
