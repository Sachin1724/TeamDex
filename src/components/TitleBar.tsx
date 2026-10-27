import React from 'react';
import { SessionState } from '../types';
import { Shield, RefreshCw, PanelRight, LayoutGrid, Wifi } from 'lucide-react';

interface TitleBarProps {
  session: SessionState;
  activeView: 'workspace' | 'dock';
  onViewChange: (view: 'workspace' | 'dock') => void;
  onElectLeader: () => void;
  onToggleNetworkMode: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  session,
  activeView,
  onViewChange,
  onElectLeader,
  onToggleNetworkMode,
}) => {
  return (
    <div className="h-10 bg-background border-b border-border flex items-center justify-between px-3 text-xs select-none titlebar-drag-region">
      {/* Left: App Brand & Room Badge */}
      <div className="flex items-center space-x-2.5 no-drag">
        <div className="flex items-center space-x-2 font-semibold text-text-primary tracking-tight">
          <img src="/logo.png" alt="Team Deck" className="w-4 h-4 object-contain rounded-sm" />
          <span>Team Deck</span>
        </div>
        <span className="text-border text-xs">/</span>
        <span className="text-text-secondary font-medium">{session.teamName}</span>
        <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-text-primary font-mono text-[11px] border border-border">
          {session.roomCode}
        </span>
        <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface text-text-secondary text-[11px] border border-border">
          <Shield className="w-3 h-3 text-text-muted" />
          <span>Epoch {session.epoch}</span>
        </div>
      </div>

      {/* Center: Controls & Mode Toggles */}
      <div className="flex items-center space-x-2 no-drag">
        <button
          onClick={onToggleNetworkMode}
          title="Click to cycle transport mode (LAN Direct TCP / UDP Multicast / WebRTC)"
          className="flex items-center space-x-1.5 px-2 py-1 rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors duration-100"
        >
          <Wifi className="w-3 h-3 text-electric" />
          <span className="font-mono text-[11px] uppercase">{session.networkMode.replace(/_/g, ' ')}</span>
        </button>

        <button
          onClick={onElectLeader}
          title="Trigger consensus leader election (simulates failover)"
          className="flex items-center space-x-1 px-2 py-1 rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors duration-100"
        >
          <RefreshCw className="w-3 h-3 text-text-muted" />
          <span>Elect Successor</span>
        </button>

        {/* View Switcher: Main Workspace vs Floating Edge Dock */}
        <div className="flex items-center bg-surface rounded p-0.5 border border-border">
          <button
            onClick={() => onViewChange('workspace')}
            className={`px-2 py-1 rounded flex items-center space-x-1 transition-colors ${
              activeView === 'workspace'
                ? 'bg-surface-elevated text-electric font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            <span>Workspace</span>
          </button>
          <button
            onClick={() => onViewChange('dock')}
            className={`px-2 py-1 rounded flex items-center space-x-1 transition-colors ${
              activeView === 'dock'
                ? 'bg-surface-elevated text-electric font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PanelRight className="w-3 h-3" />
            <span>Edge Dock</span>
          </button>
        </div>
      </div>

      {/* Right: Windows Native Controls */}
      <div className="flex items-center space-x-1 no-drag">
        <button
          title="Minimize"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          &minus;
        </button>
        <button
          title="Maximize"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors text-xs"
        >
          &#9633;
        </button>
        <button
          title="Close to Tray"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-status-error/20 hover:text-status-error text-text-secondary transition-colors"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
};
