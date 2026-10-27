import { DockEdge } from '../types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VaultPlacementOptions {
  dockRect: Rect;
  selectedRowRect?: Rect | null;
  dockEdge: DockEdge;
  monitorWorkArea: MonitorWorkArea;
  vaultSize?: { width: number; height: number };
  margin?: number;
}

export interface VaultPlacementResult {
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  originClass: string;
}

const DEFAULT_VAULT_WIDTH = 340;
const DEFAULT_VAULT_HEIGHT = 460;
const DEFAULT_MARGIN = 12;

/**
 * Computes the optimal placement bounds for the Transfer Vault panel
 * relative to the edge dock and monitor work area.
 */
export function computeVaultPlacement(options: VaultPlacementOptions): VaultPlacementResult {
  const {
    dockRect,
    selectedRowRect,
    dockEdge,
    monitorWorkArea,
    vaultSize = { width: DEFAULT_VAULT_WIDTH, height: DEFAULT_VAULT_HEIGHT },
    margin = DEFAULT_MARGIN,
  } = options;

  let width = Math.min(vaultSize.width, monitorWorkArea.width - margin * 2);
  let height = Math.min(vaultSize.height, monitorWorkArea.height - margin * 2);

  let side: 'left' | 'right' | 'top' | 'bottom' = 'left';
  let targetX = 0;
  let targetY = 0;
  let originClass = 'origin-top-right';

  // Space available on four sides of dock relative to monitor work area
  const spaceLeft = dockRect.x - monitorWorkArea.x;
  const spaceRight = monitorWorkArea.x + monitorWorkArea.width - (dockRect.x + dockRect.width);
  const spaceTop = dockRect.y - monitorWorkArea.y;
  const spaceBottom = monitorWorkArea.y + monitorWorkArea.height - (dockRect.y + dockRect.height);

  if (dockEdge === 'right') {
    // Prefer opening to the left of dock
    if (spaceLeft >= width + margin) {
      side = 'left';
      targetX = dockRect.x - width - margin;
      originClass = 'origin-right';
    } else if (spaceRight >= width + margin) {
      side = 'right';
      targetX = dockRect.x + dockRect.width + margin;
      originClass = 'origin-left';
    } else {
      // Not enough space on either side: clamp inside work area
      side = 'left';
      targetX = Math.max(monitorWorkArea.x + margin, dockRect.x - width - margin);
      originClass = 'origin-right';
    }

    // Align vertically with selected row if available, otherwise center on dock
    if (selectedRowRect) {
      targetY = selectedRowRect.y + selectedRowRect.height / 2 - height / 2;
    } else {
      targetY = dockRect.y + dockRect.height / 2 - height / 2;
    }
  } else if (dockEdge === 'left') {
    // Prefer opening to the right of dock
    if (spaceRight >= width + margin) {
      side = 'right';
      targetX = dockRect.x + dockRect.width + margin;
      originClass = 'origin-left';
    } else if (spaceLeft >= width + margin) {
      side = 'left';
      targetX = dockRect.x - width - margin;
      originClass = 'origin-right';
    } else {
      side = 'right';
      targetX = Math.min(
        monitorWorkArea.x + monitorWorkArea.width - width - margin,
        dockRect.x + dockRect.width + margin
      );
      originClass = 'origin-left';
    }

    if (selectedRowRect) {
      targetY = selectedRowRect.y + selectedRowRect.height / 2 - height / 2;
    } else {
      targetY = dockRect.y + dockRect.height / 2 - height / 2;
    }
  } else if (dockEdge === 'top') {
    // Prefer opening below dock
    if (spaceBottom >= height + margin) {
      side = 'bottom';
      targetY = dockRect.y + dockRect.height + margin;
      originClass = 'origin-top';
    } else if (spaceTop >= height + margin) {
      side = 'top';
      targetY = dockRect.y - height - margin;
      originClass = 'origin-bottom';
    } else {
      side = 'bottom';
      targetY = Math.min(
        monitorWorkArea.y + monitorWorkArea.height - height - margin,
        dockRect.y + dockRect.height + margin
      );
      originClass = 'origin-top';
    }

    if (selectedRowRect) {
      targetX = selectedRowRect.x + selectedRowRect.width / 2 - width / 2;
    } else {
      targetX = dockRect.x + dockRect.width / 2 - width / 2;
    }
  } else {
    // dockEdge === 'bottom'
    // Prefer opening above dock
    if (spaceTop >= height + margin) {
      side = 'top';
      targetY = dockRect.y - height - margin;
      originClass = 'origin-bottom';
    } else if (spaceBottom >= height + margin) {
      side = 'bottom';
      targetY = dockRect.y + dockRect.height + margin;
      originClass = 'origin-top';
    } else {
      side = 'top';
      targetY = Math.max(monitorWorkArea.y + margin, dockRect.y - height - margin);
      originClass = 'origin-bottom';
    }

    if (selectedRowRect) {
      targetX = selectedRowRect.x + selectedRowRect.width / 2 - width / 2;
    } else {
      targetX = dockRect.x + dockRect.width / 2 - width / 2;
    }
  }

  // Final Boundary Clamping to ensure panel stays strictly inside monitor work area
  const minX = monitorWorkArea.x + margin;
  const maxX = monitorWorkArea.x + monitorWorkArea.width - width - margin;
  const clampedX = Math.max(minX, Math.min(targetX, maxX));

  const minY = monitorWorkArea.y + margin;
  const maxY = monitorWorkArea.y + monitorWorkArea.height - height - margin;
  const clampedY = Math.max(minY, Math.min(targetY, maxY));

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    width: Math.round(width),
    height: Math.round(height),
    side,
    originClass,
  };
}
