//! Native HLS/DASH inspection leases and durable extension submission receipts.
pub mod contracts;
mod journal;
mod policy;
pub mod routes;
#[cfg(test)]
mod tests;
pub use policy::start_automatic_selection;

use crate::{
    aria2::client::{Aria2Client, Aria2State},
    error::AppError,
};
use contracts::*;
use journal::{Journal, Operation};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, OnceCell};
use uuid::Uuid;

pub struct MediaState(pub OnceCell<Arc<MediaService>>);
impl MediaState {
    pub fn new() -> Self {
        Self(OnceCell::new())
    }
}

pub struct MediaService {
    engine: Arc<Aria2Client>,
    journal: Journal,
    submission_gate: Mutex<()>,
    deferred_events: Mutex<HashMap<String, (&'static str, crate::aria2::types::Aria2Task)>>,
    operations: Mutex<HashMap<Uuid, Operation>>,
}

pub fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
fn native_error(error: &AppError) -> &'static str {
    let message = error.to_string().to_ascii_lowercase();
    if message.contains("drm") || message.contains("unsupported encryption") {
        "protected_media"
    } else if message.contains("401") || message.contains("403") {
        "authentication_required"
    } else {
        "probe_failed"
    }
}
fn missing(error: &AppError) -> bool {
    let message = error.to_string().to_ascii_lowercase();
    message.contains("gid") && message.contains("not found")
}

pub async fn service(app: &AppHandle) -> Result<Arc<MediaService>, &'static str> {
    let state = app.state::<MediaState>();
    let result = state
        .0
        .get_or_try_init(|| async {
            let directory = app.path().app_local_data_dir().map_err(|_| "unavailable")?;
            tokio::fs::create_dir_all(&directory)
                .await
                .map_err(|_| "unavailable")?;
            let journal = Journal::open(directory.join("media-operations.db")).await?;
            let service = Arc::new(
                MediaService::restore(app.state::<Aria2State>().0.clone(), journal).await?,
            );
            let weak = Arc::downgrade(&service);
            let app = app.clone();
            tokio::spawn(async move {
                loop {
                    let Some(worker) = weak.upgrade() else { break };
                    if let Err(code) = worker.maintain().await {
                        log::warn!("media: operation reconciliation failed code={code}");
                    }
                    worker.flush_events(&app).await;
                    drop(worker);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            });
            Ok::<Arc<MediaService>, &'static str>(service)
        })
        .await?;
    Ok(result.clone())
}

pub async fn owns(app: &AppHandle, gid: &str) -> bool {
    match app.try_state::<Aria2State>() {
        Some(state) => state.0.is_internal(gid).await,
        None => false,
    }
}

