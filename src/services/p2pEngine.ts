import { transferEngine } from './transferEngine';
import { teamManager } from './teamManager';
import { Peer, TransferRecord, SessionState, DeviceSettings, ActivityEvent } from '../types';

export class P2PEngine {
  public getPeers(): Peer[] {
    return teamManager.getPeers();
  }

  public getSession(): SessionState {
    return teamManager.getSession();
  }

  public getTransfers(): TransferRecord[] {
    return transferEngine.getTransfers();
  }

  public getActivityLog(): ActivityEvent[] {
    return teamManager.getActivityLog();
  }

  public getSettings(): DeviceSettings {
    return teamManager.getSettings();
  }

  public updateSettings(partial: Partial<DeviceSettings>): void {
    teamManager.updateSettings(partial);
  }

  public initiateSend(file: { name: string; size: number }, targetPeerId: string): TransferRecord {
    return transferEngine.initiateSend(file, targetPeerId);
  }

  public triggerSimulatedIncoming(
    senderPeerId: string = 'peer-sachin',
    filename: string = 'design.fig',
    sizeBytes: number = 12 * 1024
  ): TransferRecord {
    return transferEngine.triggerSimulatedIncoming(senderPeerId, filename, sizeBytes);
  }

  public triggerFailedTransfer(
    filename: string = 'data.zip',
    sizeBytes: number = 24 * 1024 * 1024
  ): TransferRecord {
    return transferEngine.triggerFailedTransfer(filename, sizeBytes);
  }

  public acceptIncomingTransfer(transferId: string): void {
    transferEngine.acceptIncomingTransfer(transferId);
  }

  public declineIncomingTransfer(transferId: string): void {
    transferEngine.declineIncomingTransfer(transferId);
  }

  public dismissTransfer(transferId: string): void {
    transferEngine.dismissTransfer(transferId);
  }

  public retryTransfer(transferId: string): void {
    transferEngine.retryTransfer(transferId);
  }

  public interruptTransfer(transferId: string): void {
    transferEngine.interruptTransfer(transferId);
  }

  public electLeaderSuccessor(): void {
    teamManager.electLeaderSuccessor();
  }

  public toggleFirewallStatus(): void {
    teamManager.toggleFirewallStatus();
  }

  public subscribe(fn: () => void): () => void {
    const unsub1 = transferEngine.subscribe(fn);
    const unsub2 = teamManager.subscribe(fn);
    return () => {
      unsub1();
      unsub2();
    };
  }
}

export const p2pEngine = new P2PEngine();
