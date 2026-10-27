import { DockVisualState } from '../types';
import { transferEngine } from './transferEngine';

export class DockStateController {
  private visualState: DockVisualState = 'minimized';
  private hoveredRecipientId: string | null = null;
  private draggedFilePreview: { name: string; size: string } | null = null;
  private activeTransferId: string | null = null;
  private snoozedTransferIds: Set<string> = new Set();
  private dismissedTransferIds: Set<string> = new Set();
  private snoozeTimers: Map<string, number> = new Map();

  private listeners: (() => void)[] = [];

  constructor() {
    transferEngine.subscribe(() => {
      this.syncWithTransfers();
    });
  }

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

  public getVisualState(): DockVisualState {
    return this.visualState;
  }

  public getHoveredRecipientId(): string | null {
    return this.hoveredRecipientId;
  }

  public getDraggedFilePreview(): { name: string; size: string } | null {
    return this.draggedFilePreview;
  }

  public getActiveTransferId(): string | null {
    return this.activeTransferId;
  }

  public isTransferSnoozed(transferId: string): boolean {
    return this.snoozedTransferIds.has(transferId);
  }

  public setVisualState(state: DockVisualState): void {
    this.visualState = state;
    this.notify();
  }

  public setHoveredRecipient(id: string | null): void {
    this.hoveredRecipientId = id;
    this.notify();
  }

  public setDraggedFile(file: { name: string; size: string } | null): void {
    this.draggedFilePreview = file;
    if (file) {
      this.visualState = 'drag-over';
    } else if (this.visualState === 'drag-over') {
      this.visualState = 'minimized';
      this.hoveredRecipientId = null;
    }
    this.notify();
  }

  public toggleExpanded(): void {
    if (this.visualState === 'minimized') {
      this.visualState = 'expanded';
    } else {
      this.visualState = 'minimized';
    }
    this.notify();
  }

  public expand(): void {
    if (this.visualState === 'minimized') {
      this.visualState = 'expanded';
      this.notify();
    }
  }

  public collapse(): void {
    if (this.visualState === 'expanded' || this.visualState === 'drag-over') {
      this.visualState = 'minimized';
      this.draggedFilePreview = null;
      this.hoveredRecipientId = null;
      this.notify();
    }
  }

  public snooze(transferId: string, durationMs: number = 5000): void {
    if (this.dismissedTransferIds.has(transferId)) return;

    this.snoozedTransferIds.add(transferId);

    // Clear existing timer if any
    if (this.snoozeTimers.has(transferId)) {
      clearTimeout(this.snoozeTimers.get(transferId));
    }

    // Collapse visual state to minimized or quiet state without interrupting the background transfer
    if (this.visualState === 'receiving') {
      this.visualState = 'minimized';
    }

    const timer = setTimeout(() => {
      this.snoozedTransferIds.delete(transferId);
      this.snoozeTimers.delete(transferId);

      // Verify transfer hasn't been declined or dismissed
      if (this.dismissedTransferIds.has(transferId)) return;

      const currentTransfer = transferEngine.getTransfers().find((t) => t.id === transferId);
      if (
        currentTransfer &&
        (currentTransfer.status === 'transferring' ||
          currentTransfer.status === 'pending_acceptance')
      ) {
        // Restore notification after 5s snooze
        this.visualState = 'receiving';
        this.activeTransferId = transferId;
      }
      this.notify();
    }, durationMs);

    this.snoozeTimers.set(transferId, timer as unknown as number);
    this.notify();
  }

  public dismissTransfer(transferId: string): void {
    this.dismissedTransferIds.add(transferId);
    this.snoozedTransferIds.delete(transferId);
    if (this.snoozeTimers.has(transferId)) {
      clearTimeout(this.snoozeTimers.get(transferId));
      this.snoozeTimers.delete(transferId);
    }

    if (this.activeTransferId === transferId) {
      this.activeTransferId = null;
      this.visualState = 'minimized';
    }
    this.notify();
  }

  private syncWithTransfers(): void {
    const transfers = transferEngine.getTransfers();
    const activeIncoming = transfers.filter(
      (t) =>
        t.isIncoming &&
        !this.dismissedTransferIds.has(t.id) &&
        (t.status === 'pending_acceptance' ||
          t.status === 'transferring' ||
          t.status === 'verifying_checksum' ||
          t.status === 'verified_complete' ||
          t.status === 'failed')
    );

    if (activeIncoming.length === 0) {
      if (this.visualState === 'receiving' || this.visualState === 'completed' || this.visualState === 'failed') {
        this.visualState = 'minimized';
        this.activeTransferId = null;
        this.notify();
      }
      return;
    }

    const latest = activeIncoming[0];
    this.activeTransferId = latest.id;

    // Check if snoozed
    if (this.snoozedTransferIds.has(latest.id)) {
      // If completed while snoozed, immediately surface completed state!
      if (latest.status === 'verified_complete') {
        this.visualState = 'completed';
        this.snoozedTransferIds.delete(latest.id);
        this.notify();
      }
      return;
    }

    if (latest.status === 'pending_acceptance' || latest.status === 'transferring') {
      if (this.visualState !== 'expanded' && this.visualState !== 'drag-over') {
        this.visualState = 'receiving';
      }
    } else if (latest.status === 'verified_complete') {
      this.visualState = 'completed';
    } else if (latest.status === 'failed') {
      this.visualState = 'failed';
    }

    this.notify();
  }
}

export const dockStateController = new DockStateController();
