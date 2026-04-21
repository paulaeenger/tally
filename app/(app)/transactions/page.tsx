import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { TransactionList } from '@/components/ui/transaction-list';
import { getTransactions } from '@/lib/data/queries';

export default async function TransactionsPage() {
  const transactions = await getTransactions(200);

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        description="Every inflow and outflow, in one place."
        actions={
          <button className="btn-primary">
            <Plus size={15} strokeWidth={2} />
            New
          </button>
        }
      />
      <TransactionList transactions={transactions} />
    </div>
  );
}
