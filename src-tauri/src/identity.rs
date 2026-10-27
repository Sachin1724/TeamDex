use sha2::{Digest, Sha256};
use uuid::Uuid;
use std::path::PathBuf;

const IDENTITY_FILE: &str = "device_identity.json";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeviceIdentity {
    pub device_id: String,
    pub device_name: String,
    pub public_key_hex: String,
}

impl DeviceIdentity {
    fn identity_path() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("TeamDex")
            .join(IDENTITY_FILE)
    }

    pub fn generate_or_load(preferred_name: Option<String>) -> Self {
        let path = Self::identity_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(mut saved) = serde_json::from_str::<DeviceIdentity>(&data) {
                if let Some(name) = preferred_name {
                    saved.device_name = name;
                    let _ = saved.save();
                }
                return saved;
            }
        }

        let name = preferred_name.unwrap_or_else(|| {
            std::env::var("COMPUTERNAME")
                .or_else(|_| std::env::var("USER"))
                .unwrap_or_else(|_| "Desktop-Node".to_string())
        });

        let random_uuid = Uuid::new_v4();
        let mut hasher = Sha256::new();
        hasher.update(random_uuid.as_bytes());
        let hash = hasher.finalize();
        let public_key_hex = format!("{:x}", hash);
        let device_id = format!("dev_{}", &public_key_hex[..12]);

        let identity = Self {
            device_id,
            device_name: name,
            public_key_hex,
        };
        let _ = identity.save();
        identity
    }

    fn save(&self) -> std::io::Result<()> {
        let path = Self::identity_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(path, json)
    }

    pub fn format_room_code(team_name: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(team_name.as_bytes());
        let hash = hasher.finalize();
        let code_hex = format!("{:X}", hash);
        format!("ROOM-{}", &code_hex[..8])
    }
}
