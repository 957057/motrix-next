WITH engine AS (
    SELECT value AS task,
           json_extract(value, '$.gid') AS gid,
           json_extract(value, '$.status') AS status,
           json_extract(value, '$.name') AS name,
           json_extract(value, '$.live') AS live,
           json_extract(value, '$.attention') AS attention,
           json_extract(value, '$.infoHash') AS info_hash,
           json_extract(value, '$.ed2k.hash') AS ed2k_hash,
           json_extract(value, '$.ed2k.ed2kLink') AS ed2k_link
    FROM json_each(?1)
), visible_engine AS (
    SELECT * FROM engine e WHERE e.live OR NOT EXISTS (
        SELECT 1 FROM engine a WHERE a.live AND a.gid != e.gid AND (
            (e.info_hash IS NOT NULL AND e.info_hash = a.info_hash) OR
            (e.ed2k_hash IS NOT NULL AND e.ed2k_hash = a.ed2k_hash) OR
            (e.ed2k_link IS NOT NULL AND e.ed2k_link = a.ed2k_link)
        )
    )
), history AS (
    SELECT h.*, CASE WHEN json_valid(h.meta) THEN h.meta ELSE '{}' END AS metadata
    FROM download_history h
), combined AS (
    SELECT e.gid, e.name, e.status, e.live, e.attention,
           CAST(json_extract(e.task, '$.totalLength') AS INTEGER) AS size,
           CAST(json_extract(e.task, '$.downloadSpeed') AS INTEGER) AS speed,
           COALESCE(CAST(json_extract(e.task, '$.media.progress') AS REAL),
               100.0 * CAST(json_extract(e.task, '$.completedLength') AS REAL) /
               NULLIF(CAST(json_extract(e.task, '$.totalLength') AS REAL), 0), -1) AS progress,
           COALESCE(b.added_at, h.added_at, h.completed_at, '') AS added_at,
           COALESCE(h.completed_at, '') AS completed_at
    FROM visible_engine e
    LEFT JOIN task_birth b ON b.gid=e.gid
    LEFT JOIN download_history h ON h.gid=e.gid
    UNION ALL
    SELECT h.gid, h.name, h.status, 0, h.status='error',
           h.total_length, 0, CASE WHEN h.status='complete' THEN 100 ELSE 0 END,
           COALESCE(h.added_at, h.completed_at, ''), COALESCE(h.completed_at, '')
    FROM history h
    WHERE h.gid NOT IN (SELECT gid FROM visible_engine)
      AND (json_extract(h.metadata, '$.infoHash') IS NULL OR
           json_extract(h.metadata, '$.infoHash') NOT IN (SELECT info_hash FROM visible_engine WHERE info_hash IS NOT NULL))
      AND (json_extract(h.metadata, '$.ed2kHash') IS NULL OR
           json_extract(h.metadata, '$.ed2kHash') NOT IN (SELECT ed2k_hash FROM visible_engine WHERE ed2k_hash IS NOT NULL))
      AND (json_extract(h.metadata, '$.ed2kLink') IS NULL OR
           json_extract(h.metadata, '$.ed2kLink') NOT IN (SELECT ed2k_link FROM visible_engine WHERE ed2k_link IS NOT NULL))
)
