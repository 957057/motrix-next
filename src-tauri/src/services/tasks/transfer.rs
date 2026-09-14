//! Latest-value transfer sampling shared by the desktop and native consumers.
use super::TaskService;
use crate::{
    aria2::types::{Aria2GlobalStat, Aria2Task},
    error::AppError,
    services::stat::StatUpdate,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{watch, Notify};

const TRANSFER_KEYS: &[&str] = &[
    "gid",
    "status",
    "totalLength",
    "completedLength",
    "uploadLength",
    "downloadSpeed",
    "uploadSpeed",
    "connections",
    "dir",
    "seeder",
    "bittorrent",
    "ed2k",
    "media",
    "verifiedLength",
    "verifyIntegrityPending",
    "errorCode",
    "errorMessage",
    "infoHash",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferSnapshot {
    pub generation: u64,
    pub sequence: u64,
    pub revision: u64,
    pub sampled_at: u64,
    pub stat: StatUpdate,
    pub tasks: Vec<Aria2Task>,
}

pub struct TransferState {
    pub latest: watch::Sender<Option<Arc<TransferSnapshot>>>,
    pub subscriptions: watch::Sender<u64>,
    pub wake: Notify,
    revision: AtomicU64,
    sequence: AtomicU64,
}
impl Default for TransferState {
    fn default() -> Self {
        Self {
            latest: watch::channel(None).0,
            subscriptions: watch::channel(0).0,
            wake: Notify::new(),
            revision: AtomicU64::new(0),
            sequence: AtomicU64::new(0),
        }
    }
}
impl TransferState {
    pub fn mark_changed(&self) {
        self.revision.fetch_add(1, Ordering::Relaxed);
    }
    pub fn invalidate(&self) {
        self.mark_changed();
        self.wake.notify_one();
    }
    pub fn reset(&self) {
        self.latest.send_replace(None);
        self.invalidate();
    }
    pub fn revision(&self) -> u64 {
        self.revision.load(Ordering::Relaxed)
    }
    pub fn sequence(&self) -> u64 {
        self.sequence.load(Ordering::Relaxed)
    }
    pub fn subscribe(&self) -> u64 {
        let mut id = 0;
        self.subscriptions.send_modify(|current| {
            *current += 1;
            id = *current;
        });
        id
    }
    pub fn unsubscribe(&self, id: u64) {
        self.subscriptions.send_if_modified(|current| {
            if *current != id {
                return false;
            }
            *current += 1;
            true
        });
    }
}

fn result<T: serde::de::DeserializeOwned>(row: &Value) -> Result<T, AppError> {
    let value = row
        .as_array()
        .filter(|row| row.len() == 1)
        .and_then(|row| row.first())
        .ok_or_else(|| AppError::Aria2("Incomplete transfer sample".into()))?;
    serde_json::from_value(value.clone()).map_err(|error| AppError::Aria2(error.to_string()))
}

/// Excludes counters: a progress tick must not trigger a history query.
fn topology(tasks: &[Aria2Task], stat: &StatUpdate) -> String {
    let mut entries: Vec<_> = tasks
        .iter()
        .map(|task| {
            let bt = task.bittorrent.as_ref();
            json!([
                task.gid,
                task.status,
                task.seeder,
                task.total_length,
                task.selection_managed,
                bt.and_then(|bt| bt.state.as_ref()),
                bt.and_then(|bt| bt.file_selection_state.as_ref()),
                bt.and_then(|bt| bt.info.as_ref()).map(|info| &info.name),
                bt.and_then(|bt| bt.error.as_ref()).map(|error| &error.code),
                task.media.as_ref().map(|media| &media.state)
            ])
        })
        .collect();
    entries.sort_by(|a, b| a[0].as_str().cmp(&b[0].as_str()));
    json!([
        entries,
        stat.num_waiting,
        stat.num_stopped,
        stat.num_stopped_total
    ])
    .to_string()
}

impl TaskService {
    pub async fn sample_transfers(&self) -> Result<Arc<TransferSnapshot>, AppError> {
        let generation = self.generation();
        let rows = self
            .multicall(vec![
                ("getGlobalStat".into(), vec![]),
                ("tellActive".into(), vec![json!(TRANSFER_KEYS)]),
            ])
            .await?;
        if rows.len() != 2 {
            return Err(AppError::Aria2("Incomplete transfer sample".into()));
        }
        let raw: Aria2GlobalStat = result(&rows[0])?;
        let tasks = self.tasks.visible_tasks(result(&rows[1])?).await;
        let stat = StatUpdate {
            download_speed: raw.download_speed.parse().unwrap_or(0),
            upload_speed: raw.upload_speed.parse().unwrap_or(0),
            num_active: tasks.len() as u64,
            num_waiting: raw.num_waiting.parse().unwrap_or(0),
            num_stopped: raw.num_stopped.parse().unwrap_or(0),
            num_stopped_total: raw.num_stopped_total.parse().unwrap_or(0),
        };
        if generation != self.generation() {
            return Err(AppError::Aria2(
                "Engine changed during transfer sampling".into(),
            ));
        }
        let changed = self
            .transfers
            .latest
            .borrow()
            .as_ref()
            .is_none_or(|previous| {
                previous.generation != generation
                    || topology(&previous.tasks, &previous.stat) != topology(&tasks, &stat)
            });
        if changed {
            self.transfers.revision.fetch_add(1, Ordering::Relaxed);
        }
        let snapshot = Arc::new(TransferSnapshot {
            generation,
            sequence: self.transfers.sequence.fetch_add(1, Ordering::Relaxed) + 1,
            revision: self.transfers.revision.load(Ordering::Relaxed),
            sampled_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            stat,
            tasks,
        });
        let published = self.transfers.latest.send_if_modified(|latest| {
            if self.generation() != generation {
                return false;
            }
            *latest = Some(snapshot.clone());
            true
        });
        if !published {
            return Err(AppError::Aria2(
                "Engine changed before transfer publication".into(),
            ));
        }
        Ok(snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn samples_counters_without_file_lists_and_publishes_the_latest_value() {
        use axum::{routing::post, Json, Router};
        async fn respond(Json(request): Json<Value>) -> Json<Value> {
            let calls = request["params"][0].as_array().unwrap();
            assert_eq!(calls.len(), 2);
            assert_eq!(calls[0]["methodName"], "aria2.getGlobalStat");
            assert_eq!(calls[1]["methodName"], "aria2.tellActive");
            let keys = calls[1]["params"][0].as_array().unwrap();
            assert!(keys.contains(&json!("completedLength")));
            assert!(!keys.contains(&json!("files")));
            assert!(!keys.contains(&json!("bitfield")));
            Json(json!({ "jsonrpc": "2.0", "id": request["id"], "result": [
                [{"downloadSpeed":"500", "uploadSpeed":"0", "numActive":"1", "numWaiting":"0", "numStopped":"0", "numStoppedTotal":"0"}],
                [[{"gid":"a", "status":"active", "totalLength":"1000", "completedLength":"500", "uploadLength":"0", "downloadSpeed":"500", "uploadSpeed":"0", "connections":"1", "dir":"/downloads"}]]
            ] }))
        }
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let service = TaskService::new(listener.local_addr().unwrap().port(), String::new());
        let server = tokio::spawn(async move {
            axum::serve(listener, Router::new().route("/jsonrpc", post(respond)))
                .await
                .unwrap();
        });
        let first = service.sample_transfers().await.unwrap();
        let second = service.sample_transfers().await.unwrap();
        assert!(second.sequence > first.sequence);
        assert_eq!(second.revision, first.revision);
        assert_eq!(second.stat.download_speed, 500);
        assert_eq!(second.tasks[0].completed_length, "500");
        assert_eq!(
            service.transfers.latest.borrow().as_ref().unwrap().sequence,
            second.sequence
        );
        service.tasks.set_internal("a", true).await;
        let hidden = service.sample_transfers().await.unwrap();
        assert!(hidden.tasks.is_empty());
        assert_eq!(hidden.stat.num_active, 0);
        server.abort();
    }
    #[tokio::test]
    async fn cached_pages_keep_files_fresh_counters_and_current_admission_policy() {
        use axum::{extract::State, routing::post, Json, Router};
        async fn respond(
            State(reads): State<Arc<AtomicU64>>,
            Json(request): Json<Value>,
        ) -> Json<Value> {
            let results: Vec<_> = request["params"][0].as_array().unwrap().iter().map(|call| {
                let value = match call["methodName"].as_str().unwrap() {
                    "aria2.getGlobalStat" => json!({"downloadSpeed":"500", "uploadSpeed":"0", "numActive":"1", "numWaiting":"0", "numStopped":"0", "numStoppedTotal":"0"}),
                    "aria2.tellActive" => {
                        let compact = call["params"][0].is_array();
                        if !compact { reads.fetch_add(1, Ordering::Relaxed); }
                        json!([{"gid":"a", "status":"active", "totalLength":"1000", "completedLength":if compact {"500"} else {"100"}, "uploadLength":"0", "downloadSpeed":"500", "uploadSpeed":"0", "connections":"1", "dir":"/downloads",
                            "files":[{"index":"1", "path":"/downloads/a.zip", "length":"1000", "completedLength":"100", "selected":"true"}]}])
                    }
                    "aria2.tellWaiting" | "aria2.tellStopped" => json!([]),
                    _ => panic!("unexpected RPC"),
                };
                json!([value])
            }).collect();
            Json(json!({"jsonrpc":"2.0", "id":request["id"], "result":results}))
        }
        let reads = Arc::new(AtomicU64::new(0));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let service = TaskService::new(listener.local_addr().unwrap().port(), String::new());
        let app = Router::new()
            .route("/jsonrpc", post(respond))
            .with_state(reads.clone());
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let db = crate::database::Database::open_in_memory().unwrap();
        let query = || crate::database::TaskQueryInput {
            scope: "all".into(),
            query: String::new(),
            page: 1,
            page_size: 20,
            sort_field: "speed".into(),
            direction: "desc".into(),
            manual_order: vec![],
        };
        service.sample_transfers().await.unwrap();
        let first = service.query_tasks(&db, query()).await.unwrap();
        assert_eq!(first.tasks[0].completed_length, "500");
        assert_eq!(first.tasks[0].files[0].path, "/downloads/a.zip");
        service.tasks.set_automatic("a", true).await;
        let second = service.query_tasks(&db, query()).await.unwrap();
        assert!(second.tasks[0].selection_managed);
        service.tasks.set_internal("a", true).await;
        let hidden = service.query_tasks(&db, query()).await.unwrap();
        assert!(hidden.gids.is_empty());
        assert_eq!(reads.load(Ordering::Relaxed), 1);
        server.abort();
    }
    #[test]
    fn counters_do_not_invalidate_pages_but_state_changes_do() {
        let stat = StatUpdate {
            download_speed: 0,
            upload_speed: 0,
            num_active: 1,
            num_waiting: 0,
            num_stopped: 0,
            num_stopped_total: 0,
        };
        let mut task = Aria2Task {
            gid: "a".into(),
            status: "active".into(),
            ..Default::default()
        };
        let before = topology(&[task.clone()], &stat);
        task.completed_length = "1000".into();
        task.download_speed = "100".into();
        assert_eq!(before, topology(&[task.clone()], &stat));
        task.seeder = Some("true".into());
        assert_ne!(before, topology(&[task], &stat));
    }
    #[test]
    fn retiring_an_old_subscription_does_not_close_its_replacement() {
        let state = TransferState::default();
        let old = state.subscribe();
        let current = state.subscribe();
        state.unsubscribe(old);
        assert_eq!(*state.subscriptions.borrow(), current);
        state.unsubscribe(current);
        assert_ne!(*state.subscriptions.borrow(), current);
    }
}
