import React from 'react';
import { PeerStatus } from '../types';
import { Check, Crown } from 'lucide-react';

interface TeammateAvatarInitialProps {
  name: string;
  status: PeerStatus;
  isLeader?: boolean;
  transferProgress?: number | null; // 0 to 100
  isCompleted?: boolean;
  size?: number; // diameter in pixels (default: 32)
  className?: string;
}

export const TeammateAvatarInitial: React.FC<TeammateAvatarInitialProps> = ({
  name,
  status,
  isLeader = false,
  transferProgress = null,
  isCompleted = false,
  size = 32,
  className = '',
}) => {
  const initial = (name.trim()[0] || '?').toUpperCase();
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const isOnline = status !== 'offline';

  // Calculate animated progress stroke offset
  const progressPercent = transferProgress !== null ? Math.min(100, Math.max(0, transferProgress)) : 0;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      title={`${name} &bull; ${status}`}
    >
      {/* SVG Ring for Presence or Live Transfer Progress */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={
            isCompleted
              ? 'rgba(34, 197, 94, 0.25)'
              : transferProgress !== null
              ? 'rgba(91, 124, 250, 0.2)'
              : isOnline
              ? 'rgba(34, 197, 94, 0.35)'
              : 'rgba(100, 116, 139, 0.3)'
          }
          strokeWidth={strokeWidth}
        />

        {/* Dynamic Transfer Progress Stroke */}
        {transferProgress !== null && !isCompleted && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#5B7CFA"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-150 ease-out"
          />
        )}

        {/* Success Completion Ring */}
        {isCompleted && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#22C55E"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0}
            className="animate-in fade-in duration-200"
          />
        )}
      </svg>

      {/* Avatar Inner Body */}
      <div
        className={`w-full h-full rounded-full flex items-center justify-center transition-all ${
          isCompleted
            ? 'bg-presence-online text-white font-bold'
            : isOnline
            ? 'bg-surface-elevated text-text-primary hover:bg-surface-hover'
            : 'bg-surface text-text-muted opacity-60'
        }`}
        style={{ padding: strokeWidth + 1 }}
      >
        {isCompleted ? (
          <Check className="w-4 h-4 text-white stroke-[3] animate-in zoom-in-75 duration-150" />
        ) : (
          <span className="text-[11px] font-bold font-mono tracking-tight leading-none">
            {initial}
          </span>
        )}
      </div>

      {/* Leader Crown Badge */}
      {isLeader && !isCompleted && (
        <div className="absolute -top-1 -right-1 z-10 w-3 h-3 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
          <Crown className="w-2 h-2 text-amber-400" />
        </div>
      )}
    </div>
  );
};
