import { TransportAdapter, DiscoveredPeer } from '../connectionManager';

export type SignalingMessage =
  | { type: 'offer'; sdp: string; from: string; to: string; teamCode: string }
  | { type: 'answer'; sdp: string; from: string; to: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string; to: string }
  | { type: 'peer-list'; peers: Array<{ id: string; name: string }> };

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface WebRtcTransportConfig {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
  turnServer?: RTCIceServer;
}

interface PeerConnection {
  peerId: string;
  peerName: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  state: 'connecting' | 'connected' | 'failed' | 'closed';
}

type OnPeerCallback = (peerId: string, name: string) => void;
type OnDataCallback = (peerId: string, data: ArrayBuffer | string) => void;
type OnStateCallback = (peerId: string, state: PeerConnection['state']) => void;

export class WebRtcTransport implements TransportAdapter {
  readonly name = 'webrtc' as const;

  private config: WebRtcTransportConfig;
  private ws: WebSocket | null = null;
  private deviceId: string = '';
  private deviceName: string = '';
  private teamCode: string = '';
  private peers: Map<string, PeerConnection> = new Map();
  private remotePeerList: Array<{ id: string; name: string }> = [];

  private onPeerConnected: OnPeerCallback | null = null;
  private onPeerDisconnected: OnPeerCallback | null = null;
  private onData: OnDataCallback | null = null;
  private onStateChange: OnStateCallback | null = null;

  constructor(config: WebRtcTransportConfig) {
    this.config = config;
  }

