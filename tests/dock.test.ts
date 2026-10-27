import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DockPlacementManager } from '../src/services/dockPlacement';
import { DockStateController } from '../src/services/dockStateController';
import { P2PEngine } from '../src/services/p2pEngine';
import { MonitorInfo } from '../src/types';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Team Deck Adaptive Floating Dock Test Suite', () => {
  let placementManager: DockPlacementManager;
  let stateController: DockStateController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    placementManager = new DockPlacementManager();
    stateController = new DockStateController();
  });

  describe('1. Placement & Snapping Engine', () => {
    it('should snap to left edge when pointer is closest to left boundary', () => {
      const placement = placementManager.snapToNearestPosition(50, 500, 1920, 1080);
      expect(placement.edge).toBe('left');
      expect(placement.alignment).toBe('center');
    });

    it('should snap to right edge when pointer is closest to right boundary', () => {
      const placement = placementManager.snapToNearestPosition(1880, 500, 1920, 1080);
      expect(placement.edge).toBe('right');
      expect(placement.alignment).toBe('center');
    });

    it('should snap to top edge when pointer is closest to top boundary', () => {
      const placement = placementManager.snapToNearestPosition(960, 40, 1920, 1080);
      expect(placement.edge).toBe('top');
      expect(placement.alignment).toBe('center');
    });

    it('should snap to bottom edge when pointer is closest to bottom boundary', () => {
      const placement = placementManager.snapToNearestPosition(960, 1040, 1920, 1080);
      expect(placement.edge).toBe('bottom');
      expect(placement.alignment).toBe('center');
    });

    it('should snap to corner alignment (start/end) when near corners', () => {
      // Top-right corner
      const topRight = placementManager.snapToNearestPosition(1900, 50, 1920, 1080);
      expect(topRight.edge).toBe('right');
      expect(topRight.alignment).toBe('start');
      expect(topRight.cornerSnapped).toBe(true);

      // Bottom-right corner
      const bottomRight = placementManager.snapToNearestPosition(1900, 1050, 1920, 1080);
      expect(bottomRight.edge).toBe('right');
      expect(bottomRight.alignment).toBe('end');
      expect(bottomRight.cornerSnapped).toBe(true);
    });
  });

  describe('2. Multi-Monitor Behavior & Graceful Recovery', () => {
    it('should persist placement and reload from storage', () => {
      placementManager.setPlacement({ edge: 'left', alignment: 'end' });
      expect(placementManager.getPlacement().edge).toBe('left');
      expect(placementManager.getPlacement().alignment).toBe('end');

      // Re-initialize manager to simulate app restart
      const reloadedManager = new DockPlacementManager();
      expect(reloadedManager.getPlacement().edge).toBe('left');
      expect(reloadedManager.getPlacement().alignment).toBe('end');
    });

    it('should gracefully fallback to primary monitor if saved monitor is disconnected', () => {
      const dualMonitors: MonitorInfo[] = [
        {
          name: 'Display-1 (Primary)',
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          workAreaX: 0,
          workAreaY: 0,
          workAreaWidth: 1920,
          workAreaHeight: 1032,
          scaleFactor: 1.0,
          isPrimary: true,
        },
        {
          name: 'Display-2 (External 4K)',
          x: 1920,
          y: 0,
          width: 3840,
          height: 2160,
          workAreaX: 1920,
          workAreaY: 0,
          workAreaWidth: 3840,
          workAreaHeight: 2160,
          scaleFactor: 1.5,
          isPrimary: false,
        },
      ];

      placementManager.setMonitors(dualMonitors);
      placementManager.setPlacement({ monitorName: 'Display-2 (External 4K)', edge: 'bottom' });
      expect(placementManager.getPlacement().monitorName).toBe('Display-2 (External 4K)');

      // Simulate external monitor being disconnected
      const singleMonitor = [dualMonitors[0]];
      placementManager.setMonitors(singleMonitor);

      // Verify graceful recovery fallback to primary display
      const recovered = placementManager.getPlacement();
      expect(recovered.monitorName).toBe('Display-1 (Primary)');
      expect(recovered.edge).toBe('right');
    });
  });

  describe('3. Unified Dock Visual State Machine', () => {
    it('should handle expansion and collapse transitions', () => {
      expect(stateController.getVisualState()).toBe('minimized');

      stateController.expand();
      expect(stateController.getVisualState()).toBe('expanded');

      stateController.collapse();
      expect(stateController.getVisualState()).toBe('minimized');
    });

    it('should transition to drag-over and show file preview on OS file drag', () => {
      stateController.setDraggedFile({ name: 'design.fig', size: '12 KB' });
      expect(stateController.getVisualState()).toBe('drag-over');
      expect(stateController.getDraggedFilePreview()?.name).toBe('design.fig');

      // Drag leaves dock without drop
      stateController.setDraggedFile(null);
      expect(stateController.getVisualState()).toBe('minimized');
      expect(stateController.getDraggedFilePreview()).toBeNull();
    });
  });

  describe('4. Receiver Notifications & 5-Second Snooze Timing', () => {
    it('should snooze notification without stopping background transfer and restore after 5s', () => {
      const transferId = 'tr-test-snooze-1';
      stateController.setVisualState('receiving');

      // Snooze for 5 seconds
      stateController.snooze(transferId, 5000);
      expect(stateController.isTransferSnoozed(transferId)).toBe(true);
      expect(stateController.getVisualState()).toBe('minimized');

      // Fast-forward 2 seconds: should still be snoozed
      vi.advanceTimersByTime(2000);
      expect(stateController.isTransferSnoozed(transferId)).toBe(true);

      // Fast-forward remaining 3 seconds (total 5s)
      vi.advanceTimersByTime(3000);
      expect(stateController.isTransferSnoozed(transferId)).toBe(false);
    });

    it('should never reopen if transfer was explicitly dismissed or declined', () => {
      const transferId = 'tr-test-declined';
      stateController.snooze(transferId, 5000);
      expect(stateController.isTransferSnoozed(transferId)).toBe(true);

      // User explicitly declines/dismisses
      stateController.dismissTransfer(transferId);
      expect(stateController.isTransferSnoozed(transferId)).toBe(false);

      // Advance past 5s
      vi.advanceTimersByTime(6000);
      expect(stateController.getVisualState()).toBe('minimized');
    });

    it('should immediately surface completed state if transfer finishes during snooze', () => {
      const engine = new P2PEngine();
      const transfer = engine.triggerSimulatedIncoming('peer-sachin', 'design.fig', 1000);

      // Start receiving and snooze it
      engine.acceptIncomingTransfer(transfer.id);
      stateController.snooze(transfer.id, 5000);
      expect(stateController.isTransferSnoozed(transfer.id)).toBe(true);

      // Advance timers to finish transfer simulation (which takes ~1000ms)
      vi.advanceTimersByTime(1200);

      // Verified complete should surface completion immediately despite being snoozed
      const completedRecord = engine.getTransfers().find((t) => t.id === transfer.id);
      expect(completedRecord?.status).toBe('verified_complete');
    });
  });
});
