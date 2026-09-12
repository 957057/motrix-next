//! Native selection and queue transitions shared by every desktop entry point.
use super::contracts::Format;
use crate::{
    aria2::{client::Aria2Client, types::Aria2Task},
    error::AppError,
};
use serde_json::Value;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum StartMode {
    User,
    Browser,
    Automatic,
}

pub async fn start(
    engine: &Aria2Client,
    task: &Aria2Task,
    mut options: Value,
    mode: StartMode,
) -> Result<String, AppError> {
    let generation = engine.generation();
    if !options.is_object() {
        return Err(AppError::Aria2("Media options must be an object".into()));
    }
    let media = task
        .media
        .as_ref()
        .ok_or_else(|| AppError::Aria2("The task is not a media presentation".into()))?;
    if media.state == "awaiting-selection" && task.status != "paused" {
        return Err(AppError::Aria2("Media inspection is still pausing".into()));
    }
    if let Some(format) = options.get("media-format").and_then(Value::as_str) {
        let format = Format::parse(format).map_err(|error| AppError::Aria2(error.to_string()))?;
        let path = task
            .files
            .first()
            .ok_or_else(|| AppError::Aria2("Media output is unavailable".into()))?;
        let stem = std::path::Path::new(&path.path)
            .file_stem()
            .and_then(|name| name.to_str())
            .ok_or_else(|| AppError::Aria2("Media output filename is invalid".into()))?;
        options["out"] = format!("{stem}.{}", format.extension()).into();
    }
    options["media-pause-after-probe"] = "false".into();
    if task.status == "error" && mode == StartMode::User {
        engine.retry_media(&task.gid, options).await?;
    } else if task.status == "paused"
        && matches!(media.state.as_str(), "awaiting-selection" | "paused")
    {
        engine.change_option(&task.gid, options).await?;
        if engine.generation() != generation
            || (mode == StartMode::Automatic && !engine.tasks.is_automatic(&task.gid).await)
        {
            return Err(AppError::Aria2("Media selection was interrupted".into()));
        }
        engine.unpause(&task.gid).await?;
    }
    // Reconciliation may observe an already-started or completed task.
    engine.save_session().await?;
    Ok(task.gid.clone())
}
