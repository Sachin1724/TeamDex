import React from 'react';
import { Users, Inbox, BarChart2, FileText, Settings, ChevronRight } from 'lucide-react';

export type NavTab = 'team' | 'inbox' | 'activity' | 'files' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onlineCount: number;
  totalMembers: number;
  onStatusClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onlineCount,
  totalMembers,
  onStatusClick,
}) => {
  const navItems = [
    { id: 'team' as NavTab, label: 'Team', icon: Users },
    { id: 'inbox' as NavTab, label: 'Inbox', icon: Inbox, badge: 3 },
    { id: 'activity' as NavTab, label: 'Activity', icon: BarChart2 },
    { id: 'files' as NavTab, label: 'Files', icon: FileText },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-48 bg-surface border-r border-border flex flex-col justify-between p-3 select-none shrink-0 h-full">
      {/* Brand Header */}
      <div>
        <div className="flex items-center space-x-2.5 px-2 py-2 mb-3">
          <img src="/logo.png" alt="Team Deck" className="w-7 h-7 object-contain rounded" />
          <div className="min-w-0">
            <h1 className="font-semibold text-xs tracking-tight text-text-primary leading-none">
              Team Deck
            </h1>
            <p className="text-[10px] text-text-secondary mt-1 font-sans">
              Your team, one deck.
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-electric text-white shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-electric text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Pill */}
      <div>
        <button
          onClick={onStatusClick}
          title="Click to view network mesh status"
          className="w-full bg-surface-elevated hover:bg-surface-hover border border-border rounded-lg p-2.5 flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-presence-online shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-text-primary leading-none">
                Connected
              </div>
              <div className="text-[10px] text-text-muted mt-1 font-mono">
                {onlineCount}/{totalMembers} members
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
        </button>
      </div>
    </aside>
  );
};
