import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, DockEdge, DockPlacement, TransferRecord } from '../types';
import { transferEngine } from '../services/transferEngine';
import { dockPlacementManager } from '../services/dockPlacement';
import { dockStateController } from '../services/dockStateController';
import { dockTargetController, DockTargetState } from '../services/dockTargetController';
import { vaultController, VaultState } from '../services/vaultController';
import { computeVaultPlacement, VaultPlacementResult } from '../services/vaultPlacement';
import { TeammateAvatarInitial } from './TeammateAvatarInitial';
import { TransferVault } from './TransferVault';
import {
  GripVertical,
  GripHorizontal,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
} from 'lucide-react';

interface EdgeDockProps {
  peers: Peer[];
  onSettingsClick?: () => void;
  onOpenWorkspace?: () => void;
  isStandalone?: boolean;
}

export const EdgeDock: React.FC<EdgeDockProps> = ({
  peers,
  onSettingsClick,
  onOpenWorkspace,
  isStandalone = false,
}) => {
  const [placement, setPlacement] = useState<DockPlacement>(dockPlacementManager.getPlacement());
  const [visualState, setVisualState] = useState(dockStateController.getVisualState());
  const [targetState, setTargetState] = useState<DockTargetState>(dockTargetController.getState());
  const [vaultState, setVaultState] = useState<VaultState>(vaultController.getState());
  const [vaultBounds, setVaultBounds] = useState<VaultPlacementResult | null>(null);
  const [draggedFile, setDraggedFile] = useState<{ name: string; size: string } | null>(null);
  const [isDraggingDock, setIsDraggingDock] = useState(false);
  const [transfers, setTransfers] = useState<TransferRecord[]>(transferEngine.getTransfers());

  const dockRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Synchronize session membership with dock target selection controller
  useEffect(() => {
    dockTargetController.setSessionMembers(peers);
  }, [peers]);

  useEffect(() => {
    const unsubPlacement = dockPlacementManager.subscribe(setPlacement);
    const unsubState = dockStateController.subscribe(() => {
      setVisualState(dockStateController.getVisualState());
    });
    const unsubTarget = dockTargetController.subscribe(setTargetState);
    const unsubVault = vaultController.subscribe(setVaultState);
    const unsubTransfer = transferEngine.subscribe(() => {
      setTransfers(transferEngine.getTransfers());
    });

    return () => {
      unsubPlacement();
      unsubState();
      unsubTarget();
      unsubVault();
      unsubTransfer();
    };
  }, []);

  const isExpanded = visualState === 'expanded' || visualState === 'drag-over';
  const isHorizontal = placement.edge === 'top' || placement.edge === 'bottom';

  // Calculate adaptive placement for Transfer Vault anchored to the dock
  const updateVaultBounds = useCallback(() => {
    if (!dockRef.current || !vaultState.selectedTeammate) return;
    const dockRect = dockRef.current.getBoundingClientRect();
    const rowEl = rowRefs.current[vaultState.selectedTeammate.id];
    const rowRect = rowEl ? rowEl.getBoundingClientRect() : null;

    const result = computeVaultPlacement({
      dockRect: {
        x: dockRect.left,
        y: dockRect.top,
        width: dockRect.width,
        height: dockRect.height,
      },
      selectedRowRect: rowRect
        ? {
            x: rowRect.left,
            y: rowRect.top,
            width: rowRect.width,
            height: rowRect.height,
          }
        : null,
      dockEdge: placement.edge,
      monitorWorkArea: {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      vaultSize: { width: 340, height: 460 },
      margin: 12,
    });

    setVaultBounds(result);
  }, [placement.edge, vaultState.selectedTeammate]);

  // Recalculate vault bounds whenever dock moves, edge changes, teammate changes, or window resizes
  useEffect(() => {
    if (vaultState.isOpen) {
      updateVaultBounds();
    }
  }, [vaultState.isOpen, vaultState.selectedTeammate, placement.edge, isExpanded, updateVaultBounds]);

  useEffect(() => {
    const handleResize = () => {
      if (vaultState.isOpen) {
        updateVaultBounds();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [vaultState.isOpen, updateVaultBounds]);

  // Close vault when clicking outside both dock and vault
  useEffect(() => {
    if (!vaultState.isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        vaultRef.current &&
        !vaultRef.current.contains(target) &&
        dockRef.current &&
        !dockRef.current.contains(target)
      ) {
        vaultController.closeVault();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [vaultState.isOpen]);

  // Find active transfer for each peer to calculate live ring animation
  const getPeerTransferInfo = (peerId: string) => {
    const active = transfers.find(
      (t) =>
        (t.recipientId === peerId || t.senderId === peerId) &&
        (t.status === 'transferring' || t.status === 'verifying_checksum')
    );

    if (active) {
      const progress =
        active.fileSize > 0
          ? Math.min(100, Math.round((active.bytesTransferred / active.fileSize) * 100))
          : 50;
      return { progress, isCompleted: false };
    }

    const recentlyCompleted = transfers.find(
      (t) =>
        (t.recipientId === peerId || t.senderId === peerId) &&
        t.status === 'verified_complete' &&
        t.completedAt &&
        Date.now() - t.completedAt < 45000
    );

    if (recentlyCompleted) {
      return { progress: null, isCompleted: true };
    }

    return { progress: null, isCompleted: false };
  };

  // Drag over dock from operating system Explorer
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedFile) {
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        setDraggedFile({ name: 'design.fig', size: '12 KB' });
      } else {
        setDraggedFile({ name: 'design.fig', size: '12 KB' });
      }
    }
    dockStateController.setVisualState('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      dockTargetController.cancelDrag();
      setDraggedFile(null);
      dockStateController.setVisualState('minimized');
    }
  };

  const executeTransfer = (e: React.DragEvent, recipientId: string) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      transferEngine.initiateSend({ name: file.name, size: file.size }, recipientId);
    } else if (draggedFile) {
      transferEngine.initiateSend({ name: draggedFile.name, size: 12 * 1024 }, recipientId);
    }

    setDraggedFile(null);
    dockStateController.setVisualState('minimized');
  };

  // Dropping on dock container
  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const recipientId = dockTargetController.commitDrop();
    if (!recipientId) {
      // Dropped outside a valid recipient - cancel send
      setDraggedFile(null);
      dockStateController.setVisualState('minimized');
      return;
    }

    executeTransfer(e, recipientId);
  };

  // Dropping on specific peer row
  const handleDropOnPeer = (e: React.DragEvent, peerId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const recipientId = dockTargetController.commitDrop(peerId);
    if (!recipientId) {
      // Membership validation failed or offline
      setDraggedFile(null);
      dockStateController.setVisualState('minimized');
      return;
    }

    executeTransfer(e, recipientId);
  };

  // Mouse hover to expand/collapse
  const handleDockPointerEnter = () => {
    if (!isDraggingDock && !vaultState.isOpen) {
      dockTargetController.onDockPointerEnter(isExpanded);
    }
  };

  const handleDockPointerLeave = () => {
    if (!isDraggingDock && !vaultState.isOpen) {
      dockTargetController.onDockPointerLeave();
    }
  };

  // Manual repositioning: pointer drag handlers
  const handlePointerDownGrip = (e: React.PointerEvent) => {
    e.preventDefault();
    dockTargetController.lockGeometry(400);
    setIsDraggingDock(true);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingDock) return;
      dockPlacementManager.snapToNearestPosition(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight
      );
    };

    const handlePointerUp = () => {
      if (isDraggingDock) {
        dockTargetController.lockGeometry(200);
        setIsDraggingDock(false);
      }
    };

    if (isDraggingDock) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingDock]);

  // Positioning classes based on edge and alignment
  const getPlacementClasses = () => {
    if (isStandalone) {
      return 'w-full h-full flex items-center justify-center p-2';
    }

    const classes: string[] = ['fixed z-50 select-none'];

    if (placement.edge === 'right') {
      classes.push('right-3');
      if (placement.alignment === 'start') classes.push('top-6');
      else if (placement.alignment === 'end') classes.push('bottom-6');
      else classes.push('top-1/2 -translate-y-1/2');
    } else if (placement.edge === 'left') {
      classes.push('left-3');
      if (placement.alignment === 'start') classes.push('top-6');
      else if (placement.alignment === 'end') classes.push('bottom-6');
      else classes.push('top-1/2 -translate-y-1/2');
    } else if (placement.edge === 'top') {
      classes.push('top-3');
      if (placement.alignment === 'start') classes.push('left-6');
      else if (placement.alignment === 'end') classes.push('right-6');
      else classes.push('left-1/2 -translate-x-1/2');
    } else if (placement.edge === 'bottom') {
      classes.push('bottom-3');
      if (placement.alignment === 'start') classes.push('left-6');
      else if (placement.alignment === 'end') classes.push('right-6');
      else classes.push('left-1/2 -translate-x-1/2');
    }

    return classes.join(' ');
  };

  return (
    <>
      {/* 1. Main Floating Edge Dock */}
      <div
        ref={dockRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleContainerDrop}
        onPointerEnter={handleDockPointerEnter}
        onPointerLeave={handleDockPointerLeave}
        className={getPlacementClasses()}
      >
        <div
          className={`bg-surface border border-border shadow-dock rounded-2xl flex transition-all duration-[180ms] ease-out motion-reduce:duration-0 ${
            isHorizontal
              ? isExpanded
                ? 'flex-col p-3 w-80'
                : 'flex-row items-center p-1.5 space-x-2 h-14'
              : isExpanded
              ? 'flex-col p-3 w-52 space-y-2'
              : 'flex-col items-center p-1.5 space-y-2 w-14'
          } ${isDraggingDock ? 'scale-105 border-electric ring-2 ring-electric/30' : ''}`}
        >
          {/* Dock Header & Drag Handle Grip */}
          <div
            className={`flex items-center justify-between text-text-muted ${
              isHorizontal && !isExpanded ? 'space-x-1' : 'w-full mb-1'
            }`}
          >
            {/* Logo / App trigger */}
            <button
              onClick={onOpenWorkspace}
              title="Team Deck (Click to open Workspace)"
              className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border flex items-center justify-center p-1 transition-all hover:scale-105 shrink-0"
            >
              <img src="/logo.png" alt="Team Deck" className="w-full h-full object-contain" />
            </button>

            {/* Repositioning Grip Handle */}
            <div
              onPointerDown={handlePointerDownGrip}
              title="Drag to reposition edge dock"
              className="p-1 cursor-grab active:cursor-grabbing hover:text-text-primary rounded"
            >
              {isHorizontal ? (
                <GripHorizontal className="w-3.5 h-3.5" />
              ) : (
                <GripVertical className="w-3.5 h-3.5" />
              )}
            </div>

            {/* Expand/Collapse Toggle Button */}
            <button
              onClick={() => {
                dockTargetController.toggleManualExpandedPin();
                dockStateController.toggleExpanded();
                dockTargetController.lockGeometry(isExpanded ? 160 : 180);
              }}
              title={isExpanded ? 'Collapse Dock (160ms)' : 'Expand Dock (180ms)'}
              className="p-1 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              {placement.edge === 'right' ? (
                isExpanded ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />
              ) : placement.edge === 'left' ? (
                isExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
              ) : placement.edge === 'top' ? (
                isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              ) : isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronUp className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Teammates Stack */}
          <div
            className={`flex transition-all duration-[180ms] ${
              isHorizontal && !isExpanded
                ? 'flex-row items-center space-x-2'
                : 'flex-col space-y-1.5 w-full'
            }`}
          >
            {peers.map((peer) => {
              const isSelected = targetState.selectedRecipientId === peer.id;
              const isVaultSelected = vaultState.isOpen && vaultState.selectedTeammate?.id === peer.id;
              const isOnline = peer.status !== 'offline';
              const { progress, isCompleted } = getPeerTransferInfo(peer.id);

              return (
                <div
                  key={peer.id}
                  ref={(el) => {
                    rowRefs.current[peer.id] = el;
                  }}
                  data-peer-id={peer.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draggedFile) {
                      transferEngine.initiateSend({ name: draggedFile.name, size: 12 * 1024 }, peer.id);
                      setDraggedFile(null);
                      dockStateController.setVisualState('minimized');
                      return;
                    }
                    // Open / toggle Transfer Vault for this teammate
                    vaultController.toggleVault(peer);
                  }}
                  onPointerEnter={() => isOnline && dockTargetController.onTargetPointerEnter(peer.id)}
                  onPointerLeave={() => isOnline && dockTargetController.onTargetPointerLeave(peer.id)}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOnline) dockTargetController.onTargetPointerEnter(peer.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOnline) dockTargetController.onTargetPointerEnter(peer.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isOnline) dockTargetController.onTargetPointerLeave(peer.id);
                  }}
                  onDrop={(e) => isOnline && handleDropOnPeer(e, peer.id)}
                  className={`relative rounded-xl transition-all duration-[180ms] ease-out motion-reduce:duration-0 ${
                    isSelected && isExpanded
                      ? 'bg-electric text-white shadow-highlight p-2 w-full ring-1 ring-white/30'
                      : isVaultSelected && isExpanded
                      ? 'bg-surface-elevated border border-electric/60 ring-1 ring-electric/30 text-text-primary p-2 w-full shadow-subtle'
                      : isExpanded
                      ? 'hover:bg-surface-elevated text-text-primary p-2 w-full'
                      : isVaultSelected
                      ? 'ring-2 ring-electric ring-offset-2 ring-offset-surface scale-105 p-1'
                      : 'cursor-pointer hover:scale-105 p-1'
                  } ${!isOnline ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ minHeight: isExpanded ? '44px' : undefined }}
                >
                  {/* 1. Minimized State: Initials with dynamic SVG progress ring & completion checkmark */}
                  {!isExpanded && (
                    <TeammateAvatarInitial
                      name={peer.name}
                      status={peer.status}
                      isLeader={peer.isLeader}
                      transferProgress={progress}
                      isCompleted={isCompleted}
                      size={30}
                    />
                  )}

                  {/* 2. Expanded State: Compact teammate row */}
                  {isExpanded && !isSelected && (
                    <div className="flex items-center space-x-2 w-full">
                      <TeammateAvatarInitial
                        name={peer.name}
                        status={peer.status}
                        isLeader={peer.isLeader}
                        transferProgress={progress}
                        isCompleted={isCompleted}
                        size={24}
                      />
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-primary truncate">
                            {peer.name}
                          </span>
                          {isVaultSelected && (
                            <span className="text-[9px] font-mono text-electric font-bold uppercase tracking-wider">
                              Vault
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono capitalize">
                          {progress !== null ? `Transferring (${progress}%)` : peer.status}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Drag-Over / Active Recipient Preview: Focused Drop Card */}
                  {isExpanded && isSelected && (
                    <div className="space-y-1.5 animate-in fade-in duration-100">
                      <div className="flex items-center space-x-1.5 text-white">
                        <TeammateAvatarInitial
                          name={peer.name}
                          status={peer.status}
                          isLeader={peer.isLeader}
                          size={20}
                          className="border-white"
                        />
                        <span className="text-xs font-bold truncate">{peer.name}</span>
                      </div>

                      <div className="bg-white/10 rounded-lg p-2 flex items-center space-x-2 border border-white/20">
                        <div className="w-6 h-6 rounded bg-white text-electric flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-mono font-bold truncate text-white leading-tight">
                            {draggedFile?.name || 'design.fig'}
                          </div>
                          <div className="text-[10px] text-white/80 font-mono">
                            {draggedFile?.size || '12 KB'}
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-[10px] uppercase font-bold tracking-wider text-white">
                        Release to send
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom / Side Tools */}
          <div
            className={`flex items-center justify-between border-border text-[10px] text-text-muted ${
              isHorizontal && !isExpanded
                ? 'pl-1 border-l space-x-1'
                : 'pt-2 border-t w-full mt-1'
            }`}
          >
            <button
              onClick={onSettingsClick}
              title="Settings"
              className="p-1 rounded hover:bg-surface-elevated hover:text-text-primary"
            >
              <Settings className="w-3 h-3" />
            </button>

            {/* Quick edge cycler */}
            <button
              onClick={() => {
                const edges: DockEdge[] = ['right', 'bottom', 'left', 'top'];
                const nextIndex = (edges.indexOf(placement.edge) + 1) % edges.length;
                dockPlacementManager.setPlacement({ edge: edges[nextIndex] });
              }}
              title="Cycle edge (Right → Bottom → Left → Top)"
              className="px-1.5 py-0.5 rounded hover:bg-surface-elevated font-mono uppercase text-[9px] truncate max-w-[3rem]"
            >
              {placement.edge.charAt(0)}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dynamic Per-Teammate Transfer Vault anchored beside Dock */}
      {vaultState.isOpen && vaultState.selectedTeammate && vaultBounds && (
        <div
          ref={vaultRef}
          style={{
            position: 'fixed',
            left: `${vaultBounds.x}px`,
            top: `${vaultBounds.y}px`,
            width: `${vaultBounds.width}px`,
            height: `${vaultBounds.height}px`,
          }}
          className={`z-50 ${vaultBounds.originClass}`}
        >
          <TransferVault
            teammate={vaultState.selectedTeammate}
            transfers={transfers}
            activeTab={vaultState.activeTab}
            onTabChange={(tab) => vaultController.setActiveTab(tab)}
            searchQuery={vaultState.searchQuery}
            onSearchChange={(q) => vaultController.setSearchQuery(q)}
            onClose={() => vaultController.closeVault()}
            className="w-full h-full"
          />
        </div>
      )}
    </>
  );
};
