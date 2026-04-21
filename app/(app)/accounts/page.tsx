import { Plus, Wallet, Landmark, CreditCard, TrendingUp, Banknote, HandCoins } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { getAccounts } from '@/lib/data/queries';
import { cn, formatCurrency } from '@/lib/utils/cn';
import type { AccountType } from '@/lib/data/types';

const typeMeta: Record<AccountType, { label: string; icon: React.ElementType }> = {
  checking: { label: 'Checking', icon: Wallet },
  savings: { label: 'Savings', icon: Landmark },
  credit: { label: 'Credit', icon: CreditCard },
  investment: { label: 'Investment', icon: TrendingUp },
  cash: { label: 'Cash', icon: Banknote },
  loan: { label: 'Loan', icon: HandCoins },
};

const typeOrder: AccountType[] = ['checking', 'savings', 'investment', 'credit', 'cash', 'loan'];

export default async function AccountsPage() {
  const accounts = await getAccounts();

  const assets = accounts
    .filter((a) => a.balance >= 0)
    .reduce((s, a) => s + Number(a.balance), 0);
  const liabilities = accounts
    .filter((a) => a.balance < 0)
    .reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
  const netWorth = assets - liabilities;

  const grouped = typeOrder
    .map((type) => ({ type, items: accounts.filter((a) => a.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Holdings"
        title="Accounts"
        description="Assets and liabilities across every institution."
        actions={
          <button className="btn-primary">
            <Plus size={15} strokeWidth={2} />
            Link account
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} footnote="Assets minus liabilities" />
        <StatCard label="Assets" value={formatCurrency(assets)} trend="positive" />
        <StatCard
          label="Liabilities"
          value={formatCurrency(liabilities)}
          trend="negative"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts linked"
          description="Add checking, savings, credit, or investment accounts to get started."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, items }) => {
            const Icon = typeMeta[type].icon;
            const subtotal = items.reduce((s, a) => s + Number(a.balance), 0);

            return (
              <section key={type}>
                <header className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} strokeWidth={1.5} className="text-muted" />
                    <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-faint">
                      {typeMeta[type].label}
                    </h2>
                  </div>
                  <span className="text-xs tabular text-muted">{formatCurrency(subtotal)}</span>
                </header>

                <div className="card divide-y divide-border overflow-hidden">
                  {items.map((a) => {
                    const negative = a.balance < 0;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-subtle/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted">{a.institution ?? '—'}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              'font-display text-lg tabular',
                              negative ? 'text-negative' : 'text-foreground'
                            )}
                          >
                            {negative ? '−' : ''}
                            {formatCurrency(Math.abs(Number(a.balance)))}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-faint">
                            {a.currency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
