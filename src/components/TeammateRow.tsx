import React from 'react';
import { Peer } from '../types';
import { Crown, ArrowUpRight } from 'lucide-react';

interface TeammateRowProps {
  peer: Peer;
  isHoveredForDrop?: boolean;
  onSendClick?: (peerId: string) => void;
  onToggleStatus?: (peerId: string) => void;
}

export const TeammateRow: React.FC<TeammateRowProps> = ({
  peer,
  isHoveredForDrop = false,
  onSendClick,
  onToggleStatus,
}) => {
  const getPresenceColor = (status: Peer['status']) => {
    switch (status) {
      case 'online':
        return 'bg-presence-online';
      case 'transferring':
        return 'bg-presence-transferring animate-pulse';
      case 'idle':
        return 'bg-presence-idle';
      case 'offline':
        return 'bg-presence-offline';
    }
  };

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 rounded border transition-all duration-100 ${
        isHoveredForDrop
          ? 'bg-surface-elevated border-electric text-text-primary shadow-highlight'
          : 'bg-surface hover:bg-surface-elevated border-border text-text-primary'
      }`}
    >
      {/* Left: Presence Dot + Name + Leader Pill */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <button
          onClick={() => onToggleStatus && onToggleStatus(peer.id)}
          title={`Status: ${peer.status} (Click to toggle)`}
          className="focus:outline-none"
        >
          <span
            className={`w-2 h-2 rounded-full inline-block shrink-0 ${getPresenceColor(peer.status)}`}
          />
        </button>

        <div className="flex items-center space-x-2 min-w-0">
          <span className="font-medium text-xs truncate tracking-tight">{peer.name}</span>
          {peer.isLeader && (
            <span className="flex items-center space-x-0.5 px-1 py-0.2 rounded bg-surface-elevated border border-border text-[10px] text-electric">
              <Crown className="w-2.5 h-2.5" />
              <span>Leader</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Network info & Action */}
      <div className="flex items-center space-x-3 text-text-secondary text-[11px] font-mono">
        <span className="hidden sm:inline text-text-muted">{peer.ip}</span>
        {peer.status !== 'offline' && (
          <span className="text-text-muted text-[10px]">{peer.latencyMs}ms</span>
        )}
        <span className="capitalize text-text-secondary text-[11px]">{peer.status}</span>

        {onSendClick && peer.status !== 'offline' && (
          <button
            onClick={() => onSendClick(peer.id)}
            title={`Direct transfer to ${peer.name}`}
            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-surface-hover hover:bg-electric text-text-primary text-[11px] font-sans transition-all duration-100 flex items-center space-x-1"
          >
            <span>Send</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