  async probe(): Promise<boolean> {
    if (typeof RTCPeerConnection === 'undefined') return false;
    try {
      const ws = new WebSocket(this.config.signalingUrl);
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);
        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  async discover(): Promise<DiscoveredPeer[]> {
    return this.remotePeerList.map((p) => ({
      peerId: p.id,
      name: p.name,
      address: 'webrtc',
      transport: 'webrtc' as const,
    }));
  }

  setCallbacks(callbacks: {
    onPeerConnected?: OnPeerCallback;
    onPeerDisconnected?: OnPeerCallback;
    onData?: OnDataCallback;
    onStateChange?: OnStateCallback;
  }): void {
    this.onPeerConnected = callbacks.onPeerConnected ?? null;
    this.onPeerDisconnected = callbacks.onPeerDisconnected ?? null;
    this.onData = callbacks.onData ?? null;
    this.onStateChange = callbacks.onStateChange ?? null;
  }

  async connect(deviceId: string, deviceName: string, teamCode: string): Promise<void> {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.teamCode = teamCode;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.signalingUrl);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({
          type: 'join',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          teamCode: this.teamCode,
        }));
        resolve();
      };

      this.ws.onerror = () => reject(new Error('Signaling connection failed'));

      this.ws.onmessage = (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data);
          this.handleSignalingMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        for (const [id, pc] of this.peers) {
          pc.connection.close();
          this.onPeerDisconnected?.(id, pc.peerName);
        }
        this.peers.clear();
      };
    });
  }

  disconnect(): void {
    for (const [, pc] of this.peers) {
      pc.dataChannel?.close();
      pc.connection.close();
    }
    this.peers.clear();
    this.ws?.close();
    this.ws = null;
  }

  async connectToPeer(peerId: string): Promise<void> {
    const iceServers = this.buildIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    const dataChannel = pc.createDataChannel('teamdeck-transfer', { ordered: true });

    const peerEntry: PeerConnection = {
      peerId,
      peerName: this.remotePeerList.find((p) => p.id === peerId)?.name ?? peerId,
      connection: pc,
      dataChannel,
      state: 'connecting',
    };
    this.peers.set(peerId, peerEntry);

    this.setupDataChannel(dataChannel, peerId);
    this.setupPeerConnection(pc, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignaling({
      type: 'offer',
      sdp: offer.sdp!,
      from: this.deviceId,
      to: peerId,
      teamCode: this.teamCode,
    });
  }

  sendData(peerId: string, data: ArrayBuffer | string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') return false;

    if (typeof data === 'string') {
      peer.dataChannel.send(data);
    } else {
      peer.dataChannel.send(data);
    }
    return true;
  }

  async sendFileOverDataChannel(
    peerId: string,
    file: File,
    onProgress: (sent: number, total: number) => void,
  ): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    const dc = peer.dataChannel;
    const totalSize = file.size;

    // Send file header
    dc.send(JSON.stringify({
      type: 'file-header',
      filename: file.name,
      fileSize: totalSize,
      senderId: this.deviceId,
      senderName: this.deviceName,
    }));

    let offset = 0;
    const reader = file.stream().getReader();

    while (offset < totalSize) {
      const { done, value } = await reader.read();
      if (done) break;

      // Respect backpressure
      while (dc.bufferedAmount > 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 50));
      }

      dc.send(value);
      offset += value.byteLength;
      onProgress(offset, totalSize);
    }

    dc.send(JSON.stringify({ type: 'file-complete' }));
  }

  getPeerState(peerId: string): PeerConnection['state'] | null {
    return this.peers.get(peerId)?.state ?? null;
  }

  private buildIceServers(): RTCIceServer[] {
    const servers = [...(this.config.iceServers ?? DEFAULT_ICE_SERVERS)];
    if (this.config.turnServer) {
      servers.push(this.config.turnServer);
    }
    return servers;
  }

  private sendSignaling(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'peer-list':
        this.remotePeerList = msg.peers.filter((p) => p.id !== this.deviceId);
        break;

      case 'offer':
        await this.handleOffer(msg);
        break;

      case 'answer':
        await this.handleAnswer(msg);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(msg);
        break;
    }
  }

  private async handleOffer(msg: Extract<SignalingMessage, { type: 'offer' }>): Promise<void> {
    const iceServers = this.buildIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const peerEntry: PeerConnection = {
      peerId: msg.from,
      peerName: this.remotePeerList.find((p) => p.id === msg.from)?.name ?? msg.from,
      connection: pc,
      dataChannel: null,
      state: 'connecting',
    };
    this.peers.set(msg.from, peerEntry);

    pc.ondatachannel = (event) => {
      peerEntry.dataChannel = event.channel;
      this.setupDataChannel(event.channel, msg.from);
    };

    this.setupPeerConnection(pc, msg.from);

    await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignaling({
      type: 'answer',
      sdp: answer.sdp!,
      from: this.deviceId,
      to: msg.from,
    });
  }

  private async handleAnswer(msg: Extract<SignalingMessage, { type: 'answer' }>): Promise<void> {
    const peer = this.peers.get(msg.from);
    if (!peer) return;
    await peer.connection.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
  }

  private async handleIceCandidate(msg: Extract<SignalingMessage, { type: 'ice-candidate' }>): Promise<void> {
    const peer = this.peers.get(msg.from);
    if (!peer) return;
    await peer.connection.addIceCandidate(msg.candidate);
  }

  private setupPeerConnection(pc: RTCPeerConnection, peerId: string): void {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          from: this.deviceId,
          to: peerId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const peer = this.peers.get(peerId);
      if (!peer) return;

      switch (pc.connectionState) {
        case 'connected':
          peer.state = 'connected';
          this.onPeerConnected?.(peerId, peer.peerName);
          break;
        case 'failed':
          peer.state = 'failed';
          this.onStateChange?.(peerId, 'failed');
          break;
        case 'closed':
        case 'disconnected':
          peer.state = 'closed';
          this.onPeerDisconnected?.(peerId, peer.peerName);
          this.peers.delete(peerId);
          break;
      }
      this.onStateChange?.(peerId, peer.state);
    };
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.state = 'connected';
        this.onPeerConnected?.(peerId, peer.peerName);
        this.onStateChange?.(peerId, 'connected');
      }
    };

    dc.onmessage = (event) => {
      this.onData?.(peerId, event.data);
    };

    dc.onclose = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.state = 'closed';
        this.onPeerDisconnected?.(peerId, peer.peerName);
        this.onStateChange?.(peerId, 'closed');
      }
    };
  }
}
