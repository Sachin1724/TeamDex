import { TransferRecord } from '../types';
import { teamManager } from './teamManager';
import { lanTransport } from './transports/lanTransport';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

type Listener = () => void;

export class TransferEngine {
  private transfers: TransferRecord[] = [
    {
      id: 'tr-001',
      filename: 'design.fig',
      fileSize: 12 * 1024,
      bytesTransferred: 12 * 1024,
      senderId: 'peer-riya',
      senderName: 'Riya',
      recipientId: 'dev_local_8b1a2f9c',
      recipientName: 'Sachin',
      checksumSha256: '9a8b1c4e6f217830d4a9845ecbb10294c771aa938472918471bcee819304a081',
      status: 'verified_complete',
      localPath: 'C:\\Users\\sachi\\Downloads\\TeamDeck\\design.fig',
      transferSpeedBps: 18 * 1024 * 1024,
      startedAt: Date.now() - 120000,
      completedAt: Date.now() - 118000,
      isIncoming: true,
    },
    {
      id: 'tr-002',
      filename: 'data.zip',
      fileSize: 24 * 1024 * 1024,
      bytesTransferred: 24 * 1024 * 1024,
      senderId: 'dev_local_8b1a2f9c',
      senderName: 'Sachin',
      recipientId: 'peer-arjun',
      recipientName: 'Arjun',
      checksumSha256: 'f45ac23910ee2b457c128509bca34812f8491cba483921029e8471a938cde110',
      status: 'verified_complete',
      localPath: 'C:\\Users\\sachi\\Downloads\\TeamDeck\\data.zip',
      transferSpeedBps: 45 * 1024 * 1024,
      startedAt: Date.now() - 480000,
      completedAt: Date.now() - 475000,
      isIncoming: false,
    },
    {
      id: 'tr-003',
      filename: 'notes.txt',
      fileSize: 4 * 1024,
      bytesTransferred: Math.round(4 * 1024 * 0.68),
      senderId: 'dev_local_8b1a2f9c',
      senderName: 'Sachin',
      recipientId: 'broadcast',
      recipientName: 'Everyone',
      checksumSha256: '38cde1109a8b1c4e6f217830d4a9845ecbb10294c771aa938472918471bcee81',
      status: 'transferring',
      localPath: 'C:\\Users\\sachi\\Downloads\\TeamDeck\\notes.txt',
      transferSpeedBps: 22 * 1024 * 1024,
      startedAt: Date.now() - 900000,
      isIncoming: false,
    },
    {
      id: 'tr-004',
      filename: 'report.pdf',
      fileSize: 1.2 * 1024 * 1024,
      bytesTransferred: 1.2 * 1024 * 1024,
      senderId: 'peer-neha',
      senderName: 'Neha',
      recipientId: 'dev_local_8b1a2f9c',
      recipientName: 'Sachin',
      checksumSha256: '771aa938472918471bcee819304a0819a8b1c4e6f217830d4a9845ecbb10294c',
      status: 'verified_complete',
      localPath: 'C:\\Users\\sachi\\Downloads\\TeamDeck\\report.pdf',
      transferSpeedBps: 34 * 1024 * 1024,
      startedAt: Date.now() - 1320000,
      completedAt: Date.now() - 1318000,
      isIncoming: true,
    },
  ];

  private listeners: Listener[] = [];
  private transferTimers: Map<string, number> = new Map();

  public subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getTransfers(): TransferRecord[] {
    return [...this.transfers];
  }

  public getTransfer(id: string): TransferRecord | undefined {
    const t = this.transfers.find((t) => t.id === id);
    return t ? { ...t } : undefined;
  }

  public updateTransfer(id: string, partial: Partial<TransferRecord>): void {
    const t = this.transfers.find((t) => t.id === id);
    if (t) {
      Object.assign(t, partial);
      this.notify();
    }
  }

