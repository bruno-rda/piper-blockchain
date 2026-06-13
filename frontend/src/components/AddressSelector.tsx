import { useState } from 'react';
import { useProfiles } from '@/contexts/ProfileContext';

interface AddressSelectorProps {
  value: string;
  onChange: (address: string) => void;
  label: string;
  helperText?: string;
}

/**
 * Dropdown of saved profiles with an "Other address…" option that reveals a text input.
 * Pre-selects the active profile if no value is set.
 */
export function AddressSelector({ value, onChange, label, helperText }: AddressSelectorProps) {
  const { profiles } = useProfiles();
  const [isCustom, setIsCustom] = useState(false);

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === '__custom__') {
      setIsCustom(true);
      onChange('');
    } else {
      setIsCustom(false);
      onChange(selectedValue);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-[--color-text-secondary]">{label}</label>
      <select
        value={isCustom ? '__custom__' : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] appearance-none cursor-pointer transition-colors"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
      >
        {profiles.length === 0 && !isCustom && (
          <option value="" disabled>
            No saved wallets
          </option>
        )}
        {profiles.map((p) => (
          <option key={p.address} value={p.address}>
            {p.username} — {p.address.slice(0, 8)}…{p.address.slice(-6)}
          </option>
        ))}
        <option value="__custom__">Other address…</option>
      </select>

      {isCustom && (
        <input
          type="text"
          placeholder="Enter address…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] mt-1 transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      )}

      {helperText && (
        <span className="text-xs text-[--color-text-tertiary]">{helperText}</span>
      )}
    </div>
  );
}