impl MediaService {
    async fn restore(engine: Arc<Aria2Client>, journal: Journal) -> Result<Self, &'static str> {
        let mut operations = HashMap::new();
        for mut op in journal.load().await? {
            if matches!(op.state.as_str(), "probing" | "ready") {
                op.state = "failed".into();
                op.error = Some("source_expired".into());
                journal.save(&op).await?;
            }
            engine.set_internal(&op.gid, op.state != "submitted").await;
            operations.insert(op.id, op);
        }
        Ok(Self {
            engine,
            journal,
            submission_gate: Mutex::new(()),
            deferred_events: Mutex::new(HashMap::new()),
            operations: Mutex::new(operations),
        })
    }

    pub async fn defer_event(&self, event: &'static str, task: crate::aria2::types::Aria2Task) {
        self.deferred_events
            .lock()
            .await
            .insert(task.gid.clone(), (event, task));
    }
    async fn flush_events(&self, app: &AppHandle) {
        let submitted: std::collections::HashSet<_> = self
            .operations
            .lock()
            .await
            .values()
            .filter(|op| op.state == "submitted")
            .map(|op| op.gid.clone())
            .collect();
        let mut pending = self.deferred_events.lock().await;
        let events: Vec<_> = submitted
            .iter()
            .filter_map(|gid| pending.remove(gid))
            .collect();
        drop(pending);
        for (event, task) in events {
            if let Err(error) =
                super::monitor::process_lifecycle_task(app, event, &task, true).await
            {
                log::warn!(
                    "media: deferred lifecycle event failed code={}",
                    native_error(&error)
                );
            }
        }
    }

    pub async fn capabilities(&self) -> Result<Value, &'static str> {
        let (version, methods) = tokio::time::timeout(Duration::from_secs(3), async {
            tokio::try_join!(self.engine.get_version(), self.engine.list_methods())
        })
        .await
        .map_err(|_| "unavailable")?
        .map_err(|_| "unavailable")?;
        let features = version["enabledFeatures"].as_array().ok_or("unavailable")?;
        if !features.iter().any(|f| f == "HLS/DASH")
            || !["aria2.finishMedia", "aria2.retryMedia"]
                .iter()
                .all(|name| methods.iter().any(|method| method == name))
        {
            return Err("unavailable");
        }
        Ok(json!({"protocolVersion":1,"sourceKinds":["hls","dash"]}))
    }

    pub async fn create(
        self: &Arc<Self>,
        request: ProbeRequest,
        format: &str,
    ) -> Result<Value, &'static str> {
        let fingerprint = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&request).map_err(|_| "unsupported_source")?)
        );
        let mut records = self.operations.lock().await;
        if let Some(existing) = records.get(&request.id) {
            if existing.state == "cancelled" || existing.fingerprint == fingerprint {
                if now() >= existing.expires_at
                    && matches!(existing.state.as_str(), "probing" | "ready")
                {
                    return Err("expired");
                }
                return Ok(existing.response());
            }
            return Err("conflict");
        }
        request.source.validate(now())?;
        if !matches!(request.source.kind.as_str(), "hls" | "dash") {
            return Err("unsupported_source");
        }
        // This engine cannot enforce exact-origin custom headers on every redirect.
        // Refuse unsupported credentials instead of leaking or silently dropping them.
        if request
            .source
            .request_contexts
            .iter()
            .any(|context| !context.headers.is_empty())
        {
            return Err("unsupported_source");
        }
        if records
            .values()
            .filter(|op| matches!(op.state.as_str(), "probing" | "ready" | "starting"))
            .count()
            >= 8
            || records.len() >= 4096
        {
            return Err("unavailable");
        }
        let record = Operation::new(
            request.id,
            fingerprint,
            now(),
            if format == "mkv" { "mkv" } else { "mp4" }.into(),
        );
        self.journal.save(&record).await?;
        self.engine.set_internal(&record.gid, true).await;
        records.insert(record.id, record.clone());
        let response = record.response();
        let worker = self.clone();
        tokio::spawn(async move {
            worker.probe(record, request.source).await;
        });
        Ok(response)
    }

    async fn probe(self: Arc<Self>, record: Operation, source: Source) {
        let result = self.run_probe(&record, &source).await;
        let mut records = self.operations.lock().await;
        let Some(current) = records.get_mut(&record.id) else {
            return;
        };
        if current.state != "probing" {
            drop(records);
            let _ = self.clean_gid(&record.gid).await;
            return;
        }
        let mut updated = current.clone();
        match result {
            Ok(presentation) => {
                updated.presentation = Some(presentation);
                updated.state = "ready".into();
            }
            Err(code) => {
                updated.state = "failed".into();
                updated.error = Some(code.into());
            }
        }
        match self.journal.save(&updated).await {
            Ok(()) => *current = updated,
            Err(code) => log::warn!("media: probe journal failed code={code}"),
        }
    }

    async fn run_probe(
        &self,
        record: &Operation,
        source: &Source,
    ) -> Result<Presentation, &'static str> {
        let options = json!({"gid":record.gid,"media":source.kind,"media-format":record.format,
            "media-pause-after-probe":"true","header":"","http-user":"","http-passwd":"","referer":"",
            "check-certificate":"true","auto-file-renaming":"true"});
        self.engine
            .add_uri(vec![source.url.clone()], options)
            .await
            .map_err(|e| native_error(&e))?;
        loop {
            if now() >= record.expires_at {
                return Err("expired");
            }
            if self
                .operations
                .lock()
                .await
                .get(&record.id)
                .is_none_or(|op| op.state != "probing")
            {
                return Err("expired");
            }
            let task = self
                .engine
                .tell_status(&record.gid)
                .await
                .map_err(|_| "probe_failed")?;
            if task.status == "error" {
                return Err(native_error(&AppError::Aria2(
                    task.media
                        .as_ref()
                        .map(|m| m.error.clone())
                        .or(task.error_message.clone())
                        .unwrap_or_default(),
                )));
            }
            if task
                .media
                .as_ref()
                .is_some_and(|m| m.state == "awaiting-selection")
            {
                return Presentation::from_task(&task, &record.format);
            }
            if matches!(task.status.as_str(), "complete" | "removed") {
                return Err("unsupported_source");
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }

    pub async fn read(&self, id: Uuid) -> Result<Value, &'static str> {
        let records = self.operations.lock().await;
        let record = records.get(&id).ok_or("not_found")?;
        if now() >= record.expires_at && matches!(record.state.as_str(), "probing" | "ready") {
            return Err("expired");
        }
        Ok(record.response())
    }

    pub async fn submit(
        self: &Arc<Self>,
        id: Uuid,
        request: SubmitRequest,
    ) -> Result<Value, &'static str> {
        let mut records = self.operations.lock().await;
        let record = records.get_mut(&id).ok_or("not_found")?;
        if let Some(previous) = record.submission_id {
            if previous != request.submission_id
                || record.selection.as_ref() != Some(&request.selection)
            {
                return Err("conflict");
            }
            return match record.state.as_str() {
                "submitted" => Ok(receipt(record)),
                "failed" => Err("source_expired"),
                _ => Err("unavailable"),
            };
        }
        if now() >= record.expires_at {
            return Err("expired");
        }
        if record.state != "ready" {
            return Err("conflict");
        }
        record
            .presentation
            .as_ref()
            .ok_or("conflict")?
            .validate_selection(&request.selection)?;
        let mut intent = record.clone();
        intent.selection = Some(request.selection);
        intent.submission_id = Some(request.submission_id);
        intent.state = "starting".into();
        intent.retain_until = now() + RECEIPT_MS;
        self.journal.save(&intent).await?;
        *record = intent.clone();
        drop(records);
        let worker = self.clone();
        let job = tokio::spawn(async move { worker.start(intent).await });
        match tokio::time::timeout(Duration::from_secs(4), job).await {
            Ok(Ok(result)) => result,
            _ => Err("unavailable"),
        }
    }

    async fn start(&self, record: Operation) -> Result<Value, &'static str> {
        let _submission = self.submission_gate.lock().await;
        if let Some(current) = self.operations.lock().await.get(&record.id) {
            if current.state == "submitted" {
                return Ok(receipt(current));
            }
        }
        self.start_native(&record).await?;
        let mut records = self.operations.lock().await;
        let current = records.get_mut(&record.id).ok_or("not_found")?;
        let mut completed = current.clone();
        completed.state = "submitted".into();
        completed.error = None;
        self.journal.save(&completed).await?;
        *current = completed;
        self.engine.set_internal(&record.gid, false).await;
        Ok(receipt(current))
    }

    async fn start_native(&self, record: &Operation) -> Result<(), &'static str> {
        let task = self.engine.tell_status(&record.gid).await.map_err(|e| {
            if missing(&e) {
                "source_expired"
            } else {
                "unavailable"
            }
        })?;
        if task.status == "paused"
            && task
                .media
                .as_ref()
                .is_some_and(|m| m.state == "awaiting-selection")
        {
            let selection = record.selection.as_ref().ok_or("conflict")?;
            let mut options = selection.options();
            if let Some(file) = task.files.first() {
                let path = std::path::Path::new(&file.path);
                let name = path.file_stem().and_then(|n| n.to_str()).unwrap_or("media");
                options["out"] = format!("{name}.{}", selection.format).into();
            }
            self.engine
                .change_option(&record.gid, options)
                .await
                .map_err(|_| "unavailable")?;
            self.engine
                .unpause(&record.gid)
                .await
                .map_err(|_| "unavailable")?;
        }
        self.engine
            .save_session()
            .await
            .map_err(|_| "unavailable")?;
        Ok(())
    }

    pub async fn cancel(&self, id: Uuid) -> Result<Value, &'static str> {
        let mut records = self.operations.lock().await;
        if !records.contains_key(&id) && records.len() >= 4096 {
            return Err("unavailable");
        }
        let existing = records
            .get(&id)
            .cloned()
            .unwrap_or_else(|| Operation::new(id, String::new(), now(), "mp4".into()));
        if existing.state == "submitted" {
            let mut value = receipt(&existing);
            value["state"] = "submitted".into();
            return Ok(value);
        }
        if existing.state == "starting" {
            return Err("unavailable");
        }
        let mut cancelled = existing;
        cancelled.state = "cancelled".into();
        self.journal.save(&cancelled).await?;
        records.insert(id, cancelled);
        Ok(json!({"id":id,"state":"cancelled"}))
    }

    async fn clean_gid(&self, gid: &str) -> Result<(), &'static str> {
        let task = match self.engine.tell_status(gid).await {
            Ok(task) => task,
            Err(error) if missing(&error) => return Ok(()),
            Err(_) => return Err("unavailable"),
        };
        if !matches!(task.status.as_str(), "complete" | "error" | "removed") {
            self.engine
                .force_remove(gid)
                .await
                .map_err(|_| "unavailable")?;
        }
        self.engine
            .remove_download_result(gid)
            .await
            .map_err(|_| "unavailable")?;
        Ok(())
    }

    async fn maintain(&self) -> Result<(), &'static str> {
        let records: Vec<_> = self.operations.lock().await.values().cloned().collect();
        let present: std::collections::HashSet<_> = self
            .engine
            .tell_internal_tasks()
            .await
            .map_err(|_| "unavailable")?
            .into_iter()
            .map(|task| task.gid)
            .collect();
        for record in records {
            if record.state == "starting" {
                match self.start(record.clone()).await {
                    Err("source_expired") => {
                        let mut all = self.operations.lock().await;
                        if let Some(current) = all.get_mut(&record.id) {
                            let mut failed = current.clone();
                            failed.state = "failed".into();
                            failed.error = Some("source_expired".into());
                            self.journal.save(&failed).await?;
                            *current = failed;
                        }
                    }
                    Err(code) => {
                        log::debug!("media: submission reconciliation pending code={code}")
                    }
                    Ok(_) => {}
                }
                continue;
            }
            if record.expires_at <= now() && matches!(record.state.as_str(), "probing" | "ready") {
                self.cancel(record.id).await?;
            }
            if matches!(record.state.as_str(), "failed" | "cancelled")
                && present.contains(&record.gid)
            {
                self.clean_gid(&record.gid).await?;
            }
            if record.retain_until <= now() && !matches!(record.state.as_str(), "probing" | "ready")
            {
                self.journal.delete(record.id).await?;
                self.deferred_events.lock().await.remove(&record.gid);
                self.engine.set_internal(&record.gid, false).await;
                self.operations.lock().await.remove(&record.id);
            }
        }
        Ok(())
    }
}
fn receipt(record: &Operation) -> Value {
    json!({"id":record.id,"submissionId":record.submission_id,"gid":record.gid})
}
