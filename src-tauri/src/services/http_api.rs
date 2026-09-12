//! Extension HTTP API micro-service.
//!
//! Embeds an Axum HTTP server inside the Tauri process, sharing the existing
//! tokio runtime.  Provides a local REST API for browser extension → desktop
//! communication.
//!
use crate::commands::remote_file::summarize_url_for_log;
use crate::error::AppError;
use crate::services::config::{RuntimeConfigState, DEFAULT_EXTENSION_API_PORT};
use crate::services::port_guard;
use crate::services::tasks::TaskServiceState;
use axum::{
    extract::State,
    http::{header, HeaderMap, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

// ── Request / Response Types ────────────────────────────────────────

pub use super::downloads::contracts::{AddRequest, AddResponse};

/// GET /ping response.
#[derive(Debug, Serialize)]
pub struct PingResponse {
    pub status: String,
    pub version: String,
}

/// GET /version response.
#[derive(Debug, Serialize)]
pub struct VersionResponse {
    pub app: String,
    pub engine: String,
}

/// GET /stat response — mirrors aria2's getGlobalStat for the extension popup.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatResponse {
    pub download_speed: String,
    pub upload_speed: String,
    pub num_active: String,
    pub num_waiting: String,
    pub num_stopped: String,
    pub num_stopped_total: String,
}

/// Generic action response for control endpoints (pause-all, resume-all).
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct ActionResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ── Auth Extraction ─────────────────────────────────────────────────

/// Extract and validate the Bearer token from the Authorization header.
///
/// Returns `Ok(())` if:
/// - The server secret is empty (authentication disabled)
/// - The header matches `Bearer {secret}`
///
/// Returns `Err(StatusCode::UNAUTHORIZED)` otherwise.
pub fn validate_bearer_token(headers: &HeaderMap, expected_secret: &str) -> Result<(), StatusCode> {
    // Empty secret = auth disabled (matches aria2 behavior)
    if expected_secret.is_empty() {
        return Ok(());
    }

    let header_value = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let expected = format!("Bearer {expected_secret}");
    if header_value == expected {
        Ok(())
    } else {
        log::warn!("http_api: 401 Unauthorized (invalid or missing Bearer token)");
        Err(StatusCode::UNAUTHORIZED)
    }
}

// ── Axum State ──────────────────────────────────────────────────────

/// Shared state passed to Axum handlers via `State<Arc<ApiContext>>`.
pub struct ApiContext {
    pub app: AppHandle,
}

// ── Router Builder ──────────────────────────────────────────────────

/// Build the Axum router with all routes.
pub fn build_router(ctx: Arc<ApiContext>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_private_network(true);

    Router::new()
        .route("/ping", get(handle_ping))
        .route("/add", post(handle_add))
        .route("/downloads/capabilities", get(handle_download_capabilities))
        .route("/version", get(handle_version))
        .route("/stat", get(handle_stat))
        .route("/pause-all", post(handle_pause_all))
        .route("/resume-all", post(handle_resume_all))
        .layer(cors)
        .layer(axum::extract::DefaultBodyLimit::max(256 * 1024))
        .nest("/media/v1", super::media::routes::router())
        .with_state(ctx)
}

// ── Handlers ────────────────────────────────────────────────────────

async fn handle_ping(State(ctx): State<Arc<ApiContext>>) -> impl IntoResponse {
    let version = ctx.app.package_info().version.to_string();
    Json(PingResponse {
        status: "ok".to_string(),
        version,
    })
}

async fn handle_download_capabilities(
    State(ctx): State<Arc<ApiContext>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, StatusCode> {
    validate_bearer_token(&headers, &read_api_secret(&ctx.app))?;
    let engine = ctx
        .app
        .try_state::<TaskServiceState>()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let version = engine
        .0
        .get_version()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !version["downloadFeatures"]
        .as_array()
        .is_some_and(|features| {
            features
                .iter()
                .any(|feature| feature.as_str() == Some("filename-hints"))
        })
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    Ok(Json(
        serde_json::json!({"protocolVersion":2,"filenameHints":true}),
    ))
}

async fn handle_add(
    State(ctx): State<Arc<ApiContext>>,
    headers: HeaderMap,
    Json(body): Json<AddRequest>,
) -> Result<Json<AddResponse>, StatusCode> {
    let secret = read_api_secret(&ctx.app);
    validate_bearer_token(&headers, &secret)?;

    log::info!(
        "http_api: POST /add url={} final_url={} header_count={} has_user_agent={} has_cookie={} source=http-api filename={}",
        summarize_url_for_log(&body.url),
        body.final_url
            .as_deref()
            .map(summarize_url_for_log)
            .unwrap_or_else(|| "none".to_string()),
        body.request_headers.len(),
        body.user_agent.as_ref().is_some_and(|v| !v.is_empty()),
        body.cookie.as_ref().is_some_and(|v| !v.is_empty()),
        if body.filename.as_ref().is_some_and(|v| !v.is_empty()) {
            "present"
        } else {
            "none"
        },
    );

    super::downloads::dispatch(&ctx.app, body)
        .await
        .map(Json)
        .map_err(|error| {
            log::warn!("http_api: download handoff failed: {error}");
            match error {
                AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
                AppError::Conflict(_) => StatusCode::CONFLICT,
                _ => StatusCode::SERVICE_UNAVAILABLE,
            }
        })
}

async fn handle_version(State(ctx): State<Arc<ApiContext>>) -> impl IntoResponse {
    let app_version = ctx.app.package_info().version.to_string();

    let engine_status = if ctx.app.try_state::<TaskServiceState>().is_some() {
        "running"
    } else {
        "stopped"
    };

    Json(VersionResponse {
        app: app_version,
        engine: engine_status.to_string(),
    })
}

/// GET /stat — global download/upload statistics.
///
/// Returns the same shape as aria2's `getGlobalStat`, allowing the
/// extension popup to display speed and task counts without needing
/// a direct aria2 RPC connection.
async fn handle_stat(
    State(ctx): State<Arc<ApiContext>>,
    headers: HeaderMap,
) -> Result<Json<StatResponse>, StatusCode> {
    let secret = read_api_secret(&ctx.app);
    validate_bearer_token(&headers, &secret)?;

    let aria2 = ctx
        .app
        .try_state::<TaskServiceState>()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    match aria2.0.get_global_stat().await {
        Ok(stat) => Ok(Json(StatResponse {
            download_speed: stat.download_speed,
            upload_speed: stat.upload_speed,
            num_active: stat.num_active,
            num_waiting: stat.num_waiting,
            num_stopped: stat.num_stopped,
            num_stopped_total: stat.num_stopped_total,
        })),
        Err(e) => {
            log::error!("http_api: get_global_stat failed: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /pause-all — pause all active downloads.
async fn handle_pause_all(
    State(ctx): State<Arc<ApiContext>>,
    headers: HeaderMap,
) -> Result<Json<ActionResponse>, StatusCode> {
    let secret = read_api_secret(&ctx.app);
    validate_bearer_token(&headers, &secret)?;

    log::info!("http_api: POST /pause-all");

    let aria2 = match ctx.app.try_state::<TaskServiceState>() {
        Some(s) => s,
        None => {
            return Ok(Json(ActionResponse {
                status: "error".to_string(),
                error: Some("Engine not running".to_string()),
            }));
        }
    };

    match aria2.0.force_pause_all().await {
        Ok(_) => Ok(Json(ActionResponse {
            status: "ok".to_string(),
            error: None,
        })),
        Err(e) => Ok(Json(ActionResponse {
            status: "error".to_string(),
            error: Some(e.to_string()),
        })),
    }
}

/// POST /resume-all — resume all paused downloads.
async fn handle_resume_all(
    State(ctx): State<Arc<ApiContext>>,
    headers: HeaderMap,
) -> Result<Json<ActionResponse>, StatusCode> {
    let secret = read_api_secret(&ctx.app);
    validate_bearer_token(&headers, &secret)?;

    log::info!("http_api: POST /resume-all");

    let aria2 = match ctx.app.try_state::<TaskServiceState>() {
        Some(s) => s,
        None => {
            return Ok(Json(ActionResponse {
                status: "error".to_string(),
                error: Some("Engine not running".to_string()),
            }));
        }
    };

    match aria2.0.resume_eligible().await {
        Ok(result) => {
            log::info!(
                "http_api: POST /resume-all resumed={} blocked={}",
                result.resumed,
                result.blocked
            );
            Ok(Json(ActionResponse {
                status: "ok".to_string(),
                error: None,
            }))
        }
        Err(e) => Ok(Json(ActionResponse {
            status: "error".to_string(),
            error: Some(e.to_string()),
        })),
    }
}

// ── Helper Functions ────────────────────────────────────────────────

/// Reads the `extensionApiSecret` for HTTP API authentication.
/// This secret is fully independent from `rpcSecret` (used for aria2 RPC).
/// Returns empty string if not configured (auth disabled).
pub(crate) fn read_api_secret(app: &AppHandle) -> String {
    app.store("config.json")
        .ok()
        .and_then(|s| s.get("preferences"))
        .and_then(|p| {
            p.get("extensionApiSecret")
                .and_then(|v| v.as_str().map(String::from))
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_default()
}

// ── Server Lifecycle ────────────────────────────────────────────────

/// Handle for a running HTTP API server.  Allows graceful shutdown.
pub struct HttpApiHandle {
    shutdown_tx: tokio::sync::oneshot::Sender<()>,
    join_handle: tokio::task::JoinHandle<()>,
    port: u16,
    allow_remote_access: bool,
}

impl HttpApiHandle {
    /// The port this server is currently bound to.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Whether this server is bound to all network interfaces.
    pub fn allow_remote_access(&self) -> bool {
        self.allow_remote_access
    }

    /// Signal the server to shut down and wait for it to finish.
    pub async fn stop(self) {
        let _ = self.shutdown_tx.send(());
        let _ = self.join_handle.await;
    }
}

/// Tauri managed state for the HTTP API server handle.
pub struct HttpApiState(pub Mutex<Option<HttpApiHandle>>);

impl HttpApiState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

/// Spawn the HTTP API server on the given port.
///
/// The server binds locally by default and runs until the returned
/// handle is stopped or the application exits.
pub async fn spawn_http_api(
    app: AppHandle,
    port: u16,
    allow_remote_access: bool,
) -> Result<HttpApiHandle, AppError> {
    let ctx = Arc::new(ApiContext { app });
    let router = build_router(ctx);

    let host = if allow_remote_access {
        [0, 0, 0, 0]
    } else {
        [127, 0, 0, 1]
    };
    let addr = std::net::SocketAddr::from((host, port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| AppError::Io(format!("Failed to bind HTTP API on port {port}: {e}")))?;

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let join_handle = tokio::spawn(async move {
        let graceful = axum::serve(listener, router).with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        });
        if let Err(e) = graceful.await {
            log::error!("http_api: server error: {e}");
        }
    });

    log::info!("http_api: listening on {addr}");

    Ok(HttpApiHandle {
        shutdown_tx,
        join_handle,
        port,
        allow_remote_access,
    })
}

/// Stop the current HTTP API server (if running) and respawn on `new_port`.
///
/// Used by:
/// - `on_engine_ready()` during startup (idempotent — skipped if already
///   bound to the correct port by the caller)
/// - `restart_http_api` command when the user changes the port at runtime
///
/// The old server is stopped *before* binding the new one because the old
/// and new port may be identical (user changed and reverted), so the
/// listener must be released first.
pub async fn restart_on_port(app: &AppHandle, new_port: u16) -> Result<u16, AppError> {
    let api_state = app
        .try_state::<HttpApiState>()
        .ok_or_else(|| AppError::Engine("HttpApiState not managed".into()))?;

    let mut guard = api_state.0.lock().await;

    // Stop existing server (if any)
    if let Some(handle) = guard.take() {
        log::info!(
            "http_api: stopping server on port {} for rebind to {new_port}",
            handle.port()
        );
        handle.stop().await;
    }

    let allow_remote_access = read_extension_api_allow_remote_access(app).await;

    // Spawn on the new port, then recover once if the chosen port is busy.
    let handle = match spawn_http_api(app.clone(), new_port, allow_remote_access).await {
        Ok(handle) => handle,
        Err(e) => {
            log::warn!("http_api: bind failed on port {new_port}: {e}");
            let fallback = port_guard::recover_extension_api_port(app, new_port).await?;
            match spawn_http_api(app.clone(), fallback, allow_remote_access).await {
                Ok(handle) => handle,
                Err(e) => {
                    port_guard::emit_bind_failed(
                        app,
                        port_guard::PortKind::ExtensionApi,
                        fallback,
                        port_guard::PortSwitchFailureSource::ExtensionApi,
                    );
                    return Err(e);
                }
            }
        }
    };
    let port = handle.port();
    *guard = Some(handle);
    Ok(port)
}

// ── Read extension API port from RuntimeConfig ─────────────────────

/// Read the extension API port from RuntimeConfigState.
/// Falls back to store read, then to the default extension API port if neither is available.
pub async fn read_extension_api_port(app: &AppHandle) -> u16 {
    // Primary: RuntimeConfigState (cached, always in sync)
    if let Some(rc_state) = app.try_state::<RuntimeConfigState>() {
        return rc_state.0.read().await.extension_api_port;
    }
    // Fallback: direct store read (during early startup before state is managed)
    read_extension_api_port_from_store(app)
}

pub async fn read_extension_api_allow_remote_access(app: &AppHandle) -> bool {
    if let Some(rc_state) = app.try_state::<RuntimeConfigState>() {
        return rc_state.0.read().await.allow_remote_access;
    }
    read_extension_api_allow_remote_access_from_store(app)
}

/// Direct store read — used only as a fallback during early startup.
fn read_extension_api_port_from_store(app: &AppHandle) -> u16 {
    app.store("config.json")
        .ok()
        .and_then(|s| s.get("preferences"))
        .and_then(|p| {
            p.get("extensionApiPort").and_then(|v| {
                v.as_u64()
                    .map(|n| n as u16)
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
        })
        .unwrap_or(DEFAULT_EXTENSION_API_PORT)
}

fn read_extension_api_allow_remote_access_from_store(app: &AppHandle) -> bool {
    app.store("config.json")
        .ok()
        .and_then(|s| s.get("preferences"))
        .and_then(|p| {
            p.get("allowRemoteAccess")
                .and_then(serde_json::Value::as_bool)
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    // ── validate_bearer_token ───────────────────────────────────────

    #[test]
    fn auth_accepts_correct_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            HeaderValue::from_static("Bearer my-secret"),
        );
        assert!(validate_bearer_token(&headers, "my-secret").is_ok());
    }

    #[test]
    fn auth_rejects_wrong_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            HeaderValue::from_static("Bearer wrong-secret"),
        );
        assert_eq!(
            validate_bearer_token(&headers, "my-secret"),
            Err(StatusCode::UNAUTHORIZED)
        );
    }

    #[test]
    fn auth_rejects_missing_header() {
        let headers = HeaderMap::new();
        assert_eq!(
            validate_bearer_token(&headers, "my-secret"),
            Err(StatusCode::UNAUTHORIZED)
        );
    }

    #[test]
    fn auth_rejects_non_bearer_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Basic my-secret"));
        assert_eq!(
            validate_bearer_token(&headers, "my-secret"),
            Err(StatusCode::UNAUTHORIZED)
        );
    }

    #[test]
    fn auth_allows_any_request_when_secret_is_empty() {
        let headers = HeaderMap::new();
        assert!(validate_bearer_token(&headers, "").is_ok());
    }

    #[test]
    fn auth_allows_with_header_when_secret_is_empty() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer anything"));
        assert!(validate_bearer_token(&headers, "").is_ok());
    }
}
