use tauri::command;
use crate::types::{DockAlignment, DockEdge, DockPlacement, MonitorInfo, SessionState};
use std::sync::Mutex;

static SAVED_PLACEMENT: Mutex<Option<DockPlacement>> = Mutex::new(None);

#[command]
pub fn get_device_identity() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "device_id": "dev_win_8b1a2f9c",
        "device_name": "Sachin's Laptop",
        "public_key": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "listen_port": 53318,
        "is_online": true
    }))
}

#[command]
pub fn get_active_session() -> Result<SessionState, String> {
    Ok(SessionState {
        team_name: "Hackathon Squad".to_string(),
        room_code: "4K7P9Q".to_string(),
        session_id: "sess_4917a-8f2b".to_string(),
        epoch: 1,
        leader_id: "peer-sachin".to_string(),
        is_current_device_leader: true,
        active_peer_count: 5,
        network_mode: "lan_direct_tcp".to_string(),
    })
}

#[command]
pub fn open_file_in_folder(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg("/select,")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        Ok(())
    }
}

#[command]
pub fn trigger_manual_election(peers_json: String) -> Result<serde_json::Value, String> {
    let peers: Vec<crate::types::Peer> = serde_json::from_str(&peers_json).map_err(|e| e.to_string())?;
    let mut engine = crate::election::ElectionEngine::new(String::new());
    match engine.elect_successor(&peers) {
        Some((leader_id, epoch)) => Ok(serde_json::json!({
            "leader_id": leader_id,
            "epoch": epoch,
        })),
        None => Err("Cannot reach quorum for election".to_string()),
    }
}

#[command]
pub fn get_available_monitors(app_handle: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let mut monitors = Vec::new();

    if let Ok(available) = app_handle.available_monitors() {
        for (idx, mon) in available.into_iter().enumerate() {
            let name = mon.name().map(|s| s.to_string()).unwrap_or_else(|| format!("Display-{}", idx + 1));
            let pos = mon.position();
            let size = mon.size();
            let scale = mon.scale_factor();

            // Default work area accounts for Windows taskbar (48px at bottom for primary)
            let is_primary = idx == 0;
            let tb_inset = if is_primary { 48 } else { 0 };

            monitors.push(MonitorInfo {
                name,
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                work_area_x: pos.x,
                work_area_y: pos.y,
                work_area_width: size.width,
                work_area_height: size.height.saturating_sub(tb_inset),
                scale_factor: scale,
                is_primary,
            });
        }
    }

    if monitors.is_empty() {
        // Fallback standard 1080p display
        monitors.push(MonitorInfo {
            name: "Primary Display".to_string(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            work_area_x: 0,
            work_area_y: 0,
            work_area_width: 1920,
            work_area_height: 1032,
            scale_factor: 1.0,
            is_primary: true,
        });
    }

    Ok(monitors)
}

#[command]
pub fn save_dock_placement(placement: DockPlacement) -> Result<(), String> {
    let mut lock = SAVED_PLACEMENT.lock().map_err(|e| e.to_string())?;
    *lock = Some(placement);
    Ok(())
}

#[command]
pub fn get_dock_placement(app_handle: tauri::AppHandle) -> Result<DockPlacement, String> {
    let monitors = get_available_monitors(app_handle)?;
    let lock = SAVED_PLACEMENT.lock().map_err(|e| e.to_string())?;

    if let Some(ref saved) = *lock {
        // Verify saved monitor still exists
        let monitor_still_exists = saved.monitor_name.as_ref().map_or(false, |saved_name| {
            monitors.iter().any(|m| &m.name == saved_name)
        });

        if monitor_still_exists {
            return Ok(saved.clone());
        }
    }

    // Graceful recovery: default to primary monitor, right edge, center alignment
    let primary_name = monitors.iter().find(|m| m.is_primary).map(|m| m.name.clone());
    Ok(DockPlacement {
        edge: DockEdge::Right,
        alignment: DockAlignment::Center,
        monitor_name: primary_name,
        offset_x: 0,
        offset_y: 0,
        corner_snapped: false,
    })
}

#[command]
pub fn reposition_dock_window(
    app_handle: tauri::AppHandle,
    placement: DockPlacement,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app_handle.get_webview_window("dock") {
        let monitors = get_available_monitors(app_handle.clone())?;
        let target_monitor = placement
            .monitor_name
            .as_ref()
            .and_then(|name| monitors.iter().find(|m| &m.name == name))
            .or_else(|| monitors.iter().find(|m| m.is_primary))
            .or_else(|| monitors.first())
            .ok_or_else(|| "No active monitor found".to_string())?;

        let win_size = window.outer_size().map_err(|e| e.to_string())?;
        let win_w = win_size.width as i32;
        let win_h = win_size.height as i32;

        let margin = 16;
        let (base_x, base_y) = match placement.edge {
            DockEdge::Left => {
                let x = target_monitor.work_area_x + margin;
                let y = match placement.alignment {
                    DockAlignment::Start => target_monitor.work_area_y + margin,
                    DockAlignment::Center => {
                        target_monitor.work_area_y + (target_monitor.work_area_height as i32 - win_h) / 2
                    }
                    DockAlignment::End => {
                        target_monitor.work_area_y + target_monitor.work_area_height as i32 - win_h - margin
                    }
                };
                (x, y)
            }
            DockEdge::Right => {
                let x = target_monitor.work_area_x + target_monitor.work_area_width as i32 - win_w - margin;
                let y = match placement.alignment {
                    DockAlignment::Start => target_monitor.work_area_y + margin,
                    DockAlignment::Center => {
                        target_monitor.work_area_y + (target_monitor.work_area_height as i32 - win_h) / 2
                    }
                    DockAlignment::End => {
                        target_monitor.work_area_y + target_monitor.work_area_height as i32 - win_h - margin
                    }
                };
                (x, y)
            }
            DockEdge::Top => {
                let y = target_monitor.work_area_y + margin;
                let x = match placement.alignment {
                    DockAlignment::Start => target_monitor.work_area_x + margin,
                    DockAlignment::Center => {
                        target_monitor.work_area_x + (target_monitor.work_area_width as i32 - win_w) / 2
                    }
                    DockAlignment::End => {
                        target_monitor.work_area_x + target_monitor.work_area_width as i32 - win_w - margin
                    }
                };
                (x, y)
            }
            DockEdge::Bottom => {
                let y = target_monitor.work_area_y + target_monitor.work_area_height as i32 - win_h - margin;
                let x = match placement.alignment {
                    DockAlignment::Start => target_monitor.work_area_x + margin,
                    DockAlignment::Center => {
                        target_monitor.work_area_x + (target_monitor.work_area_width as i32 - win_w) / 2
                    }
                    DockAlignment::End => {
                        target_monitor.work_area_x + target_monitor.work_area_width as i32 - win_w - margin
                    }
                };
                (x, y)
            }
        };

        let target_x = base_x + placement.offset_x;
        let target_y = base_y + placement.offset_y;

        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: target_x,
            y: target_y,
        }));
    }
    Ok(())
}

#[command]
pub fn resize_dock_window(
    app_handle: tauri::AppHandle,
    width: f64,
    height: f64,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app_handle.get_webview_window("dock") {
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width,
            height,
        }));
    }
    Ok(())
}
