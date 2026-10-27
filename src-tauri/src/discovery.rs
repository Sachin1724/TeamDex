use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const MULTICAST_ADDR: Ipv4Addr = Ipv4Addr::new(239, 255, 84, 68); // "TD" = 84, 68
const MULTICAST_PORT: u16 = 53319;
const BEACON_INTERVAL: Duration = Duration::from_secs(3);
const PEER_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeaconPayload {
    pub device_id: String,
    pub device_name: String,
    pub team_code: String,
    pub listen_port: u16,
    pub is_leader: bool,
    pub priority: u32,
}

#[derive(Debug, Clone)]
pub struct DiscoveredPeer {
    pub device_id: String,
    pub device_name: String,
    pub ip: Ipv4Addr,
    pub listen_port: u16,
    pub team_code: String,
    pub is_leader: bool,
    pub priority: u32,
    pub last_seen: Instant,
}

pub struct DiscoveryService {
    peers: Arc<Mutex<Vec<DiscoveredPeer>>>,
    running: Arc<Mutex<bool>>,
}

impl DiscoveryService {
    pub fn new() -> Self {
        Self {
            peers: Arc::new(Mutex::new(Vec::new())),
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn get_peers(&self) -> Vec<DiscoveredPeer> {
        let peers = self.peers.lock().unwrap();
        peers
            .iter()
            .filter(|p| p.last_seen.elapsed() < PEER_TIMEOUT)
            .cloned()
            .collect()
    }

    pub fn start_beacon(&self, payload: BeaconPayload) {
        let running = self.running.clone();
        *running.lock().unwrap() = true;

        let running_flag = running.clone();
        std::thread::spawn(move || {
            let socket = match UdpSocket::bind("0.0.0.0:0") {
                Ok(s) => s,
                Err(e) => {
                    log::error!("Failed to bind beacon socket: {}", e);
                    return;
                }
            };

            let target = SocketAddr::new(MULTICAST_ADDR.into(), MULTICAST_PORT);
            let message = match serde_json::to_vec(&payload) {
                Ok(m) => m,
                Err(_) => return,
            };

            while *running_flag.lock().unwrap() {
                let _ = socket.send_to(&message, target);
                std::thread::sleep(BEACON_INTERVAL);
            }
        });
    }

    pub fn start_listener(&self, own_device_id: String, team_code_filter: String) {
        let peers = self.peers.clone();
        let running = self.running.clone();

        std::thread::spawn(move || {
            let socket = match UdpSocket::bind(format!("0.0.0.0:{}", MULTICAST_PORT)) {
                Ok(s) => s,
                Err(e) => {
                    log::error!("Failed to bind discovery listener: {}", e);
                    return;
                }
            };

            if let Err(e) = socket.join_multicast_v4(&MULTICAST_ADDR, &Ipv4Addr::UNSPECIFIED) {
                log::error!("Failed to join multicast group: {}", e);
                return;
            }

            let _ = socket.set_read_timeout(Some(Duration::from_secs(2)));
            let mut buf = [0u8; 2048];

            while *running.lock().unwrap() {
                match socket.recv_from(&mut buf) {
                    Ok((size, addr)) => {
                        if let Ok(beacon) = serde_json::from_slice::<BeaconPayload>(&buf[..size]) {
                            if beacon.device_id == own_device_id {
                                continue;
                            }
                            if beacon.team_code != team_code_filter {
                                continue;
                            }

                            let ip = match addr.ip() {
                                std::net::IpAddr::V4(v4) => v4,
                                _ => continue,
                            };

                            let mut peer_list = peers.lock().unwrap();
                            if let Some(existing) = peer_list.iter_mut().find(|p| p.device_id == beacon.device_id) {
                                existing.last_seen = Instant::now();
                                existing.device_name = beacon.device_name;
                                existing.ip = ip;
                                existing.listen_port = beacon.listen_port;
                                existing.is_leader = beacon.is_leader;
                                existing.priority = beacon.priority;
                            } else {
                                peer_list.push(DiscoveredPeer {
                                    device_id: beacon.device_id,
                                    device_name: beacon.device_name,
                                    ip,
                                    listen_port: beacon.listen_port,
                                    team_code: beacon.team_code,
                                    is_leader: beacon.is_leader,
                                    priority: beacon.priority,
                                    last_seen: Instant::now(),
                                });
                            }
                        }
                    }
                    Err(_) => {
                        // Timeout or error, prune stale peers
                        let mut peer_list = peers.lock().unwrap();
                        peer_list.retain(|p| p.last_seen.elapsed() < PEER_TIMEOUT);
                    }
                }
            }
        });
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}
