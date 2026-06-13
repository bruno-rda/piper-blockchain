import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { client } from '@/client/client.gen'; // Use client directly if needed
import { getWalletTransactions, getTransaction } from '@/client';
import type { WalletBalanceResponse, TransactionDetailResponse } from '@/client/types.gen';
import { useCoins } from '@/hooks/useCoins';
import { Modal } from '@/components/Modal';
import { TransactionTable } from '@/components/TransactionTable';
import { TransactionDetailView } from '@/components/TransactionDetailView';

export function BalancesPage() {
  const { addToast } = useToast();
  const { format } = useCoins();
  const [balances, setBalances] = useState<WalletBalanceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Modal State
  const [selectedWallet, setSelectedWallet] = useState<WalletBalanceResponse | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<TransactionDetailResponse[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);

  // Transaction detail modal
  const [txDetail, setTxDetail] = useState<TransactionDetailResponse | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);

  const fetchBalances = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError('');
      // Since SDK might not have getAllBalances yet, use client.get directly
      const res = await client.get<WalletBalanceResponse[]>({
        url: '/wallets/balances/all'
      });

      if (res.error) {
        setError('Failed to fetch balances');
      } else if (res.data) {
        setBalances(res.data);
      }
    } catch (err) {
      setError('An error occurred while fetching balances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleCopyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    addToast('Address copied', 'success');
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  const handleRowClick = async (wallet: WalletBalanceResponse) => {
    setSelectedWallet(wallet);
    setWalletTransactions([]);
    setLoadingTransactions(true);
    setTransactionsModalOpen(true);

    try {
      const res = await getWalletTransactions({ path: { address: wallet.wallet_address } });
      if (res.data) {
        setWalletTransactions(res.data);
      }
    } catch {
      addToast('Failed to load transactions for wallet', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleViewTransaction = async (txId: string) => {
    try {
      const res = await getTransaction({ path: { tx_id: txId } });
      if (res.data) {
        setTxDetail(res.data);
        setTxModalOpen(true);
      }
    } catch {
      addToast('Failed to load transaction', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full min-h-[calc(100vh-8rem)] pb-10">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl">Wallet Balances</h1>
          <p className="text-body text-[--color-text-tertiary] mt-1">Overview of all users and their balances.</p>
        </div>
        <button
          onClick={() => fetchBalances(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 bg-[#202020] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#2a2a2a] transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-[#202020] rounded-[2rem] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <RefreshCw size={28} className="text-[--color-text-tertiary] animate-spin" />
            <p className="text-body">Loading balances...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <p className="text-[--color-danger]">{error}</p>
            <button
              onClick={() => fetchBalances()}
              className="bg-[--color-surface-subtle] text-white px-4 py-2 rounded-lg text-sm hover:bg-[--color-surface-border] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : balances.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <p className="text-body">No wallets found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#333333]">
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Username</th>
                  <th className="py-4 px-6 text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Wallet Address</th>
                  <th className="py-4 px-6 text-right text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Balance</th>
                  <th className="py-4 px-6 text-right text-[--color-text-tertiary] font-medium text-xs uppercase tracking-wider">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((wallet, idx) => {
                  const isLast = idx === balances.length - 1;
                  return (
                    <tr
                      key={`${wallet.wallet_address}-${idx}`}
                      onClick={() => handleRowClick(wallet)}
                      className={`${isLast ? '' : 'border-b border-[#2a2a2a]'} hover:bg-[#2a2a2a] transition-colors cursor-pointer`}
                    >
                      <td className="py-4 px-6 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[--color-surface-raised] flex items-center justify-center font-bold text-xs text-[--color-text-primary]">
                            {wallet.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[--color-text-primary] text-sm">
                            {wallet.username}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div
                          onClick={(e) => handleCopyAddress(e, wallet.wallet_address)}
                          className="flex items-center gap-2 w-fit px-3 py-1.5 hover:bg-[#333] rounded-md transition-colors cursor-pointer group"
                          title="Copy address"
                        >
                          <TruncatedAddress
                            address={wallet.wallet_address}
                            className="!text-[13px] font-mono text-[--color-text-secondary] group-hover:text-[--color-text-primary]"
                          />
                          {copiedAddress === wallet.wallet_address ? (
                            <Check size={14} className="text-[--color-success] shrink-0" />
                          ) : (
                            <Copy size={14} className="text-[--color-text-tertiary] group-hover:text-[--color-text-primary] shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-sm text-[--color-text-primary] font-medium">
                        {format(wallet.balance)}
                      </td>
                      <td className="py-4 px-6 text-right text-sm text-[--color-text-secondary]">
                        {wallet.transaction_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions Modal */}
      <Modal open={transactionsModalOpen} onClose={() => setTransactionsModalOpen(false)} maxWidth="3xl">
        {selectedWallet && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-display text-2xl mb-1">
                {selectedWallet.username}&apos;s Transactions
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[--color-text-tertiary] mt-2">
                <span className="bg-[#2a2a2a] px-2 py-1 rounded text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {selectedWallet.wallet_address}
                </span>
                <span className="font-semibold text-[#4ade80] ml-2">
                  Balance: {format(selectedWallet.balance)}
                </span>
              </div>
            </div>

            {loadingTransactions ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 bg-[#1a1a1a] rounded-[2rem]">
                <RefreshCw size={24} className="text-[--color-text-tertiary] animate-spin" />
                <p className="text-sm text-[--color-text-tertiary]">Loading transactions...</p>
              </div>
            ) : (
              <div className="-mx-4 -mb-4">
                {/* We use a negative margin inside the modal because TransactionTable brings its own padding and rounded corners */}
                <TransactionTable
                  variant="block"
                  transactions={walletTransactions}
                  onRowClick={handleViewTransaction}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)}>
        {txDetail && <TransactionDetailView tx={txDetail} />}
      </Modal>
    </div>
  );
}
