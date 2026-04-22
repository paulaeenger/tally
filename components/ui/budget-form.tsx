'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { createBudget, updateBudget, deleteBudget } from '@/app/actions/budgets';
import type { Budget, Category } from '@/lib/data/types';
import { cn } from '@/lib/utils/cn';

type BudgetPeriod = 'monthly' | 'yearly';

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
  editing?: Budget | null;
}

export function BudgetForm({ open, onClose, categories, editing }: BudgetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BudgetPeriod>(
    (editing?.period as BudgetPeriod) ?? 'monthly'
  );
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? categories[0]?.id ?? '');

  const isEdit = !!editing;

  // No categories means the user hasn't added any accounts yet (categories are
  // auto-seeded when the first account is added). Block with a helpful message.
  if (categories.length === 0) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Add a budget"
        description="You'll need categories first."
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted">
            Budgets are tied to categories (Groceries, Dining, etc). Categories are added
            automatically when you create your first account — so start there.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn-primary">
              OK, got it
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = isEdit ? updateBudget : createBudget;
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
    if (!confirm(`Delete the "${editing.name}" budget? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBudget(editing.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit budget' : 'Add a budget'}
      description={
        isEdit
          ? 'Update the budget details.'
          : 'Cap spending in a category for a set period.'
      }
    >
      <form action={handleSubmit} className="space-y-5">
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
            placeholder="Groceries, Dining out…"
            className="input"
          />
          <p className="mt-1 text-xs text-faint">
            Usually matches the category, but call it whatever's useful.
          </p>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category_id" className="label mb-1.5 block">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selectedCategory && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: selectedCategory.color }}
              />
              {selectedCategory.name}
            </div>
          )}
        </div>

        {/* Amount + Period */}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label htmlFor="amount" className="label mb-1.5 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={editing ? Number(editing.amount) : ''}
                placeholder="0.00"
                className="input pl-7 tabular"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="label mb-1.5 block">Period</label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-subtle/60 p-1">
              {(['monthly', 'yearly'] as BudgetPeriod[]).map((opt) => (
                <label
                  key={opt}
                  className={cn(
                    'cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                    period === opt
                      ? 'bg-surface text-foreground shadow-subtle'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  <input
                    type="radio"
                    name="period"
                    value={opt}
                    checked={period === opt}
                    onChange={() => setPeriod(opt)}
                    className="sr-only"
                  />
                  {opt}
                </label>
              ))}
            </div>
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
              {isEdit ? 'Save changes' : 'Add budget'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
