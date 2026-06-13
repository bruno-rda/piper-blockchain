import { useState } from 'react';
import { Lock, Unlock, Settings } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useCoins } from '@/hooks/useCoins';
import { useProfiles } from '@/contexts/ProfileContext';
import { useToast } from '@/contexts/ToastContext';
import { AddressSelector } from '@/components/AddressSelector';
import { verifyAdmin, initBlockchain, updateConfig, resetChain } from '@/client';

export function ConfigPage() {
  const { config, refetchConfig } = useConfig();
  const { format } = useCoins();
  const { activeProfile } = useProfiles();
  const { addToast } = useToast();

  // Admin state
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAdminVerify = async () => {
    setAdminError('');
    setAdminLoading(true);
    try {
      const res = await verifyAdmin({
        body: { admin_password: adminPassword },
      });
      if (res.error) {
        const detail = (res.error as { detail?: string }).detail;
        setAdminError(detail ?? 'Invalid admin password.');
      } else if (res.data) {
        setAdminToken(res.data.session_token);
        setAdminPassword('');
        addToast('Admin authenticated', 'success');
      }
    } catch {
      setAdminError('Network error.');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full pb-10">
      <h1 className="text-display text-3xl">Configuration</h1>

      {/* Config Display */}
      {config ? (
        <div className="bg-[#202020] rounded-[2rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <h2 className="text-title text-xl mb-6 flex items-center gap-2">
            <Settings size={20} className="text-[--color-text-secondary]" />
            Current Parameters
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
            <ConfigValue label="Difficulty" value={config.difficulty.toString()} />
            <ConfigValue label="Block Reward (coins)" value={config.block_reward_coins.toString()} />
            <ConfigValue label="Max Transactions" value={config.max_tx_per_block.toString()} />
            <ConfigValue label="Units per Coin" value={config.units_per_coin.toLocaleString()} />
            <ConfigValue label="Coin Name" value={config.coin_name} />
            <ConfigValue label="Unit Name" value={config.unit_name} />
          </div>
        </div>
      ) : (
        <div className="bg-[#202020] rounded-[2rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.4)] min-h-[200px] flex items-center justify-center">
          <div className="text-[--color-text-tertiary] animate-pulse">Loading config…</div>
        </div>
      )}

      {/* Admin Zone */}
      {!adminToken ? (
        <div className="bg-[#202020] rounded-[2rem] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.4)] flex flex-col items-center text-center max-w-xl mx-auto w-full">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Lock size={28} className="text-[--color-text-secondary]" />
          </div>
          <h2 className="text-display text-2xl mb-2">Admin Access Required</h2>
          <p className="text-sm text-[--color-text-tertiary] mb-8">Enter your password to unlock dangerous actions.</p>

          <div className="flex gap-3 w-full">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              className="flex-1 bg-[#2a2a2a] rounded-xl text-[--color-text-primary] text-base px-5 py-4 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors text-center shadow-inner"
              onKeyDown={(e) => e.key === 'Enter' && handleAdminVerify()}
            />
            <button
              onClick={handleAdminVerify}
              disabled={adminLoading || !adminPassword}
              className="bg-[#2a2a2a] text-white rounded-xl px-8 py-4 text-base font-bold hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              {adminLoading ? '...' : 'Unlock'}
            </button>
          </div>
          {adminError && <p className="text-sm text-[--color-danger] mt-4">{adminError}</p>}
        </div>
      ) : (
        <div className="bg-[#202020] rounded-[2rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-display text-2xl flex items-center gap-3">
              <Unlock size={24} className="text-[--color-success]" />
              Admin Actions
            </h2>
            <button
              onClick={() => setAdminToken(null)}
              className="text-sm text-[--color-text-tertiary] hover:text-[--color-text-primary] transition-colors px-4 py-2 rounded-lg hover:bg-[#2a2a2a]"
            >
              Lock Actions
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InitializeCard token={adminToken} activeAddress={activeProfile?.address ?? ''} />
            <EditConfigCard
              token={adminToken}
              config={config}
              onUpdated={() => {
                refetchConfig();
                addToast('Config updated', 'success');
              }}
            />
            <ResetCard token={adminToken} onReset={() => addToast('Chain reset successfully', 'success')} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Config Stat Value
   ================================================================ */

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-[--color-text-secondary] font-medium">{label}</span>
      <span className="text-xl font-bold text-[--color-text-primary]">{value}</span>
    </div>
  );
}

/* ================================================================
   Card 1 — Initialize Chain
   ================================================================ */

function InitializeCard({ token, activeAddress }: { token: string; activeAddress: string }) {
  const [address, setAddress] = useState(activeAddress);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInit = async () => {
    if (!address.trim()) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await initBlockchain({
        body: { miner_address: address.trim() },
        headers: { 'admin-token': token },
      });
      if (res.error) {
        const detail = (res.error as { detail?: string }).detail;
        setError(detail ?? 'Failed to initialize.');
      } else {
        setSuccess(res.data?.message ?? 'Blockchain initialized.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#2a2a2a] rounded-xl p-6 shadow-inner">
      <h4 className="text-title mb-1">Initialize Chain</h4>
      <p className="text-sm text-[--color-text-secondary] mb-4">
        Create the genesis block. Can only be done once.
      </p>

      <AddressSelector
        value={address}
        onChange={setAddress}
        label="Miner Address"
      />

      {error && <p className="text-sm text-[--color-danger] mt-2">{error}</p>}
      {success && <p className="text-sm text-[--color-success] mt-2">{success}</p>}

      <button
        onClick={handleInit}
        disabled={loading || !address.trim()}
        className="bg-[#333333] text-white rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#404040] transition-colors disabled:opacity-50 mt-3"
      >
        {loading ? 'Initializing…' : 'Initialize'}
      </button>
    </div>
  );
}

/* ================================================================
   Card 2 — Edit Config
   ================================================================ */

function EditConfigCard({
  token,
  config,
  onUpdated,
}: {
  token: string;
  config: { difficulty: number; block_reward_coins: number; max_tx_per_block: number; units_per_coin: number } | null;
  onUpdated: () => void;
}) {
  const [difficulty, setDifficulty] = useState(config?.difficulty?.toString() ?? '');
  const [blockReward, setBlockReward] = useState(config?.block_reward_coins?.toString() ?? '');
  const [maxTx, setMaxTx] = useState(config?.max_tx_per_block?.toString() ?? '');
  const [unitsPerCoin, setUnitsPerCoin] = useState(config?.units_per_coin?.toString() ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setLoading(true);

    // Build request with only changed fields
    const body: {
      difficulty?: number | null;
      block_reward_coins?: number | null;
      max_transactions_per_block?: number | null;
      units_per_coin?: number | null;
    } = {};

    const newDiff = parseInt(difficulty);
    const newReward = parseFloat(blockReward);
    const newMax = parseInt(maxTx);
    const newUnits = parseInt(unitsPerCoin);

    if (!isNaN(newDiff) && newDiff !== config?.difficulty) body.difficulty = newDiff;
    if (!isNaN(newReward) && newReward !== config?.block_reward_coins) body.block_reward_coins = newReward;
    if (!isNaN(newMax) && newMax !== config?.max_tx_per_block) body.max_transactions_per_block = newMax;
    if (!isNaN(newUnits) && newUnits !== config?.units_per_coin) body.units_per_coin = newUnits;

    try {
      const res = await updateConfig({
        body,
        headers: { 'admin-token': token },
      });
      if (res.error) {
        const detail = (res.error as { detail?: string }).detail;
        setError(detail ?? 'Failed to update config.');
      } else {
        onUpdated();
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#2a2a2a] rounded-xl p-6 shadow-inner">
      <h4 className="text-title mb-4">Edit Config</h4>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ConfigInput label="Difficulty" value={difficulty} onChange={setDifficulty} type="number" />
        <ConfigInput label="Block Reward (coins)" value={blockReward} onChange={setBlockReward} type="number" />
        <ConfigInput label="Max TX per Block" value={maxTx} onChange={setMaxTx} type="number" />
        <ConfigInput label="Units per Coin" value={unitsPerCoin} onChange={setUnitsPerCoin} type="number" />
      </div>

      {error && <p className="text-sm text-[--color-danger] mb-2">{error}</p>}

      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-[#333333] text-white rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#404040] transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save Config'}
      </button>
    </div>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[--color-text-secondary]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#333333] rounded-lg text-[--color-text-primary] text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] transition-colors"
      />
    </div>
  );
}

/* ================================================================
   Card 3 — Reset Chain
   ================================================================ */

function ResetCard({ token, onReset }: { token: string; onReset: () => void }) {
  const { clearProfiles } = useProfiles();
  const [resetProfiles, setResetProfiles] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await resetChain({
        body: { confirmation: 'RESET', reset_profiles: resetProfiles },
        headers: { 'admin-token': token },
      });
      if (res.error) {
        const detail = (res.error as { detail?: string }).detail;
        setError(detail ?? 'Failed to reset chain.');
      } else {
        if (resetProfiles) {
          clearProfiles();
        }
        setSuccess('Chain has been reset. You may want to reinitialize.');
        setConfirmation('');
        onReset();
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#2a2a2a] rounded-xl p-6 shadow-inner">
      <h4 className="text-title mb-1 text-[--color-danger]">Reset Chain</h4>
      <p className="text-sm text-[--color-text-secondary] mb-4">
        This will destroy all blocks and transactions. This action cannot be undone.
      </p>

      {/* Toggle */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={resetProfiles}
          onChange={(e) => setResetProfiles(e.target.checked)}
          className="accent-[--color-danger]"
        />
        <span className="text-sm text-[--color-text-secondary]">Also reset wallets and users</span>
      </label>

      {/* Confirmation input */}
      <div className="flex flex-col gap-1.5 mb-4 max-w-xs">
        <label className="text-xs text-[--color-text-secondary]">
          Type <span className="text-[--color-danger] font-semibold">RESET</span> to confirm
        </label>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="RESET"
          className="bg-[#333333] rounded-lg text-[--color-text-primary] text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-danger] transition-colors"
        />
      </div>

      {error && <p className="text-sm text-[--color-danger] mb-2">{error}</p>}
      {success && <p className="text-sm text-[--color-success] mb-2">{success}</p>}

      <button
        onClick={handleReset}
        disabled={loading || confirmation !== 'RESET'}
        className="bg-[--color-danger-ghost] text-[--color-danger] rounded-lg px-4 py-3 text-sm font-bold hover:bg-[--color-danger] hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? 'Resetting…' : 'Reset Chain'}
      </button>
    </div>
  );
}