  public initiateSend(file: { name: string; size: number; path?: string }, targetPeerId: string): TransferRecord {
    const targetPeer = teamManager.getPeer(targetPeerId);
    const recipientName = targetPeer ? targetPeer.name : 'Everyone';
    const settings = teamManager.getSettings();

    const transferId = `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const randomHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const newTransfer: TransferRecord = {
      id: transferId,
      filename: file.name,
      fileSize: file.size,
      bytesTransferred: 0,
      senderId: settings.deviceId,
      senderName: settings.deviceName,
      recipientId: targetPeerId,
      recipientName,
      checksumSha256: randomHash,
      status: 'transferring',
      localPath: `${settings.downloadDirectory}\\${file.name}`,
      transferSpeedBps: 45 * 1024 * 1024,
      startedAt: Date.now(),
      isIncoming: false,
    };

    this.transfers.unshift(newTransfer);
    teamManager.logEvent('transfer_completed', `Initiated outbound transfer: ${file.name} to ${recipientName}`);

    if (isTauri() && file.path && targetPeer) {
      lanTransport.sendFile(targetPeer.ip, targetPeer.port, file.path, transferId, settings.deviceId, settings.deviceName)
        .catch((err) => {
          this.updateTransfer(transferId, { status: 'failed', errorMessage: String(err) });
        });
    } else {
      this.startTransferSimulation(transferId);
    }
    this.notify();
    return newTransfer;
  }

  public triggerSimulatedIncoming(senderPeerId: string = 'peer-sachin', filename: string = 'design.fig', sizeBytes: number = 12 * 1024): TransferRecord {
    const sender = teamManager.getPeer(senderPeerId) || teamManager.getPeers()[0];
    const settings = teamManager.getSettings();
    const transferId = `tr-${Date.now().toString(36)}-in`;
    const randomHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const incomingTransfer: TransferRecord = {
      id: transferId,
      filename,
      fileSize: sizeBytes,
      bytesTransferred: 0,
      senderId: sender.id,
      senderName: sender.name,
      recipientId: settings.deviceId,
      recipientName: 'You',
      checksumSha256: randomHash,
      status: 'pending_acceptance',
      localPath: `${settings.downloadDirectory}\\${filename}`,
      transferSpeedBps: 0,
      startedAt: Date.now(),
      isIncoming: true,
    };

    this.transfers.unshift(incomingTransfer);
    teamManager.logEvent('transfer_completed', `Incoming transfer request: ${filename} from ${sender.name}`);
    this.notify();
    return incomingTransfer;
  }

  public triggerFailedTransfer(filename: string = 'data.zip', sizeBytes: number = 24 * 1024 * 1024): TransferRecord {
    const settings = teamManager.getSettings();
    const transferId = `tr-${Date.now().toString(36)}-fail`;
    const failedTransfer: TransferRecord = {
      id: transferId,
      filename,
      fileSize: sizeBytes,
      bytesTransferred: 4 * 1024 * 1024,
      senderId: 'peer-arjun',
      senderName: 'Arjun',
      recipientId: settings.deviceId,
      recipientName: 'You',
      checksumSha256: 'failed-hash-check',
      status: 'failed',
      localPath: `${settings.downloadDirectory}\\${filename}`,
      transferSpeedBps: 0,
      startedAt: Date.now(),
      isIncoming: true,
      errorMessage: 'Failed to receive: peer connection reset',
    };

    this.transfers.unshift(failedTransfer);
    this.notify();
    return failedTransfer;
  }

  public acceptIncomingTransfer(transferId: string): void {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return;

    transfer.status = 'transferring';
    transfer.transferSpeedBps = 48 * 1024 * 1024;
    this.startTransferSimulation(transferId);
    this.notify();
  }

  public declineIncomingTransfer(transferId: string): void {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return;

    transfer.status = 'declined';
    teamManager.logEvent('transfer_completed', `Declined transfer ${transfer.filename} from ${transfer.senderName}`);
    this.notify();
  }

  public dismissTransfer(transferId: string): void {
    this.transfers = this.transfers.filter((t) => t.id !== transferId);
    this.notify();
  }

  public retryTransfer(transferId: string): void {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return;

    transfer.status = 'transferring';
    transfer.bytesTransferred = 0;
    transfer.errorMessage = undefined;
    this.startTransferSimulation(transferId);
    this.notify();
  }

  public interruptTransfer(transferId: string): void {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return;

    if (this.transferTimers.has(transferId)) {
      clearInterval(this.transferTimers.get(transferId));
      this.transferTimers.delete(transferId);
    }
    transfer.status = 'interrupted';
    transfer.errorMessage = 'Connection paused';
    this.notify();
  }

  public resumeTransfer(transferId: string): void {
    const transfer = this.transfers.find((t) => t.id === transferId);
    if (!transfer) return;

    transfer.status = 'transferring';
    transfer.errorMessage = undefined;
    this.startTransferSimulation(transferId);
    this.notify();
  }

  private startTransferSimulation(transferId: string): void {
    if (this.transferTimers.has(transferId)) return;

    const interval = setInterval(() => {
      const transfer = this.transfers.find((t) => t.id === transferId);
      if (!transfer || transfer.status !== 'transferring') {
        clearInterval(interval);
        this.transferTimers.delete(transferId);
        return;
      }

      const increment = Math.max(
        1024,
        Math.min(transfer.fileSize / 10, transfer.fileSize - transfer.bytesTransferred)
      );
      transfer.bytesTransferred += increment;
      transfer.transferSpeedBps = 32 * 1024 * 1024 + Math.floor((Math.random() - 0.5) * 4 * 1024 * 1024);

      if (transfer.bytesTransferred >= transfer.fileSize) {
        clearInterval(interval);
        this.transferTimers.delete(transferId);

        transfer.status = 'verifying_checksum';
        this.notify();

        setTimeout(() => {
          transfer.status = 'verified_complete';
          transfer.completedAt = Date.now();
          teamManager.logEvent(
            'transfer_completed',
            `Transfer complete: ${transfer.filename} · Checksum SHA-256 verified`
          );
          this.notify();
        }, 500);
      } else {
        this.notify();
      }
    }, 100);

    this.transferTimers.set(transferId, interval as unknown as number);
  }
}

export const transferEngine = new TransferEngine();
