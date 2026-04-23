import { Target, Check } from 'lucide-react';
import { format, parseISO, differenceInMonths, differenceInDays } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AddGoalButton, EditGoalButton, GoalQuickBump } from '@/components/ui/goal-actions';
import { getGoals } from '@/lib/data/queries';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/cn';
import type { Goal } from '@/lib/data/types';

export const revalidate = 60;

export default async function GoalsPage() {
  const goals = await getGoals();

  // Separate save-up goals from pay-down goals.
  // A pay-down goal is one where current > target (paying down toward a low/zero target).
  const saveUpGoals = goals.filter(
    (g) => Number(g.target_amount) >= Number(g.current_amount)
  );
  const payDownGoals = goals.filter(
    (g) => Number(g.target_amount) < Number(g.current_amount)
  );

  // Summary metrics: use save-up goals for the "progress across all goals" since
  // pay-down math works in reverse and would confuse a single combined stat
  const totalTarget = saveUpGoals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = saveUpGoals.reduce((s, g) => s + Number(g.current_amount), 0);

  // Pay-down summary
  const totalDebt = payDownGoals.reduce((s, g) => s + Number(g.current_amount), 0);
  const initialDebtEstimate = payDownGoals.reduce(
    (s, g) => s + Number(g.current_amount),
    0
  );

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Aspirations"
        title="Goals"
        description="Milestones, and the path to each one."
        actions={<AddGoalButton />}
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a target, and watch the path appear. Emergency fund, down payment, or paying off debt — all work."
          action={<AddGoalButton label="Add your first goal" />}
        />
      ) : (
        <>
          {/* Summary only shown when there's at least one save-up goal */}
          {saveUpGoals.length > 0 && (
            <div className="card p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="label">Saved across goals</p>
                  <p
                    className="mt-2 font-display tabular text-foreground leading-tight"
                    style={{
                      fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {formatCurrency(totalSaved)}
                    <span className="ml-2 text-lg text-faint">
                      / {formatCurrency(totalTarget)}
                    </span>
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
          )}

          {/* Save-up goals */}
          {saveUpGoals.length > 0 && (
            <section>
              <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-faint">
                Saving for
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {saveUpGoals.map((g) => (
                  <GoalCard key={g.id} goal={g} direction="save-up" />
                ))}
              </div>
            </section>
          )}

          {/* Pay-down goals */}
          {payDownGoals.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center justify-between px-1 text-xs font-medium uppercase tracking-[0.18em] text-faint">
                <span>Paying down</span>
                <span className="tabular normal-case tracking-normal">
                  {formatCurrency(totalDebt)} remaining
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {payDownGoals.map((g) => (
                  <GoalCard key={g.id} goal={g} direction="pay-down" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// GoalCard — direction-aware display
// ----------------------------------------------------------------
function GoalCard({
  goal: g,
  direction,
}: {
  goal: Goal;
  direction: 'save-up' | 'pay-down';
}) {
  const current = Number(g.current_amount);
  const target = Number(g.target_amount);

  // Progress calculation differs by direction
  let pct: number;
  let remaining: number;
  let complete: boolean;

  if (direction === 'save-up') {
    pct = target > 0 ? Math.min(1, current / target) : 0;
    remaining = Math.max(0, target - current);
    complete = current >= target && target > 0;
  } else {
    // Pay-down: we don't know the original balance, so we show "amount left to pay"
    // and progress is derived from current vs target (where target is usually 0)
    // For a $2000 CC being paid down to $0, showing "$2000 remaining" is what matters
    pct = 0; // We use current amount as the bar
    remaining = Math.max(0, current - target);
    complete = current <= target;
  }

  // Time-left text (safe for hydration — rendered server-side only)
  let timeText: string | null = null;
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
    <div className="card relative overflow-hidden p-6">
      {/* Color accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: g.color }}
        aria-hidden
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-foreground truncate">{g.name}</h3>
          <p className="mt-1 text-xs text-muted">
            {g.target_date
              ? `Target: ${format(parseISO(g.target_date), 'MMM d, yyyy')}`
              : 'No deadline'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {complete ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2.5 py-0.5 text-xs font-medium text-positive"
            >
              <Check size={11} strokeWidth={2.5} />
              Done
            </span>
          ) : (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium tabular"
              style={{
                background: g.color + '18',
                color: g.color,
              }}
            >
              {direction === 'save-up'
                ? formatPercent(pct, 0)
                : formatCurrency(remaining) + ' left'}
            </span>
          )}
          <EditGoalButton goal={g} />
        </div>
      </div>

      {/* Amount display */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-display text-2xl tabular text-foreground">
            {formatCurrency(current)}
          </span>
          <span className="tabular text-faint">
            {direction === 'save-up'
              ? `of ${formatCurrency(target)}`
              : `paying down to ${formatCurrency(target)}`}
          </span>
        </div>
        {/* Progress bar for save-up goals. Pay-down goals don't show one since
            we don't track the original balance — progress is shown by watching
            the current amount shrink toward the target. */}
        {direction === 'save-up' && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: pct * 100 + '%', background: g.color }}
            />
          </div>
        )}
      </div>

      {/* Time + monthly needed */}
      {(timeText || monthlyNeeded) && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted">{timeText}</span>
          {monthlyNeeded !== null && monthlyNeeded > 0 && (
            <span className="tabular text-muted">
              {formatCurrency(monthlyNeeded)}/mo to hit target
            </span>
          )}
        </div>
      )}

      {/* Quick bump controls (hide if complete) */}
      {!complete && (
        <div className="mt-3">
          <GoalQuickBump goal={g} direction={direction} />
        </div>
      )}
    </div>
  );
}
