//! Extension media v1 wire contract. Native RPC strings never escape this boundary.
use crate::aria2::types::Aria2Task;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use url::Url;
use uuid::Uuid;

pub const LEASE_MS: i64 = 300_000;
pub const RECEIPT_MS: i64 = 86_400_000;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProbeRequest {
    pub id: Uuid,
    pub source: Source,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub url: String,
    pub kind: String,
    pub page_url: String,
    pub title: String,
    pub filename: String,
    pub mime: String,
    pub request_contexts: Vec<RequestContext>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RequestContext {
    pub url: String,
    pub captured_at: i64,
    pub headers: Vec<RequestHeader>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RequestHeader {
    pub name: String,
    pub value: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Selection {
    pub video_id: Option<String>,
    pub audio_id: Option<String>,
    pub subtitle_id: Option<String>,
    pub format: String,
    pub record_time_seconds: u32,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SubmitRequest {
    pub submission_id: Uuid,
    pub selection: Selection,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Track {
    pub id: String,
    pub r#type: String,
    pub language: String,
    pub codec: String,
    pub width: u64,
    pub height: u64,
    pub bandwidth: u64,
    pub frame_rate: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Presentation {
    pub kind: String,
    pub title: String,
    pub live: bool,
    pub duration_ms: Option<u64>,
    pub size: Option<u64>,
    pub tracks: Vec<Track>,
    pub formats: Vec<String>,
    pub defaults: Selection,
}

fn http_url(value: &str) -> Result<Url, &'static str> {
    if value.len() > 16_384 {
        return Err("unsupported_source");
    }
    let url = Url::parse(value).map_err(|_| "unsupported_source")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("unsupported_source");
    }
    Ok(url)
}

impl Source {
    pub fn validate(&self, now: i64) -> Result<(), &'static str> {
        http_url(&self.url)?;
        http_url(&self.page_url)?;
        if !matches!(self.kind.as_str(), "file" | "hls" | "dash")
            || self.title.encode_utf16().count() > 512
            || self.filename.encode_utf16().count() > 255
            || self.mime.len() > 128
            || self.request_contexts.len() > 8
        {
            return Err("unsupported_source");
        }
        let mut origins = std::collections::HashSet::new();
        for context in &self.request_contexts {
            let origin = http_url(&context.url)?.origin().ascii_serialization();
            if !origins.insert(origin)
                || context.headers.len() > 32
                || context.captured_at < now - LEASE_MS
                || context.captured_at > now + 30_000
            {
                return Err("source_expired");
            }
            let mut names = std::collections::HashSet::new();
            for field in &context.headers {
                let name = field.name.to_ascii_lowercase();
                if name.len() > 128
                    || field.value.len() > 8192
                    || !names.insert(name.clone())
                    || axum::http::HeaderName::from_bytes(name.as_bytes()).is_err()
                    || axum::http::HeaderValue::from_str(&field.value).is_err()
                    || matches!(
                        name.as_str(),
                        "host"
                            | "connection"
                            | "content-length"
                            | "transfer-encoding"
                            | "range"
                            | "if-range"
                            | "if-match"
                            | "if-none-match"
                            | "if-modified-since"
                            | "if-unmodified-since"
                            | "proxy-authorization"
                            | "proxy-connection"
                            | "upgrade"
                            | "te"
                            | "trailer"
                    )
                {
                    return Err("unsupported_source");
                }
            }
        }
        Ok(())
    }
}

fn number(value: &str) -> u64 {
    value.parse::<u64>().unwrap_or(0).min(9_007_199_254_740_991)
}

impl Presentation {
    pub fn from_task(task: &Aria2Task, format: &str) -> Result<Self, &'static str> {
        let title = task
            .files
            .first()
            .and_then(|f| f.path.rsplit(['/', '\\']).next())
            .unwrap_or("Media")
            .to_string();
        let media = task.media.as_ref().ok_or("unsupported_source")?;
        if !matches!(media.protocol.as_str(), "hls" | "dash") || media.tracks.len() > 256 {
            return Err("unsupported_source");
        }
        let selected = |kind: &str| {
            media
                .tracks
                .iter()
                .find(|t| t.r#type == kind && t.selected == "true")
                .map(|t| t.id.clone())
        };
        let muxed = selected("muxed");
        let value = Self {
            kind: media.protocol.clone(),
            title,
            live: media.live == "true",
            duration_ms: (number(&media.duration) > 0).then(|| number(&media.duration)),
            size: None,
            tracks: media
                .tracks
                .iter()
                .map(|t| Track {
                    id: t.id.clone(),
                    r#type: t.r#type.clone(),
                    language: t.language.clone(),
                    codec: t.codec.clone(),
                    width: number(&t.width),
                    height: number(&t.height),
                    bandwidth: number(&t.bandwidth),
                    frame_rate: 0.0,
                })
                .collect(),
            formats: vec!["mp4".into(), "mkv".into()],
            defaults: Selection {
                video_id: selected("video").or(muxed.clone()),
                audio_id: selected("audio").or(muxed),
                subtitle_id: selected("subtitle"),
                format: format.into(),
                record_time_seconds: 0,
            },
        };
        value.validate_selection(&value.defaults)?;
        Ok(value)
    }

    pub fn validate_selection(&self, value: &Selection) -> Result<(), &'static str> {
        let invalid = || Err("unsupported_selection");
        if !self.formats.contains(&value.format)
            || value.record_time_seconds > 31_536_000
            || (!self.live && value.record_time_seconds != 0)
        {
            return invalid();
        }
        if value.video_id.is_none() && value.audio_id.is_none() {
            return invalid();
        }
        for (id, kinds) in [
            (&value.video_id, &["video", "muxed"][..]),
            (&value.audio_id, &["audio", "muxed"][..]),
            (&value.subtitle_id, &["subtitle"][..]),
        ] {
            if let Some(id) = id {
                if !self
                    .tracks
                    .iter()
                    .any(|t| t.id == *id && kinds.contains(&t.r#type.as_str()))
                {
                    return invalid();
                }
            }
        }
        if let (Some(v), Some(a)) = (&value.video_id, &value.audio_id) {
            if v != a
                && self
                    .tracks
                    .iter()
                    .any(|t| (t.id == *v || t.id == *a) && t.r#type == "muxed")
            {
                return invalid();
            }
        }
        Ok(())
    }
}

impl Selection {
    pub fn options(&self) -> Value {
        json!({"media-format":self.format, "media-video":self.video_id.as_deref().unwrap_or("none"),
            "media-audio":self.audio_id.as_deref().unwrap_or("none"), "media-subtitles":self.subtitle_id.as_deref().unwrap_or("none"),
            "media-record-time":self.record_time_seconds.to_string(), "media-pause-after-probe":"false"})
    }
}
