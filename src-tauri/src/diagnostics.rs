use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::DateTime;
use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

use crate::aria2::client::Aria2State;
use crate::engine::supervisor::EngineSupervisor;
use crate::error::AppError;
use crate::log_policy::{managed_log_source, LogSource};

pub(crate) struct LogArtifact {
    pub path: PathBuf,
    pub zip_path: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub(crate) struct TimelineRecord {
    pub timestamp: String,
    pub severity: String,
    pub source: String,
    pub target: String,
    pub message: String,
    pub attributes: BTreeMap<String, String>,
    #[serde(skip)]
    sort_key: i64,
}

#[derive(Debug, Serialize)]
pub(crate) struct Timeline {
    pub records: Vec<TimelineRecord>,
    pub skipped_lines: usize,
}

pub(crate) fn collect_logs(log_dir: &Path) -> Result<Vec<LogArtifact>, AppError> {
    let mut artifacts = Vec::new();
    for entry in std::fs::read_dir(log_dir)
        .map_err(|error| AppError::Io(format!("Failed to read log directory: {error}")))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        let Some(source) = managed_log_source(&name) else {
            continue;
        };
        let content = std::fs::read(&path)
            .map_err(|error| AppError::Io(format!("Failed to read {name}: {error}")))?;
        if content.is_empty() {
            continue;
        }
        let directory = match source {
            LogSource::Motrix => "motrix-next",
            LogSource::Aria2 => "aria2-next",
        };
        artifacts.push(LogArtifact {
            path,
            zip_path: format!("{directory}/{name}"),
            content,
        });
    }
    artifacts.sort_by(|left, right| left.zip_path.cmp(&right.zip_path));
    Ok(artifacts)
}

fn parse_quoted_value(input: &str) -> Option<(String, usize)> {
    let bytes = input.as_bytes();
    let mut escaped = false;
    for index in 1..bytes.len() {
        match bytes[index] {
            b'\\' if !escaped => escaped = true,
            b'"' if !escaped => {
                let raw = &input[..=index];
                let value = serde_json::from_str(raw).ok()?;
                return Some((value, index + 1));
            }
            _ => escaped = false,
        }
    }
    None
}

fn parse_fields(input: &str) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();
    let mut remaining = input.trim();
    while !remaining.is_empty() {
        let Some(equals) = remaining.find('=') else {
            break;
        };
        let key = remaining[..equals].trim();
        if key.is_empty() || key.bytes().any(|byte| byte.is_ascii_whitespace()) {
            break;
        }
        remaining = &remaining[equals + 1..];
        let (value, consumed) = if remaining.starts_with('"') {
            match parse_quoted_value(remaining) {
                Some(parsed) => parsed,
                None => break,
            }
        } else if key == "message" {
            (remaining.trim().to_string(), remaining.len())
        } else {
            let end = remaining
                .find(char::is_whitespace)
                .unwrap_or(remaining.len());
            (remaining[..end].to_string(), end)
        };
        fields.insert(key.to_string(), value);
        remaining = remaining[consumed..].trim_start();
    }
    fields
}

fn embedded_message_fields(message: &str) -> BTreeMap<String, String> {
    message
        .split_whitespace()
        .filter_map(|part| part.split_once('='))
        .filter(|(key, value)| !key.is_empty() && !value.is_empty())
        .map(|(key, value)| (key.to_string(), value.trim_matches('"').to_string()))
        .collect()
}

pub(crate) fn parse_timeline_line(line: &str) -> Option<TimelineRecord> {
    let mut parts = line.splitn(3, ' ');
    let timestamp = parts.next()?;
    let severity = parts.next()?.trim_matches(['[', ']']).to_ascii_uppercase();
    let payload = parts.next()?;
    let parsed_timestamp = DateTime::parse_from_rfc3339(timestamp).ok()?;
    if !matches!(
        severity.as_str(),
        "TRACE" | "DEBUG" | "INFO" | "WARN" | "WARNING" | "ERROR" | "CRITICAL"
    ) {
        return None;
    }
    let mut fields = parse_fields(payload);
    let source = fields.remove("source")?;
    let target = fields.remove("target").unwrap_or_default();
    let message = fields.remove("message").unwrap_or_default();
    for (key, value) in embedded_message_fields(&message) {
        fields.entry(key).or_insert(value);
    }
    Some(TimelineRecord {
        timestamp: timestamp.to_string(),
        severity: match severity.as_str() {
            "WARNING" => "WARN".to_string(),
            "CRITICAL" => "ERROR".to_string(),
            _ => severity,
        },
        source,
        target,
        message,
        attributes: fields,
        sort_key: parsed_timestamp.timestamp_micros(),
    })
}

