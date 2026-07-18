import { Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, LogOut, Code2, BarChart3 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAppUser } from '@/hooks/useAppUser';

const devNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'System Logs', href: '/logs',      icon: Activity },
];



export default function Sidebar() {
  const pathname = useLocation().pathname;
  const { user, logout } = useAppUser();
  const navigate = useNavigate();
  const isDeveloper = user?.role === 'developer';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex flex-col h-full bg-card border-r border-border shadow-sm">
      {/* Logo & Header */}
      <div className="p-6 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0d3320] dark:bg-[#0d3320] border border-[#2ea043] flex items-center justify-center shrink-0">
            <span className="text-[#22c55e] font-bold text-sm">G</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-foreground">
              Groit AI
            </h1>
            <p className="text-[10px] text-muted-foreground">Intelligent Orchestration</p>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* User profile capsule */}
      {user && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ${isDeveloper ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
              <div className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-0.5 ${
                isDeveloper
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
              }`}>
                {isDeveloper ? <Code2 size={8} /> : <BarChart3 size={8} />}
                {user.role}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-6">
        {/* Core Nav */}
        <div className="px-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-3 px-2">Main Navigation</p>
          <nav className="flex flex-col gap-1">
            {devNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer — Logout Action */}
      <div className="p-4 border-t border-border mt-auto">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 text-sm font-semibold transition-all duration-200"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
