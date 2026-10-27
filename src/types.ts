export type PeerStatus = 'online' | 'transferring' | 'idle' | 'offline';

export interface Peer {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: PeerStatus;
  isLeader: boolean;
  priority: number;
  latencyMs: number;
  lastSeen: number;
}

export type TransferStatus =
  | 'pending_acceptance'
  | 'transferring'
  | 'verifying_checksum'
  | 'verified_complete'
  | 'declined'
  | 'failed'
  | 'interrupted';

export interface TransferRecord {
  id: string;
  filename: string;
  fileSize: number; // in bytes
  bytesTransferred: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  checksumSha256: string;
  status: TransferStatus;
  localPath?: string;
  transferSpeedBps: number; // bytes per second
  startedAt: number;
  completedAt?: number;
  isIncoming: boolean;
  errorMessage?: string;
  snoozedUntil?: number; // timestamp until when notification is snoozed
}

export interface ActivityEvent {
  id: string;
  eventType: 'peer_joined' | 'peer_left' | 'transfer_completed' | 'epoch_change' | 'leader_failover' | 'network_warning';
  description: string;
  timestamp: number;
  metadata?: string;
}

export interface SessionState {
  teamName: string;
  roomCode: string;
  sessionId: string;
  epoch: number;
  leaderId: string;
  isCurrentDeviceLeader: boolean;
  activePeerCount: number;
  networkMode: 'lan_direct_tcp' | 'udp_multicast_fallback' | 'webrtc_signaling';
  firewallStatus: 'allowed' | 'restricted' | 'ap_isolated';
}

export interface DeviceSettings {
  deviceId: string;
  deviceName: string;
  listenPort: number;
  downloadDirectory: string;
  mdnsEnabled: boolean;
  udpMulticastEnabled: boolean;
  autoAcceptFromTeam: boolean;
}

// Adaptive Dock Placement & Visual States
export type DockEdge = 'top' | 'bottom' | 'left' | 'right';
export type DockAlignment = 'start' | 'center' | 'end';

export type DockVisualState =
  | 'minimized'
  | 'expanded'
  | 'drag-over'
  | 'receiving'
  | 'completed'
  | 'failed';

export interface DockPlacement {
  edge: DockEdge;
  alignment: DockAlignment;
  monitorName?: string;
  offsetX: number;
  offsetY: number;
  cornerSnapped?: boolean;
}

export interface MonitorInfo {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  workAreaX: number;
  workAreaY: number;
  workAreaWidth: number;
  workAreaHeight: number;
  scaleFactor: number;
  isPrimary: boolean;
}
