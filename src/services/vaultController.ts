import { Peer } from '../types';

export type VaultTab = 'all' | 'sent' | 'received' | 'in_progress' | 'failed';

export interface VaultState {
  isOpen: boolean;
  selectedTeammate: Peer | null;
  activeTab: VaultTab;
  searchQuery: string;
}

export class VaultController {
  private state: VaultState = {
    isOpen: false,
    selectedTeammate: null,
    activeTab: 'all',
    searchQuery: '',
  };

  private listeners: ((state: VaultState) => void)[] = [];

  public subscribe(fn: (state: VaultState) => void): () => void {
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

  public getState(): VaultState {
    return { ...this.state };
  }

  public openVault(teammate: Peer): void {
    this.state = {
      ...this.state,
      isOpen: true,
      selectedTeammate: teammate,
      searchQuery: '',
    };
    this.notify();
  }

  public switchTeammate(teammate: Peer): void {
    if (!this.state.isOpen) {
      this.openVault(teammate);
      return;
    }
    // Switch teammate with smooth content transition
    this.state = {
      ...this.state,
      selectedTeammate: teammate,
      searchQuery: '',
    };
    this.notify();
  }

  public toggleVault(teammate: Peer): void {
    if (this.state.isOpen && this.state.selectedTeammate?.id === teammate.id) {
      this.closeVault();
    } else {
      this.openVault(teammate);
    }
  }

  public closeVault(): void {
    if (!this.state.isOpen) return;
    this.state = {
      ...this.state,
      isOpen: false,
      selectedTeammate: null,
      searchQuery: '',
    };
    this.notify();
  }

  public setActiveTab(tab: VaultTab): void {
    this.state = {
      ...this.state,
      activeTab: tab,
    };
    this.notify();
  }

  public setSearchQuery(query: string): void {
    this.state = {
      ...this.state,
      searchQuery: query,
    };
    this.notify();
  }
}

export const vaultController = new VaultController();
