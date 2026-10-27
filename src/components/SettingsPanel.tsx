import React, { useState } from 'react';
import { DeviceSettings } from '../types';
import { teamManager } from '../services/teamManager';
import { Settings, Save, Check } from 'lucide-react';

interface SettingsPanelProps {
  settings: DeviceSettings;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [listenPort, setListenPort] = useState(settings.listenPort);
  const [downloadDir, setDownloadDir] = useState(settings.downloadDirectory);
  const [mdns, setMdns] = useState(settings.mdnsEnabled);
  const [udpMulticast, setUdpMulticast] = useState(settings.udpMulticastEnabled);
  const [autoAccept, setAutoAccept] = useState(settings.autoAcceptFromTeam);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    teamManager.updateSettings({
      deviceName,
      listenPort,
      downloadDirectory: downloadDir,
      mdnsEnabled: mdns,
      udpMulticastEnabled: udpMulticast,
      autoAcceptFromTeam: autoAccept,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-md overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-background border-b border-border flex items-center justify-between text-xs cursor-pointer select-none hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Settings className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-semibold text-text-primary uppercase tracking-wider text-[11px] font-mono">
            Node Settings & Network
          </span>
        </div>
        <span className="text-text-muted text-[11px] font-mono">
          {isOpen ? 'Collapse' : 'Configure'}
        </span>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Device Name */}
            <div>
              <label className="block text-text-secondary text-[11px] font-medium mb-1">
                Device Name (Visible on LAN)
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-text-primary font-mono text-xs focus:outline-none focus:border-electric transition-colors"
              />
            </div>

            {/* Listen Port */}
            <div>
              <label className="block text-text-secondary text-[11px] font-medium mb-1">
                Direct TCP Listen Port
              </label>
              <input
                type="number"
                value={listenPort}
                onChange={(e) => setListenPort(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-text-primary font-mono text-xs focus:outline-none focus:border-electric transition-colors"
              />
            </div>
          </div>

          {/* Download Directory */}
          <div>
            <label className="block text-text-secondary text-[11px] font-medium mb-1">
              File Storage Directory (Windows)
            </label>
            <input
              type="text"
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-text-primary font-mono text-xs focus:outline-none focus:border-electric transition-colors"
            />
          </div>

          {/* Protocol Toggles */}
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mdns}
                onChange={(e) => setMdns(e.target.checked)}
                className="rounded border-border text-electric focus:ring-0 bg-background"
              />
              <span className="text-[11px] text-text-secondary">mDNS Discovery</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={udpMulticast}
                onChange={(e) => setUdpMulticast(e.target.checked)}
                className="rounded border-border text-electric focus:ring-0 bg-background"
              />
              <span className="text-[11px] text-text-secondary">UDP Multicast Fallback</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={(e) => setAutoAccept(e.target.checked)}
                className="rounded border-border text-electric focus:ring-0 bg-background"
              />
              <span className="text-[11px] text-text-secondary">Auto-Accept Team Files</span>
            </label>
          </div>

          {/* Save Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSave}
              className="px-3 py-1 rounded bg-electric hover:bg-electric-hover text-white font-medium flex items-center space-x-1.5 transition-colors text-[11px]"
            >
              {isSaved ? <Check className="w-3 h-3 text-white" /> : <Save className="w-3 h-3" />}
              <span>{isSaved ? 'Settings Applied' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
