//! Durable operation identities, independent of the history database and webview.
use super::contracts::{Presentation, Selection, RECEIPT_MS};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
pub struct Operation {
    pub id: Uuid,
    pub fingerprint: String,
    pub expires_at: i64,
    pub retain_until: i64,
    pub gid: String,
    pub state: String,
    pub format: String,
    pub presentation: Option<Presentation>,
    pub selection: Option<Selection>,
    pub submission_id: Option<Uuid>,
    pub error: Option<String>,
}
impl Operation {
    pub fn new(id: Uuid, fingerprint: String, now: i64, format: String) -> Self {
        Self {
            id,
            fingerprint,
            expires_at: now + super::contracts::LEASE_MS,
            retain_until: now + RECEIPT_MS,
            gid: new_gid(),
            state: "probing".into(),
            format,
            presentation: None,
            selection: None,
            submission_id: None,
            error: None,
        }
    }
    pub fn response(&self) -> serde_json::Value {
        let mut value = serde_json::json!({"id":self.id,"expiresAt":self.expires_at,
            "state":if self.state == "starting" { "probing" } else { &self.state }});
        match self.state.as_str() {
            "ready" => value["presentation"] = serde_json::json!(self.presentation),
            "submitted" => {
                value["submissionId"] = serde_json::json!(self.submission_id);
                value["gid"] = self.gid.clone().into();
            }
            "failed" => value["error"] = self.error.as_deref().unwrap_or("probe_failed").into(),
            _ => {}
        }
        value
    }
}
fn new_gid() -> String {
    Uuid::new_v4().simple().to_string()[..16].to_string()
}

#[derive(Clone)]
pub struct Journal(Arc<Mutex<Connection>>);
impl Journal {
    pub async fn open(path: PathBuf) -> Result<Self, &'static str> {
        tokio::task::spawn_blocking(move || {
            let connection = Connection::open(path).map_err(|_| "unavailable")?;
            connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, retain_until INTEGER NOT NULL, record TEXT NOT NULL);").map_err(|_| "unavailable")?;
            Ok(Self(Arc::new(Mutex::new(connection))))
        }).await.map_err(|_| "unavailable")?
    }
    pub async fn load(&self) -> Result<Vec<Operation>, &'static str> {
        let journal = self.clone();
        tokio::task::spawn_blocking(move || {
            let db = journal.0.lock().map_err(|_| "unavailable")?;
            let mut query = db
                .prepare("SELECT record FROM operations")
                .map_err(|_| "unavailable")?;
            let rows = query
                .query_map([], |row| row.get::<_, String>(0))
                .map_err(|_| "unavailable")?;
            let mut records = Vec::new();
            for row in rows {
                records.push(
                    serde_json::from_str(&row.map_err(|_| "unavailable")?)
                        .map_err(|_| "unavailable")?,
                );
            }
            Ok(records)
        })
        .await
        .map_err(|_| "unavailable")?
    }
    pub async fn save(&self, record: &Operation) -> Result<(), &'static str> {
        let journal = self.clone();
        let record = record.clone();
        tokio::task::spawn_blocking(move || {
            let value = serde_json::to_string(&record).map_err(|_| "unavailable")?;
            journal.0.lock().map_err(|_| "unavailable")?.execute(
                "INSERT INTO operations (id,retain_until,record) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET retain_until=excluded.retain_until,record=excluded.record",
                params![record.id.to_string(), record.retain_until, value]).map_err(|_| "unavailable")?;
            Ok(())
        }).await.map_err(|_| "unavailable")?
    }
    pub async fn delete(&self, id: Uuid) -> Result<(), &'static str> {
        let journal = self.clone();
        tokio::task::spawn_blocking(move || {
            journal
                .0
                .lock()
                .map_err(|_| "unavailable")?
                .execute("DELETE FROM operations WHERE id=?1", [id.to_string()])
                .map_err(|_| "unavailable")?;
            Ok(())
        })
        .await
        .map_err(|_| "unavailable")?
    }
}
