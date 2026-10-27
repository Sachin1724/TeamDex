import React, { useState, useEffect } from 'react';
import { TransferRecord } from '../types';
import { transferEngine } from '../services/transferEngine';
import { dockStateController } from '../services/dockStateController';
import {
  CheckCircle2,
  AlertCircle,
  X,
  MoreVertical,
  GripVertical,
  Clock,
  Layers,
} from 'lucide-react';

interface IncomingTransferNotificationProps {
  transfers: TransferRecord[];
}

export const IncomingTransferNotification: React.FC<IncomingTransferNotificationProps> = ({
  transfers,
}) => {
  const [, setTick] = useState(0);

  // Force re-render on dock state controller changes (e.g. snooze wakeups)
  useEffect(() => {
    const unsub = dockStateController.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const activeIncoming = transfers.filter(
    (t) =>
      t.isIncoming &&
      (t.status === 'pending_acceptance' ||
        t.status === 'transferring' ||
        t.status === 'verifying_checksum' ||
        t.status === 'failed' ||
        (t.status === 'verified_complete' && t.completedAt && Date.now() - t.completedAt < 120000))
  );

  if (activeIncoming.length === 0) return null;

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  };

  const getFileBadge = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'fig') {
      return (
        <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-xs flex items-center justify-center font-mono">
          fig
        </div>
      );
    }
    if (ext === 'zip') {
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
          ZIP
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center font-mono uppercase">
        {ext.slice(0, 3) || 'DOC'}
      </div>
    );
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full select-none">
      {/* Grouped Transfers Header (when more than 1 incoming transfer arrives) */}
      {activeIncoming.length > 1 && (
        <div className="bg-surface-elevated/90 border border-border px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-mono text-electric shadow-subtle">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Grouped Transfers ({activeIncoming.length} active)</span>
          </div>
          <span className="text-text-muted text-[10px]">Independent Stream</span>
        </div>
      )}

      {activeIncoming.slice(0, 3).map((item) => {
        const isSnoozed = dockStateController.isTransferSnoozed(item.id);
        const progressPercent = item.fileSize > 0
          ? Math.min(100, Math.round((item.bytesTransferred / item.fileSize) * 100))
          : 0;

        // If snoozed, render compact contracted pill without covering screen
        if (isSnoozed && item.status !== 'verified_complete') {
          return (
            <div
              key={item.id}
              onClick={() => dockStateController.dismissTransfer(item.id)}
              className="bg-surface/90 border border-border hover:border-electric rounded-xl p-2.5 shadow-subtle flex items-center justify-between text-xs cursor-pointer transition-all animate-in fade-in"
              title="Transfer streaming in background &bull; Click to expand"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span className="font-mono text-xs text-text-primary truncate">
                  {item.filename}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  Snoozed (5s) &bull; {progressPercent}%
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-electric">Wake</span>
            </div>
          );
        }

        // 1. Pending Acceptance State with 5-Second Snooze
        if (item.status === 'pending_acceptance') {
          return (
            <div
              key={item.id}
              className="bg-surface border border-border rounded-xl shadow-dock p-3.5 text-xs animate-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  {getFileBadge(item.filename)}
                  <div className="min-w-0">
                    <div className="font-semibold text-text-primary text-xs truncate font-mono">
                      {item.filename}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      From {item.senderName} &bull; {formatSize(item.fileSize)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    transferEngine.declineIncomingTransfer(item.id);
                    dockStateController.dismissTransfer(item.id);
                  }}
                  className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-3.5 flex items-center space-x-2">
                <button
                  onClick={() => transferEngine.acceptIncomingTransfer(item.id)}
                  className="flex-1 py-1.5 rounded-lg bg-electric hover:bg-electric-hover text-white font-medium text-xs transition-colors shadow-subtle"
                >
                  Receive
                </button>
                <button
                  onClick={() => {
                    transferEngine.declineIncomingTransfer(item.id);
                    dockStateController.dismissTransfer(item.id);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border text-xs transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => dockStateController.snooze(item.id, 5000)}
                  title="Hide for 5 seconds without pausing transfer"
                  className="py-1.5 px-2.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-amber-400 border border-border text-[11px] font-mono flex items-center space-x-1 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  <span>5s</span>
                </button>
              </div>
            </div>
          );
        }

        // 2. Transferring / Progress State with 5-Second Snooze
        if (item.status === 'transferring' || item.status === 'verifying_checksum') {
          return (
            <div
              key={item.id}
              className="bg-surface border border-border rounded-xl shadow-dock p-3.5 text-xs animate-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  {getFileBadge(item.filename)}
                  <div className="min-w-0">
                    <div className="font-semibold text-text-primary text-xs truncate font-mono">
                      {item.filename}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      From {item.senderName} &bull; {formatSize(item.fileSize)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => dockStateController.snooze(item.id, 5000)}
                    title="Snooze notification for 5 seconds (transfer continues in background)"
                    className="p-1 rounded text-amber-400 hover:bg-surface-elevated transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      transferEngine.interruptTransfer(item.id);
                      dockStateController.dismissTransfer(item.id);
                    }}
                    className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Linear Progress Bar */}
              <div className="mt-3 space-y-2">
                <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-electric transition-all duration-200 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary pt-0.5">
                  <span>
                    {formatSize(item.bytesTransferred)} / {formatSize(item.fileSize)} ({progressPercent}%)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => dockStateController.snooze(item.id, 5000)}
                      className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-amber-400 border border-border text-[10px] transition-colors"
                    >
                      Snooze 5s
                    </button>
                    <button
                      onClick={() => {
                        transferEngine.interruptTransfer(item.id);
                        dockStateController.dismissTransfer(item.id);
                      }}
                      className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // 3. File Received (Ready to Drag) State with Verified Checkmark & Native Drag Handle
        if (item.status === 'verified_complete') {
          return (
            <div
              key={item.id}
              className="bg-surface border border-presence-online/40 rounded-xl shadow-dock p-3 text-xs flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-presence-online shrink-0" />
                {getFileBadge(item.filename)}
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary text-xs truncate font-mono">
                    {item.filename}
                  </div>
                  <div className="text-[11px] text-presence-online mt-0.2">
                    Received &bull; Ready to drag
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.localPath || '');
                    e.dataTransfer.effectAllowed = 'copyMove';
                  }}
                  title="Drag directly into Windows Explorer, Desktop, or VS Code"
                  className="px-2 py-1 rounded-md bg-electric text-white font-mono text-[10px] font-semibold flex items-center space-x-1 cursor-grab active:cursor-grabbing shadow-subtle"
                >
                  <GripVertical className="w-3 h-3 text-white/80" />
                  <span>Drag Out</span>
                </div>

                <button
                  onClick={() => {
                    transferEngine.dismissTransfer(item.id);
                    dockStateController.dismissTransfer(item.id);
                  }}
                  className="p-1 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }

        // 4. Transfer Failed State
        if (item.status === 'failed') {
          return (
            <div
              key={item.id}
              className="bg-surface border border-status-error/40 rounded-xl shadow-dock p-3.5 text-xs animate-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-status-error/10 border border-status-error/20 flex items-center justify-center text-status-error shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-text-primary text-xs truncate font-mono">
                      {item.filename}
                    </div>
                    <div className="text-[11px] text-status-error mt-0.5">
                      Failed to receive
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    transferEngine.dismissTransfer(item.id);
                    dockStateController.dismissTransfer(item.id);
                  }}
                  className="p-1 rounded text-text-muted hover:text-text-primary"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-3.5 flex items-center space-x-2">
                <button
                  onClick={() => transferEngine.retryTransfer(item.id)}
                  className="flex-1 py-1.5 rounded-lg bg-electric hover:bg-electric-hover text-white font-medium text-xs transition-colors shadow-subtle"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    transferEngine.dismissTransfer(item.id);
                    dockStateController.dismissTransfer(item.id);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border text-xs transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
