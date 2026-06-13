import { useState, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface TruncatedAddressProps {
  address: string;
  className?: string;
}

/** Shows first 8 + … + last 6 chars. Click to copy full address. */
export function TruncatedAddress({ address, className = '' }: TruncatedAddressProps) {
  const { addToast } = useToast();
  const [showCopied, setShowCopied] = useState(false);

  const truncated =
    address.length > 14
      ? `${address.slice(0, 8)}…${address.slice(-6)}`
      : address;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
      addToast('Address copied', 'info');
    } catch {
      // Clipboard API may fail in insecure contexts
    }
  }, [address, addToast]);

  return (
    <span
      className={`font-[--font-mono] text-[13px] cursor-pointer relative select-all ${className}`}
      style={{ fontFamily: 'var(--font-mono)' }}
      onClick={handleCopy}
      title={address}
    >
      {truncated}
      {showCopied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[--color-surface-overlay] border border-[--color-surface-border] text-[--color-text-primary] text-xs px-2 py-0.5 rounded whitespace-nowrap">
          Copied
        </span>
      )}
    </span>
  );
}
