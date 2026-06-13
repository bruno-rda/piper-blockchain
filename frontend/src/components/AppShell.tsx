import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Users, ArrowUpRight, Cpu, Blocks, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/users', label: 'Users', icon: Users },
  { to: '/send', label: 'Send', icon: ArrowUpRight },
  { to: '/mine', label: 'Mine', icon: Cpu },
  { to: '/blockchain', label: 'Blockchain', icon: Blocks },
  { to: '/balances', label: 'Balances', icon: Users },
  { to: '/config', label: 'Config', icon: Settings },
] as const;

export function AppShell() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[220px] max-md:w-14 bg-surface-void flex flex-col h-screen fixed left-0 top-0 z-40">
        {/* Brand */}
        <div className="px-5 max-md:px-0 max-md:justify-center h-16 flex items-center gap-2.5 shrink-0 mt-2 mb-2">
          <span className="text-[--color-accent] text-3xl font-extrabold">₱</span>
          <span className="text-[--color-text-primary] font-bold text-xl tracking-tight max-md:hidden">
            Piper
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-2 max-md:px-1 mt-2 flex-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 max-md:px-0 max-md:justify-center py-2.5 rounded-lg text-base transition-all ${
                  isActive
                    ? 'bg-surface-base text-text-primary font-semibold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-base'
                }`
              }
            >
              <Icon size={20} />
              <span className="max-md:hidden">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="ml-[220px] max-md:ml-14 flex-1 flex flex-col min-h-screen">
        {/* Page Content */}
        <main className="flex-1 page-background p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
