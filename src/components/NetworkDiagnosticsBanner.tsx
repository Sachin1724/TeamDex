import React from 'react';
import { SessionState } from '../types';
import { teamManager } from '../services/teamManager';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface NetworkDiagnosticsBannerProps {
  session: SessionState;
}

export const NetworkDiagnosticsBanner: React.FC<NetworkDiagnosticsBannerProps> = ({ session }) => {
  if (session.firewallStatus === 'allowed') {
    return null;
  }

  return (
    <div className="bg-surface-elevated border border-status-warning/40 rounded p-2.5 flex items-start justify-between text-xs text-text-primary">
      <div className="flex items-start space-x-2">
        <AlertCircle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">
            Wi-Fi Client Isolation Detected
          </span>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Venue router is blocking direct LAN TCP packets. Active peers are falling back to UDP multicast broadcast.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 ml-3">
        <button
          onClick={() => teamManager.toggleFirewallStatus()}
          className="px-2 py-1 rounded bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border text-[11px] flex items-center space-x-1"
        >
          <CheckCircle2 className="w-3 h-3 text-presence-online" />
          <span>Dismiss</span>
        </button>

        <button
          onClick={() => teamManager.toggleNetworkMode()}
          className="px-2.5 py-1 rounded bg-electric hover:bg-electric-hover text-white text-[11px] font-medium flex items-center space-x-1"
        >
          <span>Switch Fallback</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
