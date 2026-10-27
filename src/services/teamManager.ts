import { Peer, SessionState, DeviceSettings, ActivityEvent } from '../types';

type Listener = () => void;

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

const MOCK_PEERS: Peer[] = [
  { id: 'peer-sachin', name: 'Sachin', ip: '192.168.1.102', port: 53318, status: 'online', isLeader: true, priority: 100, latencyMs: 2, lastSeen: Date.now() },
  { id: 'peer-riya', name: 'Riya', ip: '192.168.1.108', port: 53318, status: 'online', isLeader: false, priority: 85, latencyMs: 4, lastSeen: Date.now() },
  { id: 'peer-arjun', name: 'Arjun', ip: '192.168.1.115', port: 53318, status: 'online', isLeader: false, priority: 80, latencyMs: 6, lastSeen: Date.now() },
  { id: 'peer-neha', name: 'Neha', ip: '192.168.1.121', port: 53318, status: 'online', isLeader: false, priority: 75, latencyMs: 5, lastSeen: Date.now() },
  { id: 'peer-karthik', name: 'Karthik', ip: '192.168.1.140', port: 53318, status: 'offline', isLeader: false, priority: 60, latencyMs: 0, lastSeen: Date.now() - 3600000 },
];

const MOCK_ACTIVITY: ActivityEvent[] = [
  { id: 'act-001', eventType: 'peer_joined', description: 'Riya joined room via direct LAN TCP (192.168.1.108:53318)', timestamp: Date.now() - 600000 },
  { id: 'act-002', eventType: 'peer_joined', description: 'Arjun connected to room', timestamp: Date.now() - 550000 },
  { id: 'act-003', eventType: 'epoch_change', description: 'Session active at Epoch 1 with Leader Sachin', timestamp: Date.now() - 500000 },
];

const PEER_STALE_TIMEOUT = 15_000;

export class TeamManager {
  private peers: Peer[] = isTauri() ? [] : MOCK_PEERS.map((p) => ({ ...p }));

  private session: SessionState = {
    teamName: 'Hackathon Squad',
    roomCode: '4K7P9Q',
    sessionId: 'sess_5b7cfa90-e2b1',
    epoch: 1,
    leaderId: 'peer-sachin',
    isCurrentDeviceLeader: true,
    activePeerCount: 5,
    networkMode: 'lan_direct_tcp',
    firewallStatus: 'allowed',
  };

  private deviceSettings: DeviceSettings = {
    deviceId: 'dev_local_8b1a2f9c',
    deviceName: "Sachin's Laptop",
    listenPort: 53318,
    downloadDirectory: 'C:\\Users\\sachi\\Downloads\\TeamDeck',
    mdnsEnabled: true,
    udpMulticastEnabled: true,
    autoAcceptFromTeam: false,
  };

  private activityLog: ActivityEvent[] = isTauri() ? [] : MOCK_ACTIVITY.map((a) => ({ ...a }));
  private listeners: Listener[] = [];
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private settingsChangeListeners: Array<(settings: DeviceSettings) => void> = [];

