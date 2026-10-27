import { Peer } from '../types';
import { dockStateController } from './dockStateController';

export interface DockTargetTimingConfig {
  initialActivationDelayMs: number; // Delay before selecting on initial hover (180–250 ms, default: 220 ms)
  targetSwitchHysteresisMs: number; // Delay required before switching to another target (150–200 ms, default: 180 ms)
  interRowGracePeriodMs: number;    // Grace period for crossing small gaps between rows (80–120 ms, default: 100 ms)
  animationLockDurationMs: number;  // Lock duration while dock geometry is morphing/moving (default: 200 ms)
  dockHoverExpandDelayMs: number;   // Hover intent delay before expanding minimized dock (default: 220 ms)
  dockHoverCollapseDelayMs: number; // Grace period before collapsing when pointer leaves dock (default: 350 ms)
}

export interface DockTargetState {
  selectedRecipientId: string | null;
  pendingRecipientId: string | null;
  isLocked: boolean;
  isDockHovered: boolean;
  isManualExpandedPinned: boolean;
}

export const DEFAULT_TIMING_CONFIG: DockTargetTimingConfig = {
  initialActivationDelayMs: 220,
  targetSwitchHysteresisMs: 180,
  interRowGracePeriodMs: 100,
  animationLockDurationMs: 200,
  dockHoverExpandDelayMs: 220,
  dockHoverCollapseDelayMs: 350,
};

export class DockTargetController {
  private config: DockTargetTimingConfig = { ...DEFAULT_TIMING_CONFIG };

  private state: DockTargetState = {
    selectedRecipientId: null,
    pendingRecipientId: null,
    isLocked: false,
    isDockHovered: false,
    isManualExpandedPinned: false,
  };

  private activeSessionMembers: Map<string, { id: string; isOnline: boolean }> = new Map();

  // Cancellable timer references
  private activationTimer: number | null = null;
  private switchTimer: number | null = null;
  private graceTimer: number | null = null;
  private animationLockTimer: number | null = null;
  private hoverExpandTimer: number | null = null;
  private hoverCollapseTimer: number | null = null;

  private listeners: ((state: DockTargetState) => void)[] = [];

  constructor(timingConfig?: Partial<DockTargetTimingConfig>) {
    if (timingConfig) {
      this.config = { ...this.config, ...timingConfig };
    }
  }

  public subscribe(fn: (state: DockTargetState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public getState(): DockTargetState {
    return { ...this.state };
  }

  public getConfig(): DockTargetTimingConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<DockTargetTimingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Sync active session membership for validation before committing any transfer.
   */
  public setSessionMembers(members: Peer[] | string[]): void {
    this.activeSessionMembers.clear();
    for (const member of members) {
      if (typeof member === 'string') {
        this.activeSessionMembers.set(member, { id: member, isOnline: true });
      } else {
        this.activeSessionMembers.set(member.id, {
          id: member.id,
          isOnline: member.status !== 'offline',
        });
      }
    }

    // If currently selected or pending peer was removed from the session, cancel selection
    if (this.state.selectedRecipientId && !this.activeSessionMembers.has(this.state.selectedRecipientId)) {
      this.cancelDrag();
    }
  }

  public isMemberValid(peerId: string): boolean {
    const member = this.activeSessionMembers.get(peerId);
    return Boolean(member && member.isOnline);
  }

  /**
   * Pointer enters a candidate teammate row.
   * Enforces initial activation delay (220ms) or switch hysteresis (180ms).
   */
  public onTargetPointerEnter(peerId: string): void {
    if (!this.isMemberValid(peerId)) {
      return;
    }

    // Cancel any gap grace timer immediately since we are inside a candidate row
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }

    // Case 1: Already selected target - keep highlighted without jitter
    if (this.state.selectedRecipientId === peerId) {
      if (this.switchTimer !== null) {
        clearTimeout(this.switchTimer);
        this.switchTimer = null;
      }
      this.state.pendingRecipientId = null;
      return;
    }

    // Case 2: Dock is locked (animating or repositioning)
    if (this.state.isLocked) {
      this.state.pendingRecipientId = peerId;
      return;
    }

    // Case 3: Initial activation (no recipient currently selected)
    if (!this.state.selectedRecipientId) {
      if (this.state.pendingRecipientId !== peerId) {
        if (this.activationTimer !== null) {
          clearTimeout(this.activationTimer);
        }

        this.state.pendingRecipientId = peerId;
        this.notify();

        this.activationTimer = setTimeout(() => {
          this.activationTimer = null;
          if (!this.state.isLocked && this.state.pendingRecipientId === peerId) {
            this.state.selectedRecipientId = peerId;
            this.state.pendingRecipientId = null;
            this.notify();
          }
        }, this.config.initialActivationDelayMs) as unknown as number;
      }
      return;
    }

    // Case 4: Target-switch hysteresis (switching from an already selected recipient)
    if (this.state.selectedRecipientId !== peerId) {
      if (this.state.pendingRecipientId !== peerId) {
        if (this.switchTimer !== null) {
          clearTimeout(this.switchTimer);
        }

        this.state.pendingRecipientId = peerId;
        this.notify();

        this.switchTimer = setTimeout(() => {
          this.switchTimer = null;
          if (!this.state.isLocked && this.state.pendingRecipientId === peerId) {
            this.state.selectedRecipientId = peerId;
            this.state.pendingRecipientId = null;
            this.notify();
          }
        }, this.config.targetSwitchHysteresisMs) as unknown as number;
      }
    }
  }

  /**
   * Pointer leaves a teammate row.
   * Enforces cancellable timers and inter-row gap grace period (100ms).
   */
  public onTargetPointerLeave(peerId: string): void {
    // If leaving a pending (not yet selected) target, cancel the timer
    if (this.state.pendingRecipientId === peerId) {
      if (this.activationTimer !== null) {
        clearTimeout(this.activationTimer);
        this.activationTimer = null;
      }
      if (this.switchTimer !== null) {
        clearTimeout(this.switchTimer);
        this.switchTimer = null;
      }
      this.state.pendingRecipientId = null;
      this.notify();
    }

    // If leaving the currently selected target, start inter-row grace period
    if (this.state.selectedRecipientId === peerId) {
      if (this.graceTimer !== null) {
        clearTimeout(this.graceTimer);
      }

      this.graceTimer = setTimeout(() => {
        this.graceTimer = null;
        // If still on this recipient and haven't switched to another, clear selection
        if (this.state.selectedRecipientId === peerId && !this.state.pendingRecipientId) {
          this.state.selectedRecipientId = null;
          this.notify();
        }
      }, this.config.interRowGracePeriodMs) as unknown as number;
    }
  }

  /**
   * Locks target switching while dock geometry or shape is changing.
   */
  public lockGeometry(durationMs = this.config.animationLockDurationMs): void {
    if (this.activationTimer !== null) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    if (this.switchTimer !== null) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }

    this.state.isLocked = true;
    this.notify();

    if (this.animationLockTimer !== null) {
      clearTimeout(this.animationLockTimer);
    }

    this.animationLockTimer = setTimeout(() => {
      this.animationLockTimer = null;
      this.state.isLocked = false;

      // Layout stabilized: if there was a pending target, re-evaluate safely
      if (this.state.pendingRecipientId && this.isMemberValid(this.state.pendingRecipientId)) {
        const candidate = this.state.pendingRecipientId;
        this.state.pendingRecipientId = null;
        this.onTargetPointerEnter(candidate);
      } else {
        this.notify();
      }
    }, durationMs) as unknown as number;
  }

