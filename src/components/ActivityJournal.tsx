import React from 'react';
import { ActivityEvent } from '../types';
import { Activity, Shield, ArrowRightLeft, Users, AlertTriangle } from 'lucide-react';

interface ActivityJournalProps {
  events: ActivityEvent[];
}

export const ActivityJournal: React.FC<ActivityJournalProps> = ({ events }) => {
  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type: ActivityEvent['eventType']) => {
    switch (type) {
      case 'epoch_change':
      case 'leader_failover':
        return <Shield className="w-3 h-3 text-electric shrink-0" />;
      case 'peer_joined':
      case 'peer_left':
        return <Users className="w-3 h-3 text-presence-online shrink-0" />;
      case 'transfer_completed':
        return <ArrowRightLeft className="w-3 h-3 text-text-secondary shrink-0" />;
      case 'network_warning':
        return <AlertTriangle className="w-3 h-3 text-status-warning shrink-0" />;
      default:
        return <Activity className="w-3 h-3 text-text-muted shrink-0" />;
    }
  };

  return (
    <div className="bg-surface border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-background border-b border-border flex items-center justify-between text-xs select-none">
        <span className="font-semibold text-text-primary uppercase tracking-wider text-[11px] font-mono">
          Session Journal
        </span>
        <span className="text-text-muted font-mono text-[11px]">SQLite Persistent</span>
      </div>

      <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto">
        {events.length === 0 ? (
          <div className="py-4 text-center text-xs text-text-muted">No session events</div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start space-x-2 text-[11px] py-1 px-1.5 rounded hover:bg-surface-elevated transition-colors"
            >
              <div className="pt-0.5">{getEventIcon(ev.eventType)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary leading-tight font-sans truncate">
                  {ev.description}
                </p>
              </div>
              <span className="text-[10px] font-mono text-text-muted shrink-0">
                {formatTime(ev.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
