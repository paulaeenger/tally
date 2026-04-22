'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { createGoal, updateGoal, deleteGoal } from '@/app/actions/goals';
import type { Goal } from '@/lib/data/types';
import { cn } from '@/lib/utils/cn';

type Direction = 'save-up' | 'pay-down';

const COLOR_OPTIONS: { value: string; name: string }[] = [
  { value: '#1e293b', name: 'Slate' },
  { value: '#4a7c59', name: 'Forest' },
  { value: '#3d5a80', name: 'Ocean' },
  { value: '#c45a3d', name: 'Terracotta' },
  { value: '#7d5ba6', name: 'Plum' },
  { value: '#c89960', name: 'Amber' },
  { value: '#a64d79', name: 'Wine' },
  { value: '#2d6a6a', name: 'Teal' },
];

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  editing?: Goal | null;
}

// Format an ISO datestring to yyyy-mm-dd for the <input type="date">
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Infer direction from an existing goal's shape
function inferDirection(g?: Goal | null): Direction {
  if (!g) return 'save-up';
  const target = Number(g.target_amount);
  const current = Number(g.current_amount);
  // If the goal starts higher than the target and the target is low, it's a debt payoff
  if (current > target) return 'pay-down';
  return 'save-up';
}

export function GoalForm({ open, onClose, editing }: GoalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>(inferDirection(editing));
  const [color, setColor] = useState<string>(editing?.color ?? COLOR_OPTIONS[0].value);

  const isEdit = !!editing;

  async function handleSubmit(formData: FormData) {
    setError(null);
    // Force the selected color into the form
    formData.set('color', color);
    startTransition(async () => {
      const action = isEdit ? updateGoal : createGoal;
      if (isEdit && editing) formData.set('id', editing.id);
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm(`Delete the "${editing.name}" goal? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGoal(editing.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit goal' : 'Add a goal'}
      description={
        isEdit
          ? 'Update the goal details.'
          : 'Set a target, track progress, keep yourself honest.'
      }
    >
      <form action={handleSubmit} className="space-y-5">
        {/* Direction toggle */}
        <div>
          <label className="label mb-2 block">Direction</label>
          <div className="flex gap-1 rounded-lg border border-border bg-subtle/60 p-1">
            <label
              className={cn(
                'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors',
                direction === 'save-up'
                  ? 'bg-surface text-foreground shadow-subtle'
                  : 'text-muted hover:text-foreground'
              )}
            >
              <input
                type="radio"
                name="direction"
                value="save-up"
                checked={direction === 'save-up'}
                onChange={() => setDirection('save-up')}
                className="sr-only"
              />
              Save up
            </label>
            <label
              className={cn(
                'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors',
                direction === 'pay-down'
                  ? 'bg-surface text-foreground shadow-subtle'
                  : 'text-muted hover:text-foreground'
              )}
            >
              <input
                type="radio"
                name="direction"
                value="pay-down"
                checked={direction === 'pay-down'}
                onChange={() => setDirection('pay-down')}
                className="sr-only"
              />
              Pay down
            </label>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {direction === 'save-up'
              ? "You're building toward a target amount (savings, down payment, etc)."
              : "You're reducing a balance toward zero (credit card, loan, etc)."}
          </p>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="label mb-1.5 block">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus={!isEdit}
            defaultValue={editing?.name}
            placeholder={
              direction === 'save-up' ? 'Emergency fund, Down payment…' : 'Pay off Visa, Student loan…'
            }
            className="input"
          />
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="current_amount" className="label mb-1.5 block">
              {direction === 'save-up' ? 'Saved so far' : 'Current balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                id="current_amount"
                name="current_amount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={editing ? Number(editing.current_amount) : 0}
                placeholder="0.00"
                className="input pl-7 tabular"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label htmlFor="target_amount" className="label mb-1.5 block">
              {direction === 'save-up' ? 'Target' : 'Payoff target'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                id="target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={
                  editing
                    ? Number(editing.target_amount)
                    : direction === 'pay-down'
                      ? 0
                      : ''
                }
                placeholder={direction === 'pay-down' ? '0.00' : '10,000.00'}
                className="input pl-7 tabular"
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        {/* Target date */}
        <div>
          <label htmlFor="target_date" className="label mb-1.5 block">
            Target date <span className="text-faint normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="target_date"
            name="target_date"
            type="date"
            defaultValue={toDateInput(editing?.target_date)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-faint">
            We'll show how much you need to set aside per month to hit this.
          </p>
        </div>

        {/* Color picker */}
        <div>
          <label className="label mb-2 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={c.name}
                className={cn(
                  'h-8 w-8 rounded-full ring-offset-2 ring-offset-elevated transition-all',
                  color === c.value ? 'ring-2 ring-foreground' : 'hover:scale-110'
                )}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
            {error}
          </div>
        )}

        <div
          className={cn(
            'flex gap-2 border-t border-border pt-4',
            isEdit ? 'justify-between' : 'justify-end'
          )}
        >
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-negative transition-colors hover:bg-negative/5"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
              {isEdit ? 'Save changes' : 'Add goal'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
