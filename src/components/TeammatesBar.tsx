import React from 'react';
import { Peer } from '../types';
import { Crown } from 'lucide-react';

interface TeammatesBarProps {
  peers: Peer[];
  selectedPeerId?: string | null;
  onSelectPeer?: (peerId: string) => void;
}

export const TeammatesBar: React.FC<TeammatesBarProps> = ({
  peers,
  selectedPeerId,
  onSelectPeer,
}) => {
  return (
    <div className="flex items-center space-x-2.5 overflow-x-auto py-1 select-none">
      {peers.map((peer) => {
        const isSelected = selectedPeerId === peer.id;
        const isOnline = peer.status !== 'offline';

        return (
          <button
            key={peer.id}
            onClick={() => onSelectPeer && onSelectPeer(peer.id)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              isSelected
                ? 'bg-electric text-white border-electric shadow-subtle'
                : 'bg-surface hover:bg-surface-elevated text-text-primary border-border'
            }`}
          >
            {/* Presence Dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOnline ? 'bg-presence-online' : 'bg-presence-offline'
              }`}
            />

            <span>{peer.name}</span>

            {peer.isLeader && (
              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
};
