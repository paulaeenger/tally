import { startOfMonth } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import { CategoryDonut } from '@/components/charts/category-donut';
import { TransactionRow } from '@/components/ui/transaction-row';
import { getAccounts, getTransactions, getBudgets, getGoals } from '@/lib/data/queries';
import { buildCashflow, buildCategorySlices, sumByType } from '@/lib/utils/aggregations';
import { formatCurrency, formatPercent } from '@/lib/utils/cn';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default async function DashboardPage() {
  const [accounts, transactions, budgets, goals] = await Promise.all([
    getAccounts(),
    getTransactions(50),
    getBudgets(),
    getGoals(),
  ]);

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const liquid = accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const monthStart = startOfMonth(new Date());
  const monthFlow = sumByType(transactions, monthStart);

  const cashflow = buildCashflow(transactions, 6);
  const { slices, total: monthSpend } = buildCategorySlices(transactions);

  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetSpent = budgets.reduce((s, b) => s + Number(b.spent ?? 0), 0);
  const budgetPct = budgetTotal > 0 ? budgetSpent / budgetTotal : 0;

  const topGoal = goals
    .slice()
    .sort((a, b) => b.current_amount / b.target_amount - a.current_amount / a.target_amount)[0];

  const recent = transactions.slice(0, 6);

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Good morning"
        description="A considered view of your money this month."
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} footnote="Across all accounts" />
        <StatCard label="Liquid" value={formatCurrency(liquid)} footnote="Checking & savings" />
        <StatCard
          label="Income MTD"
          value={formatCurrency(monthFlow.income)}
          trend="positive"
        />
        <StatCard
          label="Spending MTD"
          value={formatCurrency(monthFlow.expense)}
          trend="negative"
          footnote={formatPercent(budgetPct) + ' of budget'}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-foreground">Cashflow</h2>
              <p className="text-xs text-faint">Last 6 months</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full bg-positive" />
                Income
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full bg-negative" />
                Expense
              </span>
            </div>
          </div>
          <CashflowChart data={cashflow} />
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-2">
            <h2 className="font-display text-lg text-foreground">By category</h2>
            <p className="text-xs text-faint">This month</p>
          </div>
          <CategoryDonut data={slices.slice(0, 6)} total={monthSpend} />
          <ul className="mt-4 space-y-1.5">
            {slices.slice(0, 4).map((s) => (
              <li key={s.name} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular text-foreground">{formatCurrency(s.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Transactions + top goal */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Recent activity</h2>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div>
            {recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} compact />
            ))}
          </div>
        </div>

        {topGoal && (
          <div className="card overflow-hidden p-5 sm:p-6">
            <p className="label">Closest goal</p>
            <h3 className="mt-1 font-display text-xl text-foreground">{topGoal.name}</h3>
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="tabular text-foreground">
                  {formatCurrency(Number(topGoal.current_amount))}
                </span>
                <span className="tabular text-faint">
                  of {formatCurrency(Number(topGoal.target_amount))}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-subtle">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width:
                      Math.min(
                        100,
                        (Number(topGoal.current_amount) / Number(topGoal.target_amount)) * 100
                      ) + '%',
                    background: topGoal.color,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                {formatPercent(
                  Number(topGoal.current_amount) / Number(topGoal.target_amount),
                  0
                )}{' '}
                complete
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
