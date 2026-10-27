import { DockPlacement, DockEdge, DockAlignment, MonitorInfo } from '../types';

export const STORAGE_KEY_PLACEMENT = 'teamdeck_dock_placement_v1';

export class DockPlacementManager {
  private currentPlacement: DockPlacement = {
    edge: 'right',
    alignment: 'center',
    monitorName: 'Primary Display',
    offsetX: 0,
    offsetY: 0,
    cornerSnapped: false,
  };

  private monitors: MonitorInfo[] = [
    {
      name: 'Primary Display',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      workAreaX: 0,
      workAreaY: 0,
      workAreaWidth: 1920,
      workAreaHeight: 1032, // 48px taskbar
      scaleFactor: 1.0,
      isPrimary: true,
    },
  ];

  private listeners: ((placement: DockPlacement) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  public subscribe(fn: (placement: DockPlacement) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.currentPlacement });
    }
  }

  public getPlacement(): DockPlacement {
    return { ...this.currentPlacement };
  }

  public getMonitors(): MonitorInfo[] {
    return [...this.monitors];
  }

  public setMonitors(monitors: MonitorInfo[]): void {
    this.monitors = monitors;
    this.validateMonitorOrFallback();
  }

  public setPlacement(partial: Partial<DockPlacement>): void {
    this.currentPlacement = { ...this.currentPlacement, ...partial };
    this.saveToStorage();
    this.notify();
  }

  public snapToNearestPosition(
    pointerX: number,
    pointerY: number,
    containerWidth: number = 1920,
    containerHeight: number = 1080
  ): DockPlacement {
    const cornerThreshold = 100;

    // Distances to four edges
    const distLeft = pointerX;
    const distRight = containerWidth - pointerX;
    const distTop = pointerY;
    const distBottom = containerHeight - pointerY;

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    let edge: DockEdge = 'right';
    if (minDist === distLeft) edge = 'left';
    else if (minDist === distRight) edge = 'right';
    else if (minDist === distTop) edge = 'top';
    else edge = 'bottom';

    // Alignment calculation
    let alignment: DockAlignment = 'center';
    let cornerSnapped = false;

    if (edge === 'left' || edge === 'right') {
      if (pointerY < cornerThreshold) {
        alignment = 'start';
        cornerSnapped = true;
      } else if (pointerY > containerHeight - cornerThreshold) {
        alignment = 'end';
        cornerSnapped = true;
      } else {
        alignment = 'center';
      }
    } else {
      // top or bottom
      if (pointerX < cornerThreshold) {
        alignment = 'start';
        cornerSnapped = true;
      } else if (pointerX > containerWidth - cornerThreshold) {
        alignment = 'end';
        cornerSnapped = true;
      } else {
        alignment = 'center';
      }
    }

    const newPlacement: DockPlacement = {
      edge,
      alignment,
      monitorName: this.currentPlacement.monitorName || 'Primary Display',
      offsetX: 0,
      offsetY: 0,
      cornerSnapped,
    };

    this.currentPlacement = newPlacement;
    this.saveToStorage();
    this.notify();
    return newPlacement;
  }

  private validateMonitorOrFallback(): void {
    const savedName = this.currentPlacement.monitorName;
    const exists = this.monitors.some((m) => m.name === savedName);

    if (!exists) {
      // Fallback gracefully to primary monitor
      const primary = this.monitors.find((m) => m.isPrimary) || this.monitors[0];
      this.currentPlacement.monitorName = primary ? primary.name : 'Primary Display';
      this.currentPlacement.edge = 'right';
      this.currentPlacement.alignment = 'center';
      this.saveToStorage();
      this.notify();
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_PLACEMENT);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.edge && parsed.alignment) {
            this.currentPlacement = { ...this.currentPlacement, ...parsed };
          }
        }
      }
    } catch {
      // Fallback to default
    }
    this.validateMonitorOrFallback();
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PLACEMENT, JSON.stringify(this.currentPlacement));
      }
    } catch {
      // Ignore in non-storage envs
    }
  }
}

export const dockPlacementManager = new DockPlacementManager();
