//! Recoverable, no-replace renaming of completed single-file downloads.
use super::{Database, HistoryRecord};
use crate::error::AppError;
use rusqlite::{params, Connection};
use std::path::Path;

fn rename_exclusive(from: &Path, to: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
        // SAFETY: Terminated path buffers outlive the call. MoveFileW never replaces a destination.
        if unsafe { windows_sys::Win32::Storage::FileSystem::MoveFileW(from.as_ptr(), to.as_ptr()) }
            == 0
        {
            return Err(std::io::Error::last_os_error());
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let from = std::ffi::CString::new(from.as_os_str().as_bytes())?;
        let to = std::ffi::CString::new(to.as_os_str().as_bytes())?;
        // SAFETY: Valid terminated paths; native exclusive rename keeps existing files intact.
        #[cfg(target_os = "linux")]
        let result = unsafe {
            libc::renameat2(
                libc::AT_FDCWD,
                from.as_ptr(),
                libc::AT_FDCWD,
                to.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        };
        #[cfg(target_os = "macos")]
        let result = unsafe { libc::renamex_np(from.as_ptr(), to.as_ptr(), libc::RENAME_EXCL) };
        if result != 0 {
            return Err(std::io::Error::last_os_error());
        }
    }
    Ok(())
}

fn finish(conn: &mut Connection, gid: &str, path: &str, name: &str) -> Result<(), AppError> {
    let transaction = conn.transaction()?;
    transaction.execute(
        "UPDATE download_history SET name=?2,meta=json_set(meta,'$.files[0].path',?3) WHERE gid=?1",
        params![gid, name, path],
    )?;
    transaction.execute("DELETE FROM file_renames WHERE gid=?1", [gid])?;
    transaction.commit()?;
    Ok(())
}

impl Database {
    pub(super) fn recover_file_renames(conn: &mut Connection) -> Result<(), AppError> {
        let pending = conn
            .prepare("SELECT gid,old_path,new_path,name FROM file_renames")?
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        for (gid, old, new, name) in pending {
            if !Path::new(&old).exists() && Path::new(&new).is_file() {
                finish(conn, &gid, &new, &name)?;
            } else if Path::new(&old).is_file() {
                conn.execute("DELETE FROM file_renames WHERE gid=?1", [&gid])?;
            }
        }
        Ok(())
    }

    pub async fn rename_completed_file(&self, gid: &str, name: &str) -> Result<(), AppError> {
        crate::services::downloads::validate_filename(name)?;
        if name.is_empty() {
            return Err(AppError::InvalidInput("Enter a filename".into()));
        }
        let mut conn = self.connection().await?;
        Self::recover_file_renames(&mut conn)?;
        let record: HistoryRecord = conn.query_row(
            "SELECT * FROM download_history WHERE gid=?1",
            [gid],
            Self::row_to_record,
        )?;
        let meta: serde_json::Value = serde_json::from_str(record.meta.as_deref().unwrap_or("{}"))?;
        let files = meta["files"]
            .as_array()
            .filter(|files| files.len() == 1)
            .ok_or_else(|| {
                AppError::InvalidInput(
                    "Rename is available for completed single-file downloads".into(),
                )
            })?;
        let old = files[0]["path"]
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("The download has no file path".into()))?;
        let source = Path::new(old);
        if record.status != "complete"
            || !source.is_absolute()
            || !std::fs::symlink_metadata(source)?.is_file()
        {
            return Err(AppError::InvalidInput(
                "Only completed regular files can be renamed".into(),
            ));
        }
        let target = source.with_file_name(name);
        if target == source {
            return Ok(());
        }
        let new = target
            .to_str()
            .ok_or_else(|| AppError::InvalidInput("Invalid output path".into()))?;
        conn.execute(
            "INSERT INTO file_renames(gid,old_path,new_path,name) VALUES (?1,?2,?3,?4)",
            params![gid, old, new, name],
        )?;
        if let Err(error) = rename_exclusive(source, &target) {
            conn.execute("DELETE FROM file_renames WHERE gid=?1", [gid])?;
            return Err(error.into());
        }
        finish(&mut conn, gid, new, name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn rename_preserves_collisions_and_recovers_after_filesystem_commit() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("original.bin");
        let target = directory.path().join("renamed.bin");
        std::fs::write(&source, b"original bytes").unwrap();
        std::fs::write(&target, b"another file").unwrap();
        assert!(rename_exclusive(&source, &target).is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"another file");
        std::fs::remove_file(&target).unwrap();
        let db = Database::open(&directory.path().join("history.db")).unwrap();
        db.add_record(&HistoryRecord {
            id: None,
            gid: "task".into(),
            name: "original.bin".into(),
            uri: None,
            dir: None,
            total_length: Some(14),
            status: "complete".into(),
            task_type: Some("uri".into()),
            added_at: None,
            created_at: None,
            completed_at: None,
            meta: Some(serde_json::json!({"files":[{"path":source}]}).to_string()),
        })
        .await
        .unwrap();
        {
            let mut conn = db.connection().await.unwrap();
            conn.execute(
                "INSERT INTO file_renames VALUES ('task',?1,?2,'renamed.bin')",
                params![source.to_str(), target.to_str()],
            )
            .unwrap();
            rename_exclusive(&source, &target).unwrap();
            Database::recover_file_renames(&mut conn).unwrap();
        }
        let record = db.get_record("task").await.unwrap().unwrap();
        assert_eq!(record.name, "renamed.bin");
        assert_eq!(std::fs::read(&target).unwrap(), b"original bytes");
    }
}
