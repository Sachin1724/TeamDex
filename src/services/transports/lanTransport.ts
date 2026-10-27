import { TransportAdapter, DiscoveredPeer } from '../connectionManager';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = (window as any).__TAURI__.core;
  return invoke(cmd, args);
}

export class LanTransport implements TransportAdapter {
  readonly name = 'lan_direct_tcp' as const;

  async probe(): Promise<boolean> {
    if (!isTauri()) return true; // Simulated mode always available
    try {
      await tauriInvoke('get_device_identity');
      return true;
    } catch {
      return false;
    }
  }

  async discover(): Promise<DiscoveredPeer[]> {
    if (!isTauri()) {
      return [
        { peerId: 'peer-riya', name: 'Riya', address: '192.168.1.108:53318', transport: 'lan_direct_tcp' },
        { peerId: 'peer-arjun', name: 'Arjun', address: '192.168.1.115:53318', transport: 'lan_direct_tcp' },
        { peerId: 'peer-neha', name: 'Neha', address: '192.168.1.121:53318', transport: 'lan_direct_tcp' },
      ];
    }

    try {
      const peers = await tauriInvoke<any[]>('get_discovered_peers');
      return peers.map((p) => ({
        peerId: p.device_id,
        name: p.device_name,
        address: `${p.ip}:${p.listen_port}`,
        transport: 'lan_direct_tcp' as const,
      }));
    } catch {
      return [];
    }
  }

  async startDiscovery(deviceId: string, deviceName: string, teamCode: string, listenPort: number, isLeader: boolean, priority: number): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('start_discovery', {
      deviceId,
      deviceName,
      teamCode,
      listenPort,
      isLeader,
      priority,
    });
  }

  async stopDiscovery(): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('stop_discovery');
  }

  async startFileServer(listenPort: number, downloadDir: string): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('start_file_server', { listenPort, downloadDir });
  }

  async stopFileServer(): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('stop_file_server');
  }

  async sendFile(targetIp: string, targetPort: number, filePath: string, transferId: string, senderId: string, senderName: string): Promise<void> {
    if (!isTauri()) return;
    await tauriInvoke('send_file_to_peer', {
      targetIp,
      targetPort,
      filePath,
      transferId,
      senderId,
      senderName,
    });
  }
}

export const lanTransport = new LanTransport();
