'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BudgetForm } from './budget-form';
import type { Budget, Category } from '@/lib/data/types';

interface Props {
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

export function AddBudgetButton({
  categories,
  label = 'New budget',
}: Props & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={2} />
        {label}
      </button>
      <BudgetForm open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
}

/**
 * Wraps a budget card in a clickable trigger that opens the edit modal.
 */
export function EditableBudgetCard({
  budget,
  categories,
  children,
}: Props & {
  budget: Budget;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left transition-colors hover:border-foreground/20"
      >
        {children}
      </button>
      <BudgetForm
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        editing={budget}
      />
    </>
  );
}
