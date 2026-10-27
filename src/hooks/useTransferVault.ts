import { useState, useEffect, useCallback } from 'react';
import { Peer } from '../types';
import { vaultController, VaultState, VaultTab } from '../services/vaultController';

export function useTransferVault() {
  const [vaultState, setVaultState] = useState<VaultState>(vaultController.getState());

  useEffect(() => {
    const unsubscribe = vaultController.subscribe(setVaultState);
    return unsubscribe;
  }, []);

  const openVault = useCallback((teammate: Peer) => {
    vaultController.openVault(teammate);
  }, []);

  const closeVault = useCallback(() => {
    vaultController.closeVault();
  }, []);

  const switchTeammate = useCallback((teammate: Peer) => {
    vaultController.switchTeammate(teammate);
  }, []);

  const toggleVault = useCallback((teammate: Peer) => {
    vaultController.toggleVault(teammate);
  }, []);

  const setActiveTab = useCallback((tab: VaultTab) => {
    vaultController.setActiveTab(tab);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    vaultController.setSearchQuery(query);
  }, []);

  return {
    isOpen: vaultState.isOpen,
    selectedTeammate: vaultState.selectedTeammate,
    activeTab: vaultState.activeTab,
    searchQuery: vaultState.searchQuery,
    openVault,
    closeVault,
    switchTeammate,
    toggleVault,
    setActiveTab,
    setSearchQuery,
  };
}
