import React, { useState, useEffect } from 'react';
import { Peer } from '../types';
import { teamManager } from '../services/teamManager';
import { EdgeDock } from '../components/EdgeDock';

export const DockView: React.FC = () => {
  const [peers, setPeers] = useState<Peer[]>(teamManager.getPeers());

  useEffect(() => {
    const unsubscribe = teamManager.subscribe(() => {
      setPeers(teamManager.getPeers());
    });
    return unsubscribe;
  }, []);

  return (
    <div className="w-full h-full bg-transparent overflow-hidden flex items-center justify-center p-1 select-none">
      <EdgeDock
        peers={peers}
        isStandalone={true}
        onSettingsClick={() => alert("Dock settings: auto-hide, transparent mode, right-edge docked.")}
        onOpenWorkspace={() => {
          // If in Tauri or browser, focus or open main window
          window.location.search = '';
        }}
      />
    </div>
  );
};
