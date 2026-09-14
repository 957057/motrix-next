//! A single SQLite snapshot owns task ordering, page bounds and global counts.
//! Only records on the requested page cross IPC; transfer ticks never load history.
use super::{Database, HistoryRecord};
use crate::{aria2::types::Aria2Task, error::AppError};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

const QUERY: &str = include_str!("task_query.sql");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskQueryInput {
    pub scope: String,
    pub query: String,
    pub page: u32,
    pub page_size: u32,
    pub sort_field: String,
    pub direction: String,
    pub manual_order: Vec<String>,
}

#[derive(Debug, Default, Serialize)]
pub struct TaskCounts {
    pub all: i64,
    pub progress: i64,
    pub failed: i64,
    pub completed: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskQueryPage {
    pub generation: u64,
    pub sequence: u64,
    pub tasks: Vec<Aria2Task>,
    pub history: Vec<HistoryRecord>,
    pub gids: Vec<String>,
    pub counts: TaskCounts,
    pub total: i64,
    pub page: u32,
    pub selections: Vec<Value>,
}

fn live(task: &Aria2Task) -> bool {
    matches!(task.status.as_str(), "active" | "waiting" | "paused")
}

fn name(task: &Aria2Task) -> String {
    if let Some(bt) = &task.bittorrent {
        if let Some(info) = &bt.info {
            if !info.name.is_empty() {
                return info.name.clone();
            }
        }
        if let Some(link) = &bt.magnet_link {
            if let Ok(url) = url::Url::parse(link) {
                if let Some((_, value)) = url.query_pairs().find(|(key, _)| key == "dn") {
                    return value.into_owned();
                }
            }
        }
    }
    task.files
        .iter()
        .find_map(|file| {
            file.path
                .rsplit(['/', '\\'])
                .next()
                .filter(|name| !name.is_empty())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| task.gid.clone())
}

impl Database {
    pub async fn query_tasks(
        &self,
        tasks: Vec<Aria2Task>,
        input: TaskQueryInput,
    ) -> Result<TaskQueryPage, AppError> {
        self.with_connection(move |conn| Self::query_task_page(conn, tasks, input))
            .await
    }
    fn query_task_page(
        conn: &mut rusqlite::Connection,
        mut tasks: Vec<Aria2Task>,
        input: TaskQueryInput,
    ) -> Result<TaskQueryPage, AppError> {
        let scope = match input.scope.as_str() {
            "all" => "1",
            "progress" => "live",
            "failed" => "attention",
            "completed" => "status='complete'",
            _ => return Err(AppError::InvalidInput("Unknown task scope".into())),
        };
        let column = match input.sort_field.as_str() {
            "manual" => "COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(?3) WHERE value=combined.gid), 2147483647)",
            "added-at" => "added_at",
            "completed-at" => "completed_at",
            "name" => "name COLLATE NOCASE",
            "size" => "size",
            "speed" => "speed",
            "progress" => "progress",
            _ => return Err(AppError::InvalidInput("Unknown task sort field".into())),
        };
        let direction = match input.direction.as_str() {
            "asc" => "ASC",
            "desc" => "DESC",
            _ => return Err(AppError::InvalidInput("Unknown task sort direction".into())),
        };
        let direction = if input.sort_field == "manual" {
            "ASC"
        } else {
            direction
        };
        tasks.retain(|task| {
            let search = task
                .ed2k
                .as_ref()
                .is_some_and(|ed2k| ed2k.search_active == Some(true))
                || task
                    .files
                    .iter()
                    .any(|file| file.path.contains("aria2-next-ed2k-search-"));
            let metadata = task.bittorrent.as_ref().is_some_and(|bt| {
                bt.info.is_none()
                    && matches!(bt.state.as_deref(), Some("adding" | "downloadingMetadata"))
            });
            task.status != "removed" && !search && (live(task) || !metadata)
        });
        let mut selections = Vec::new();
        let rows = tasks.iter().map(|task| {
            let bt_selection = task.bittorrent.as_ref().is_some_and(|bt| bt.file_selection_state.as_deref() == Some("awaiting"));
            let media_selection = !task.selection_managed && matches!(task.status.as_str(), "paused" | "error") && task.media.as_ref().is_some_and(|media| media.state != "finalizing");
            let media_waiting = task.media.as_ref().is_some_and(|media| media.state == "awaiting-selection");
            if bt_selection || media_selection {
                selections.push(json!({ "gid": task.gid, "kind": if bt_selection { "bt" } else { "media" }, "waiting": bt_selection || media_waiting }));
            }
            let bt_error = task.bittorrent.as_ref().is_some_and(|bt| bt.error.is_some() || bt.state.as_deref() == Some("error"));
            json!({
                "gid": task.gid, "status": task.status, "name": name(task), "live": live(task),
                "attention": task.status == "error" || bt_selection || media_waiting || bt_error,
                "infoHash": task.info_hash,
                "ed2k": task.ed2k.as_ref().map(|ed2k| json!({ "hash": ed2k.hash, "ed2kLink": ed2k.ed2k_link })),
                "totalLength": task.total_length, "completedLength": task.completed_length,
                "downloadSpeed": task.download_speed,
                "media": task.media.as_ref().map(|media| json!({ "progress": media.progress })),
            })
        }).collect::<Vec<_>>();
        let engine = serde_json::to_string(&rows)?;
        let order = serde_json::to_string(&input.manual_order)?;
        let tx = conn.transaction()?;
        let counts = tx.query_row(&format!("{QUERY} SELECT COUNT(*), COALESCE(SUM(live), 0), COALESCE(SUM(attention), 0), COALESCE(SUM(status='complete'), 0) FROM combined"), [&engine], |row| Ok(TaskCounts { all: row.get(0)?, progress: row.get(1)?, failed: row.get(2)?, completed: row.get(3)? }))?;
        let filter = format!("WHERE ({scope}) AND instr(lower(name), lower(?2)) > 0");
        let total: i64 = tx.query_row(
            &format!("{QUERY} SELECT COUNT(*) FROM combined {filter}"),
            params![engine, input.query.trim()],
            |row| row.get(0),
        )?;
        let size = input.page_size.clamp(1, 100);
        let max_page = (total as u64)
            .div_ceil(u64::from(size))
            .max(1)
            .min(u64::from(u32::MAX)) as u32;
        let page = input.page.clamp(1, max_page);
        let offset = u64::from(page - 1) * u64::from(size);
        // ?3 is present for every sort so the parameter contract stays constant.
        let gids = tx.prepare(&format!("{QUERY} SELECT gid FROM combined {filter} AND json_valid(?3) ORDER BY {column} {direction}, added_at DESC, gid ASC LIMIT ?4 OFFSET ?5"))?.query_map(params![engine, input.query.trim(), order, size, offset], |row| row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
        let history = tx
            .prepare(
                "SELECT * FROM download_history WHERE gid IN (SELECT value FROM json_each(?1))",
            )?
            .query_map([serde_json::to_string(&gids)?], Self::row_to_record)?
            .collect::<Result<Vec<_>, _>>()?;
        tx.commit()?;
        let selected: HashSet<_> = gids.iter().collect();
        tasks.retain(|task| selected.contains(&task.gid));
        Ok(TaskQueryPage {
            generation: 0,
            sequence: 0,
            tasks,
            history,
            gids,
            counts,
            total,
            page,
            selections,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aria2::types::{Aria2BtInfo, Aria2BtName, Aria2File};

    fn input(scope: &str) -> TaskQueryInput {
        TaskQueryInput {
            scope: scope.into(),
            query: String::new(),
            page: 1,
            page_size: 20,
            sort_field: "added-at".into(),
            direction: "desc".into(),
            manual_order: vec![],
        }
    }
    fn task(gid: &str) -> Aria2Task {
        Aria2Task {
            gid: gid.into(),
            status: "active".into(),
            total_length: "100".into(),
            completed_length: "25".into(),
            files: vec![Aria2File {
                path: format!("/downloads/{gid}.zip"),
                ..Default::default()
            }],
            ..Default::default()
        }
    }
    fn record(gid: &str) -> HistoryRecord {
        HistoryRecord {
            id: None,
            gid: gid.into(),
            name: format!("{gid}.zip"),
            uri: None,
            dir: Some("/downloads".into()),
            total_length: Some(100),
            status: "complete".into(),
            task_type: Some("uri".into()),
            added_at: Some("2026-09-13T00:00:00Z".into()),
            created_at: None,
            completed_at: Some("2026-09-13T00:01:00Z".into()),
            meta: None,
        }
    }
    #[tokio::test]
    async fn large_history_remains_page_bounded_with_live_tasks() {
        let db = Database::open_in_memory().unwrap();
        {
            let mut conn = db.connection().await.unwrap();
            let tx = conn.transaction().unwrap();
            for index in 0..5000 {
                tx.execute("INSERT INTO download_history (gid, name, status, completed_at) VALUES (?1, ?1, 'complete', '2026-01-01')", [format!("history-{index}")]).unwrap();
            }
            tx.commit().unwrap();
        }
        let started = std::time::Instant::now();
        let page = db
            .query_tasks(
                (0..20).map(|i| task(&format!("live-{i}"))).collect(),
                input("all"),
            )
            .await
            .unwrap();
        assert_eq!(page.total, 5020);
        assert_eq!(page.gids.len(), 20);
        assert!(page.history.len() <= 20);
        eprintln!("large history query: {:?}", started.elapsed());
    }
    #[tokio::test]
    async fn pagination_materializes_only_one_page_and_counts_every_record() {
        let db = Database::open_in_memory().unwrap();
        for index in 0..103 {
            db.add_record(&record(&format!("history-{index:03}")))
                .await
                .unwrap();
        }
        let mut query = input("all");
        query.page = 99;
        let page = db.query_tasks(vec![task("live")], query).await.unwrap();
        assert_eq!(page.total, 104);
        assert_eq!(page.counts.all, 104);
        assert_eq!(page.counts.progress, 1);
        assert_eq!(page.counts.completed, 103);
        assert_eq!(page.page, 6);
        assert_eq!(page.gids.len(), 4);
        assert!(page.history.len() <= 4);
    }
    #[tokio::test]
    async fn pending_selection_is_live_and_needs_attention() {
        let db = Database::open_in_memory().unwrap();
        let mut pending = task("select");
        pending.status = "paused".into();
        pending.bittorrent = Some(Aria2BtInfo {
            info: Some(Aria2BtName {
                name: "Ubuntu".into(),
            }),
            file_selection_state: Some("awaiting".into()),
            ..Default::default()
        });
        let page = db
            .query_tasks(vec![pending], input("failed"))
            .await
            .unwrap();
        assert_eq!(page.gids, ["select"]);
        assert_eq!(page.counts.progress, 1);
        assert_eq!(page.counts.failed, 1);
        assert_eq!(page.selections[0]["waiting"], true);
    }
    #[tokio::test]
    async fn live_protocol_identity_wins_over_history_and_engine_results() {
        let db = Database::open_in_memory().unwrap();
        let mut archived = record("old");
        archived.meta = Some(r#"{"infoHash":"abc"}"#.into());
        db.add_record(&archived).await.unwrap();
        let mut current = task("current");
        current.info_hash = Some("abc".into());
        let mut stopped = task("stopped");
        stopped.info_hash = Some("abc".into());
        stopped.status = "complete".into();
        let page = db
            .query_tasks(vec![stopped, current], input("all"))
            .await
            .unwrap();
        assert_eq!(page.gids, ["current"]);
        assert_eq!(page.counts.all, 1);
        assert!(page.history.is_empty());
    }
    #[tokio::test]
    async fn search_is_literal_and_does_not_change_navigation_counts() {
        let db = Database::open_in_memory().unwrap();
        db.add_record(&record("100%_done")).await.unwrap();
        db.add_record(&record("other")).await.unwrap();
        let mut query = input("completed");
        query.query = "%_".into();
        let page = db.query_tasks(vec![], query).await.unwrap();
        assert_eq!(page.gids, ["100%_done"]);
        assert_eq!(page.total, 1);
        assert_eq!(page.counts.completed, 2);
    }
    #[tokio::test]
    async fn manual_order_and_ties_are_stable() {
        let db = Database::open_in_memory().unwrap();
        let mut query = input("all");
        query.sort_field = "manual".into();
        query.manual_order = vec!["b".into(), "a".into()];
        let page = db
            .query_tasks(vec![task("z"), task("a"), task("b")], query)
            .await
            .unwrap();
        assert_eq!(page.gids, ["b", "a", "z"]);
        let page = db
            .query_tasks(vec![task("b"), task("a")], input("all"))
            .await
            .unwrap();
        assert_eq!(page.gids, ["a", "b"]);
    }
}
