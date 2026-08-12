#!/usr/bin/env python3
"""Static checks for the use-cases portal (CI + local)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "ru", "es", "fr", "zh")
FORBIDDEN = re.compile(
    r"PromoMaterials|/Users/alex|investor-pack|data[\s_-]?room",
    re.IGNORECASE,
)
PUBLIC_GLOBS = (
    "index.html",
    "ideas.html",
    "css/**/*.css",
    "js/**/*.js",
    "locales/*.json",
    "data/*.json",
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    required = [
        ROOT / "index.html",
        ROOT / "ideas.html",
        ROOT / "css" / "portal.css",
        ROOT / "js" / "i18n.js",
        ROOT / "js" / "boards.js",
        ROOT / "js" / "preview3d.js",
        ROOT / "data" / "boards.json",
        ROOT / "README.md",
        ROOT / "LICENSE",
        ROOT / ".nojekyll",
    ]
    for path in required:
        if not path.is_file():
            fail(f"missing required file: {path.relative_to(ROOT)}")

    boards = json.loads((ROOT / "data" / "boards.json").read_text(encoding="utf-8"))
    if not isinstance(boards.get("boards"), list) or not boards["boards"]:
        fail("data/boards.json: boards[] required")

    idea_ids: set[str] = set()
    for board in boards["boards"]:
        for idea in board.get("ideas") or []:
            idea_ids.add(str(idea))
    if len(idea_ids) < 8:
        fail(f"expected ≥8 idea ids, got {len(idea_ids)}")

    locales: dict[str, dict] = {}
    for lang in LANGS:
        path = ROOT / "locales" / f"{lang}.json"
        if not path.is_file():
            fail(f"missing locale: {path.name}")
        locales[lang] = json.loads(path.read_text(encoding="utf-8"))

    en_keys = set(locales["en"].keys())
    for lang in LANGS[1:]:
        keys = set(locales[lang].keys())
        missing = en_keys - keys
        extra = keys - en_keys
        if missing:
            fail(f"locales/{lang}.json missing keys: {sorted(missing)[:12]}")
        if extra:
            fail(f"locales/{lang}.json unexpected keys: {sorted(extra)[:12]}")

    for pattern in PUBLIC_GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            hit = FORBIDDEN.search(text)
            if hit:
                fail(f"forbidden path/token in {path.relative_to(ROOT)}: {hit.group(0)!r}")

    print(
        f"OK: {len(idea_ids)} ideas · {len(LANGS)} locales · "
        f"{len(boards['boards'])} boards · public hygiene clean"
    )


if __name__ == "__main__":
    main()
