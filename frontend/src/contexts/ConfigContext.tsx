import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ConfigResponse } from '@/client';
import { getConfig } from '@/client';

interface ConfigContextValue {
  config: ConfigResponse | null;
  refetchConfig: () => void;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await getConfig();
      if (data) {
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <ConfigContext.Provider value={{ config, refetchConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (ctx === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return ctx;
}
