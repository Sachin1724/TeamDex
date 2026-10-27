import React, { useState } from 'react';
import { ChevronDown, Copy, Check, MoreVertical } from 'lucide-react';

interface WorkspaceHeaderProps {
  teamName: string;
  roomCode: string;
  networkMode: string;
  onRoomClick?: () => void;
  onOptionsClick?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  teamName,
  roomCode,
  networkMode,
  onRoomClick,
  onOptionsClick,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-14 border-b border-border px-5 flex items-center justify-between bg-background select-none titlebar-drag-region">
      {/* Left: Room Title & LAN Status */}
      <div className="flex items-center space-x-3 no-drag">
        <div>
          <button
            onClick={onRoomClick}
            className="flex items-center space-x-1.5 text-base font-semibold text-text-primary hover:text-electric transition-colors focus:outline-none"
          >
            <span>{teamName}</span>
            <ChevronDown className="w-4 h-4 text-text-muted" />
          </button>
          <div className="flex items-center space-x-1.5 text-xs text-text-secondary mt-0.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-presence-online" />
            <span>{networkMode === 'lan_direct_tcp' ? 'LAN Mode' : networkMode.toUpperCase()} &bull; Session Active</span>
          </div>
        </div>
      </div>

      {/* Right: Invite Code & Windows Controls */}
      <div className="flex items-center space-x-3 no-drag">
        {/* Invite Code Pill */}
        <div className="flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 space-x-2 text-xs">
          <span className="text-text-muted text-[11px]">Invite Code</span>
          <span className="font-mono font-semibold text-text-primary">{roomCode}</span>
          <button
            onClick={handleCopy}
            title="Copy invitation code"
            className="p-1 hover:bg-surface-elevated rounded text-text-muted hover:text-text-primary transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-presence-online" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Options Button */}
        <button
          onClick={onOptionsClick}
          title="Team & Session Options"
          className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Windows Standard Title Bar Controls */}
        <div className="flex items-center space-x-1 pl-2 border-l border-border">
          <button
            title="Minimize"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors text-xs"
          >
            &minus;
          </button>
          <button
            title="Maximize / Restore"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors text-xs"
          >
            &#9633;
          </button>
          <button
            title="Close"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-status-error/20 hover:text-status-error text-text-muted transition-colors text-xs"
          >
            &#10005;
          </button>
        </div>
      </div>
    </header>
  );
};
