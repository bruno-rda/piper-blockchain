import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppShell } from '@/components/AppShell';
import { UsersPage } from '@/pages/UsersPage';
import { SendPage } from '@/pages/SendPage';
import { MinePage } from '@/pages/MinePage';
import { BlockchainPage } from '@/pages/BlockchainPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { BalancesPage } from '@/pages/BalancesPage';

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider>
        <ProfileProvider>
          <ToastProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/users" replace />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/send" element={<SendPage />} />
                <Route path="/mine" element={<MinePage />} />
                <Route path="/blockchain" element={<BlockchainPage />} />
                <Route path="/config" element={<ConfigPage />} />
                <Route path="/balances" element={<BalancesPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </ProfileProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}
