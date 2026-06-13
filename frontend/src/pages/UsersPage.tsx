import { useState, useEffect } from 'react';
import { Wallet, Plus, Eye, FileKey, Copy, Check } from 'lucide-react';
import { useProfiles, type StoredProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/contexts/ToastContext';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import { Modal } from '@/components/Modal';
import { useCoins } from '@/hooks/useCoins';
import { createUser, createWallet, getWalletBalance } from '@/client';
import {
  generateKeyPair,
  deriveAddress,
  encryptPrivateKey,
  decryptPrivateKey,
  exportWIF,
} from '@/lib/crypto';
const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
];

function getColorForUsername(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function UsersPage() {
  const { profiles, addProfile, removeProfile } = useProfiles();
  const { addToast } = useToast();

  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [showWifModal, setShowWifModal] = useState(false);

  const selectedProfile = profiles.find((p) => p.address === selectedAddress) ?? null;

  // Empty state
  if (profiles.length === 0 && !showCreateModal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[--color-surface-raised] border border-[--color-surface-border] flex items-center justify-center">
          <Wallet size={28} className="text-[--color-text-tertiary]" />
        </div>
        <h1 className="text-display">No users yet</h1>
        <p className="text-body">Create your first user to get started.</p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[--color-accent] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[--color-accent-dim] transition-colors mt-2"
        >
          Create User
        </button>
        <CreateWalletModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={(profile) => {
            addProfile(profile);
            setShowCreateModal(false);
            addToast('User created', 'success');
          }}
        />
      </div>
    );
  }

  const handleCopyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    addToast('Address copied', 'success');
  };

  return (
    <div className="flex flex-col gap-10 max-w-5xl mx-auto w-full min-h-[calc(100vh-8rem)] pb-10">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl">Your Users</h1>
          <p className="text-body text-[--color-text-tertiary] mt-1">Manage your keys and active session.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-[#202020] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#2a2a2a] transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
        >
          <Plus size={18} />
          <span>Add User</span>
        </button>
      </div>

      {/* Grid of Profile Cards */}
      <div className="flex-1 flex flex-wrap content-center justify-center gap-8">
        {profiles.map((profile) => (
          <button
            key={profile.address}
            onClick={() => {
              setSelectedAddress(profile.address);
              setShowDetailModal(true);
            }}
            className="flex flex-col items-center justify-center px-6 py-10 bg-[#202020] rounded-[2.5rem] transition-all duration-300 cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] shadow-[0_8px_30px_rgba(0,0,0,0.4)] w-full max-w-[280px]"
          >
            {/* Profile Picture */}
            <div
              className="w-40 h-40 rounded-full flex items-center justify-center text-6xl font-bold text-white mb-8 shrink-0 shadow-inner"
              style={{ backgroundColor: getColorForUsername(profile.username || 'Unknown') }}
            >
              {profile.username?.charAt(0).toUpperCase() || '?'}
            </div>

            <span className="text-[--color-text-primary] font-semibold text-2xl mb-6 truncate w-full text-center">
              {profile.username || 'Unknown'}
            </span>

            {/* Copyable Address Pill */}
            <div
              onClick={(e) => handleCopyAddress(e, profile.address)}
              className="flex items-center gap-2 w-full justify-between px-4 py-3 bg-[--color-surface-subtle] hover:bg-[--color-surface-border] rounded-xl transition-colors group/copy"
              title="Copy address"
            >
              <TruncatedAddress
                address={profile.address}
                className="!text-[14px] font-mono text-[--color-text-secondary] group-hover/copy:text-[--color-text-primary] transition-colors"
              />
              <Copy size={16} className="text-[--color-text-tertiary] group-hover/copy:text-[--color-text-primary] shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Modals */}
      <CreateWalletModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(profile) => {
          addProfile(profile);
          setShowCreateModal(false);
          addToast('User created', 'success');
        }}
      />

      {selectedProfile && (
        <>
          <WalletDetailModal
            open={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            profile={selectedProfile}
            onRemove={() => {
              removeProfile(selectedProfile.address);
              addToast('User removed from session', 'info');
              setShowDetailModal(false);
            }}
            onRevealKey={() => {
              setShowDetailModal(false);
              setShowRevealModal(true);
            }}
            onExportWif={() => {
              setShowDetailModal(false);
              setShowWifModal(true);
            }}
          />
          <RevealKeyModal
            open={showRevealModal}
            onClose={() => setShowRevealModal(false)}
            profile={selectedProfile}
          />
          <ExportWifModal
            open={showWifModal}
            onClose={() => setShowWifModal(false)}
            profile={selectedProfile}
          />
        </>
      )}
    </div>
  );
}

/* ================================================================
   Wallet Detail Modal
   ================================================================ */

function WalletDetailModal({
  open,
  onClose,
  profile,
  onRemove,
  onRevealKey,
  onExportWif,
}: {
  open: boolean;
  onClose: () => void;
  profile: StoredProfile;
  onRemove: () => void;
  onRevealKey: () => void;
  onExportWif: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const { format } = useCoins();
  useEffect(() => {
    if (open) {
      getWalletBalance({ path: { address: profile.address } })
        .then((res: any) => {
          if (res.error) {
            setBalance(0);
          } else if (res.data !== undefined) {
            const val = typeof res.data === 'number' ? res.data : res.data.balance;
            setBalance(val !== undefined ? val : 0);
          } else {
            setBalance(0);
          }
        })
        .catch(() => setBalance(0));
    } else {
      setBalance(null);
    }
  }, [open, profile.address]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(profile.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col">
        <h3 className="text-display text-2xl mb-1 text-center">{profile.username || 'Unknown Profile'}</h3>

        {/* Balance */}
        <div className="text-center mb-6 mt-2">
          {balance !== null ? (
            <span className="text-2xl font-medium text-[#4ade80] tracking-wide">{format(balance)}</span>
          ) : (
            <span className="text-sm text-[--color-text-tertiary] animate-pulse">Loading balance…</span>
          )}
        </div>

        {/* Address */}
        <div className="bg-[#2a2a2a] rounded-lg p-3 flex items-center gap-2 mb-6">
          <span
            className="flex-1 text-[13px] text-[--color-text-secondary] break-all"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {profile.address}
          </span>
          <button
            onClick={copyAddress}
            className="shrink-0 p-1.5 rounded-md hover:bg-[--color-surface-border] transition-colors text-[--color-text-tertiary] hover:text-[--color-text-primary]"
            title="Copy address"
          >
            {copied ? <Check size={14} className="text-[--color-success]" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onRevealKey}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-[#2a2a2a] hover:bg-[#333333] rounded-lg transition-colors text-[--color-text-primary]"
          >
            <Eye size={16} /> Reveal Private Key
          </button>

          <button
            onClick={onExportWif}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-[#2a2a2a] hover:bg-[#333333] rounded-lg transition-colors text-[--color-text-primary]"
          >
            <FileKey size={16} /> Export WIF
          </button>

          <button
            onClick={onRemove}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium bg-[--color-danger-ghost] text-[--color-danger] hover:bg-[--color-danger] hover:text-white rounded-lg transition-colors mt-2"
          >
            <Wallet size={16} /> Remove from Session
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================
   Create Wallet Modal
   ================================================================ */

function CreateWalletModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (profile: StoredProfile) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // 1. Generate keys
      const { privateKey, publicKey } = generateKeyPair();
      const address = deriveAddress(publicKey);
      const encryptedBlob = await encryptPrivateKey(privateKey, password);

      // 2. Register user on backend
      const userRes = await createUser({
        body: { username: username.trim(), password },
      });
      if (userRes.error) {
        setError((userRes.error as { detail?: string }).detail ?? 'Failed to create user.');
        setLoading(false);
        return;
      }
      const userId = userRes.data!.user_id;

      // 3. Register wallet on backend
      const walletRes = await createWallet({
        body: {
          user_id: userId,
          address,
          public_key: publicKey,
          encrypted_private_key: JSON.stringify(encryptedBlob),
        },
      });
      if (walletRes.error) {
        setError(
          (walletRes.error as { detail?: string }).detail ?? 'Failed to register wallet.',
        );
        setLoading(false);
        return;
      }

      // 4. Store profile locally
      const profile: StoredProfile = {
        userId,
        username: username.trim(),
        address,
        publicKey,
        encryptedPrivateKey: encryptedBlob,
      };

      resetForm();
      onCreated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <h3 className="text-title mb-4">Create User</h3>

      <div className="flex flex-col gap-3">
        <InputField label="Username" value={username} onChange={setUsername} placeholder="Username" />
        <InputField
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          placeholder="Password"
        />
        <InputField
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
          placeholder="Confirm Password"
        />

        <p className="text-xs text-[--color-text-tertiary] mt-1">
          Your password encrypts your private key locally. It cannot be recovered if lost.
        </p>

        {error && <p className="text-sm text-[--color-danger]">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm font-bold hover:bg-[#333333] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 mt-2"
        >
          {loading ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

/* ================================================================
   Reveal Private Key Modal
   ================================================================ */

function RevealKeyModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: StoredProfile;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [revealedKey, setRevealedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-close after 60 seconds
  useEffect(() => {
    if (!revealedKey) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 60_000);
    return () => clearTimeout(timer);
  }, [revealedKey]);

  // Clean up on navigation
  useEffect(() => {
    return () => {
      setRevealedKey('');
      setPassword('');
      setError('');
    };
  }, []);

  const handleClose = () => {
    setRevealedKey('');
    setPassword('');
    setError('');
    setCopied(false);
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      let key = await decryptPrivateKey(profile.encryptedPrivateKey, password);
      setRevealedKey(key);
      key = ''; // Clear from this scope
    } catch {
      setError('Wrong password.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <h3 className="text-title mb-4">Reveal Private Key</h3>

      {!revealedKey ? (
        <div className="flex flex-col gap-3">
          <InputField
            label="Enter your password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Password"
          />
          {error && <p className="text-sm text-[--color-danger]">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-[--color-accent] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[--color-accent-dim] transition-colors disabled:opacity-50"
          >
            {loading ? 'Decrypting…' : 'Confirm'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-[--color-surface-subtle] border-2 border-[--color-danger] rounded-lg p-3 flex items-start gap-2">
            <span
              className="flex-1 text-[12px] text-[--color-text-primary] break-all"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {revealedKey}
            </span>
            <button
              onClick={copyKey}
              className="shrink-0 p-1.5 rounded-md hover:bg-[--color-surface-border] transition-colors text-[--color-text-tertiary]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-[--color-danger]">
            Never share this key. Close this window when done.
          </p>
          <p className="text-xs text-[--color-text-tertiary]">
            This window will auto-close in 60 seconds.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ================================================================
   Export WIF Modal
   ================================================================ */

function ExportWifModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: StoredProfile;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [wifString, setWifString] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-close after 60 seconds
  useEffect(() => {
    if (!wifString) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 60_000);
    return () => clearTimeout(timer);
  }, [wifString]);

  useEffect(() => {
    return () => {
      setWifString('');
      setPassword('');
      setError('');
    };
  }, []);

  const handleClose = () => {
    setWifString('');
    setPassword('');
    setError('');
    setCopied(false);
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      let key = await decryptPrivateKey(profile.encryptedPrivateKey, password);
      const wif = exportWIF(key);
      key = ''; // Clear private key
      setWifString(wif);
    } catch {
      setError('Wrong password.');
    } finally {
      setLoading(false);
    }
  };

  const copyWif = async () => {
    await navigator.clipboard.writeText(wifString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <h3 className="text-title mb-4">Export WIF</h3>

      {!wifString ? (
        <div className="flex flex-col gap-3">
          <InputField
            label="Enter your password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Password"
          />
          {error && <p className="text-sm text-[--color-danger]">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-[--color-accent] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[--color-accent-dim] transition-colors disabled:opacity-50"
          >
            {loading ? 'Decrypting…' : 'Confirm'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-[--color-surface-subtle] border border-[--color-surface-border] rounded-lg p-3 flex items-start gap-2">
            <span
              className="flex-1 text-[12px] text-[--color-text-primary] break-all"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {wifString}
            </span>
            <button
              onClick={copyWif}
              className="shrink-0 p-1.5 rounded-md hover:bg-[--color-surface-border] transition-colors text-[--color-text-tertiary]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-[--color-text-tertiary]">
            This window will auto-close in 60 seconds.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ================================================================
   Shared Input Field
   ================================================================ */

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors"
        style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
      />
    </div>
  );
}
