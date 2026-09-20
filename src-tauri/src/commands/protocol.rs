//! Native protocol associations. The application activation scheme repairs itself;
//! public download schemes change only in response to an explicit user action.
use crate::error::AppError;
use tauri::AppHandle;

// ── macOS native implementation ─────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos {
    use objc2_app_kit::NSWorkspace;
    use objc2_foundation::{NSBundle, NSString, NSURL};

    /// Returns the bundle identifier of the app registered as the default
    /// handler for the given URL scheme, or `None` if no handler is set.
    pub fn get_default_handler_bundle_id(protocol: &str) -> Option<String> {
        let workspace = NSWorkspace::sharedWorkspace();
        let url_str = format!("{protocol}://test");
        let ns_url_str = NSString::from_str(&url_str);
        let test_url = NSURL::URLWithString(&ns_url_str)?;
        let handler_url = workspace.URLForApplicationToOpenURL(&test_url)?;
        let handler_bundle = NSBundle::bundleWithURL(&handler_url)?;
        let bundle_id = handler_bundle.bundleIdentifier()?;
        Some(bundle_id.to_string())
    }

    /// Registers this application as the default handler for the given URL
    /// scheme using `LSSetDefaultHandlerForURLScheme`.
    pub fn set_as_default_handler(protocol: &str, bundle_id: &str) -> Result<(), String> {
        use core_foundation::base::TCFType;
        use core_foundation::string::CFString;

        let scheme = CFString::new(protocol);
        let handler = CFString::new(bundle_id);

        let status = unsafe {
            core_foundation::base::OSStatus::from(LSSetDefaultHandlerForURLScheme(
                scheme.as_concrete_TypeRef(),
                handler.as_concrete_TypeRef(),
            ))
        };
        if status == 0 {
            Ok(())
        } else if status == -128 {
            // LaunchServices userCanceledErr is a normal dismissal.
            Err("cancelled".into())
        } else {
            Err(format!("LSSetDefaultHandlerForURLScheme returned {status}"))
        }
    }

    extern "C" {
        fn LSSetDefaultHandlerForURLScheme(
            scheme: core_foundation::string::CFStringRef,
            handler: core_foundation::string::CFStringRef,
        ) -> i32;
    }
}

// Query the effective Shell association, not an application-owned registry key.
#[cfg(windows)]
mod windows;

// ── Linux native associations ──────────────────────────────────────

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "linux")]
async fn with_linux_associations<T: Send + 'static>(
    app: &AppHandle,
    operation: impl FnOnce(&linux::Associations) -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    use tauri::Manager;

    let executable = match app.env().appimage {
        Some(path) => std::path::PathBuf::from(path),
        None => tauri::utils::platform::current_exe()?,
    };
    tokio::task::spawn_blocking(move || {
        // Serialize read/modify/write operations; GIO objects stay on this worker.
        static ACCESS: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _guard = ACCESS
            .lock()
            .map_err(|error| AppError::Protocol(error.to_string()))?;
        operation(&linux::Associations::new(&executable)?)
    })
    .await
    .map_err(|error| AppError::Protocol(error.to_string()))?
}

#[cfg(target_os = "linux")]
pub(crate) async fn protocol_diagnostics(app: &AppHandle) -> serde_json::Value {
    match with_linux_associations(app, |associations| Ok(associations.diagnostics())).await {
        Ok(snapshot) => snapshot,
        Err(error) => serde_json::json!({ "error": error.to_string() }),
    }
}

// ── Cross-platform Tauri commands ───────────────────────────────────

/// Returns `true` when this application is the OS-level default handler
/// for the given URL scheme (e.g. `"magnet"`, `"thunder"`).
#[tauri::command]
pub async fn is_default_protocol_client(
    app: AppHandle,
    protocol: String,
) -> Result<bool, AppError> {
    validate_protocol(&protocol)?;
    #[cfg(target_os = "macos")]
    {
        let handler_id = macos::get_default_handler_bundle_id(&protocol);
        let self_id = &app.config().identifier;
        match handler_id {
            Some(handler) => Ok(handler == *self_id),
            None => Ok(false),
        }
    }
    #[cfg(windows)]
    {
        let _ = &app;
        windows::is_default(&protocol)
    }
    #[cfg(target_os = "linux")]
    {
        with_linux_associations(&app, move |associations| associations.is_default(&protocol)).await
    }
}

