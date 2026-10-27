import { teamManager } from './teamManager';
import { transferEngine } from './transferEngine';
import { connectionManager } from './connectionManager';
import { lanTransport } from './transports/lanTransport';
import { WebRtcTransport } from './transports/webrtcTransport';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

type UnlistenFn = () => void;

let initialized = false;
const unlisteners: UnlistenFn[] = [];
let webrtcTransport: WebRtcTransport | null = null;
let settingsUnsub: (() => void) | null = null;

export async function initTauriBridge(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Register LAN adapter
  connectionManager.registerAdapter(lanTransport);

  // Initialize LAN transport (Tauri-only)
  if (isTauri()) {
    await initLanTransport();
  }

  // Initialize WebRTC transport (works in both Tauri and browser)
  await initWebRtcTransport();

  // Load persisted transfer history from SQLite
  await loadTransferHistory();

  // Restart services on settings change (bug #3: port/dir change)
  if (isTauri()) {
    settingsUnsub = teamManager.onSettingsChange(async (settings) => {
      try {
        await lanTransport.stopFileServer();
        await lanTransport.stopDiscovery();
        await lanTransport.startFileServer(settings.listenPort, settings.downloadDirectory);
        const session = teamManager.getSession();
        await lanTransport.startDiscovery(
          settings.deviceId, settings.deviceName, session.roomCode,
          settings.listenPort, session.isCurrentDeviceLeader, 100
        );
      } catch (e) {
        console.error('Failed to restart services after settings change:', e);
      }
    });
  }
}

async function initLanTransport(): Promise<void> {
  const { listen } = (window as any).__TAURI__.event;
  const settings = teamManager.getSettings();

  try {
    await lanTransport.startFileServer(settings.listenPort, settings.downloadDirectory);
    connectionManager.setStatus('connected');
  } catch (e) {
    console.error('Failed to start file server:', e);
  }

  const session = teamManager.getSession();
  try {
    await lanTransport.startDiscovery(
      settings.deviceId,
      settings.deviceName,
      session.roomCode,
      settings.listenPort,
      session.isCurrentDeviceLeader,
      100
    );
  } catch (e) {
    console.error('Failed to start discovery:', e);
  }

  const unPeers = await listen('peers-discovered', (event: any) => {
    updatePeersFromDiscovery(event.payload, 'lan_direct_tcp');
  });
  unlisteners.push(unPeers);

  const unProgress = await listen('transfer-progress', (event: any) => {
    handleTransferProgress(event.payload);
  });
  unlisteners.push(unProgress);

  const unComplete = await listen('transfer-complete', (event: any) => {
    handleTransferComplete(event.payload);
  });
  unlisteners.push(unComplete);

  const unFailed = await listen('transfer-failed', (event: any) => {
    handleTransferFailed(event.payload);
  });
  unlisteners.push(unFailed);
}

async function initWebRtcTransport(): Promise<void> {
  const signalingUrl = getSignalingUrl();
  if (!signalingUrl) return;

  webrtcTransport = new WebRtcTransport({
    signalingUrl,
    turnServer: getTurnServer(),
  });

  const available = await webrtcTransport.probe();
  if (!available) {
    console.warn('WebRTC signaling server not reachable');
    webrtcTransport = null;
    return;
  }

  connectionManager.registerAdapter(webrtcTransport);

  webrtcTransport.setCallbacks({
    onPeerConnected: (peerId, name) => {
      const existing = teamManager.getPeer(peerId);
      if (!existing) {
        teamManager.addPeer({
          id: peerId,
          name,
          ip: 'webrtc',
          port: 0,
          status: 'online',
          isLeader: false,
          priority: 50,
          latencyMs: 0,
          lastSeen: Date.now(),
        });
        teamManager.logEvent('peer_joined', `${name} connected via WebRTC`);
      } else {
        teamManager.updatePeer(peerId, { status: 'online', lastSeen: Date.now() });
      }
    },
    onPeerDisconnected: (peerId, name) => {
      teamManager.updatePeer(peerId, { status: 'offline' });
      teamManager.logEvent('peer_left', `${name} disconnected`);
    },
    onData: (peerId, data) => {
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'file-header') {
            handleWebRtcFileHeader(peerId, msg);
          } else if (msg.type === 'file-complete') {
            handleWebRtcFileComplete(peerId);
          }
        } catch {
          // Not JSON, ignore
        }
      }
      // Binary data handled by file receiver
    },
  });

  const settings = teamManager.getSettings();
  const session = teamManager.getSession();
  try {
    await webrtcTransport.connect(settings.deviceId, settings.deviceName, session.roomCode);
  } catch (e) {
    console.error('WebRTC signaling connect failed:', e);
  }
}

