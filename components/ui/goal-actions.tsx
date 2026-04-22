'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Pencil } from 'lucide-react';
import { GoalForm } from './goal-form';
import { bumpGoalProgress } from '@/app/actions/goals';
import type { Goal } from '@/lib/data/types';

export function AddGoalButton({ label = 'New goal' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={2} />
        {label}
      </button>
      <GoalForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function EditGoalButton({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-subtle hover:text-foreground"
        aria-label={`Edit ${goal.name}`}
      >
        <Pencil size={14} strokeWidth={1.5} />
      </button>
      <GoalForm open={open} onClose={() => setOpen(false)} editing={goal} />
    </>
  );
}

/**
 * Inline +/- controls for bumping a goal's progress.
 *
 * For "save-up" goals (target > current), the + button is "add to progress".
 * For "pay-down" goals (target < current), the + button is "paid down more" —
 * which actually DECREASES current_amount toward the target.
 *
 * To keep the UX predictable, we label the buttons with their actual effect
 * on the number shown ("current balance" for pay-down, "saved" for save-up),
 * not their direction of progress.
 */
export function GoalQuickBump({
  goal,
  direction,
}: {
  goal: Goal;
  direction: 'save-up' | 'pay-down';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  function bump(delta: number) {
    setError(null);
    startTransition(async () => {
      const result = await bumpGoalProgress(goal.id, delta);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCustom(sign: 1 | -1) {
    const n = Number(customAmount);
    if (!isFinite(n) || n <= 0) {
      setError('Enter a positive amount');
      return;
    }
    bump(sign * n);
    setCustomAmount('');
  }

  // For save-up goals: + increases current; - decreases it
  // For pay-down goals: we show "+" as "you paid more off" which REDUCES current
  // So the button labels need to feel right:
  //   save-up: [- 50] [current] [+ 50] (both bump current_amount)
  //   pay-down: [+ 50] [current] [- 50] where + actually means "reduce balance"
  // To avoid confusion, we always show + on the "good progress" side

  const makeProgress = (amount: number) => {
    // save-up: +amount to current; pay-down: -amount from current
    return direction === 'save-up' ? amount : -amount;
  };
  const undoProgress = (amount: number) => {
    return direction === 'save-up' ? -amount : amount;
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {direction === 'save-up' ? 'Log a contribution' : 'Log a payment'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => bump(undoProgress(50))}
            disabled={isPending}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:bg-subtle disabled:opacity-50"
            aria-label="Undo 50"
          >
            <Minus size={12} strokeWidth={2} />
          </button>
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => bump(makeProgress(n))}
              disabled={isPending}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-subtle disabled:opacity-50"
            >
              +${n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Other amount"
            inputMode="decimal"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1 pl-5 text-xs tabular placeholder:text-faint focus:border-foreground/30 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => handleCustom(1)}
          disabled={isPending || !customAmount}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground transition-colors hover:bg-subtle disabled:opacity-50"
          aria-label={direction === 'save-up' ? 'Add' : 'Pay down'}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => handleCustom(-1)}
          disabled={isPending || !customAmount}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:bg-subtle disabled:opacity-50"
          aria-label={direction === 'save-up' ? 'Withdraw' : 'Add back'}
        >
          <Minus size={12} strokeWidth={2} />
        </button>
      </div>

      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
}
