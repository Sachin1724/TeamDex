import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DockTargetController } from '../src/services/dockTargetController';
import { dockStateController } from '../src/services/dockStateController';
import { Peer } from '../src/types';

describe('Team Deck Dock Hover Switching & Target Selection Engine', () => {
  let controller: DockTargetController;

  const mockPeers: Peer[] = [
    { id: 'peer-sachin', name: 'Sachin', status: 'online', isLeader: true, ip: '192.168.1.101', port: 8080 },
    { id: 'peer-riya', name: 'Riya', status: 'online', isLeader: false, ip: '192.168.1.102', port: 8080 },
    { id: 'peer-arjun', name: 'Arjun', status: 'online', isLeader: false, ip: '192.168.1.103', port: 8080 },
    { id: 'peer-neha', name: 'Neha', status: 'online', isLeader: false, ip: '192.168.1.104', port: 8080 },
    { id: 'peer-karthik', name: 'Karthik', status: 'offline', isLeader: false, ip: '192.168.1.105', port: 8080 },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    dockStateController.collapse();
    controller = new DockTargetController({
      initialActivationDelayMs: 220,
      targetSwitchHysteresisMs: 180,
      interRowGracePeriodMs: 100,
      animationLockDurationMs: 200,
      dockHoverExpandDelayMs: 220,
      dockHoverCollapseDelayMs: 350,
    });
    controller.setSessionMembers(mockPeers);
  });

  describe('1. Hover Activation Delay (220 ms)', () => {
    it('should not flicker or select any teammate during rapid sweeps across five rows', () => {
      // Rapidly traverse all 5 peers in 40ms intervals (< 220ms initial activation threshold)
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(40);
      controller.onTargetPointerLeave('peer-sachin');

      controller.onTargetPointerEnter('peer-riya');
      vi.advanceTimersByTime(40);
      controller.onTargetPointerLeave('peer-riya');

      controller.onTargetPointerEnter('peer-arjun');
      vi.advanceTimersByTime(40);
      controller.onTargetPointerLeave('peer-arjun');

      controller.onTargetPointerEnter('peer-neha');
      vi.advanceTimersByTime(40);
      controller.onTargetPointerLeave('peer-neha');

      // Verify no row became selected
      expect(controller.getState().selectedRecipientId).toBeNull();
    });

    it('should select teammate when pointer pauses for >= 220 ms', () => {
      controller.onTargetPointerEnter('peer-sachin');

      // 100ms in: still pending, not selected
      vi.advanceTimersByTime(100);
      expect(controller.getState().selectedRecipientId).toBeNull();
      expect(controller.getState().pendingRecipientId).toBe('peer-sachin');

      // Advance remaining 120ms (total 220ms): becomes selected!
      vi.advanceTimersByTime(120);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');
      expect(controller.getState().pendingRecipientId).toBeNull();
    });

    it('should cancel pending selection if pointer leaves before 220 ms delay expires', () => {
      controller.onTargetPointerEnter('peer-riya');
      vi.advanceTimersByTime(150);
      expect(controller.getState().selectedRecipientId).toBeNull();

      controller.onTargetPointerLeave('peer-riya');
      expect(controller.getState().pendingRecipientId).toBeNull();

      // Even after waiting past 220ms, it should remain unselected
      vi.advanceTimersByTime(200);
      expect(controller.getState().selectedRecipientId).toBeNull();
    });
  });

  describe('2. Target-Switch Hysteresis (180 ms) & Inter-Row Grace Period (100 ms)', () => {
    it('should maintain selection while pointer moves through small gaps between rows (100 ms grace period)', () => {
      // Select peer-sachin
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Pointer leaves row into inter-row gap
      controller.onTargetPointerLeave('peer-sachin');

      // 50ms into gap (within 100ms grace period): still selected!
      vi.advanceTimersByTime(50);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Pointer re-enters row within grace period
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(100);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');
    });

    it('should clear selection if gap grace period (100 ms) fully expires without re-entry', () => {
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Leaves row
      controller.onTargetPointerLeave('peer-sachin');
      vi.advanceTimersByTime(120); // Past 100ms grace period

      expect(controller.getState().selectedRecipientId).toBeNull();
    });

    it('should require 180 ms continuous dwell before switching from an already selected teammate', () => {
      // Initially select peer-sachin
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Move into adjacent row (peer-riya)
      controller.onTargetPointerEnter('peer-riya');

      // 100ms in: peer-sachin MUST remain selected due to hysteresis!
      vi.advanceTimersByTime(100);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');
      expect(controller.getState().pendingRecipientId).toBe('peer-riya');

      // Advance remaining 80ms (total 180ms hysteresis): now switches to peer-riya
      vi.advanceTimersByTime(80);
      expect(controller.getState().selectedRecipientId).toBe('peer-riya');
      expect(controller.getState().pendingRecipientId).toBeNull();
    });

    it('should not switch targets if pointer quickly brushes another row and leaves before 180 ms', () => {
      // Initially select peer-sachin
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Pointer quickly brushes peer-riya for 80ms then leaves
      controller.onTargetPointerEnter('peer-riya');
      vi.advanceTimersByTime(80);
      controller.onTargetPointerLeave('peer-riya');

      vi.advanceTimersByTime(200);
      // peer-riya was never selected
      expect(controller.getState().selectedRecipientId).not.toBe('peer-riya');
    });
  });

  describe('3. Geometry & Dock Animation Lock', () => {
    it('should ignore/lock target switching while dock is expanding or repositioning', () => {
      // Lock geometry during 200ms morph animation
      controller.lockGeometry(200);
      expect(controller.getState().isLocked).toBe(true);

      // Pointer enters peer-sachin while animating
      controller.onTargetPointerEnter('peer-sachin');

      // 150ms elapsed: still locked, no selection
      vi.advanceTimersByTime(150);
      expect(controller.getState().selectedRecipientId).toBeNull();
      expect(controller.getState().isLocked).toBe(true);

      // Animation finishes at 200ms
      vi.advanceTimersByTime(60);
      expect(controller.getState().isLocked).toBe(false);

      // Now layout has stabilized; activation delay runs
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');
    });
  });

  describe('4. Separate Hover from Commitment & Session Membership Validation', () => {
    it('should never initiate transfer from hover alone and commit only on valid drop', () => {
      // Dwell over peer-sachin
      controller.onTargetPointerEnter('peer-sachin');
      vi.advanceTimersByTime(220);
      expect(controller.getState().selectedRecipientId).toBe('peer-sachin');

      // Committing valid drop
      const committedRecipient = controller.commitDrop('peer-sachin');
      expect(committedRecipient).toBe('peer-sachin');

      // State resets immediately after drop
      expect(controller.getState().selectedRecipientId).toBeNull();
    });

    it('should reject drop and cancel send when dropped outside a valid row or on offline peer', () => {
      // Offline peer cannot be committed
      const offlineCommit = controller.commitDrop('peer-karthik');
      expect(offlineCommit).toBeNull();

      // Non-member or outside drop cannot be committed
      const invalidCommit = controller.commitDrop('unknown-peer-xyz');
      expect(invalidCommit).toBeNull();

      // Dropping outside with no target
      const outsideCommit = controller.commitDrop(null);
      expect(outsideCommit).toBeNull();
    });
  });

  describe('5. Mouse Hover to Expand and Collapse', () => {
    it('should expand dock after hover intent delay (220 ms) when pointer enters minimized dock', () => {
      expect(dockStateController.getVisualState()).toBe('minimized');

      // Pointer enters dock
      controller.onDockPointerEnter(false);

      // 100ms in: still minimized
      vi.advanceTimersByTime(100);
      expect(dockStateController.getVisualState()).toBe('minimized');

      // Advance remaining 130ms (total 230ms >= 220ms): expands!
      vi.advanceTimersByTime(130);
      expect(dockStateController.getVisualState()).toBe('expanded');
    });

    it('should collapse dock after 350 ms when pointer leaves, unless manually pinned', () => {
      dockStateController.expand();
      expect(dockStateController.getVisualState()).toBe('expanded');

      // Pointer leaves dock
      controller.onDockPointerLeave();

      // 200ms in: still expanded (within 350ms grace period)
      vi.advanceTimersByTime(200);
      expect(dockStateController.getVisualState()).toBe('expanded');

      // Advance remaining 160ms (total 360ms >= 350ms): collapses back to minimized!
      vi.advanceTimersByTime(160);
      expect(dockStateController.getVisualState()).toBe('minimized');
    });

    it('should not auto-collapse when manually pinned by user', () => {
      dockStateController.expand();
      controller.setManualExpandedPinned(true);

      controller.onDockPointerLeave();
      vi.advanceTimersByTime(500);

      // Remains expanded because it was manually pinned
      expect(dockStateController.getVisualState()).toBe('expanded');
    });
  });
});