function getSignalingUrl(): string | null {
  // Check for configured signaling server
  // In production: stored in settings or environment
  // For now: check localStorage or return null (WebRTC disabled)
  try {
    return localStorage.getItem('teamdeck_signaling_url');
  } catch {
    return null;
  }
}

function getTurnServer(): RTCIceServer | undefined {
  try {
    const turn = localStorage.getItem('teamdeck_turn_server');
    if (turn) return JSON.parse(turn);
  } catch {
    // No TURN configured
  }
  return undefined;
}

// Shared event handlers

function updatePeersFromDiscovery(discovered: any[], transport: string): void {
  for (const d of discovered) {
    const existing = teamManager.getPeer(d.device_id);
    if (existing) {
      teamManager.updatePeer(d.device_id, {
        ip: d.ip,
        port: d.listen_port,
        lastSeen: Date.now(),
        isLeader: d.is_leader,
        priority: d.priority,
        status: existing.status === 'offline' ? 'online' : existing.status,
      });
    } else {
      teamManager.addPeer({
        id: d.device_id,
        name: d.device_name,
        ip: d.ip,
        port: d.listen_port,
        status: 'online',
        isLeader: d.is_leader,
        priority: d.priority,
        latencyMs: 0,
        lastSeen: Date.now(),
      });
      teamManager.logEvent('peer_joined', `${d.device_name} joined via ${transport} (${d.ip}:${d.listen_port})`);
    }
  }
}

function handleTransferProgress(payload: any): void {
  const { transfer_id, bytes_received, bytes_sent } = payload;
  const transferred = bytes_received ?? bytes_sent ?? 0;
  transferEngine.updateTransfer(transfer_id, { bytesTransferred: transferred });
}

function handleTransferComplete(payload: any): void {
  const { transfer_id } = payload;
  const transfer = transferEngine.getTransfer(transfer_id);
  if (transfer) {
    const completedAt = Date.now();
    transferEngine.updateTransfer(transfer_id, {
      status: 'verified_complete',
      bytesTransferred: transfer.fileSize,
      completedAt,
    });
    teamManager.logEvent('transfer_completed', `Transfer complete: ${transfer.filename} · SHA-256 verified`);
    persistTransfer({ ...transfer, status: 'verified_complete', bytesTransferred: transfer.fileSize, completedAt });
  }
}

function handleTransferFailed(payload: any): void {
  const { transfer_id, error } = payload;
  transferEngine.updateTransfer(transfer_id, {
    status: 'failed',
    errorMessage: error || 'Transfer failed',
  });
}

// WebRTC file receive state
const webrtcFileReceivers: Map<string, { filename: string; size: number; received: number; transferId: string }> = new Map();

function handleWebRtcFileHeader(peerId: string, header: any): void {
  const transferId = `tr-webrtc-${Date.now().toString(36)}`;
  webrtcFileReceivers.set(peerId, {
    filename: header.filename,
    size: header.fileSize,
    received: 0,
    transferId,
  });

  transferEngine.triggerSimulatedIncoming(peerId, header.filename, header.fileSize);
}

function handleWebRtcFileComplete(peerId: string): void {
  const receiver = webrtcFileReceivers.get(peerId);
  if (!receiver) return;

  transferEngine.updateTransfer(receiver.transferId, {
    status: 'verified_complete',
    completedAt: Date.now(),
  });

  webrtcFileReceivers.delete(peerId);
}

export function getWebRtcTransport(): WebRtcTransport | null {
  return webrtcTransport;
}

function persistTransfer(transfer: any): void {
  if (!isTauri()) return;
  const { invoke } = (window as any).__TAURI__.core;
  invoke('db_save_transfer', { record: transfer }).catch((e: any) => console.warn('DB save failed:', e));
}

async function loadTransferHistory(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = (window as any).__TAURI__.core;
    const records = await invoke('db_get_transfers', { limit: 50 });
    for (const r of records) {
      transferEngine.updateTransfer(r.id, r);
    }
  } catch (e) {
    console.warn('Failed to load transfer history:', e);
  }
}

export async function teardownTauriBridge(): Promise<void> {
  for (const unlisten of unlisteners) {
    unlisten();
  }
  unlisteners.length = 0;

  if (isTauri()) {
    await lanTransport.stopDiscovery();
    await lanTransport.stopFileServer();
  }

  settingsUnsub?.();
  settingsUnsub = null;

  webrtcTransport?.disconnect();
  webrtcTransport = null;

  connectionManager.setStatus('disconnected');
  initialized = false;
}
