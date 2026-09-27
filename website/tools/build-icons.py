#!/usr/bin/env python3
"""Inline the Ionicons 5 symbols the site uses into index.html.

Rayburst's interface uses Ionicons 5 (via @vicons/ionicons5), so the mock-ups
use the same outlines. The script collects every icon name referenced by
index.html and assets/js (names ending in -outline, plus logo-github),
downloads missing SVGs from the ionicons 5.5.4 package into tools/.icons, and
writes one <symbol id="i-NAME"> per icon between the icons:start/end markers.

    python3 tools/build-icons.py
"""
import re
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CACHE = SITE / "tools" / ".icons"
SOURCE = "https://unpkg.com/ionicons@5.5.4/dist/svg/{}.svg"
NAME = re.compile(r"(?<![\w-])(?:i-)?((?:[a-z]+-)+outline|logo-github)\b")


def used():
    names = set()
    files = [SITE / "index.html", *sorted((SITE / "assets" / "js").rglob("*.js"))]
    for f in files:
        names.update(NAME.findall(f.read_text("utf-8")))
    return sorted(names)


def svg(name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{name}.svg"
    if not path.exists():
        with urllib.request.urlopen(SOURCE.format(name), timeout=20) as r:
            path.write_bytes(r.read())
    return path.read_text("utf-8")


def symbol(name):
    body = svg(name)
    inner = re.search(r"<svg[^>]*>(.*)</svg>", body, re.S).group(1)
    inner = re.sub(r"<title>.*?</title>", "", inner, flags=re.S)
    inner = re.sub(r'\s*class="[^"]*"', "", inner)
    return f'<symbol id="i-{name}" viewBox="0 0 512 512">{inner.strip()}</symbol>'


def main():
    names = used()
    sprite = (
        '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>\n'
        + "\n".join(symbol(n) for n in names)
        + "\n</defs></svg>"
    )
    page = SITE / "index.html"
    html = page.read_text("utf-8")
    html = re.sub(
        r"(<!-- icons:start -->).*?(\s*<!-- icons:end -->)",
        lambda m: m.group(1) + "\n    " + sprite + m.group(2),
        html,
        flags=re.S,
    )
    page.write_text(html, "utf-8")
    print(f"{len(names)} icons: {', '.join(names)}")


if __name__ == "__main__":
    main()