  constructor() {
    if (isTauri()) {
      this.startPeerPruning();
    }
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  public onSettingsChange(fn: (settings: DeviceSettings) => void): () => void {
    this.settingsChangeListeners.push(fn);
    return () => { this.settingsChangeListeners = this.settingsChangeListeners.filter((l) => l !== fn); };
  }

  public notify(): void {
    for (const listener of this.listeners) listener();
  }

  public getPeers(): Peer[] {
    return [...this.peers];
  }

  public getPeer(id: string): Peer | undefined {
    return this.peers.find((p) => p.id === id);
  }

  public addPeer(peer: Peer): void {
    if (!this.peers.find((p) => p.id === peer.id)) {
      this.peers.push(peer);
      this.session.activePeerCount = this.peers.filter((p) => p.status !== 'offline').length;
      this.notify();
    }
  }

  public updatePeer(id: string, partial: Partial<Peer>): void {
    const peer = this.peers.find((p) => p.id === id);
    if (peer) {
      Object.assign(peer, partial);
      this.session.activePeerCount = this.peers.filter((p) => p.status !== 'offline').length;
      this.notify();
    }
  }

  public getSession(): SessionState {
    return { ...this.session };
  }

  public getSettings(): DeviceSettings {
    return { ...this.deviceSettings };
  }

  public getActivityLog(): ActivityEvent[] {
    return [...this.activityLog];
  }

  public logEvent(eventType: ActivityEvent['eventType'], description: string): void {
    this.activityLog.unshift({
      id: `act-${Date.now().toString(36)}`,
      eventType,
      description,
      timestamp: Date.now(),
    });
    this.notify();
  }

  public async electLeaderSuccessor(): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = (window as any).__TAURI__.core;
        const peersForRust = this.peers.map((p) => ({
          id: p.id, name: p.name, ip: p.ip, port: p.port,
          status: p.status, is_leader: p.isLeader, priority: p.priority,
          latency_ms: p.latencyMs, last_seen: p.lastSeen,
        }));
        const result = await invoke('trigger_manual_election', { peersJson: JSON.stringify(peersForRust) });
        const oldLeader = this.peers.find((p) => p.isLeader);
        if (oldLeader) oldLeader.isLeader = false;
        const newLeader = this.peers.find((p) => p.id === result.leader_id);
        if (newLeader) newLeader.isLeader = true;
        this.session.epoch = result.epoch;
        this.session.leaderId = result.leader_id;
        this.logEvent('leader_failover', `Leader failover: ${newLeader?.name ?? result.leader_id} elected for Epoch ${result.epoch}`);
        return;
      } catch (e) {
        console.warn('Rust election failed, falling back to local:', e);
      }
    }

    const eligiblePeers = this.peers.filter((p) => p.status !== 'offline');
    if (eligiblePeers.length === 0) return;

    const oldLeader = this.peers.find((p) => p.isLeader);
    if (oldLeader) oldLeader.isLeader = false;

    const nextCandidate = [...eligiblePeers].sort((a, b) => b.priority - a.priority)[0];
    nextCandidate.isLeader = true;
    this.session.epoch += 1;
    this.session.leaderId = nextCandidate.id;

    this.logEvent(
      'leader_failover',
      `Leader failover: ${nextCandidate.name} elected room leader for Epoch ${this.session.epoch}`
    );
  }

  public toggleNetworkMode(): void {
    const modes: SessionState['networkMode'][] = ['lan_direct_tcp', 'udp_multicast_fallback', 'webrtc_signaling'];
    const currentIndex = modes.indexOf(this.session.networkMode);
    this.session.networkMode = modes[(currentIndex + 1) % modes.length];
    this.logEvent('network_warning', `Transport mode switched to ${this.session.networkMode}`);
  }

  public toggleFirewallStatus(): void {
    this.session.firewallStatus = this.session.firewallStatus === 'allowed' ? 'ap_isolated' : 'allowed';
    this.notify();
  }

  public togglePeerPresence(peerId: string): void {
    const peer = this.peers.find((p) => p.id === peerId);
    if (!peer) return;
    const statuses: Peer['status'][] = ['online', 'idle', 'transferring', 'offline'];
    peer.status = statuses[(statuses.indexOf(peer.status) + 1) % statuses.length];
    this.notify();
  }

  public updateSettings(partial: Partial<DeviceSettings>): void {
    const prev = { ...this.deviceSettings };
    this.deviceSettings = { ...this.deviceSettings, ...partial };

    const portChanged = prev.listenPort !== this.deviceSettings.listenPort;
    const dirChanged = prev.downloadDirectory !== this.deviceSettings.downloadDirectory;

    this.notify();

    if (portChanged || dirChanged) {
      for (const fn of this.settingsChangeListeners) fn(this.deviceSettings);
    }
  }

  public setSessionField<K extends keyof SessionState>(key: K, value: SessionState[K]): void {
    this.session[key] = value;
    this.notify();
  }

  private startPeerPruning(): void {
    if (this.pruneTimer) return;
    this.pruneTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const peer of this.peers) {
        if (peer.status !== 'offline' && now - peer.lastSeen > PEER_STALE_TIMEOUT) {
          peer.status = 'offline';
          this.logEvent('peer_left', `${peer.name} went offline (no beacon for ${PEER_STALE_TIMEOUT / 1000}s)`);
          changed = true;
        }
      }
      if (changed) {
        this.session.activePeerCount = this.peers.filter((p) => p.status !== 'offline').length;
        this.notify();
      }
    }, 5000);
  }
}

export const teamManager = new TeamManager();
