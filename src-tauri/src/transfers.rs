use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const CHUNK_SIZE_BYTES: usize = 256 * 1024; // 256 KB chunks

pub struct TransferManager {
    download_dir: PathBuf,
}

impl TransferManager {
    pub fn new<P: AsRef<Path>>(download_dir: P) -> Self {
        let path = download_dir.as_ref().to_path_buf();
        let _ = std::fs::create_dir_all(&path);
        Self { download_dir: path }
    }

    /// Compute full SHA-256 checksum of a local file
    pub fn compute_sha256<P: AsRef<Path>>(file_path: P) -> std::io::Result<String> {
        let mut file = File::open(file_path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];

        loop {
            let bytes_read = file.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        let hash = hasher.finalize();
        Ok(format!("{:x}", hash))
    }

    /// Write an incoming chunk to a temporary .part file
    pub fn write_chunk(
        &self,
        transfer_id: &str,
        chunk_offset: u64,
        data: &[u8],
    ) -> std::io::Result<()> {
        let temp_filename = format!("{}.part", transfer_id);
        let temp_path = self.download_dir.join(temp_filename);

        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(&temp_path)?;

        use std::io::Seek;
        file.seek(std::io::SeekFrom::Start(chunk_offset))?;
        file.write_all(data)?;
        file.flush()?;

        Ok(())
    }

    /// Complete a transfer by verifying checksum and atomically renaming .part file
    pub fn finalize_transfer(
        &self,
        transfer_id: &str,
        original_filename: &str,
        expected_sha256: &str,
    ) -> std::io::Result<Result<PathBuf, String>> {
        let temp_filename = format!("{}.part", transfer_id);
        let temp_path = self.download_dir.join(temp_filename);

        if !temp_path.exists() {
            return Ok(Err("Partial transfer file does not exist".to_string()));
        }

        let actual_sha256 = Self::compute_sha256(&temp_path)?;
        if actual_sha256.to_lowercase() != expected_sha256.to_lowercase() {
            return Ok(Err(format!(
                "Checksum mismatch! Expected {}, got {}",
                expected_sha256, actual_sha256
            )));
        }

        let target_path = self.download_dir.join(original_filename);
        std::fs::rename(&temp_path, &target_path)?;

        Ok(Ok(target_path))
    }
}
