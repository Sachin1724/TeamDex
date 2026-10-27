import React, { useState, useEffect } from 'react';
import { Copy, Check, X, CheckCircle2, QrCode } from 'lucide-react';

export type ModalType = 'welcome' | 'create' | 'join' | null;

interface TeamModalsProps {
  modal: ModalType;
  onClose: () => void;
  onCreateTeam: (teamName: string, deviceName: string) => void;
  onJoinTeam: (code: string, deviceName: string) => void;
  openModal: (modal: ModalType) => void;
}

export const TeamModals: React.FC<TeamModalsProps> = ({
  modal,
  onClose,
  onCreateTeam,
  onJoinTeam,
  openModal,
}) => {
  const [teamName, setTeamName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinDeviceName, setJoinDeviceName] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    if (modal === 'create' && teamName.length >= 2 && !generatedCode) {
      setGeneratedCode(teamName.slice(0, 3).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase());
    }
  }, [modal, teamName]);

  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none">
      {/* 1. Welcome / Setup Modal */}
      {modal === 'welcome' && (
        <div className="w-80 bg-surface border border-border rounded-2xl p-6 shadow-dock text-center space-y-4 animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-elevated border border-border flex items-center justify-center p-2.5">
            <img src="/logo.png" alt="Team Deck" className="w-full h-full object-contain" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Team Deck
            </h2>
            <p className="text-xs text-text-muted mt-1 font-sans">
              Your team, one deck.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => openModal('create')}
              className="w-full py-2.5 rounded-xl bg-electric hover:bg-electric-hover text-white font-medium text-xs transition-colors shadow-subtle"
            >
              Create a team
            </button>
            <button
              onClick={() => openModal('join')}
              className="w-full py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-text-primary border border-border font-medium text-xs transition-colors"
            >
              Join a team
            </button>
          </div>

          <div className="text-[11px] text-text-muted font-sans pt-1">
            Local-first &bull; No account required
          </div>
        </div>
      )}

      {/* 2. Create a Team Modal */}
      {modal === 'create' && (
        <div className="w-88 bg-surface border border-border rounded-2xl p-5 shadow-dock space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-text-primary">Create a Team</h2>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-text-muted text-[11px] mb-1 font-medium">Team name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-electric"
              />
            </div>

            <div>
              <label className="block text-text-muted text-[11px] mb-1 font-medium">Your device name</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-electric"
              />
            </div>

            <div className="bg-surface-elevated border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-muted block">Invite Code</span>
                <div className="flex items-center space-x-2 mt-0.5 font-mono font-bold text-sm text-text-primary">
                  <span>{generatedCode || '------'}</span>
                  <button
                    onClick={() => {
                      if (generatedCode) navigator.clipboard.writeText(generatedCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 hover:bg-surface rounded text-text-muted hover:text-text-primary"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-presence-online" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center text-background">
                <QrCode className="w-full h-full text-background" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                onCreateTeam(teamName, deviceName);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-electric hover:bg-electric-hover text-white font-medium text-xs transition-colors shadow-subtle"
            >
              Create Team
            </button>
          </div>
        </div>
      )}

      {/* 3. Join a Team Modal */}
      {modal === 'join' && (
        <div className="w-88 bg-surface border border-border rounded-2xl p-5 shadow-dock space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-text-primary">Join a Team</h2>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-text-muted text-[11px] mb-1 font-medium">Invitation code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. 4K7P9Q"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-xs font-mono uppercase focus:outline-none focus:border-electric"
              />
            </div>

            <div>
              <label className="block text-text-muted text-[11px] mb-1 font-medium">Your device name</label>
              <input
                type="text"
                value={joinDeviceName}
                onChange={(e) => setJoinDeviceName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-electric"
              />
            </div>

            {/* Live Connection Checklist Matching Mockup */}
            <div className="bg-surface-elevated/70 border border-border rounded-xl p-3 space-y-2 text-[11px] font-mono">
              <div className="flex items-center space-x-2 text-text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 text-presence-online shrink-0" />
                <span>Searching for team...</span>
              </div>
              <div className="flex items-center space-x-2 text-text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 text-presence-online shrink-0" />
                <span>Team found: Hackathon Squad</span>
              </div>
              <div className="flex items-center space-x-2 text-text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 text-presence-online shrink-0" />
                <span>Connecting to host...</span>
              </div>
              <div className="flex items-center space-x-2 text-presence-online font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-presence-online shrink-0" />
                <span>Connected!</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                onJoinTeam(joinCode, joinDeviceName);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-electric hover:bg-electric-hover text-white font-medium text-xs transition-colors shadow-subtle"
            >
              Join Team
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
