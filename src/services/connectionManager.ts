export type TransportType = 'lan_direct_tcp' | 'webrtc' | 'wifi_direct';
export type ConnectionStatus = 'disconnected' | 'discovering' | 'connecting' | 'connected' | 'relay_fallback';

export interface DiscoveredPeer {
  peerId: string;
  name: string;
  address: string;
  transport: TransportType;
}

export interface TransportAdapter {
  readonly name: TransportType;
  probe(): Promise<boolean>;
  discover(): Promise<DiscoveredPeer[]>;
}

export class ConnectionManager {
  private adapters: TransportAdapter[] = [];
  private activeTransport: TransportType | null = null;
  private status: ConnectionStatus = 'disconnected';
  private listeners: (() => void)[] = [];

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public registerAdapter(adapter: TransportAdapter): void {
    this.adapters.push(adapter);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getActiveTransport(): TransportType | null {
    return this.activeTransport;
  }

  public getAvailableAdapters(): TransportType[] {
    return this.adapters.map((a) => a.name);
  }

  public async selectBestTransport(): Promise<TransportType | null> {
    this.status = 'discovering';
    this.notify();

    for (const adapter of this.adapters) {
      const available = await adapter.probe();
      if (available) {
        this.activeTransport = adapter.name;
        this.status = 'connected';
        this.notify();
        return adapter.name;
      }
    }

    this.status = 'disconnected';
    this.activeTransport = null;
    this.notify();
    return null;
  }

  public async discover(): Promise<DiscoveredPeer[]> {
    const results: DiscoveredPeer[] = [];
    for (const adapter of this.adapters) {
      const available = await adapter.probe();
      if (available) {
        const peers = await adapter.discover();
        results.push(...peers);
      }
    }
    return results;
  }

  public setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.notify();
  }
}

export const connectionManager = new ConnectionManager();
