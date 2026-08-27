use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, OnceLock};

use log::kv::{Key, Value, VisitSource};

pub(crate) const LOG_SCHEMA_VERSION: u32 = 1;
pub(crate) const MAX_LOG_FILE_SIZE: u64 = 10 * 1024 * 1024;
pub(crate) const MAX_LOG_FILES: usize = 3;
pub(crate) const MOTRIX_LOG_FILE: &str = "motrix-next.log";
pub(crate) const ARIA2_LOG_FILE: &str = "aria2-next.log";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LogSource {
    Motrix,
    Aria2,
}

pub(crate) fn managed_log_source(name: &str) -> Option<LogSource> {
    if name == MOTRIX_LOG_FILE || (name.starts_with("motrix-next_") && name.ends_with(".log")) {
        return Some(LogSource::Motrix);
    }
    if name == ARIA2_LOG_FILE
        || name
            .strip_prefix("aria2-next.")
            .and_then(|value| value.strip_suffix(".log"))
            .is_some_and(|value| {
                !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
            })
    {
        return Some(LogSource::Aria2);
    }
    None
}

pub(crate) fn is_managed_active_log_file(name: &str) -> bool {
    matches!(name, MOTRIX_LOG_FILE | ARIA2_LOG_FILE)
}

pub(crate) fn run_id() -> &'static str {
    static RUN_ID: OnceLock<String> = OnceLock::new();
    RUN_ID.get_or_init(|| {
        let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        format!("{timestamp:x}-{:x}", std::process::id())
    })
}

fn parse_level(value: &str) -> Option<log::LevelFilter> {
    match value {
        "error" => Some(log::LevelFilter::Error),
        "warn" => Some(log::LevelFilter::Warn),
        "info" => Some(log::LevelFilter::Info),
        "debug" => Some(log::LevelFilter::Debug),
        _ => None,
    }
}

fn encode_level(level: log::LevelFilter) -> u8 {
    match level {
        log::LevelFilter::Off => 0,
        log::LevelFilter::Error => 1,
        log::LevelFilter::Warn => 2,
        log::LevelFilter::Info => 3,
        log::LevelFilter::Debug | log::LevelFilter::Trace => 4,
    }
}

fn decode_level(level: u8) -> log::LevelFilter {
    match level {
        0 => log::LevelFilter::Off,
        1 => log::LevelFilter::Error,
        2 => log::LevelFilter::Warn,
        3 => log::LevelFilter::Info,
        _ => log::LevelFilter::Debug,
    }
}

#[derive(Clone)]
pub(crate) struct LogLevelControl(Arc<AtomicU8>);

impl LogLevelControl {
    pub(crate) fn new(level: log::LevelFilter) -> Self {
        Self(Arc::new(AtomicU8::new(encode_level(level))))
    }

    pub(crate) fn set(&self, value: &str) -> Result<log::LevelFilter, String> {
        let level =
            parse_level(value).ok_or_else(|| format!("Invalid Motrix Next log level: {value}"))?;
        self.0.store(encode_level(level), Ordering::Release);
        Ok(level)
    }

    pub(crate) fn level(&self) -> log::LevelFilter {
        decode_level(self.0.load(Ordering::Acquire))
    }

    pub(crate) fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
        if metadata.target().starts_with("tao") || metadata.target().starts_with("tracing") {
            return false;
        }
        metadata.level().to_level_filter() <= self.level()
    }
}

#[derive(Default)]
struct FieldCollector(BTreeMap<String, String>);

impl<'kvs> VisitSource<'kvs> for FieldCollector {
    fn visit_pair(&mut self, key: Key<'kvs>, value: Value<'kvs>) -> Result<(), log::kv::Error> {
        self.0.insert(key.to_string(), value.to_string());
        Ok(())
    }
}

fn sanitize_line(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            '\r' | '\n' => ' ',
            character if character.is_control() => ' ',
            character => character,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn encode_value(value: &str) -> String {
    let value = sanitize_line(value);
    if !value.is_empty()
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b':' | b'/' | b'@')
        })
    {
        value
    } else {
        serde_json::to_string(&value).unwrap_or_else(|_| "\"<invalid>\"".to_string())
    }
}

#[cfg(debug_assertions)]
pub(crate) fn format_engine_terminal_record(value: &str) -> String {
    let normalized = sanitize_line(value);
    let severity = ["trace", "debug", "info", "warning", "error", "critical"]
        .into_iter()
        .find(|level| normalized.contains(&format!("[{level}]")))
        .map(|level| match level {
            "trace" => "TRACE",
            "debug" => "DEBUG",
            "info" => "INFO",
            "warning" => "WARN",
            "error" | "critical" => "ERROR",
            _ => "INFO",
        })
        .unwrap_or("INFO");
    format!(
        "{} {severity} source=aria2 target=engine run_id={} message={}",
        chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.6f%:z"),
        run_id(),
        encode_value(&normalized)
    )
}

pub(crate) fn format_record(
    _formatted_message: &std::fmt::Arguments<'_>,
    record: &log::Record<'_>,
) -> String {
    let mut fields = FieldCollector::default();
    let _ = record.key_values().visit(&mut fields);
    let source = if record
        .target()
        .starts_with(tauri_plugin_log::WEBVIEW_TARGET)
    {
        "webview"
    } else {
        "motrix"
    };
    let target = fields
        .0
        .remove("target")
        .unwrap_or_else(|| record.target().to_string());
    let timestamp = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.6f%:z");
    let mut output = format!(
        "{timestamp} {} source={source} target={} run_id={} message={}",
        record.level().as_str(),
        encode_value(&target),
        run_id(),
        encode_value(&record.args().to_string())
    );
    for (key, value) in fields.0 {
        output.push(' ');
        output.push_str(&key);
        output.push('=');
        output.push_str(&encode_value(&value));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_log_source_accepts_current_and_rotated_files() {
        assert_eq!(
            managed_log_source("motrix-next.log"),
            Some(LogSource::Motrix)
        );
        assert_eq!(
            managed_log_source("motrix-next_2026-08-27_12-00-00.log"),
            Some(LogSource::Motrix)
        );
        assert_eq!(
            managed_log_source("aria2-next.2.log"),
            Some(LogSource::Aria2)
        );
        assert_eq!(managed_log_source("unrelated.log"), None);
    }

    #[test]
    fn dynamic_level_control_applies_immediately() {
        let control = LogLevelControl::new(log::LevelFilter::Warn);
        let debug = log::Metadata::builder()
            .level(log::Level::Debug)
            .target("app")
            .build();
        assert!(!control.enabled(&debug));
        control.set("debug").expect("valid level");
        assert!(control.enabled(&debug));
    }

    #[test]
    fn formatter_uses_record_message_without_plugin_field_suffix() {
        let record = log::Record::builder()
            .args(format_args!("app_started"))
            .level(log::Level::Info)
            .target("lifecycle")
            .build();
        let output = format_record(
            &format_args!("app_started event=app_started version=1.0.0"),
            &record,
        );
        assert!(output.contains("message=app_started"));
        assert!(!output.contains("message=app_started event="));
    }
}
