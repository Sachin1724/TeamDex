use rusqlite::{params, Connection, Result};
use std::path::Path;
use crate::types::{ActivityEvent, TransferRecord, TransferStatus};

pub struct LocalDatabase {
    conn: Connection,
}

impl LocalDatabase {
    pub fn init<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.create_tables()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.create_tables()?;
        Ok(db)
    }

    fn create_tables(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                bytes_transferred INTEGER NOT NULL,
                sender_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                checksum_sha256 TEXT NOT NULL,
                status TEXT NOT NULL,
                local_path TEXT,
                transfer_speed_bps INTEGER NOT NULL,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                is_incoming INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS journal_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    pub fn insert_transfer(&self, record: &TransferRecord) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO transfers (
                id, filename, file_size, bytes_transferred, sender_id, sender_name,
                recipient_id, recipient_name, checksum_sha256, status, local_path,
                transfer_speed_bps, started_at, completed_at, is_incoming
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                record.id,
                record.filename,
                record.file_size as i64,
                record.bytes_transferred as i64,
                record.sender_id,
                record.sender_name,
                record.recipient_id,
                record.recipient_name,
                record.checksum_sha256,
                format!("{:?}", record.status),
                record.local_path,
                record.transfer_speed_bps as i64,
                record.started_at,
                record.completed_at,
                if record.is_incoming { 1 } else { 0 },
            ],
        )?;
        Ok(())
    }

    pub fn log_event(&self, event: &ActivityEvent) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO journal_events (id, event_type, description, timestamp, metadata)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                event.id,
                event.event_type,
                event.description,
                event.timestamp,
                event.metadata,
            ],
        )?;
        Ok(())
    }

    pub fn get_recent_transfers(&self, limit: usize) -> Result<Vec<TransferRecord>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, filename, file_size, bytes_transferred, sender_id, sender_name,
                   recipient_id, recipient_name, checksum_sha256, status, local_path,
                   transfer_speed_bps, started_at, completed_at, is_incoming
            FROM transfers ORDER BY started_at DESC LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let status_str: String = row.get(9)?;
            let status = match status_str.as_str() {
                "VerifiedComplete" => TransferStatus::VerifiedComplete,
                "Transferring" => TransferStatus::Transferring,
                "Declined" => TransferStatus::Declined,
                "Failed" => TransferStatus::Failed,
                "Interrupted" => TransferStatus::Interrupted,
                _ => TransferStatus::PendingAcceptance,
            };

            let is_incoming_val: i32 = row.get(14)?;

            Ok(TransferRecord {
                id: row.get(0)?,
                filename: row.get(1)?,
                file_size: row.get::<_, i64>(2)? as u64,
                bytes_transferred: row.get::<_, i64>(3)? as u64,
                sender_id: row.get(4)?,
                sender_name: row.get(5)?,
                recipient_id: row.get(6)?,
                recipient_name: row.get(7)?,
                checksum_sha256: row.get(8)?,
                status,
                local_path: row.get(10)?,
                transfer_speed_bps: row.get::<_, i64>(11)? as u64,
                started_at: row.get(12)?,
                completed_at: row.get(13)?,
                is_incoming: is_incoming_val == 1,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get_recent_events(&self, limit: usize) -> Result<Vec<ActivityEvent>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, event_type, description, timestamp, metadata
            FROM journal_events ORDER BY timestamp DESC LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(ActivityEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                description: row.get(2)?,
                timestamp: row.get(3)?,
                metadata: row.get(4)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }
}
