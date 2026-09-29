#!/usr/bin/env python3
"""Copy interface strings from the Rayburst and Rayburst Connect locales.

The product mock-ups on the website show the apps' own labels (the desktop
app and the browser extension), verbatim, in every supported language. This
script copies them into src/locales/<code>.json under the ui, cx, tray and
scheme namespaces and leaves every other key untouched.

    python3 tools/sync-ui-strings.py            # write
    python3 tools/sync-ui-strings.py --check    # fail when a copy is stale

The repositories are found through $RAYBURST_LAB (a folder holding rayburst/
and rayburst-connect/), ../rayburst-lab, or ../.. when this site lives in
rayburst/website.
"""
import json
import os
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
LOCALES = SITE / "src" / "locales"

APP = {
    "ui.tasks": "app.task-list",
    "ui.all": "task.scope-all",
    "ui.progress": "task.scope-progress",
    "ui.failed": "task.scope-failed",
    "ui.completed": "task.scope-completed",
    "ui.about": "navigation.about",
    "ui.settings": "navigation.settings",
    "ui.remaining": "task.remaining-prefix",
    "ui.h": "app.hour",
    "ui.m": "app.minute",
    "ui.s": "app.second",
    "ui.complete": "task.task-complete",
    "ui.seeding": "task.seeding",
    "ui.fetching": "task.bt-metadata-fetching",
    "ui.probing": "media.probing",
    "ui.mediaDownloading": "media.downloading",
    "ui.recording": "media.recording",
    "ui.live": "media.live",
    "ui.saved": "task.download-complete-message",
    "ui.seedingToast": "task.bt-download-complete-message",
    "ui.openFile": "task.open-file",
    "ui.showInFolder": "task.show-in-folder",
    "ui.detail": "task.task-detail-title",
    "ui.tab.general": "task.task-tab-general",
    "ui.tab.activity": "task.task-tab-activity",
    "ui.tab.files": "task.task-tab-files",
    "ui.tab.peers": "task.task-tab-peers",
    "ui.tab.trackers": "task.task-tab-trackers",
    "ui.d.progress": "task.task-progress-info",
    "ui.d.size": "task.task-file-size",
    "ui.d.down": "task.task-download-speed",
    "ui.d.up": "task.task-upload-speed",
    "ui.d.uploaded": "task.task-upload-length",
    "ui.d.ratio": "task.task-ratio",
    "ui.d.seeders": "task.task-num-seeders",
    "ui.conns": "task.task-connections",
    "ui.selectFiles": "task.select-files",
    "ui.fileNo": "task.file-index",
    "ui.fileName": "task.file-name",
    "ui.fileSize": "task.file-size",
    "ui.chooseLater": "task.magnet-choose-later",
    "ui.startDownload": "task.magnet-start-download",
    "tray.show": "app.show",
    "tray.new": "app.tray-new-task",
    "tray.resume": "app.tray-resume-all",
    "tray.pause": "app.tray-pause-all",
    "tray.quit": "app.quit",
    **{
        f"scheme.{sid}": f"preferences.color-scheme-{sid}"
        for sid in ("rayburst", "amber", "space", "mint", "rose", "coral", "glacier", "evergreen", "graphite", "sakura")
    },
}

CONNECT = {
    "cx.connected": "popup_status_connected",
    "cx.intercepting": "popup_toggle_enabled",
    "cx.downloads": "media_downloads",
    "cx.sniffer": "sniffer_tab",
    "cx.current": "resources_current",
    "cx.filter": "media_filter",
    "cx.all": "resources_all",
    "cx.time": "resources_time",
    "cx.fileKind": "resources_kind_file",
    "cx.subsKind": "resources_kind_subtitle",
    "cx.back": "media_back",
    "cx.sizeUnknown": "media_size_unknown",
    "cx.loading": "media_loading",
    "cx.confirming": "media_confirming",
    "cx.video": "media_video",
    "cx.audio": "media_audio",
    "cx.subs": "media_subtitles",
    "cx.format": "media_format",
    "cx.start": "resources_start_time",
    "cx.end": "resources_end_time",
    "cx.cancel": "media_cancel",
    "cx.download": "media_download",
    "cx.submitted": "media_submitted",
}

CODES = [
    "ar", "bg", "ca", "de", "el", "en-US", "es", "fa", "fr", "hi", "hu", "id", "it", "ja",
    "ko", "nb", "nl", "pl", "pt-BR", "ro", "ru", "th", "tr", "uk", "vi", "zh-CN", "zh-TW",
]


def find_lab():
    candidates = [os.environ.get("RAYBURST_LAB"), SITE.parent / "rayburst-lab", SITE.parent.parent]
    for c in candidates:
        if c and (Path(c) / "rayburst" / "src" / "shared" / "locales").is_dir() and (Path(c) / "rayburst-connect").is_dir():
            return Path(c)
    sys.exit("Rayburst repositories not found; set RAYBURST_LAB")


NAMESPACES = ("ui", "cx", "tray", "scheme")


def dig(tree, dotted):
    node = tree
    for part in dotted.split("."):
        node = node.get(part) if isinstance(node, dict) else None
    return node


def put(tree, dotted, value):
    *parents, leaf = dotted.split(".")
    for part in parents:
        tree = tree.setdefault(part, {})
    tree[leaf] = value


def flatten(tree, prefix):
    out = {}
    for key, value in tree.items():
        dotted = f"{prefix}.{key}"
        out.update(flatten(value, dotted) if isinstance(value, dict) else {dotted: value})
    return out


def main():
    check = "--check" in sys.argv
    lab = find_lab()
    stale = []
    for code in CODES:
        app = json.loads((lab / "rayburst/src/shared/locales" / code / "messages.json").read_text("utf-8"))
        cx_code = "en" if code == "en-US" else code.replace("-", "_")
        cx = json.loads((lab / "rayburst-connect/public/_locales" / cx_code / "messages.json").read_text("utf-8"))
        wanted = {}
        for key, src in APP.items():
            value = dig(app, src)
            if not isinstance(value, str):
                sys.exit(f"{code}: {src} missing in Rayburst")
            wanted[key] = value.replace("{taskName}", "{name}")
        for key, src in CONNECT.items():
            if src not in cx:
                sys.exit(f"{code}: {src} missing in Rayburst Connect")
            wanted[key] = cx[src]["message"]
        path = LOCALES / f"{code}.json"
        current = json.loads(path.read_text("utf-8")) if path.exists() else {}
        if all(dig(current, k) == v for k, v in wanted.items()) and all(
            isinstance(current.get(ns), dict) and set(flatten(current[ns], ns)) <= set(wanted) for ns in NAMESPACES
        ):
            continue
        stale.append(code)
        if not check:
            # Rebuild the copied namespaces in place; every other key stays as it is.
            for ns in NAMESPACES:
                current[ns] = {}
            for key, value in wanted.items():
                put(current, key, value)
            path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    if check and stale:
        sys.exit("Interface strings out of date: " + ", ".join(stale))
    print(("checked" if check else "synced") + f" {len(APP) + len(CONNECT)} interface strings in {len(CODES)} locales"
          + (f" (updated: {', '.join(stale)})" if stale and not check else ""))


if __name__ == "__main__":
    main()
