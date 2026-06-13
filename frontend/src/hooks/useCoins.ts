import { useConfig } from '@/contexts/ConfigContext';

export function useCoins() {
  const { config } = useConfig();

  const unitsPerCoin = config?.units_per_coin ?? 1000;
  const coinName = config?.coin_name ?? 'Piper';
  const symbol = config?.unit_name ?? 'Pips';

  function format(atomic: number): string {
    const coins = atomic / unitsPerCoin;
    // Determine decimal places based on units_per_coin
    const decimals = Math.max(0, Math.floor(Math.log10(unitsPerCoin)));
    return `${coins.toFixed(decimals)} ${coinName}`;
  }

  function toAtomic(coins: number): number {
    return Math.round(coins * unitsPerCoin);
  }

  return { format, toAtomic, symbol, coinName };
}
