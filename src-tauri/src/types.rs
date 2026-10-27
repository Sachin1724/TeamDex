use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PeerStatus {
    Online,
    Transferring,
    Idle,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub status: PeerStatus,
    pub is_leader: bool,
    pub priority: u32,
    pub latency_ms: u32,
    pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    PendingAcceptance,
    Transferring,
    VerifyingChecksum,
    VerifiedComplete,
    Declined,
    Failed,
    Interrupted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferRecord {
    pub id: String,
    pub filename: String,
    pub file_size: u64,
    pub bytes_transferred: u64,
    pub sender_id: String,
    pub sender_name: String,
    pub recipient_id: String,
    pub recipient_name: String,
    pub checksum_sha256: String,
    pub status: TransferStatus,
    pub local_path: Option<String>,
    pub transfer_speed_bps: u64,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub is_incoming: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: String,
    pub event_type: String,
    pub description: String,
    pub timestamp: i64,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub team_name: String,
    pub room_code: String,
    pub session_id: String,
    pub epoch: u64,
    pub leader_id: String,
    pub is_current_device_leader: bool,
    pub active_peer_count: usize,
    pub network_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSettings {
    pub device_name: String,
    pub listen_port: u16,
    pub download_directory: String,
    pub mdns_enabled: bool,
    pub udp_multicast_enabled: bool,
    pub auto_accept_from_team: bool,
}

// Adaptive Dock Placement & Multi-Monitor Support
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DockEdge {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DockAlignment {
    Start,
    Center,
    End,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockPlacement {
    pub edge: DockEdge,
    pub alignment: DockAlignment,
    pub monitor_name: Option<String>,
    pub offset_x: i32,
    pub offset_y: i32,
    pub corner_snapped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub work_area_x: i32,
    pub work_area_y: i32,
    pub work_area_width: u32,
    pub work_area_height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}
