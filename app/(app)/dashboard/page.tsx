import { startOfMonth, subMonths } from 'date-fns';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import { CategoryDonut } from '@/components/charts/category-donut';
import { TransactionRow } from '@/components/ui/transaction-row';
import { EmptyState } from '@/components/ui/empty-state';
import { BudgetGlance } from '@/components/ui/budget-glance';
import { getAccounts, getTransactions, getTransactionsSince, getBudgets, getGoals } from '@/lib/data/queries';
import { buildCashflow, buildCategorySlices, sumByType } from '@/lib/utils/aggregations';
import { formatCurrency, formatPercent } from '@/lib/utils/cn';
import Link from 'next/link';
import { ArrowRight, Wallet, ArrowLeftRight } from 'lucide-react';

// This page renders server-side on each request and should not be cached
// across requests — user data changes and should be reflected immediately.
export const revalidate = 60;

export default async function DashboardPage() {
  // Fetch enough history for the cashflow chart (6 months) AND for accurate
  // month-to-date math. The "recent activity" widget gets a separate, smaller
  // fetch since it only shows the latest 6 transactions.
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6));

  const [accounts, recentTxs, allTxs, budgets, goals] = await Promise.all([
    getAccounts(),
    getTransactions(50),                    // for "Recent activity" widget
    getTransactionsSince(sixMonthsAgo),     // for math (income/expense/cashflow/category)
    getBudgets(),
    getGoals(),
  ]);

  const liquid = accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const monthStart = startOfMonth(new Date());
  const monthFlow = sumByType(allTxs, monthStart);

  const cashflow = buildCashflow(allTxs, 6);
  const { slices, total: monthSpend } = buildCategorySlices(allTxs);

  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetSpent = budgets.reduce((s, b) => s + Number(b.spent ?? 0), 0);
  const budgetPct = budgetTotal > 0 ? budgetSpent / budgetTotal : 0;

  const topGoal =
    goals.length > 0
      ? goals
          .slice()
          .sort((a, b) => {
            const aTarget = Number(a.target_amount) || 1;
            const bTarget = Number(b.target_amount) || 1;
            return Number(b.current_amount) / bTarget - Number(a.current_amount) / aTarget;
          })[0]
      : null;

  const recent = recentTxs.slice(0, 6);

  const hasMonthlyBudgets = budgets.some((b) => b.period === 'monthly');
  const hasTopGoal = !!(topGoal && Number(topGoal.target_amount) > 0);
  const hasRightColumn = hasMonthlyBudgets || hasTopGoal;

  // Detect the "just signed up, no data yet" state for a friendlier first experience
  const isEmpty =
    accounts.length === 0 &&
    recentTxs.length === 0 &&
    budgets.length === 0 &&
    goals.length === 0;

  if (isEmpty) {
    return (
      <div className="stagger space-y-6">
        <PageHeader
          eyebrow="Overview"
          title="Welcome to Tally"
          description="Let's get set up with your real information."
        />

        <div className="card p-8 sm:p-12">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
              <Wallet size={20} strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-2xl text-foreground">A fresh page.</h2>
            <p className="mt-2 text-sm text-muted">
              Start by adding an account — checking, savings, credit, or investment.
              Once you have accounts, you can log transactions, set budgets, and track
              goals.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/accounts" className="btn-primary">
                <Wallet size={15} strokeWidth={2} />
                Add your first account
              </Link>
              <Link href="/transactions" className="btn-outline">
                <ArrowLeftRight size={15} strokeWidth={2} />
                Or add a transaction
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-faint">
          Your data stays private — visible only to you.
        </p>
      </div>
    );
  }

  const hasTransactions = allTxs.length > 0;
  const hasSpendSlices = slices.length > 0 && monthSpend > 0;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Your Tally"
        description="A considered view of your money this month."
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          label="Net MTD"
          value={(monthFlow.net >= 0 ? '+' : '−') + formatCurrency(Math.abs(monthFlow.net))}
          trend={monthFlow.net >= 0 ? 'positive' : 'negative'}
          footnote={monthFlow.net >= 0 ? 'Saved this month' : 'Over by this much'}
        />
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
          footnote={
            monthFlow.refund > 0
              ? `Net of ${formatCurrency(monthFlow.refund)} refunds`
              : budgetTotal > 0
                ? formatPercent(budgetPct) + ' of budget'
                : undefined
          }
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
          {hasTransactions ? (
            <CashflowChart data={cashflow} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-faint">
              Not enough history yet — check back after a few transactions.
            </div>
          )}
        </div>

        <div className="card p-5 sm:p-6">
          <div className="mb-2">
            <h2 className="font-display text-lg text-foreground">By category</h2>
            <p className="text-xs text-faint">This month</p>
          </div>
          {hasSpendSlices ? (
            <>
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
            </>
          ) : (
            <div className="flex h-56 items-center justify-center text-center text-sm text-faint">
              No spending this month yet.
            </div>
          )}
        </div>
      </div>

      {/* Transactions + right rail (budgets + top goal) */}
      <div className={`grid gap-4 ${hasRightColumn ? 'lg:grid-cols-3' : ''}`}>
        <div className={`card p-5 sm:p-6 ${hasRightColumn ? 'lg:col-span-2' : ''}`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Recent activity</h2>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {recent.length > 0 ? (
            <div>
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transactions yet"
              description="Add your first transaction to see it appear here."
              className="border-none bg-transparent py-6"
            />
          )}
        </div>

        {hasRightColumn && (
          <div className="space-y-4">
            {hasMonthlyBudgets && <BudgetGlance budgets={budgets} />}

            {hasTopGoal && topGoal && (
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
        )}
      </div>
    </div>
  );
}
