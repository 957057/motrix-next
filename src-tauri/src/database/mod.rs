//! Process-owned SQLite storage. No database lifecycle depends on a WebView.
mod credentials;
mod history;
mod submissions;
mod task_query;
use crate::error::AppError;
pub use credentials::HttpAuthCredential;
pub use history::{HistoryPage, HistoryPageInput, HistoryRecord};
use rusqlite::Connection;
use std::{path::Path, sync::Arc};
pub use submissions::SubmissionState;
pub use task_query::{TaskQueryInput, TaskQueryPage};
use tokio::sync::{MappedMutexGuard, Mutex, MutexGuard};

pub const SCHEMA_VERSION: u32 = 4;
// Connection is Send but not Sync; one owner serializes access and transactions.
pub struct Database {
    conn: Arc<Mutex<Option<Connection>>>,
}
pub struct DatabaseState(pub Arc<Database>);
impl Database {
    pub fn unavailable() -> Self {
        Self {
            conn: Arc::new(Mutex::new(None)),
        }
    }
    pub async fn is_ready(&self) -> bool {
        self.conn.lock().await.is_some()
    }
    pub async fn initialize(&self, path: &Path) -> Result<(), AppError> {
        let mut conn = self.conn.lock().await;
        if conn.is_none() {
            let path = path.to_owned();
            *conn = tokio::task::spawn_blocking(move || Self::open_connection(&path))
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .map(Some)?;
        }
        Ok(())
    }
    pub async fn close(&self) {
        self.conn.lock().await.take();
    }
    async fn connection(&self) -> Result<MappedMutexGuard<'_, Connection>, AppError> {
        MutexGuard::try_map(self.conn.lock().await, Option::as_mut)
            .map_err(|_| AppError::Database("Database is unavailable".into()))
    }
    fn open_connection(path: &Path) -> Result<Connection, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;")?;
        let version: u32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version > SCHEMA_VERSION {
            return Err(AppError::Database("Unsupported database schema".into()));
        }
        let transaction = conn.transaction()?;
        transaction.execute_batch(include_str!("schema.sql"))?;
        transaction.prepare("SELECT gid, added_at, meta FROM download_history LIMIT 0")?;
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
        Ok(conn)
    }
    async fn with_connection<T: Send + 'static>(
        &self,
        operation: impl FnOnce(&mut Connection) -> Result<T, AppError> + Send + 'static,
    ) -> Result<T, AppError> {
        let waiting = std::time::Instant::now();
        let mut guard = self.conn.clone().lock_owned().await;
        let wait_ms = waiting.elapsed().as_millis() as u64;
        tokio::task::spawn_blocking(move || {
            let started = std::time::Instant::now();
            let connection = guard
                .as_mut()
                .ok_or_else(|| AppError::Database("Database is unavailable".into()))?;
            let result = operation(connection);
            let duration_ms = started.elapsed().as_millis() as u64;
            if wait_ms + duration_ms >= 500 {
                log::warn!(target: "database", wait_ms, duration_ms; "database_query_slow");
            }
            result
        })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    }
    pub async fn schema_version(&self) -> Result<u32, AppError> {
        Ok(self
            .connection()
            .await?
            .query_row("PRAGMA user_version", [], |row| row.get(0))?)
    }
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(include_str!("schema.sql"))?;
        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(Some(conn))),
        })
    }
}
