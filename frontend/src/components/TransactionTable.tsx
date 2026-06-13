import { ArrowUp } from 'lucide-react';
import { useCoins } from '@/hooks/useCoins';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import type { TransactionMempoolResponse, TransactionDetailResponse } from '@/client';

interface TransactionTableProps {
  variant: 'mempool' | 'block';
  transactions: (TransactionMempoolResponse | TransactionDetailResponse)[];
  onRowClick?: (txId: string) => void;
}

export function TransactionTable({ variant, transactions, onRowClick }: TransactionTableProps) {
  const { format } = useCoins();

  const relativeTime = (timestamp: string) => {
    const t = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (diff < 0) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-[--color-text-tertiary] text-base bg-[#202020] rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        {variant === 'mempool' ? 'No pending transactions. The mempool is clear.' : 'No transactions in this block.'}
      </div>
    );
  }

  return (
    <div className="bg-[#202020] rounded-[2rem] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[#333333]">
              <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">ID</th>
              {variant === 'block' && (
                <>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Inputs</th>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Outputs</th>
                </>
              )}
              {variant === 'mempool' && (
                <>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Time</th>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Sender</th>
                </>
              )}
              <th className="py-4 px-6 text-right text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Amount</th>
              <th className="py-4 px-6 text-right text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Fee</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txBase, i) => {
              const isLast = i === transactions.length - 1;
              if (variant === 'mempool') {
                const tx = txBase as TransactionMempoolResponse;
                return (
                  <tr
                    key={tx.id}
                    onClick={() => onRowClick?.(tx.id)}
                    className={`${isLast ? '' : 'border-b border-[#2a2a2a]'} hover:bg-[#2a2a2a] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-4 px-6">
                      <span className="text-[--color-text-tertiary] text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {tx.id.slice(0, 12)}…
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-[--color-text-secondary]">{relativeTime(tx.timestamp)}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className="text-[--color-text-secondary]">
                        {tx.sender_username ?? (
                          <TruncatedAddress address={tx.sender_address} className="!text-[13px]" />
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right text-sm text-[--color-text-primary] font-medium">{format(tx.amount)}</td>
                    <td className="py-4 px-6 text-right text-sm text-[--color-text-secondary]">
                      {tx.fee > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          <ArrowUp size={12} className="text-[--color-text-tertiary]" /> {format(tx.fee)}
                        </span>
                      ) : (
                        format(tx.fee)
                      )}
                    </td>
                  </tr>
                );
              } else {
                const tx = txBase as TransactionDetailResponse;
                const amount = tx.outputs.reduce((sum, o) => sum + o.amount, 0);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => onRowClick?.(tx.id)}
                    className={`${isLast ? '' : 'border-b border-[#2a2a2a]'} hover:bg-[#2a2a2a] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-4 px-6">
                      <span className="text-[--color-text-tertiary] text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {tx.id.slice(0, 12)}…
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {tx.is_coinbase ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[--color-success-ghost] text-[--color-success]">
                          Coinbase
                        </span>
                      ) : (
                        <span className="text-sm text-[--color-text-secondary]">Transfer</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-[--color-text-secondary]">{tx.inputs.length}</td>
                    <td className="py-4 px-6 text-sm text-[--color-text-secondary]">{tx.outputs.length}</td>
                    <td className="py-4 px-6 text-right text-sm text-[--color-text-primary] font-medium">{format(amount)}</td>
                    <td className="py-4 px-6 text-right text-sm text-[--color-text-secondary]">{format(tx.fee)}</td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
