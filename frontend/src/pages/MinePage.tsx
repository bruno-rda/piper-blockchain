import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { useProfiles } from '@/contexts/ProfileContext';
import { useCoins } from '@/hooks/useCoins';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import { TransactionTable } from '@/components/TransactionTable';
import { getMempool, getMempoolStatus } from '@/client';
import type { TransactionMempoolResponse, MempoolStatusResponse } from '@/client';

export function MinePage() {
  const { profiles, activeProfile } = useProfiles();
  const { format } = useCoins();

  const [minerAddress, setMinerAddress] = useState(activeProfile?.address ?? '');

  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [miningStarted, setMiningStarted] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hashRate, setHashRate] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [miningResult, setMiningResult] = useState<{ height: number; hash: string } | null>(null);
  const [miningError, setMiningError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mempool state
  const [mempool, setMempool] = useState<TransactionMempoolResponse[]>([]);
  const [mempoolStatus, setMempoolStatus] = useState<MempoolStatusResponse | null>(null);

  // Fetch mempool
  const fetchMempool = useCallback(async () => {
    try {
      const [mempoolRes, statusRes] = await Promise.all([getMempool(), getMempoolStatus()]);
      if (mempoolRes.data) setMempool(mempoolRes.data);
      if (statusRes.data) setMempoolStatus(statusRes.data);
    } catch {
      // Silently fail — will retry
    }
  }, []);

  // Poll mempool every 10s
  useEffect(() => {
    fetchMempool();
    const interval = setInterval(fetchMempool, 10_000);
    return () => clearInterval(interval);
  }, [fetchMempool]);

  // Poll mining status every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getMempoolStatus();
        if (res.data) setMempoolStatus(res.data);
      } catch {
        // ignore
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  const stopMining = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsMining(false);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
  };

  const startMining = async () => {
    if (!minerAddress) return;

    setIsMining(true);
    setMiningStarted(true);
    setMiningResult(null);
    setMiningError('');
    setNonce(0);
    setElapsed(0);
    setHashRate(0);
    setLogLines([]);

    startTimeRef.current = Date.now();

    // Elapsed timer
    elapsedIntervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
    }, 1000);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/blocks/mining/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ miner_wallet_address: minerAddress }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        setMiningError(errBody?.detail ?? `Mining failed: ${response.statusText}`);
        setIsMining(false);
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setMiningError('No response stream.');
        setIsMining(false);
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // SSE format: "data: {...}"
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              setLogLines((prev) => {
                const next = [...prev, jsonStr];
                return next.length > 100 ? next.slice(-100) : next;
              });

              if (event.type === 'progress' || event.nonce !== undefined) {
                const currentNonce = event.nonce ?? 0;
                setNonce(currentNonce);
                const elapsedSecs = (Date.now() - startTimeRef.current) / 1000;
                if (elapsedSecs > 0) {
                  setHashRate(Math.round(currentNonce / elapsedSecs));
                }
              }

              if (event.type === 'result' || event.block_hash || event.height !== undefined) {
                if (event.block_hash || event.hash) {
                  setMiningResult({
                    height: event.height ?? event.block_height ?? 0,
                    hash: event.block_hash ?? event.hash ?? '',
                  });
                }
              }

              if (event.type === 'error') {
                setMiningError(event.message ?? 'Mining error.');
              }
            } catch {
              // Not valid JSON, add raw line
              setLogLines((prev) => {
                const next = [...prev, trimmed];
                return next.length > 100 ? next.slice(-100) : next;
              });
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMiningError(err instanceof Error ? err.message : 'Mining failed.');
      }
    } finally {
      setIsMining(false);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      fetchMempool();
    }
  };

  const relativeTime = (timestamp: string) => {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full pb-10">
      {/* Header Area */}
      <div>
        <h1 className="text-display text-3xl">Mining Operations</h1>
        <p className="text-body text-[--color-text-tertiary] mt-1">Generate blocks and secure the network.</p>
      </div>

      {/* Top — Mining Panel */}
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-[#202020] rounded-[2rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-display text-3xl">Mine a Block</h2>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                isMining
                  ? 'bg-[--color-warning-ghost] text-[--color-warning]'
                  : 'bg-[--color-surface-subtle] text-[--color-text-tertiary]'
              }`}
            >
              {isMining && <span className="w-1.5 h-1.5 rounded-full bg-[--color-warning] animate-mining-pulse" />}
              {isMining ? 'Mining Active' : 'Idle'}
            </span>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[--color-text-secondary]">Miner Address</label>
              <select
                value={minerAddress}
                onChange={(e) => setMinerAddress(e.target.value)}
                disabled={isMining}
                className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] appearance-none cursor-pointer disabled:opacity-50 transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px',
                }}
              >
                {profiles.length === 0 && (
                  <option value="" disabled>
                    No saved wallets
                  </option>
                )}
                {profiles.map((p) => (
                  <option key={p.address} value={p.address}>
                    {p.username} — {p.address.slice(0, 8)}…{p.address.slice(-6)}
                  </option>
                ))}
              </select>
            </div>

            {miningError && <p className="text-sm text-[--color-danger]">{miningError}</p>}

            <div className="flex gap-3">
              <button
                onClick={startMining}
                disabled={!minerAddress || mempool.length === 0}
                className="flex-1 bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-base font-bold hover:bg-[#333333] transition-colors disabled:opacity-50"
              >
                {mempool.length === 0 ? 'Mempool Empty' : 'Start Mining'}
              </button>
              {isMining && (
                <button
                  onClick={stopMining}
                  className="bg-transparent border border-[--color-danger] text-[--color-danger] rounded-lg px-4 py-3 text-sm font-medium hover:bg-[--color-danger-ghost] transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Stats & Log */}
          {(miningStarted || miningResult) && (
            <>
              <div className="grid grid-cols-3 gap-3 mt-8 mb-5">
                <StatTile label="Elapsed" value={`${elapsed}s`} />
                <StatTile label="Nonce" value={nonce.toLocaleString()} />
                <StatTile label="Speed" value={`${hashRate.toLocaleString()} H/s`} />
              </div>

              {/* Log panel */}
              <div
                ref={logRef}
                className="bg-[#2a2a2a] rounded-lg p-4 max-h-48 overflow-y-auto shadow-inner"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              >
                {logLines.length === 0 ? (
                  <div className="text-[--color-text-tertiary] italic">Initializing miner…</div>
                ) : (
                  logLines.map((line, i) => (
                    <div key={i} className={`${line.includes('Success') ? 'text-[--color-success] font-bold' : 'text-[--color-text-secondary]'}`}>
                      {line}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom — Mempool Table */}
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-display text-2xl">Pending Transactions</h3>
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-[#202020] text-[--color-text-tertiary] shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
            {mempool.length}
          </span>
          {mempoolStatus?.mining_active && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-[--color-warning] ml-auto bg-[#202020] px-3 py-1 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[--color-warning] animate-mining-pulse" />
              Mining active
            </div>
          )}
        </div>

        <TransactionTable variant="mempool" transactions={mempool} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#2a2a2a] rounded-lg p-4 text-center shadow-inner">
      <div
        className="text-lg font-semibold text-[--color-text-primary] tabular-nums"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
      <div className="text-xs text-[--color-text-secondary] mt-0.5">{label}</div>
    </div>
  );
}