/// Registers this application as the OS-level default handler for the
/// given URL scheme.
#[tauri::command]
pub async fn set_default_protocol_client(app: AppHandle, protocol: String) -> Result<(), AppError> {
    validate_protocol(&protocol)?;
    #[cfg(target_os = "macos")]
    {
        let bundle_id = &app.config().identifier;
        macos::set_as_default_handler(&protocol, bundle_id).map_err(AppError::Protocol)?;

        // Verify the registration actually took effect.
        let handler = macos::get_default_handler_bundle_id(&protocol);
        let registered = handler.as_deref() == Some(bundle_id.as_str());
        if registered {
            Ok(())
        } else {
            Err(AppError::Protocol(format!(
                "registration accepted but did not take effect (handler={handler:?}, expected={bundle_id})"
            )))
        }
    }
    #[cfg(windows)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        if protocol != "rayburst" {
            windows::register_candidate(&app, &protocol)?;
        }
        app.deep_link()
            .register(&protocol)
            .map_err(|error| AppError::Protocol(error.to_string()))?;
        if windows::is_default(&protocol)? {
            Ok(())
        } else {
            if protocol != "rayburst" {
                open_windows_defaults(&app)?;
            }
            Err(AppError::Protocol("manual_change_required".into()))
        }
    }
    #[cfg(target_os = "linux")]
    {
        with_linux_associations(&app, move |associations| {
            associations.set_enabled(&protocol, true)
        })
        .await
    }
}

/// Removes this application as the OS-level default handler for the
/// given URL scheme.
#[tauri::command]
pub async fn remove_as_default_protocol_client(
    app: AppHandle,
    protocol: String,
) -> Result<(), AppError> {
    validate_protocol(&protocol)?;
    if protocol == "rayburst" {
        return Err(AppError::Protocol(
            "The application activation protocol cannot be disabled".into(),
        ));
    }
    #[cfg(target_os = "macos")]
    {
        const MANUAL_CHANGE_REQUIRED: &str = "manual_change_required";
        let _ = (&app, &protocol);
        Err(AppError::Protocol(MANUAL_CHANGE_REQUIRED.into()))
    }
    #[cfg(windows)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        if app
            .deep_link()
            .is_registered(&protocol)
            .map_err(|error| AppError::Protocol(error.to_string()))?
        {
            app.deep_link()
                .unregister(&protocol)
                .map_err(|error| AppError::Protocol(error.to_string()))?;
        }
        if windows::is_default(&protocol)? {
            open_windows_defaults(&app)?;
            Err(AppError::Protocol("manual_change_required".into()))
        } else {
            Ok(())
        }
    }
    #[cfg(target_os = "linux")]
    {
        with_linux_associations(&app, move |associations| {
            associations.set_enabled(&protocol, false)
        })
        .await
    }
}

fn validate_protocol(protocol: &str) -> Result<(), AppError> {
    if matches!(protocol, "rayburst" | "magnet" | "ed2k" | "thunder") {
        Ok(())
    } else {
        Err(AppError::Protocol("Unsupported protocol".into()))
    }
}

pub(crate) fn repair_activation_protocol(app: &AppHandle) {
    #[cfg(any(windows, target_os = "linux"))]
    {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let result = async {
                match is_default_protocol_client(app.clone(), "rayburst".into()).await {
                    Ok(true) => return Ok(()),
                    Ok(false) => {}
                    Err(error) => log::warn!("protocol:activation-query-failed error={error}"),
                }
                // A broken association can fail the query itself. Registration
                // remains idempotent and its result is verified by the Shell.
                set_default_protocol_client(app.clone(), "rayburst".into()).await?;
                log::info!("protocol:activation-repaired");
                Ok::<_, AppError>(())
            }
            .await;
            if let Err(error) = result {
                log::warn!("protocol:activation-repair-failed error={error}");
            }
        });
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    let _ = app;
}

#[cfg(windows)]
pub(crate) async fn protocol_diagnostics(_app: &AppHandle) -> serde_json::Value {
    let mut protocols = serde_json::Map::new();
    for scheme in ["rayburst", "magnet", "ed2k", "thunder"] {
        let snapshot = match windows::handler(scheme) {
            Ok(handler) => serde_json::json!({
                "handler": handler,
                "currentApplication": windows::is_default(scheme).ok(),
            }),
            Err(error) => serde_json::json!({ "error": error.to_string() }),
        };
        protocols.insert(scheme.into(), snapshot);
    }
    serde_json::Value::Object(protocols)
}

#[cfg(windows)]
fn open_windows_defaults(app: &AppHandle) -> Result<(), AppError> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("ms-settings:defaultapps", None::<String>)
        .map_err(|error| AppError::Protocol(error.to_string()))
}