pub(crate) fn build_timeline(artifacts: &[LogArtifact]) -> Timeline {
    let mut records = Vec::new();
    let mut skipped_lines = 0;
    for artifact in artifacts {
        for line in String::from_utf8_lossy(&artifact.content).lines() {
            match parse_timeline_line(line) {
                Some(record) => records.push(record),
                None => skipped_lines += 1,
            }
        }
    }
    records.sort_by_key(|record| record.sort_key);
    Timeline {
        records,
        skipped_lines,
    }
}

pub(crate) fn write_archive(
    output: &Path,
    artifacts: &[LogArtifact],
    timeline: &Timeline,
    diagnostics: &Value,
    raw_config: Option<&Value>,
) -> Result<(), AppError> {
    let file = std::fs::File::create(output)
        .map_err(|error| AppError::Io(format!("Failed to create archive: {error}")))?;
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let diagnostics = serde_json::to_vec_pretty(diagnostics)
        .map_err(|error| AppError::Io(format!("Failed to serialize diagnostics: {error}")))?;
    archive
        .start_file("diagnostics.json", options)
        .map_err(|error| AppError::Io(format!("Failed to add diagnostics.json: {error}")))?;
    archive
        .write_all(&diagnostics)
        .map_err(|error| AppError::Io(format!("Failed to write diagnostics.json: {error}")))?;

    archive
        .start_file("timeline.jsonl", options)
        .map_err(|error| AppError::Io(format!("Failed to add timeline.jsonl: {error}")))?;
    for record in &timeline.records {
        serde_json::to_writer(&mut archive, record)
            .map_err(|error| AppError::Io(format!("Failed to serialize timeline: {error}")))?;
        archive
            .write_all(b"\n")
            .map_err(|error| AppError::Io(format!("Failed to write timeline.jsonl: {error}")))?;
    }

    for artifact in artifacts {
        archive
            .start_file(&artifact.zip_path, options)
            .map_err(|error| {
                AppError::Io(format!(
                    "Failed to add {}: {error}",
                    artifact.path.display()
                ))
            })?;
        archive.write_all(&artifact.content).map_err(|error| {
            AppError::Io(format!(
                "Failed to write {}: {error}",
                artifact.path.display()
            ))
        })?;
    }

    if let Some(config) = raw_config {
        let config = serde_json::to_vec_pretty(&sanitize_config_snapshot(config))
            .map_err(|error| AppError::Io(format!("Failed to sanitize config: {error}")))?;
        archive
            .start_file("config.json", options)
            .map_err(|error| AppError::Io(format!("Failed to add config.json: {error}")))?;
        archive
            .write_all(&config)
            .map_err(|error| AppError::Io(format!("Failed to write config.json: {error}")))?;
    }

    archive
        .finish()
        .map_err(|error| AppError::Io(format!("Failed to finalize archive: {error}")))?;
    Ok(())
}

fn redact_url(value: &str) -> String {
    let Ok(mut url) = url::Url::parse(value) else {
        return value.to_string();
    };
    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_query(None);
    url.set_fragment(None);
    url.to_string()
}

fn sanitize_value(key: &str, value: &Value) -> Value {
    let normalized = key.to_ascii_lowercase();
    if [
        "secret",
        "password",
        "passwd",
        "cookie",
        "authorization",
        "username",
        "token",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
    {
        return Value::String("[REDACTED]".to_string());
    }
    match value {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(child_key, child)| (child_key.clone(), sanitize_value(child_key, child)))
                .collect(),
        ),
        Value::Array(values) => Value::Array(
            values
                .iter()
                .map(|child| sanitize_value(key, child))
                .collect(),
        ),
        Value::String(value) => {
            if value.contains("://") {
                Value::String(redact_url(value))
            } else if normalized.contains("dir") || normalized.contains("path") {
                let home = dirs::home_dir()
                    .and_then(|path| path.to_str().map(ToString::to_string))
                    .unwrap_or_default();
                Value::String(value.replacen(&home, "~", 1))
            } else {
                Value::String(value.clone())
            }
        }
        value => value.clone(),
    }
}

pub(crate) fn sanitize_config_snapshot(raw: &Value) -> Value {
    sanitize_value("config", raw)
}

