// Target path: components/ui/danger-zone.tsx (NEW FILE)

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, Loader2, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { deleteAllTransactions, wipeAllHouseholdData } from '@/app/actions/danger';

type DangerAction = 'transactions' | 'everything' | null;

interface DangerZoneProps {
  householdName?: string;
  memberCount: number;
}

export function DangerZone({ householdName, memberCount }: DangerZoneProps) {
  const router = useRouter();
  const [active, setActive] = useState<DangerAction>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isConfirmed = confirmText === 'DELETE';
  const sharedNotice =
    memberCount > 1
      ? `This will also clear data for the ${memberCount - 1} other member${memberCount - 1 === 1 ? '' : 's'} in ${householdName ?? 'your household'}.`
      : null;

  function close() {
    setActive(null);
    setConfirmText('');
    setError(null);
    setResult(null);
  }

  async function handleConfirm() {
    if (!isConfirmed) return;
    setError(null);

    startTransition(async () => {
      if (active === 'transactions') {
        const res = await deleteAllTransactions();
        if (res.error) {
          setError(res.error);
          return;
        }
        setResult(
          `${res.deleted ?? 0} transaction${res.deleted === 1 ? '' : 's'} deleted.`
        );
      } else if (active === 'everything') {
        const res = await wipeAllHouseholdData();
        if (res.error) {
          setError(res.error);
          return;
        }
        const s = res.summary!;
        setResult(
          `Wiped ${s.transactions} transactions, ${s.accounts} accounts, ${s.budgets} budgets, ${s.goals} goals, ${s.categories} categories, and ${s.rules} merchant rules.`
        );
      }

      router.refresh();
    });
  }

  const config = {
    transactions: {
      title: 'Delete all transactions',
      description:
        'Remove every transaction in your household. Accounts, budgets, goals, and categories stay.',
      modalTitle: 'Delete all transactions?',
      modalDescription:
        'This removes every transaction. Accounts, budgets, and categories are preserved.',
    },
    everything: {
      title: 'Delete everything',
      description:
        'Remove all transactions, accounts, budgets, goals, categories, and import rules. Your household and login stay.',
      modalTitle: 'Delete everything?',
      modalDescription:
        'This wipes all transactional data: transactions, accounts, budgets, goals, categories, and merchant rules. Your login and household relationships are preserved.',
    },
  };

  const current = active ? config[active] : null;

  return (
    <>
      <div className="card border-negative/20 bg-negative/[0.02] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-negative/10 text-negative">
            <AlertTriangle size={15} strokeWidth={1.75} />
          </div>
          <div>
            <p className="label text-negative">Danger Zone</p>
            <p className="mt-1 text-xs text-muted">
              Destructive actions. These cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <DangerRow
            title={config.transactions.title}
            description={config.transactions.description}
            onClick={() => setActive('transactions')}
          />
          <DangerRow
            title={config.everything.title}
            description={config.everything.description}
            onClick={() => setActive('everything')}
          />
        </div>
      </div>

      <Modal
        open={active !== null}
        onClose={close}
        title={current?.modalTitle ?? ''}
        description={current?.modalDescription}
      >
        {!result ? (
          <div className="space-y-5">
            {sharedNotice && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <span>{sharedNotice}</span>
              </div>
            )}

            <div>
              <label className="label mb-1.5 block">
                Type <span className="font-mono text-foreground">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                className="input font-mono"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!isConfirmed || isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-negative/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 size={15} className="animate-spin" strokeWidth={2} />
                ) : (
                  <Trash2 size={15} strokeWidth={2} />
                )}
                Yes, {active === 'transactions' ? 'delete transactions' : 'delete everything'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
              <Check size={22} strokeWidth={1.75} />
            </div>
            <p className="text-sm text-muted">{result}</p>
            <button onClick={close} className="btn-primary">
              Done
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

function DangerRow({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-negative/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground group-hover:text-negative">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Trash2
        size={15}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-faint group-hover:text-negative"
      />
    </button>
  );
}
