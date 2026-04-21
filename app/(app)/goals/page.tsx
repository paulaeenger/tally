import { Plus, Target } from 'lucide-react';
import { format, parseISO, differenceInMonths, differenceInDays } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { getGoals } from '@/lib/data/queries';
import { formatCurrency, formatPercent } from '@/lib/utils/cn';

export default async function GoalsPage() {
  const goals = await getGoals();

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Aspirations"
        title="Goals"
        description="Milestones, and the path to each one."
        actions={
          <button className="btn-primary">
            <Plus size={15} strokeWidth={2} />
            New goal
          </button>
        }
      />

      {/* Summary */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Progress across all goals</p>
            <p className="mt-2 font-display text-display-lg tabular text-foreground">
              {formatCurrency(totalSaved)}
              <span className="ml-2 text-lg text-faint">/ {formatCurrency(totalTarget)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl tabular text-foreground">
              {totalTarget > 0 ? formatPercent(totalSaved / totalTarget, 0) : '—'}
            </p>
            <p className="text-xs text-muted">complete</p>
          </div>
        </div>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a target, and watch the path appear."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const current = Number(g.current_amount);
            const target = Number(g.target_amount);
            const pct = target > 0 ? Math.min(1, current / target) : 0;
            const remaining = Math.max(0, target - current);

            let timeText = 'No target date';
            let monthlyNeeded: number | null = null;

            if (g.target_date) {
              const targetDate = parseISO(g.target_date);
              const today = new Date();
              const months = differenceInMonths(targetDate, today);
              const days = differenceInDays(targetDate, today);

              if (days < 0) {
                timeText = 'Past due';
              } else if (months >= 1) {
                timeText = `${months} month${months === 1 ? '' : 's'} left`;
                monthlyNeeded = remaining / Math.max(1, months);
              } else {
                timeText = `${days} day${days === 1 ? '' : 's'} left`;
              }
            }

            return (
              <div
                key={g.id}
                className="card relative overflow-hidden p-6"
              >
                {/* Color accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ background: g.color }}
                  aria-hidden
                />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl text-foreground">{g.name}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {g.target_date ? `Target: ${format(parseISO(g.target_date), 'MMM d, yyyy')}` : 'No deadline'}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium tabular"
                    style={{
                      background: g.color + '18',
                      color: g.color,
                    }}
                  >
                    {formatPercent(pct, 0)}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-display text-2xl tabular text-foreground">
                      {formatCurrency(current)}
                    </span>
                    <span className="tabular text-faint">of {formatCurrency(target)}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: pct * 100 + '%', background: g.color }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted">{timeText}</span>
                  {monthlyNeeded !== null && monthlyNeeded > 0 && (
                    <span className="tabular text-muted">
                      {formatCurrency(monthlyNeeded)}/mo to hit target
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
