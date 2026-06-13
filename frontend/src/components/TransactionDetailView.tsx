import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useCoins } from '@/hooks/useCoins';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import type { TransactionDetailResponse } from '@/client';

export function TransactionDetailView({ tx }: { tx: TransactionDetailResponse }) {
  const { format } = useCoins();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-display text-2xl mb-1">Transaction Detail</h3>
        <p className="text-sm text-[--color-text-tertiary]">
          {new Date(tx.timestamp).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4">
        <TxDetailValue
          label="ID"
          value={<CopyBox value={tx.id} />}
        />
        {tx.block_height !== null && tx.block_height !== undefined && (
          <TxDetailValue label="Block Height" value={`#${tx.block_height}`} />
        )}
        <TxDetailValue
          label="Type"
          value={
            tx.is_coinbase ? (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-[--color-success-ghost] text-[--color-success]">
                Coinbase
              </span>
            ) : (
              'Transfer'
            )
          }
        />
        <TxDetailValue label="Fee" value={format(tx.fee)} />
      </div>

      {/* Inputs */}
      {tx.inputs.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-[--color-text-secondary] uppercase tracking-wider mb-4">Inputs</h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#333]">
            <table className="w-full text-sm">
              <thead className="bg-[#222]">
                <tr>
                  <th className="text-left py-3 px-4 text-[--color-text-tertiary] font-medium">Ref TX</th>
                  <th className="text-left py-3 px-4 text-[--color-text-tertiary] font-medium">Index</th>
                  <th className="text-left py-3 px-4 text-[--color-text-tertiary] font-medium">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {tx.inputs.map((input, i) => (
                  <tr key={i} className="hover:bg-[#202020] transition-colors">
                    <td className="py-3 px-4" style={{ fontFamily: 'var(--font-mono)' }}>
                      <span className="text-[--color-text-secondary]">{input.ref_tx_id.slice(0, 12)}…</span>
                    </td>
                    <td className="py-3 px-4 text-[--color-text-primary] font-medium">{input.ref_output_index}</td>
                    <td className="py-3 px-4" style={{ fontFamily: 'var(--font-mono)' }}>
                      <span className="text-[--color-text-secondary]">{input.signature.slice(0, 16)}…</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outputs */}
      {tx.outputs.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-[--color-text-secondary] uppercase tracking-wider mb-4">Outputs</h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#333]">
            <table className="w-full text-sm">
              <thead className="bg-[#222]">
                <tr>
                  <th className="text-left py-3 px-4 text-[--color-text-tertiary] font-medium">Recipient</th>
                  <th className="text-right py-3 px-4 text-[--color-text-tertiary] font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {tx.outputs.map((output, i) => (
                  <tr key={i} className="hover:bg-[#202020] transition-colors">
                    <td className="py-3 px-4">
                      <TruncatedAddress address={output.recipient} className="!text-[13px] !text-[--color-text-secondary]" />
                    </td>
                    <td className="py-3 px-4 text-right text-[--color-text-primary] font-bold">
                      {format(output.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TxDetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-[--color-text-tertiary] uppercase tracking-widest">{label}</span>
      <span className="text-base text-[--color-text-primary]">{value}</span>
    </div>
  );
}

export function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="text-[11px] text-[--color-text-tertiary]"
        style={{ fontFamily: 'var(--font-mono)' }}
        title={value}
      >
        {value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value}
      </span>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-[--color-surface-subtle] transition-colors text-[--color-text-tertiary]"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
