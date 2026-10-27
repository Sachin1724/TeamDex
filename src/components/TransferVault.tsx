import React, { useState } from 'react';
import { Peer, TransferRecord } from '../types';
import { transferEngine } from '../services/transferEngine';
import { TeammateAvatarInitial } from './TeammateAvatarInitial';
import { VaultTab } from '../services/vaultController';
import {
  X,
  Search,
  CheckCircle2,
  Send,
  ArrowDownLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
  GripVertical,
  FolderOpen,
  Check,
  FileCode,
} from 'lucide-react';

interface TransferVaultProps {
  teammate: Peer;
  transfers: TransferRecord[];
  activeTab: VaultTab;
  onTabChange: (tab: VaultTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const TransferVault: React.FC<TransferVaultProps> = ({
  teammate,
  transfers,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onClose,
  style,
  className = '',
}) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Filter transfers specifically for this teammate
  const teammateTransfers = transfers.filter(
    (t) => t.recipientId === teammate.id || t.senderId === teammate.id
  );

  // Tab counts
  const countAll = teammateTransfers.length;
  const countSent = teammateTransfers.filter(
    (t) => t.senderId !== teammate.id && t.status === 'verified_complete'
  ).length;
  const countReceived = teammateTransfers.filter(
    (t) => t.senderId === teammate.id && t.status === 'verified_complete'
  ).length;
  const countInProgress = teammateTransfers.filter(
    (t) =>
      t.status === 'transferring' ||
      t.status === 'verifying_checksum' ||
      t.status === 'pending_acceptance'
  ).length;
  const countFailed = teammateTransfers.filter(
    (t) => t.status === 'failed' || t.status === 'declined' || t.status === 'interrupted'
  ).length;

  // Filter by active tab
  const tabFiltered = teammateTransfers.filter((t) => {
    if (activeTab === 'sent') {
      return t.senderId !== teammate.id && t.status === 'verified_complete';
    }
    if (activeTab === 'received') {
      return t.senderId === teammate.id && t.status === 'verified_complete';
    }
    if (activeTab === 'in_progress') {
      return (
        t.status === 'transferring' ||
        t.status === 'verifying_checksum' ||
        t.status === 'pending_acceptance'
      );
    }
    if (activeTab === 'failed') {
      return t.status === 'failed' || t.status === 'declined' || t.status === 'interrupted';
    }
    return true;
  });

  // Filter by search query
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? tabFiltered.filter(
        (t) =>
          t.filename.toLowerCase().includes(query) ||
          (t.checksumSha256 && t.checksumSha256.toLowerCase().includes(query))
      )
    : tabFiltered;

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  };

