use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

const CHUNK_SIZE: usize = 256 * 1024; // 256 KB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHeader {
    pub transfer_id: String,
    pub filename: String,
    pub file_size: u64,
    pub checksum_sha256: String,
    pub sender_id: String,
    pub sender_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferMessage {
    Offer(FileHeader),
    Accept { transfer_id: String },
    Decline { transfer_id: String },
    Chunk { transfer_id: String, offset: u64, data: Vec<u8> },
    Complete { transfer_id: String },
}

pub type ProgressCallback = Arc<dyn Fn(String, u64, u64) + Send + Sync>;

pub struct FileServer {
    listen_port: u16,
    download_dir: PathBuf,
    running: Arc<Mutex<bool>>,
}

impl FileServer {
    pub fn new(listen_port: u16, download_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&download_dir);
        Self {
            listen_port,
            download_dir,
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, on_progress: ProgressCallback) -> Result<(), String> {
        let addr = format!("0.0.0.0:{}", self.listen_port);
        let listener = TcpListener::bind(&addr).map_err(|e| format!("Bind failed: {}", e))?;
        *self.running.lock().unwrap() = true;

        let running = self.running.clone();
        let download_dir = self.download_dir.clone();

        std::thread::spawn(move || {
            listener.set_nonblocking(true).ok();

            while *running.lock().unwrap() {
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        let dir = download_dir.clone();
                        let progress = on_progress.clone();
                        std::thread::spawn(move || {
                            if let Err(e) = handle_incoming_connection(stream, &dir, progress) {
                                log::error!("Connection error: {}", e);
                            }
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Err(e) => {
                        log::error!("Accept error: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}

fn handle_incoming_connection(
    mut stream: TcpStream,
    download_dir: &Path,
    on_progress: ProgressCallback,
) -> Result<(), String> {
    stream.set_nonblocking(false).map_err(|e| e.to_string())?;

    // Read header length (4 bytes, big-endian)
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).map_err(|e| format!("Read header length: {}", e))?;
    let header_len = u32::from_be_bytes(len_buf) as usize;

    if header_len > 65536 {
        return Err("Header too large".to_string());
    }

    // Read header
    let mut header_buf = vec![0u8; header_len];
    stream.read_exact(&mut header_buf).map_err(|e| format!("Read header: {}", e))?;
    let header: FileHeader = serde_json::from_slice(&header_buf).map_err(|e| format!("Parse header: {}", e))?;

    // Send accept
    let accept = TransferMessage::Accept { transfer_id: header.transfer_id.clone() };
    let accept_bytes = serde_json::to_vec(&accept).map_err(|e| e.to_string())?;
    let accept_len = (accept_bytes.len() as u32).to_be_bytes();
    stream.write_all(&accept_len).map_err(|e| e.to_string())?;
    stream.write_all(&accept_bytes).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;

    // Receive file data
    let temp_path = download_dir.join(format!("{}.part", header.transfer_id));
    let mut file = File::create(&temp_path).map_err(|e| format!("Create temp file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut buf = vec![0u8; CHUNK_SIZE];

    while received < header.file_size {
        let to_read = std::cmp::min(CHUNK_SIZE as u64, header.file_size - received) as usize;
        let n = stream.read(&mut buf[..to_read]).map_err(|e| format!("Read data: {}", e))?;
        if n == 0 {
            return Err("Connection closed before transfer complete".to_string());
        }

        file.write_all(&buf[..n]).map_err(|e| format!("Write data: {}", e))?;
        hasher.update(&buf[..n]);
        received += n as u64;

        on_progress(header.transfer_id.clone(), received, header.file_size);
    }

    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    // Verify checksum
    let actual_hash = format!("{:x}", hasher.finalize());
    if actual_hash != header.checksum_sha256 {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!("Checksum mismatch: expected {}, got {}", header.checksum_sha256, actual_hash));
    }

    // Atomic rename
    let final_path = download_dir.join(&header.filename);
    std::fs::rename(&temp_path, &final_path).map_err(|e| format!("Rename: {}", e))?;

    Ok(())
}

/// Send a file to a remote peer over TCP
pub fn send_file(
    target_ip: &str,
    target_port: u16,
    file_path: &Path,
    transfer_id: &str,
    sender_id: &str,
    sender_name: &str,
    on_progress: impl Fn(u64, u64),
) -> Result<(), String> {
    // Compute checksum first
    let mut file = File::open(file_path).map_err(|e| format!("Open file: {}", e))?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();
    let filename = file_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; CHUNK_SIZE];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let checksum = format!("{:x}", hasher.finalize());

    // Connect
    let addr = format!("{}:{}", target_ip, target_port);
    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e: std::net::AddrParseError| e.to_string())?,
        std::time::Duration::from_secs(5),
    ).map_err(|e| format!("Connect: {}", e))?;

    // Send header
    let header = FileHeader {
        transfer_id: transfer_id.to_string(),
        filename,
        file_size,
        checksum_sha256: checksum,
        sender_id: sender_id.to_string(),
        sender_name: sender_name.to_string(),
    };
    let header_bytes = serde_json::to_vec(&header).map_err(|e| e.to_string())?;
    let header_len = (header_bytes.len() as u32).to_be_bytes();
    stream.write_all(&header_len).map_err(|e| e.to_string())?;
    stream.write_all(&header_bytes).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;

    // Wait for accept
    let mut resp_len_buf = [0u8; 4];
    stream.read_exact(&mut resp_len_buf).map_err(|e| format!("Read response: {}", e))?;
    let resp_len = u32::from_be_bytes(resp_len_buf) as usize;
    let mut resp_buf = vec![0u8; resp_len];
    stream.read_exact(&mut resp_buf).map_err(|e| format!("Read response body: {}", e))?;

    let response: TransferMessage = serde_json::from_slice(&resp_buf).map_err(|e| e.to_string())?;
    match response {
        TransferMessage::Accept { .. } => {},
        TransferMessage::Decline { .. } => return Err("Transfer declined by recipient".to_string()),
        _ => return Err("Unexpected response".to_string()),
    }

    // Stream file data
    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    let mut sent: u64 = 0;

    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        stream.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        sent += n as u64;
        on_progress(sent, file_size);
    }

    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}
