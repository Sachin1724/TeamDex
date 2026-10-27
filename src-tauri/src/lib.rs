pub mod commands;
pub mod discovery;
pub mod election;
pub mod identity;
pub mod network;
pub mod storage;
pub mod transfers;
pub mod types;

use commands::*;
use db_commands::*;
use network_commands::*;

mod db_commands {
    use crate::storage::LocalDatabase;
    use crate::types::{ActivityEvent, TransferRecord};
    use std::sync::{Mutex, OnceLock};
    use tauri::command;

    static DB: OnceLock<Mutex<LocalDatabase>> = OnceLock::new();

    fn get_db() -> &'static Mutex<LocalDatabase> {
        DB.get_or_init(|| {
            let db_path = dirs::data_local_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("TeamDex")
                .join("teamdex.db");
            let _ = std::fs::create_dir_all(db_path.parent().unwrap());
            Mutex::new(LocalDatabase::init(&db_path).expect("Failed to open database"))
        })
    }

    #[command]
    pub fn db_save_transfer(record: TransferRecord) -> Result<(), String> {
        get_db().lock().map_err(|e| e.to_string())?
            .insert_transfer(&record).map_err(|e| e.to_string())
    }

    #[command]
    pub fn db_get_transfers(limit: usize) -> Result<Vec<TransferRecord>, String> {
        get_db().lock().map_err(|e| e.to_string())?
            .get_recent_transfers(limit).map_err(|e| e.to_string())
    }

    #[command]
    pub fn db_log_event(event: ActivityEvent) -> Result<(), String> {
        get_db().lock().map_err(|e| e.to_string())?
            .log_event(&event).map_err(|e| e.to_string())
    }

    #[command]
    pub fn db_get_events(limit: usize) -> Result<Vec<ActivityEvent>, String> {
        get_db().lock().map_err(|e| e.to_string())?
            .get_recent_events(limit).map_err(|e| e.to_string())
    }
}

mod network_commands {
    use crate::discovery::{BeaconPayload, DiscoveryService};
    use crate::network::FileServer;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex, OnceLock};
    use tauri::{command, AppHandle, Emitter};

    static DISCOVERY: OnceLock<DiscoveryService> = OnceLock::new();
    static FILE_SERVER: OnceLock<Mutex<Option<FileServer>>> = OnceLock::new();

    fn get_discovery() -> &'static DiscoveryService {
        DISCOVERY.get_or_init(DiscoveryService::new)
    }

    fn get_file_server_slot() -> &'static Mutex<Option<FileServer>> {
        FILE_SERVER.get_or_init(|| Mutex::new(None))
    }

    #[command]
    pub fn start_discovery(
        app_handle: AppHandle,
        device_id: String,
        device_name: String,
        team_code: String,
        listen_port: u16,
        is_leader: bool,
        priority: u32,
    ) -> Result<(), String> {
        let discovery = get_discovery();

        let beacon = BeaconPayload {
            device_id: device_id.clone(),
            device_name,
            team_code: team_code.clone(),
            listen_port,
            is_leader,
            priority,
        };

        discovery.start_beacon(beacon);
        discovery.start_listener(device_id, team_code);

        // Emit discovered peers periodically
        let discovery_ref = get_discovery();
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let peers = discovery_ref.get_peers();
                let peer_data: Vec<serde_json::Value> = peers
                    .iter()
                    .map(|p| {
                        serde_json::json!({
                            "device_id": p.device_id,
                            "device_name": p.device_name,
                            "ip": p.ip.to_string(),
                            "listen_port": p.listen_port,
                            "is_leader": p.is_leader,
                            "priority": p.priority,
                        })
                    })
                    .collect();

                let _ = app_handle.emit("peers-discovered", peer_data);
            }
        });

        Ok(())
    }

    #[command]
    pub fn stop_discovery() -> Result<(), String> {
        get_discovery().stop();
        Ok(())
    }

    #[command]
    pub fn get_discovered_peers() -> Result<Vec<serde_json::Value>, String> {
        let peers = get_discovery().get_peers();
        Ok(peers
            .iter()
            .map(|p| {
                serde_json::json!({
                    "device_id": p.device_id,
                    "device_name": p.device_name,
                    "ip": p.ip.to_string(),
                    "listen_port": p.listen_port,
                    "is_leader": p.is_leader,
                    "priority": p.priority,
                })
            })
            .collect())
    }

    #[command]
    pub fn start_file_server(
        app_handle: AppHandle,
        listen_port: u16,
        download_dir: String,
    ) -> Result<(), String> {
        let server = FileServer::new(listen_port, PathBuf::from(&download_dir));
        let handle = app_handle.clone();

        server.start(Arc::new(move |transfer_id, received, total| {
            let _ = handle.emit(
                "transfer-progress",
                serde_json::json!({
                    "transfer_id": transfer_id,
                    "bytes_received": received,
                    "total_bytes": total,
                }),
            );
        }))?;

        let mut slot = get_file_server_slot().lock().map_err(|e| e.to_string())?;
        *slot = Some(server);

        Ok(())
    }

    #[command]
    pub fn stop_file_server() -> Result<(), String> {
        let mut slot = get_file_server_slot().lock().map_err(|e| e.to_string())?;
        if let Some(server) = slot.take() {
            server.stop();
        }
        Ok(())
    }

    #[command]
    pub fn send_file_to_peer(
        app_handle: AppHandle,
        target_ip: String,
        target_port: u16,
        file_path: String,
        transfer_id: String,
        sender_id: String,
        sender_name: String,
    ) -> Result<(), String> {
        let path = std::path::Path::new(&file_path);
        if !path.exists() {
            return Err(format!("File not found: {}", file_path));
        }

        let handle = app_handle.clone();
        let tid = transfer_id.clone();

        std::thread::spawn(move || {
            let result = crate::network::send_file(
                &target_ip,
                target_port,
                std::path::Path::new(&file_path),
                &transfer_id,
                &sender_id,
                &sender_name,
                |sent, total| {
                    let _ = handle.emit(
                        "transfer-progress",
                        serde_json::json!({
                            "transfer_id": transfer_id,
                            "bytes_sent": sent,
                            "total_bytes": total,
                        }),
                    );
                },
            );

            match result {
                Ok(()) => {
                    let _ = handle.emit("transfer-complete", serde_json::json!({ "transfer_id": tid }));
                }
                Err(e) => {
                    let _ = handle.emit(
                        "transfer-failed",
                        serde_json::json!({ "transfer_id": tid, "error": e }),
                    );
                }
            }
        });

        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Existing commands
            get_device_identity,
            get_active_session,
            open_file_in_folder,
            trigger_manual_election,
            resize_dock_window,
            get_available_monitors,
            save_dock_placement,
            get_dock_placement,
            reposition_dock_window,
            // Database commands
            db_save_transfer,
            db_get_transfers,
            db_log_event,
            db_get_events,
            // Network commands
            start_discovery,
            stop_discovery,
            get_discovered_peers,
            start_file_server,
            stop_file_server,
            send_file_to_peer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Team Deck Tauri application");
}