  /**
   * Validates final recipient ID against current session membership on drop.
   * Returns validated recipient ID if valid; null if outside or invalid.
   */
  public commitDrop(explicitTargetId?: string | null): string | null {
    const candidateId = explicitTargetId || this.state.selectedRecipientId;

    let validatedId: string | null = null;
    if (candidateId && this.isMemberValid(candidateId)) {
      validatedId = candidateId;
    }

    this.cancelDrag();
    return validatedId;
  }

  /**
   * Cancels any active drag or preview and resets all timers.
   */
  public cancelDrag(): void {
    this.cancelAllTimers();
    this.state.selectedRecipientId = null;
    this.state.pendingRecipientId = null;
    this.notify();
  }

  public cancelAllTimers(): void {
    if (this.activationTimer !== null) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    if (this.switchTimer !== null) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  /**
   * Mouse Pointer Hover-to-Expand
   * Expands dock smoothly when pointer hovers over minimized dock.
   */
  public onDockPointerEnter(isCurrentlyExpanded: boolean): void {
    this.state.isDockHovered = true;
    if (this.hoverCollapseTimer !== null) {
      clearTimeout(this.hoverCollapseTimer);
      this.hoverCollapseTimer = null;
    }

    if (!isCurrentlyExpanded) {
      if (this.hoverExpandTimer !== null) {
        clearTimeout(this.hoverExpandTimer);
      }

      this.hoverExpandTimer = setTimeout(() => {
        this.hoverExpandTimer = null;
        if (this.state.isDockHovered) {
          dockStateController.expand();
          this.lockGeometry(this.config.animationLockDurationMs);
        }
      }, this.config.dockHoverExpandDelayMs) as unknown as number;
    }
  }

  /**
   * Mouse Pointer Hover-to-Collapse
   * Collapses dock back to minimized when pointer leaves, unless pinned manually.
   */
  public onDockPointerLeave(): void {
    this.state.isDockHovered = false;
    if (this.hoverExpandTimer !== null) {
      clearTimeout(this.hoverExpandTimer);
      this.hoverExpandTimer = null;
    }

    if (!this.state.isManualExpandedPinned) {
      if (this.hoverCollapseTimer !== null) {
        clearTimeout(this.hoverCollapseTimer);
      }

      this.hoverCollapseTimer = setTimeout(() => {
        this.hoverCollapseTimer = null;
        if (!this.state.isDockHovered && !this.state.isManualExpandedPinned) {
          dockStateController.collapse();
          this.lockGeometry(160);
        }
      }, this.config.dockHoverCollapseDelayMs) as unknown as number;
    }
  }

  public toggleManualExpandedPin(): void {
    const nextPinned = !this.state.isManualExpandedPinned;
    this.state.isManualExpandedPinned = nextPinned;
    if (this.hoverCollapseTimer !== null) {
      clearTimeout(this.hoverCollapseTimer);
      this.hoverCollapseTimer = null;
    }
    this.notify();
  }

  public setManualExpandedPinned(pinned: boolean): void {
    this.state.isManualExpandedPinned = pinned;
    if (pinned && this.hoverCollapseTimer !== null) {
      clearTimeout(this.hoverCollapseTimer);
      this.hoverCollapseTimer = null;
    }
    this.notify();
  }
}

export const dockTargetController = new DockTargetController();
