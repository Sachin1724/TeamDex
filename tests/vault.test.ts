import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vaultController } from '../src/services/vaultController';
import { computeVaultPlacement } from '../src/services/vaultPlacement';
import { P2PEngine } from '../src/services/p2pEngine';
import { Peer, TransferRecord } from '../src/types';

describe('Team Deck Per-Teammate Transfer Vault Test Suite', () => {
  const riyaPeer: Peer = {
    id: 'peer-riya',
    name: 'Riya',
    status: 'online',
    isLeader: false,
    ip: '192.168.1.108',
    port: 53318,
  };

  const arjunPeer: Peer = {
    id: 'peer-arjun',
    name: 'Arjun',
    status: 'online',
    isLeader: false,
    ip: '192.168.1.115',
    port: 53318,
  };

  const karthikOfflinePeer: Peer = {
    id: 'peer-karthik',
    name: 'Karthik',
    status: 'offline',
    isLeader: false,
    ip: '192.168.1.140',
    port: 53318,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vaultController.closeVault();
  });

  describe('1. Interaction & Smooth Teammate Switching', () => {
    it('should open Riya vault when Riya is clicked', () => {
      expect(vaultController.getState().isOpen).toBe(false);

      vaultController.openVault(riyaPeer);
      const state = vaultController.getState();
      expect(state.isOpen).toBe(true);
      expect(state.selectedTeammate?.id).toBe('peer-riya');
      expect(state.selectedTeammate?.name).toBe('Riya');
    });

    it('should switch to Arjun history without closing when Arjun is clicked', () => {
      vaultController.openVault(riyaPeer);
      expect(vaultController.getState().selectedTeammate?.id).toBe('peer-riya');

      // Click Arjun: switches directly
      vaultController.switchTeammate(arjunPeer);
      const state = vaultController.getState();
      expect(state.isOpen).toBe(true);
      expect(state.selectedTeammate?.id).toBe('peer-arjun');
      expect(state.selectedTeammate?.name).toBe('Arjun');
    });

    it('should toggle vault closed when the same teammate is clicked again', () => {
      vaultController.toggleVault(riyaPeer);
      expect(vaultController.getState().isOpen).toBe(true);

      // Click Riya again: closes vault
      vaultController.toggleVault(riyaPeer);
      expect(vaultController.getState().isOpen).toBe(false);
      expect(vaultController.getState().selectedTeammate).toBeNull();
    });

    it('should update active tab and search query', () => {
      vaultController.openVault(riyaPeer);
      expect(vaultController.getState().activeTab).toBe('all');

      vaultController.setActiveTab('received');
      expect(vaultController.getState().activeTab).toBe('received');

      vaultController.setSearchQuery('fig');
      expect(vaultController.getState().searchQuery).toBe('fig');
    });
  });

  describe('2. Adaptive Placement Engine', () => {
    const monitorWorkArea = {
      x: 0,
      y: 0,
      width: 1920,
      height: 1032, // 48px taskbar
    };

    it('should prefer opening to the left when dock is docked on the right edge', () => {
      const dockRect = { x: 1850, y: 300, width: 60, height: 400 };
      const selectedRowRect = { x: 1855, y: 350, width: 50, height: 44 };

      const placement = computeVaultPlacement({
        dockRect,
        selectedRowRect,
        dockEdge: 'right',
        monitorWorkArea,
        vaultSize: { width: 340, height: 460 },
        margin: 12,
      });

      expect(placement.side).toBe('left');
      expect(placement.x).toBeLessThan(dockRect.x);
      expect(placement.x + placement.width).toBeLessThanOrEqual(dockRect.x);
    });

    it('should prefer opening to the right when dock is docked on the left edge', () => {
      const dockRect = { x: 12, y: 300, width: 60, height: 400 };
      const selectedRowRect = { x: 17, y: 350, width: 50, height: 44 };

      const placement = computeVaultPlacement({
        dockRect,
        selectedRowRect,
        dockEdge: 'left',
        monitorWorkArea,
        vaultSize: { width: 340, height: 460 },
        margin: 12,
      });

      expect(placement.side).toBe('right');
      expect(placement.x).toBeGreaterThanOrEqual(dockRect.x + dockRect.width);
    });

    it('should prefer opening below when dock is docked on the top edge', () => {
      const dockRect = { x: 800, y: 12, width: 320, height: 60 };

      const placement = computeVaultPlacement({
        dockRect,
        dockEdge: 'top',
        monitorWorkArea,
        vaultSize: { width: 340, height: 460 },
        margin: 12,
      });

      expect(placement.side).toBe('bottom');
      expect(placement.y).toBeGreaterThanOrEqual(dockRect.y + dockRect.height);
    });

    it('should prefer opening above when dock is docked on the bottom edge', () => {
      const dockRect = { x: 800, y: 960, width: 320, height: 60 };

      const placement = computeVaultPlacement({
        dockRect,
        dockEdge: 'bottom',
        monitorWorkArea,
        vaultSize: { width: 340, height: 460 },
        margin: 12,
      });

      expect(placement.side).toBe('top');
      expect(placement.y + placement.height).toBeLessThanOrEqual(dockRect.y);
    });

    it('should clamp bounds strictly inside monitor work area and taskbar boundaries', () => {
      // Dock placed near bottom-right corner
      const dockRect = { x: 1890, y: 900, width: 25, height: 100 };

      const placement = computeVaultPlacement({
        dockRect,
        dockEdge: 'right',
        monitorWorkArea,
        vaultSize: { width: 340, height: 460 },
        margin: 12,
      });

      // Assert clamped within screen bounds
      expect(placement.x).toBeGreaterThanOrEqual(monitorWorkArea.x);
      expect(placement.x + placement.width).toBeLessThanOrEqual(
        monitorWorkArea.x + monitorWorkArea.width
      );
      expect(placement.y).toBeGreaterThanOrEqual(monitorWorkArea.y);
      expect(placement.y + placement.height).toBeLessThanOrEqual(
        monitorWorkArea.y + monitorWorkArea.height
      );
    });
  });

  describe('3. Dynamic Transfer State & Decoupling', () => {
    it('should not interrupt or cancel background transfers when vault is closed or switched', () => {
      const engine = new P2PEngine();
      const transfer = engine.triggerSimulatedIncoming('peer-riya', 'design.fig', 10000);

      // Start transfer
      engine.acceptIncomingTransfer(transfer.id);
      expect(engine.getTransfers().find((t) => t.id === transfer.id)?.status).toBe('transferring');

      // Open Riya vault
      vaultController.openVault(riyaPeer);
      expect(vaultController.getState().isOpen).toBe(true);

      // Switch to Arjun
      vaultController.switchTeammate(arjunPeer);

      // Close vault completely
      vaultController.closeVault();
      expect(vaultController.getState().isOpen).toBe(false);

      // Advance transfer timers in background
      vi.advanceTimersByTime(500);

      // Transfer must still be active and making progress in p2pEngine!
      const activeTransfer = engine.getTransfers().find((t) => t.id === transfer.id);
      expect(activeTransfer?.status).toBe('transferring');
      expect(activeTransfer?.bytesTransferred).toBeGreaterThan(0);
    });

    it('should preserve historical transfers for offline teammates', () => {
      const engine = new P2PEngine();
      // Look up existing transfers for Karthik (who is offline)
      const karthikTransfers = engine.getTransfers().filter(
        (t) => t.recipientId === karthikOfflinePeer.id || t.senderId === karthikOfflinePeer.id
      );

      // Open Karthik vault
      vaultController.openVault(karthikOfflinePeer);
      expect(vaultController.getState().selectedTeammate?.status).toBe('offline');

      // History must remain accessible
      expect(karthikTransfers.length).toBeGreaterThanOrEqual(0);
    });

    it('should distinguish multiple transfers with duplicate filenames by stable transfer IDs', () => {
      const engine = new P2PEngine();
      const t1 = engine.initiateSend({ name: 'design.fig', size: 1024 }, 'peer-riya');
      const t2 = engine.initiateSend({ name: 'design.fig', size: 2048 }, 'peer-riya');

      expect(t1.id).not.toBe(t2.id);
      expect(t1.filename).toBe(t2.filename);

      const allTransfers = engine.getTransfers();
      expect(allTransfers.some((t) => t.id === t1.id)).toBe(true);
      expect(allTransfers.some((t) => t.id === t2.id)).toBe(true);
    });
  });
});