pub(crate) async fn runtime_snapshot(
    app: &tauri::AppHandle,
    raw_config: Option<&Value>,
    timeline: &Timeline,
) -> Value {
    let engine_pid = app
        .try_state::<crate::engine::EngineState>()
        .and_then(|state| {
            state.child.lock().ok().and_then(|child| {
                child
                    .as_ref()
                    .map(tauri_plugin_shell::process::CommandChild::pid)
            })
        });
    let supervisor = app
        .try_state::<EngineSupervisor>()
        .map(|state| state.snapshot());
    let (engine_version, global_stat, bt_session) =
        if let Some(state) = app.try_state::<Aria2State>() {
            let version =
                tokio::time::timeout(std::time::Duration::from_secs(2), state.0.get_version())
                    .await
                    .ok()
                    .and_then(Result::ok);
            let global =
                tokio::time::timeout(std::time::Duration::from_secs(2), state.0.get_global_stat())
                    .await
                    .ok()
                    .and_then(Result::ok);
            let bt = tokio::time::timeout(
                std::time::Duration::from_secs(2),
                state.0.get_bt_session_status(),
            )
            .await
            .ok()
            .and_then(Result::ok);
            (version, global, bt)
        } else {
            (None, None, None)
        };
    let config = raw_config.and_then(|value| value.get("preferences"));
    serde_json::json!({
        "schema_version": crate::log_policy::LOG_SCHEMA_VERSION,
        "exported_at": chrono::Local::now().to_rfc3339(),
        "run_id": crate::log_policy::run_id(),
        "application": {
            "name": app.package_info().name,
            "version": app.package_info().version.to_string(),
            "os": std::env::consts::OS,
            "os_version": os_info::get().version().to_string(),
            "arch": std::env::consts::ARCH,
            "locale": sys_locale::get_locale().unwrap_or_default(),
            "log_level": app.try_state::<crate::log_policy::LogLevelControl>()
                .map(|state| state.level().to_string())
                .unwrap_or_else(|| crate::read_log_level().to_string()),
        },
        "engine": {
            "pid": engine_pid,
            "log_level": config.and_then(|value| value.get("aria2LogLevel")).and_then(Value::as_str),
            "version": engine_version,
            "global_stat": global_stat,
            "bt_session": bt_session,
            "supervisor": supervisor,
        },
        "rendering": {
            "webkit_dmabuf_disabled": std::env::var(crate::gpu_guard::WEBKIT_DISABLE_DMABUF_RENDERER).unwrap_or_default(),
            "webkit_compositing_disabled": std::env::var(crate::gpu_guard::WEBKIT_DISABLE_COMPOSITING_MODE).unwrap_or_default(),
            "hardware_acceleration_enabled": crate::gpu_guard::is_hardware_rendering_enabled(),
            "xdg_session_type": std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
        },
        "timeline": {
            "records": timeline.records.len(),
            "skipped_lines": timeline.skipped_lines,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn parses_application_and_engine_records_into_one_schema() {
        let app = parse_timeline_line(
            "2026-08-27T14:32:18.123456+08:00 INFO source=webview target=aria2.addTorrent run_id=run message=download_added gid=abc",
        )
        .expect("application record");
        let engine = parse_timeline_line(
            "2026-08-27T14:32:18.147000+08:00 INFO source=aria2 target=BtSession.cc:10 message=component=bittorrent event=task_attached gid=abc",
        )
        .expect("engine record");
        assert_eq!(app.attributes.get("gid").map(String::as_str), Some("abc"));
        assert_eq!(
            engine.attributes.get("event").map(String::as_str),
            Some("task_attached")
        );
    }

    #[test]
    fn writes_complete_redacted_archive_without_app_runtime() {
        let directory = tempfile::tempdir().expect("tempdir");
        let output = directory.path().join("diagnostics.zip");
        let artifacts = vec![LogArtifact {
            path: directory.path().join("motrix-next.log"),
            zip_path: "motrix-next/motrix-next.log".to_string(),
            content:
                b"2026-08-27T14:32:18.123456+08:00 INFO source=motrix target=test message=ready\n"
                    .to_vec(),
        }];
        let timeline = build_timeline(&artifacts);
        let diagnostics =
            serde_json::json!({"schema_version": crate::log_policy::LOG_SCHEMA_VERSION});
        let config = serde_json::json!({"preferences": {"rpcSecret": "private"}});

        write_archive(&output, &artifacts, &timeline, &diagnostics, Some(&config))
            .expect("archive");

        let file = std::fs::File::open(output).expect("archive file");
        let mut archive = zip::ZipArchive::new(file).expect("valid zip");
        assert!(archive.by_name("diagnostics.json").is_ok());
        assert!(archive.by_name("timeline.jsonl").is_ok());
        assert!(archive.by_name("motrix-next/motrix-next.log").is_ok());
        let mut config = String::new();
        archive
            .by_name("config.json")
            .expect("config")
            .read_to_string(&mut config)
            .expect("config text");
        assert!(config.contains("[REDACTED]"));
        assert!(!config.contains("private"));
    }
}