  const getRelativeTime = (timestamp: number) => {
    const diffMins = Math.round((Date.now() - timestamp) / 60000);
    if (diffMins <= 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const getFileBadge = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (ext === 'fig') {
      return (
        <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
          fig
        </div>
      );
    }
    if (ext === 'zip' || ext === 'tar' || ext === 'gz' || ext === '7z') {
      return (
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
          ZIP
        </div>
      );
    }
    if (ext === 'txt' || ext === 'md' || ext === 'json' || ext === 'ts' || ext === 'rs') {
      return (
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
          TXT
        </div>
      );
    }
    if (ext === 'pdf') {
      return (
        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
          PDF
        </div>
      );
    }

    return (
      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center font-mono uppercase shrink-0">
        {ext.slice(0, 3) || 'DOC'}
      </div>
    );
  };

  const handleRevealInExplorer = (localPath?: string) => {
    if (!localPath) return;
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
        (window as any).__TAURI__.core.invoke('open_file_in_folder', { filePath: localPath });
      } else {
        alert(`Opening file in Windows Explorer:\n${localPath}`);
      }
    } catch {
      alert(`Opening file in Windows Explorer:\n${localPath}`);
    }
  };

  const isOnline = teammate.status !== 'offline';

  return (
    <div
      style={style}
      className={`bg-surface border border-border shadow-2xl rounded-2xl flex flex-col z-50 text-text-primary select-none overflow-hidden animate-in fade-in zoom-in-95 duration-[180ms] ease-out motion-reduce:animate-none motion-reduce:transition-none ${className}`}
    >
      {/* 1. Header: Teammate profile and close button */}
      <div className="px-3.5 py-3 border-b border-border bg-surface-elevated/40 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <TeammateAvatarInitial
            name={teammate.name}
            status={teammate.status}
            isLeader={teammate.isLeader}
            size={28}
          />
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-text-primary truncate">
                {teammate.name}
              </span>
              <span className="text-[10px] font-mono text-text-muted">Vault</span>
            </div>
            <div className="flex items-center space-x-1 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-presence-online animate-pulse' : 'bg-text-muted'
                }`}
              />
              <span className="text-[10px] text-text-muted font-mono capitalize">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close Transfer Vault"
          className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border bg-surface/60 shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-[11px] font-medium">
          {[
            { id: 'all', label: 'All', count: countAll },
            { id: 'sent', label: 'Sent', count: countSent },
            { id: 'received', label: 'Received', count: countReceived },
            { id: 'in_progress', label: 'In progress', count: countInProgress },
            { id: 'failed', label: 'Failed', count: countFailed },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as VaultTab)}
                className={`px-2 py-1 rounded-md transition-colors flex items-center space-x-1 whitespace-nowrap ${
                  isActive
                    ? 'bg-electric text-white shadow-subtle'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Compact Search Bar */}
        <div className="relative mt-2">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search filenames..."
            className="w-full bg-surface-elevated/80 border border-border rounded-lg pl-7 pr-6 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Transfers List (Scrollable, stable hitboxes) */}
      <div
        key={teammate.id}
        className="flex-1 overflow-y-auto divide-y divide-border/60 animate-in fade-in duration-150"
      >
        {filtered.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center mx-auto text-text-muted">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="text-xs font-medium text-text-primary">
              {searchQuery ? `No files matching "${searchQuery}"` : `No files exchanged with ${teammate.name} yet`}
            </div>
            <div className="text-[11px] text-text-muted">
              {searchQuery ? 'Try clearing your search query.' : 'Send a file or drag to this teammate in the dock.'}
            </div>
          </div>
        ) : (
          filtered.map((record) => {
            const isOutgoing = record.senderId !== teammate.id;
            const progress =
              record.fileSize > 0
                ? Math.min(100, Math.round((record.bytesTransferred / record.fileSize) * 100))
                : 0;

            return (
              <div
                key={record.id}
                className="p-2.5 hover:bg-surface-elevated/60 transition-colors group space-y-1.5"
              >
                {/* Main Row */}
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {getFileBadge(record.filename)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-mono font-medium text-text-primary truncate">
                          {record.filename}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted shrink-0">
                          {formatSize(record.fileSize)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-[10px] text-text-muted mt-0.5 font-mono">
                        {isOutgoing ? (
                          <span className="flex items-center space-x-0.5 text-electric">
                            <Send className="w-2.5 h-2.5" />
                            <span>Sent</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-0.5 text-presence-online">
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                            <span>Received</span>
                          </span>
                        )}
                        <span>&bull;</span>
                        <span>{getRelativeTime(record.startedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {/* Verified complete status */}
                    {record.status === 'verified_complete' && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-presence-online" />
                        {/* Drag-Out Handle for Windows Explorer / VS Code */}
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', record.localPath || '');
                            e.dataTransfer.effectAllowed = 'copyMove';
                          }}
                          title="Drag to Windows Explorer or VS Code"
                          className="px-1.5 py-0.5 rounded bg-surface-elevated hover:bg-electric hover:text-white border border-border text-[9px] font-mono flex items-center space-x-0.5 cursor-grab active:cursor-grabbing text-text-muted transition-colors"
                        >
                          <GripVertical className="w-2.5 h-2.5" />
                          <span>Drag</span>
                        </div>

                        {/* Open folder button */}
                        <button
                          onClick={() => handleRevealInExplorer(record.localPath)}
                          title="Reveal in Windows Explorer"
                          className="p-1 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary"
                        >
                          <FolderOpen className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Pending incoming request actions */}
                    {record.status === 'pending_acceptance' && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => transferEngine.acceptIncomingTransfer(record.id)}
                          title="Accept file"
                          className="px-2 py-0.5 rounded bg-electric text-white text-[10px] font-semibold flex items-center space-x-0.5 hover:bg-electric-hover"
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => transferEngine.declineIncomingTransfer(record.id)}
                          title="Decline file"
                          className="px-1.5 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-text-muted hover:text-text-primary text-[10px]"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}

                    {/* Failed status actions */}
                    {(record.status === 'failed' || record.status === 'interrupted') && (
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 text-status-error" />
                        <button
                          onClick={() => {
                            setRetryingId(record.id);
                            transferEngine.retryTransfer(record.id);
                            setTimeout(() => setRetryingId(null), 1000);
                          }}
                          title="Retry transfer"
                          className="px-1.5 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-text-muted hover:text-text-primary text-[10px] flex items-center space-x-0.5"
                        >
                          <RotateCcw className={`w-2.5 h-2.5 ${retryingId === record.id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* Active transfer cancel action */}
                    {(record.status === 'transferring' || record.status === 'verifying_checksum') && (
                      <button
                        onClick={() => transferEngine.interruptTransfer(record.id)}
                        title="Cancel active transfer"
                        className="p-1 rounded hover:bg-status-error/20 text-text-muted hover:text-status-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar for transferring records */}
                {(record.status === 'transferring' || record.status === 'verifying_checksum') && (
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                      <span className="flex items-center space-x-1 text-electric font-medium">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>
                          {record.status === 'verifying_checksum' ? 'Verifying SHA-256...' : `Transferring ${progress}%`}
                        </span>
                      </span>
                      <span>
                        {record.transferSpeedBps
                          ? `${Math.round(record.transferSpeedBps / (1024 * 1024))} MB/s`
                          : ''}
                      </span>
                    </div>
                    <div className="w-full bg-surface-elevated h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-electric h-full transition-all duration-150 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message snippet for failed transfers */}
                {(record.status === 'failed' || record.status === 'interrupted') && record.errorMessage && (
                  <div className="text-[10px] text-status-error/90 font-mono">
                    {record.errorMessage}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer Summary */}
      <div className="px-3.5 py-2 border-t border-border bg-surface-elevated/40 text-[10px] font-mono text-text-muted flex items-center justify-between shrink-0">
        <span>{countAll} transfers recorded</span>
        <span>SHA-256 Verified</span>
      </div>
    </div>
  );
};
