import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/Modal';
import { TransactionTable } from '@/components/TransactionTable';
import { TransactionDetailView, CopyBox } from '@/components/TransactionDetailView';
import { getBlocks, getBlock, getTransaction } from '@/client';
import type { BlockResponse, BlockDetailResponse, TransactionDetailResponse } from '@/client';

export function BlockchainPage() {
  const { addToast } = useToast();

  const [blocks, setBlocks] = useState<BlockResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const [blockDetail, setBlockDetail] = useState<BlockDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Transaction modal
  const [txDetail, setTxDetail] = useState<TransactionDetailResponse | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);

  const fetchBlocks = useCallback(async (newOffset: number, append = false) => {
    try {
      const res = await getBlocks({ query: { limit: 20, offset: newOffset } });
      if (res.data) {
        const fetched = res.data;
        if (append) {
          setBlocks((prev) => {
            // Deduplicate by height
            const existing = new Set(prev.map((b) => b.height));
            const unique = fetched.filter((b) => !existing.has(b.height));
            return [...unique, ...prev];
          });
        } else {
          setBlocks(fetched);
        }
        setHasMore(fetched.length === 20);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks(0);
  }, [fetchBlocks]);

  const loadOlderBlocks = async () => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    await fetchBlocks(newOffset, true);
  };

  const handleSelectBlock = async (height: number) => {
    if (selectedHeight === height) {
      setSelectedHeight(null);
      setBlockDetail(null);
      return;
    }
    setSelectedHeight(height);
    setLoadingDetail(true);
    try {
      const res = await getBlock({ path: { height } });
      if (res.data) {
        setBlockDetail(res.data);
      }
    } catch {
      addToast('Failed to load block details', 'error');
    } finally {
      setLoadingDetail(false);
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

  const relativeTime = (timestamp: string) => {
    const t = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (diff < 0) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Sort blocks by height ascending for display (latest on right)
  const sortedBlocks = [...blocks].sort((a, b) => a.height - b.height);

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full min-h-[calc(100vh-8rem)] pb-10">
      <h1 className="text-display">Blockchain</h1>

      {/* Visual Chain — horizontal scroll */}
      <div className="mb-6 overflow-x-auto pb-4">
        {loading ? (
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[200px] h-[200px] skeleton shrink-0 rounded-[2rem]" />
            ))}
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-12 text-[--color-text-tertiary] text-sm">
            No blocks found. Initialize the blockchain from the Config page.
          </div>
        ) : (
          <div className="flex items-center p-6">
            {/* Load older */}
            {hasMore && (
              <button
                onClick={loadOlderBlocks}
                className="text-xs text-[--color-text-secondary] hover:bg-[#202020] px-4 py-3 rounded-xl transition-colors shrink-0 mr-4 font-bold shadow-sm"
              >
                ← Older
              </button>
            )}

            {sortedBlocks.map((block, i) => (
              <div key={block.height} className="flex items-center shrink-0">
                {/* Connector line */}
                {i > 0 && (
                  <div className="w-8 h-1 bg-gradient-to-r from-[#2e1065] to-[#4c1d95] rounded-full mx-1 opacity-60" />
                )}

                {/* Block card */}
                <button
                  onClick={() => handleSelectBlock(block.height)}
                  className={`w-[200px] h-[200px] rounded-[2rem] p-6 text-left transition-all duration-300 cursor-pointer shrink-0 flex flex-col justify-between ${
                    selectedHeight === block.height
                      ? 'bg-gradient-to-br from-[#4c1d95] to-[#2e1065] ring-4 ring-[#8b5cf6] shadow-[0_0_40px_rgba(139,92,246,0.6)] scale-110 z-10'
                      : 'bg-gradient-to-br from-[#2e1065] to-[#170833] hover:from-[#3b177d] hover:to-[#1e0a44] shadow-[0_8px_30px_rgba(0,0,0,0.5)] opacity-90 hover:opacity-100 hover:scale-105 hover:-translate-y-2'
                  }`}
                >
                  <div>
                    {/* Genesis badge */}
                    {block.height === 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#8b5cf6]/30 text-[#ddd6fe] mb-2 inline-block uppercase tracking-wider">
                        Genesis
                      </span>
                    )}
                    <div className="text-4xl font-black text-white tabular-nums tracking-tighter drop-shadow-md">
                      #{block.height}
                    </div>
                    <div
                      className="text-xs text-[#a78bfa] mt-1 truncate font-medium opacity-80"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {block.hash.slice(0, 14)}…
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-semibold text-white">
                      {block.tx_count} {block.tx_count === 1 ? 'tx' : 'txs'}
                    </div>
                    <div className="text-xs text-[#c4b5fd]">
                      {relativeTime(block.timestamp)}
                    </div>
                    {block.miner_username && (
                      <div className="text-xs text-[#c4b5fd] truncate flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shrink-0"></span>
                        {block.miner_username}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block Detail Panel — slides down */}
      <div
        className={`block-detail-enter ${selectedHeight !== null ? 'open' : ''}`}
      >
        {selectedHeight !== null && (
          <div className="mt-8 px-4">
            {loadingDetail ? (
              <div className="flex gap-4">
                <div className="skeleton h-8 w-40 rounded" />
                <div className="skeleton h-8 w-64 rounded" />
              </div>
            ) : blockDetail ? (
              <>
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4 mb-6 pl-2">
                  <h3 className="text-display text-2xl drop-shadow-sm">Block #{blockDetail.height}</h3>
                  <CopyBox value={blockDetail.hash} />
                  {blockDetail.miner_username && (
                    <span className="text-sm text-[--color-text-secondary] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                      Mined by <span className="text-[--color-text-primary] font-medium">{blockDetail.miner_username}</span>
                    </span>
                  )}
                  <span className="text-sm text-[--color-text-tertiary] font-medium">
                    {new Date(blockDetail.timestamp + (blockDetail.timestamp.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                  </span>
                </div>

                {/* Transactions table */}
                <div className="mt-4">
                  <TransactionTable
                    variant="block"
                    transactions={blockDetail.transactions}
                    onRowClick={handleViewTransaction}
                  />
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)}>
        {txDetail && <TransactionDetailView tx={txDetail} />}
      </Modal>
    </div>
  );
}
