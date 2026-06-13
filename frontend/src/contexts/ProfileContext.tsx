import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface StoredProfile {
  userId: string;
  username: string;
  address: string;
  publicKey: string;
  encryptedPrivateKey: {
    salt: string;
    iv: string;
    ciphertext: string;
  };
}

interface ProfileContextValue {
  profiles: StoredProfile[];
  activeProfile: StoredProfile | null;
  setActiveProfile: (address: string) => void;
  addProfile: (profile: StoredProfile) => void;
  removeProfile: (address: string) => void;
  clearProfiles: () => void;
}

const PROFILES_KEY = 'piper_profiles';
const ACTIVE_KEY = 'piper_active_address';

function loadProfiles(): StoredProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredProfile[];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: StoredProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function loadActiveAddress(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveAddress(address: string | null) {
  if (address) {
    localStorage.setItem(ACTIVE_KEY, address);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<StoredProfile[]>(loadProfiles);
  const [activeAddress, setActiveAddress] = useState<string | null>(loadActiveAddress);

  const activeProfile = profiles.find((p) => p.address === activeAddress) ?? null;

  const setActiveProfile = useCallback((address: string) => {
    setActiveAddress(address);
    saveActiveAddress(address);
  }, []);

  const addProfile = useCallback((profile: StoredProfile) => {
    setProfiles((prev) => {
      const next = [...prev, profile];
      saveProfiles(next);
      return next;
    });
    // Auto-set as active if it's the first profile
    setActiveAddress((prev) => {
      const next = prev ?? profile.address;
      saveActiveAddress(next);
      return next;
    });
  }, []);

  const removeProfile = useCallback((address: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.address !== address);
      saveProfiles(next);
      return next;
    });
    setActiveAddress((prev) => {
      if (prev === address) {
        const remaining = loadProfiles().filter((p) => p.address !== address);
        const next = remaining.length > 0 ? remaining[0].address : null;
        saveActiveAddress(next);
        return next;
      }
      return prev;
    });
  }, []);

  const clearProfiles = useCallback(() => {
    setProfiles([]);
    setActiveAddress(null);
    saveProfiles([]);
    saveActiveAddress(null);
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfile, setActiveProfile, addProfile, removeProfile, clearProfiles }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (ctx === undefined) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return ctx;
}
