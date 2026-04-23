import { ArrowLeftRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { TransactionList } from '@/components/ui/transaction-list';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AddTransactionButton,
  ImportCsvButton,
} from '@/components/ui/transaction-actions';
import {
  getTransactions,
  getAccounts,
  getCategories,
} from '@/lib/data/queries';

export const revalidate = 60;

export default async function TransactionsPage() {
  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(200),
    getAccounts(),
    getCategories(),
  ]);

  // Trim to just the fields the forms need (avoid passing extras to client)
  const accountsLite = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }));
  const categoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }));

  const hasAccounts = accounts.length > 0;
  const hasTransactions = transactions.length > 0;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        description="Every inflow and outflow, in one place."
        actions={
          <div className="flex items-center gap-2">
            <ImportCsvButton accounts={accountsLite} categories={categoriesLite} />
            <AddTransactionButton accounts={accountsLite} categories={categoriesLite} />
          </div>
        }
      />

      {!hasAccounts ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Add an account first"
          description="Transactions have to live inside an account. Head to the Accounts tab to add checking, savings, or credit."
        />
      ) : !hasTransactions ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Add one manually, or import a CSV from your bank."
          action={
            <div className="flex items-center gap-2">
              <AddTransactionButton
                accounts={accountsLite}
                categories={categoriesLite}
                label="Add your first transaction"
              />
            </div>
          }
        />
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accountsLite}
          categories={categoriesLite}
        />
      )}
    </div>
  );
}
