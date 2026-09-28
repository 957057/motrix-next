//! Linux WebKitGTK GPU rendering guard.
//!
//! WebKitGTK hardware rendering can crash on some GPU, driver, and Wayland
//! compositor combinations. Use WebKitGTK defaults unless the user explicitly
//! enables the software fallback. External environment overrides remain owned
//! by the launching environment.

#[cfg(target_os = "linux")]
use std::io::Write;

#[cfg(target_os = "linux")]
const SELF_SET_MARKER: &str = "_DESKTOP_WEBKIT_RENDERING_SELF_SET";

pub const WEBKIT_DISABLE_DMABUF_RENDERER: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";

pub const WEBKIT_DISABLE_COMPOSITING_MODE: &str = "WEBKIT_DISABLE_COMPOSITING_MODE";

#[cfg(target_os = "linux")]
fn data_dir() -> Option<std::path::PathBuf> {
    dirs::data_dir().map(|d| d.join(crate::APP_ID))
}

#[cfg(target_os = "linux")]
fn guard_log(message: &str) {
    eprintln!("[rayburst] {message}");
    if let Some(dir) = data_dir() {
        let log_dir = dir.join("logs");
        let _ = std::fs::create_dir_all(&log_dir);
        let log_path = log_dir.join("rayburst.log");
        let timestamp = chrono::Local::now().format("%Y-%m-%d][%H:%M:%S");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "[{timestamp}][INFO][gpu_guard] {message}");
        }
    }
}

#[cfg(any(target_os = "linux", test))]
fn read_software_rendering_from_config(data_dir: &std::path::Path) -> bool {
    (|| -> Option<bool> {
        let path = data_dir.join("config.json");
        let content = std::fs::read_to_string(path).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;
        json.get("preferences")?.get("softwareRendering")?.as_bool()
    })()
    .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn disable_webkit_hardware_rendering_with_marker() {
    unsafe {
        std::env::set_var(WEBKIT_DISABLE_DMABUF_RENDERER, "1");
        std::env::set_var(WEBKIT_DISABLE_COMPOSITING_MODE, "1");
        std::env::set_var(SELF_SET_MARKER, "1");
    }
}

#[cfg(any(target_os = "linux", test))]
fn env_truthy(name: &str) -> bool {
    std::env::var(name)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
pub fn pre_flight() -> bool {
    if std::env::var(SELF_SET_MARKER).is_ok() {
        unsafe {
            std::env::remove_var(SELF_SET_MARKER);
            std::env::remove_var(WEBKIT_DISABLE_DMABUF_RENDERER);
            std::env::remove_var(WEBKIT_DISABLE_COMPOSITING_MODE);
        }
        guard_log("gpu_guard: cleared inherited env vars from relaunch");
    } else if std::env::var(WEBKIT_DISABLE_DMABUF_RENDERER).is_ok()
        || std::env::var(WEBKIT_DISABLE_COMPOSITING_MODE).is_ok()
    {
        let dmabuf_disabled = env_truthy(WEBKIT_DISABLE_DMABUF_RENDERER);
        let compositing_disabled = env_truthy(WEBKIT_DISABLE_COMPOSITING_MODE);
        guard_log(&format!(
            "gpu_guard: external WebKitGTK rendering override dmabuf_disabled={dmabuf_disabled} compositing_disabled={compositing_disabled}"
        ));
        return dmabuf_disabled || compositing_disabled;
    }

    if data_dir().is_some_and(|dir| read_software_rendering_from_config(&dir)) {
        disable_webkit_hardware_rendering_with_marker();
        guard_log("gpu_guard: explicit software rendering fallback");
        true
    } else {
        guard_log("gpu_guard: using WebKitGTK rendering defaults");
        false
    }
}

#[cfg(not(target_os = "linux"))]
pub fn pre_flight() -> bool {
    false
}

pub fn is_hardware_rendering_enabled() -> bool {
    #[cfg(any(target_os = "linux", test))]
    {
        !env_truthy(WEBKIT_DISABLE_DMABUF_RENDERER) && !env_truthy(WEBKIT_DISABLE_COMPOSITING_MODE)
    }
    #[cfg(all(not(target_os = "linux"), not(test)))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn software_fallback_requires_an_explicit_current_setting() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!read_software_rendering_from_config(dir.path()));
        for (config, enabled) in [
            (r#"{"preferences":{"softwareRendering":true}}"#, true),
            (r#"{"preferences":{"softwareRendering":false}}"#, false),
            (r#"{"preferences":{}}"#, false),
            ("invalid", false),
        ] {
            std::fs::write(dir.path().join("config.json"), config).unwrap();
            assert_eq!(read_software_rendering_from_config(dir.path()), enabled);
        }
    }
}
