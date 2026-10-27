import React, { useState, useEffect } from 'react';
import { Peer, TransferRecord, ActivityEvent, SessionState, DeviceSettings } from './types';
import { teamManager } from './services/teamManager';
import { transferEngine } from './services/transferEngine';
import { dockPlacementManager } from './services/dockPlacement';
import { Sidebar, NavTab } from './components/Sidebar';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { TeammatesBar } from './components/TeammatesBar';
import { DropZone } from './components/DropZone';
import { TransferHistoryTable } from './components/TransferHistoryTable';
import { EdgeDock } from './components/EdgeDock';
import { IncomingTransferNotification } from './components/IncomingTransferNotification';
import { ActivityJournal } from './components/ActivityJournal';
import { SettingsPanel } from './components/SettingsPanel';
import { NetworkDiagnosticsBanner } from './components/NetworkDiagnosticsBanner';
import { TeamModals, ModalType } from './components/TeamModals';
import { DockView } from './views/DockView';
import { ExternalLink, Sparkles } from 'lucide-react';
import { initTauriBridge } from './services/tauriBridge';

export const App: React.FC = () => {
  // Check if current window instance is the Tauri dock window
  const isDockWindow = window.location.search.includes('window=dock');

  const [peers, setPeers] = useState<Peer[]>(teamManager.getPeers());
  const [session, setSession] = useState<SessionState>(teamManager.getSession());
  const [transfers, setTransfers] = useState<TransferRecord[]>(transferEngine.getTransfers());
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>(teamManager.getActivityLog());
  const [settings, setSettings] = useState<DeviceSettings>(teamManager.getSettings());

  const [activeTab, setActiveTab] = useState<NavTab>('team');
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [showEdgeDock, setShowEdgeDock] = useState(true);

  // Initialize transport bridges (LAN via Tauri, WebRTC via browser)
  useEffect(() => {
    initTauriBridge().catch((e) => console.warn('Bridge init:', e));
  }, []);

  // Subscribe to reactive state updates
  useEffect(() => {
    const unsubTeam = teamManager.subscribe(() => {
      setPeers(teamManager.getPeers());
      setSession(teamManager.getSession());
      setActivityLog(teamManager.getActivityLog());
      setSettings(teamManager.getSettings());
    });
    const unsubTransfer = transferEngine.subscribe(() => {
      setTransfers(transferEngine.getTransfers());
    });
    return () => {
      unsubTeam();
      unsubTransfer();
    };
  }, []);

  // If running in standalone dock window, render DockView directly
  if (isDockWindow) {
    return <DockView />;
  }

  const onlineCount = peers.filter((p) => p.status !== 'offline').length;

  const handleDropToShare = (file: { name: string; size: number; path?: string }) => {
    const targetPeerId = selectedPeerId || (peers.find((p) => p.status === 'online' && !p.isLeader)?.id || 'peer-riya');
    transferEngine.initiateSend(file, targetPeerId);
  };

  return (
    <div className="w-screen h-screen bg-[#0D0F12] text-text-primary flex items-center justify-center p-3 select-none overflow-hidden font-sans">
      {/* 
        Main Application Window:
        Normal, centered, resizable desktop application window (900 × 600 px nominal).
        Not forced fullscreen; styled with native Windows desktop frame.
      */}
      <div className="w-full max-w-[960px] h-full max-h-[640px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Quick Dev Toolbar for Testing & Demonstrating All Mockup Features */}
        <div className="h-6 bg-surface-elevated/90 border-b border-border px-3 flex items-center justify-between text-[10px] font-mono text-text-muted shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-presence-online" />
            <span>Windows Desktop Runtime &bull; 900&times;600 Resizable</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => transferEngine.triggerSimulatedIncoming('peer-sachin', 'design.fig', 12 * 1024)}
              className="text-electric hover:underline"
            >
              + Incoming (design.fig)
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => transferEngine.triggerFailedTransfer('data.zip', 24 * 1024 * 1024)}
              className="text-status-error hover:underline"
            >
              + Failed (data.zip)
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setActiveModal('welcome')}
              className="hover:text-text-primary hover:underline flex items-center space-x-0.5"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Onboarding</span>
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => {
                const current = dockPlacementManager.getPlacement().edge;
                const edges = ['right', 'bottom', 'left', 'top'] as const;
                const next = edges[(edges.indexOf(current) + 1) % edges.length];
                dockPlacementManager.setPlacement({ edge: next });
              }}
              className="text-amber-400 hover:underline"
              title="Cycle dock placement to right, bottom, left, or top"
            >
              Cycle Edge
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setShowEdgeDock(!showEdgeDock)}
              className="hover:text-text-primary hover:underline"
            >
              {showEdgeDock ? 'Hide Dock' : 'Show Dock'}
            </button>
            <span className="text-border">|</span>
            <a
              href="?window=dock"
              target="_blank"
              rel="noreferrer"
              className="hover:text-text-primary hover:underline flex items-center space-x-0.5"
            >
              <span>Dock Window</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* Main Body: Left Sidebar + Right Workspace Frame */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar Matching Mockup */}
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onlineCount={onlineCount}
            totalMembers={peers.length}
            onStatusClick={() => teamManager.toggleFirewallStatus()}
          />

          {/* Right Main Content Panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Top Header Matching Mockup */}
            <WorkspaceHeader
              teamName={session.teamName}
              roomCode={session.roomCode}
              networkMode={session.networkMode}
              onRoomClick={() => setActiveModal('welcome')}
              onOptionsClick={() => teamManager.electLeaderSuccessor()}
            />

            {/* Scrollable Main Workspace Body */}
            <main className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Network Warning Banner (if AP Isolation triggered) */}
              <NetworkDiagnosticsBanner session={session} />

              {/* View 1: Team & Main File Collaboration (Default) */}
              {activeTab === 'team' && (
                <div className="space-y-4">
                  {/* Horizontal Teammates Bar Matching Mockup Chips */}
                  <TeammatesBar
                    peers={peers}
                    selectedPeerId={selectedPeerId}
                    onSelectPeer={(id) => setSelectedPeerId(id === selectedPeerId ? null : id)}
                  />

                  {/* Centered Dashed Drop Zone Matching Mockup */}
                  <DropZone onFileDrop={handleDropToShare} />

                  {/* Filtered Recent Transfers Table Matching Mockup */}
                  <TransferHistoryTable
                    transfers={transfers}
                    onOpenFolder={(path) => alert(`Opening in Windows Explorer: ${path}`)}
                  />
                </div>
              )}

              {/* View 2: Inbox View */}
              {activeTab === 'inbox' && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Incoming Requests & Messages</h2>
                  <div className="bg-surface border border-border rounded-xl p-4 text-xs text-text-secondary space-y-2">
                    <p className="text-text-primary font-medium">3 Pending Requests from Team Members</p>
                    <p>Direct peer requests are automatically routed and saved to your local storage.</p>
                  </div>
                </div>
              )}

              {/* View 3: Activity Log View */}
              {activeTab === 'activity' && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Session Activity & Consensus</h2>
                  <ActivityJournal events={activityLog} />
                </div>
              )}

              {/* View 4: Files View */}
              {activeTab === 'files' && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Received Files Directory</h2>
                  <div className="bg-surface border border-border rounded-xl p-4 text-xs font-mono text-text-muted">
                    Path: {settings.downloadDirectory}
                  </div>
                </div>
              )}

              {/* View 5: Settings View */}
              {activeTab === 'settings' && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Device & Network Settings</h2>
                  <SettingsPanel settings={settings} />
                </div>
              )}
            </main>
          </div>
        </div>

        {/* Slide-out Incoming Transfer Notification Matching Mockup Cards */}
        <IncomingTransferNotification transfers={transfers} />

        {/* Onboarding Modals (Welcome, Create Team, Join Team) */}
        <TeamModals
          modal={activeModal}
          onClose={() => setActiveModal(null)}
          onCreateTeam={(name, dev) => {
            teamManager.updateSettings({ deviceName: dev });
            teamManager.setSessionField('teamName', name);
            const code = name.slice(0, 3).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
            teamManager.setSessionField('roomCode', code);
            teamManager.setSessionField('isCurrentDeviceLeader', true);
            teamManager.logEvent('epoch_change', `Team "${name}" created with code ${code}`);
          }}
          onJoinTeam={(code, dev) => {
            teamManager.updateSettings({ deviceName: dev });
            teamManager.setSessionField('roomCode', code);
            teamManager.setSessionField('isCurrentDeviceLeader', false);
            teamManager.logEvent('peer_joined', `Joined team with code ${code}`);
          }}
          openModal={setActiveModal}
        />
      </div>

      {/* Edge Dock rendered outside overflow-hidden container for proper fixed positioning */}
      {showEdgeDock && (
        <EdgeDock
          peers={peers}
          onSettingsClick={() => setActiveTab('settings')}
          onOpenWorkspace={() => setActiveTab('team')}
        />
      )}
    </div>
  );
};
