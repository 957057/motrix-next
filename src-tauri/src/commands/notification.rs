use crate::error::AppError;
use crate::services::notification::send_app_notification;
use tauri::AppHandle;

#[tauri::command]
pub async fn send_app_system_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), AppError> {
    send_app_notification(&app, &title, &body).await
}
