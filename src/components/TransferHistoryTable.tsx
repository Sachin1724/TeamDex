import React, { useState } from 'react';
import { TransferRecord } from '../types';
import {
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  MoreVertical,
  GripVertical,
} from 'lucide-react';

interface TransferHistoryTableProps {
  transfers: TransferRecord[];
  onOpenFolder?: (path: string) => void;
}

export const TransferHistoryTable: React.FC<TransferHistoryTableProps> = ({
  transfers,
  onOpenFolder,
}) => {
  const [filter, setFilter] = useState<'all' | 'sent' | 'received' | 'pending' | 'failed'>('all');

  const filtered = transfers.filter((t) => {
    if (filter === 'sent') return !t.isIncoming && t.status === 'verified_complete';
    if (filter === 'received') return t.isIncoming && t.status === 'verified_complete';
    if (filter === 'pending') return t.status === 'transferring' || t.status === 'pending_acceptance';
    if (filter === 'failed') return t.status === 'failed' || t.status === 'declined';
    return true;
  });

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
        <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-[10px] flex items-center justify-center font-mono">
          fig
        </div>
      );
    }
    if (ext === 'zip' || ext === 'tar' || ext === 'gz') {
      return (
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center font-mono">
          ZIP
        </div>
      );
    }
    if (ext === 'txt' || ext === 'md' || ext === 'json') {
      return (
        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[10px] flex items-center justify-center font-mono">
          TXT
        </div>
      );
    }
    if (ext === 'pdf') {
      return (
        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] flex items-center justify-center font-mono">
          PDF
        </div>
      );
    }

    return (
      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center font-mono uppercase">
        {ext.slice(0, 3) || 'DOC'}
      </div>
    );
  };

  const getStatusBadge = (record: TransferRecord) => {
    if (record.status === 'verified_complete') {
      if (record.isIncoming) {
        return (
          <div className="flex items-center space-x-1.5 text-presence-online text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Received</span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center space-x-1.5 text-electric text-xs font-medium">
            <Send className="w-3.5 h-3.5" />
            <span>Sent</span>
          </div>
        );
      }
    }

    if (record.status === 'transferring') {
      const progress = record.fileSize > 0
        ? Math.round((record.bytesTransferred / record.fileSize) * 100)
        : 50;

      return (
        <div className="flex items-center space-x-1.5 text-electric text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Sending ({progress}%)</span>
        </div>
      );
    }

    if (record.status === 'failed') {
      return (
        <div className="flex items-center space-x-1.5 text-status-error text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Failed</span>
        </div>
      );
    }

    return (
      <span className="text-text-muted text-xs capitalize">
        {record.status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getRelativeTime = (timestamp: number) => {
    const diffMins = Math.round((Date.now() - timestamp) / 60000);
    if (diffMins <= 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.round(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="space-y-3 select-none">
      {/* Header & Filter Pills */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight">
          Recent Transfers
        </h2>

        {/* Filter Pills */}
        <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 text-xs font-medium">
          {(['all', 'sent', 'received', 'pending', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-md transition-colors capitalize ${
                filter === tab
                  ? 'bg-electric text-white shadow-subtle'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transfers List Table */}
      <div className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            No transfers found for this filter
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-surface-elevated/70 transition-colors group"
            >
              {/* File Info */}
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                {getFileBadge(item.filename)}

                <div className="min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-text-primary font-mono truncate">
                      {item.filename}
                    </span>
                    <span className="text-[11px] font-mono text-text-muted shrink-0">
                      {formatSize(item.fileSize)}
                    </span>
                  </div>

                  <div className="text-[11px] text-text-secondary mt-0.5">
                    <span>
                      {item.isIncoming ? `from ${item.senderName}` : `to ${item.recipientName}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Stamp */}
              <div className="text-[11px] text-text-muted font-mono w-24 text-right pr-4 hidden sm:block">
                {getRelativeTime(item.startedAt)}
              </div>

              {/* Status Badge */}
              <div className="w-32 flex items-center justify-start pr-2">
                {getStatusBadge(item)}
              </div>

              {/* Native Explorer Drag Chip or Options Button */}
              <div className="flex items-center space-x-1.5 shrink-0">
                {item.status === 'verified_complete' && item.localPath && (
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.localPath || '');
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    title="Drag into Windows Explorer or VS Code"
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded bg-surface hover:bg-surface-elevated text-electric border border-border hover:border-electric cursor-grab text-[11px] font-mono flex items-center space-x-1 transition-all"
                  >
                    <GripVertical className="w-3 h-3 text-text-muted" />
                    <span>Drag</span>
                  </div>
                )}

                <button
                  onClick={() => onOpenFolder && item.localPath && onOpenFolder(item.localPath)}
                  title="Transfer options"
                  className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
