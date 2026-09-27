#!/usr/bin/env python3
"""Copy interface strings from the Rayburst and Rayburst Connect locales.

The product mock-ups on the website show the apps' own labels (desktop,
native notifications and the browser extension), verbatim, in
every supported language. This script copies them into locales/<code>.json
under the ui.*, cx.*, tray.*, scheme.* and native.* keys and leaves every other key
untouched.

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
LOCALES = SITE / "locales"

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

NATIVE = {
    "native.doneTitle": "notification.download-complete-title",
    "native.doneBody": "notification.download-complete-body",
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


def dig(tree, dotted):
    node = tree
    for part in dotted.split("."):
        node = node.get(part) if isinstance(node, dict) else None
    return node


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
        native = json.loads((lab / "rayburst/src-tauri/locales" / f"{code}.json").read_text("utf-8"))
        for key, src in NATIVE.items():
            if src not in native:
                sys.exit(f"{code}: {src} missing in the native locale")
            wanted[key] = native[src].replace("%{task_name}", "{name}")
        path = LOCALES / f"{code}.json"
        current = json.loads(path.read_text("utf-8")) if path.exists() else {}
        if all(current.get(k) == v for k, v in wanted.items()):
            continue
        stale.append(code)
        if not check:
            merged = {k: v for k, v in current.items() if not k.startswith(("ui.", "cx.", "tray.", "scheme.", "native."))}
            merged.update(wanted)
            path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if check and stale:
        sys.exit("Interface strings out of date: " + ", ".join(stale))
    print(("checked" if check else "synced") + f" {len(APP) + len(CONNECT) + len(NATIVE)} interface strings in {len(CODES)} locales"
          + (f" (updated: {', '.join(stale)})" if stale and not check else ""))


if __name__ == "__main__":
    main()
