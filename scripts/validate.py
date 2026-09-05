#!/usr/bin/env python3
"""Static checks for the use-cases portal (CI + local)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGS = ("en", "ru", "es", "fr", "zh")
RELEASE_VERSION = "20260818b"
FORBIDDEN = re.compile(
    r"PromoMaterials|/Users/alex|investor-pack|data[\s_-]?room",
    re.IGNORECASE,
)
FORBIDDEN_RU_CALQUES = re.compile(
    r"дефицитный слой|захват вертикал(?:ей|и)|физическая правда|"
    r"планетарное стекло|операторское стекло|живые поверхности",
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


def load_json(path: Path) -> dict:
    """Load JSON and fail on duplicate keys (the browser would silently keep one)."""
    def unique_object(pairs: list[tuple[str, object]]) -> dict:
        out: dict = {}
        for key, value in pairs:
            if key in out:
                fail(f"{path.relative_to(ROOT)} duplicate key: {key}")
            out[key] = value
        return out

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def main() -> None:
    required = [
        ROOT / "index.html",
        ROOT / "ideas.html",
        ROOT / "css" / "portal.css",
        ROOT / "js" / "i18n.js",
        ROOT / "js" / "boards.js",
        ROOT / "js" / "proof.js",
        ROOT / "js" / "preview3d.js",
        ROOT / "data" / "boards.json",
        ROOT / "README.md",
        ROOT / "LICENSE",
        ROOT / ".nojekyll",
    ]
    for path in required:
        if not path.is_file():
            fail(f"missing required file: {path.relative_to(ROOT)}")

    boards = load_json(ROOT / "data" / "boards.json")
    if not isinstance(boards.get("boards"), list) or not boards["boards"]:
        fail("data/boards.json: boards[] required")

    idea_ids: set[str] = set()
    for board in boards["boards"]:
        for idea in board.get("ideas") or []:
            idea_ids.add(str(idea))
    if len(idea_ids) < 8:
        fail(f"expected ≥8 idea ids, got {len(idea_ids)}")
    idea_registry = boards.get("ideas") or {}
    missing_ideas = idea_ids - set(idea_registry)
    if missing_ideas:
        fail(f"board references missing ideas: {sorted(missing_ideas)}")

    # Schema samples are allowed only when they use audited, real catalog IDs
    # and their actual per-call prices. Concept cards remain architecture-only.
    audited_demos = {
        "weather-risk": ("gaia.weather.read@v1", "0.001"),
        "fire-hotspot": ("atlas.fire.weather@v1", "0.080"),
        "verified-watchbox": ("atlas.watchbox.check@v1", "0.020"),
        "situation-brief": ("atlas.situation.brief@v1", "0.060"),
        "flood-hydrology": ("atlas.situation.brief@v1", "0.060"),
        "nordic-ais": ("gaia.ais.public.read@v1", "0.002"),
        "cyclone-watch": ("gaia.cyclone.read@v1", "0.002"),
        "campus-nowcast": ("atlas.situation.brief@v1", "0.060"),
        "nearest-read": ("atlas.nearest.read@v1", "0.030"),
    }
    for idea_id, idea in idea_registry.items():
        demo = idea.get("demo") if isinstance(idea, dict) else None
        expected = audited_demos.get(idea_id)
        if expected is None and demo is not None:
            fail(f"{idea_id}: unaudited demo must be architecture-only")
        if expected is not None:
            actual = (str((demo or {}).get("capabilityId") or ""), str((demo or {}).get("priceUsd") or ""))
            if actual != expected:
                fail(f"{idea_id}: demo contract {actual!r} != audited {expected!r}")

    locales: dict[str, dict] = {}
    for lang in LANGS:
        path = ROOT / "locales" / f"{lang}.json"
        if not path.is_file():
            fail(f"missing locale: {path.name}")
        locales[lang] = load_json(path)

    en_keys = set(locales["en"].keys())
    for lang in LANGS[1:]:
        keys = set(locales[lang].keys())
        missing = en_keys - keys
        extra = keys - en_keys
        if missing:
            fail(f"locales/{lang}.json missing keys: {sorted(missing)[:12]}")
        if extra:
            fail(f"locales/{lang}.json unexpected keys: {sorted(extra)[:12]}")

    for idea_id in idea_ids:
        for suffix in ("title", "teaser", "lead", "who", "artifact", "not", "hard"):
            key = f"idea.{idea_id}.{suffix}"
            if key not in en_keys:
                fail(f"locales/en.json missing idea contract key: {key}")

    # Static i18n references must never silently fall back to the English HTML
    # copy. Runtime-only proof/glossary keys are covered explicitly below.
    for page in ("index.html", "ideas.html"):
        page_text = (ROOT / page).read_text(encoding="utf-8")
        referenced = set(re.findall(r'data-i18n(?:-html|-aria-label)?="([^"]+)"', page_text))
        missing = referenced - en_keys
        if missing:
            fail(f"{page}: locale keys missing from en.json: {sorted(missing)[:12]}")
    dynamic_proof_keys = {
        "proof.live.connected", "proof.live.fresh", "proof.live.freshNow",
        "proof.live.attributed", "proof.live.unavailable", "proof.live.noFake",
        "proof.live.retry", "proof.console.copied", "proof.console.copyError",
        "proof.console.running", "proof.console.waiting", "proof.console.signed",
        "proof.console.error", "proof.console.retrying", "proof.console.rateLimited",
        "proof.console.cooldown", "proof.console.quotaExhausted",
        "proof.console.quotaButton", "proof.console.remaining",
        "proof.console.readingReceived",
        "proof.console.receiptSigned", "proof.console.receiptReturned",
        "proof.console.returnedAt", "econ.metric.liveNow", "econ.metric.unavailable",
        *{f"proof.arch.{name}.body" for name in ("source", "gaia", "atlas", "hub", "product", "metis")},
        *{f"proof.term.{name}" for name in ("live", "sim", "attestation", "invoke", "receipt", "pay")},
        "idea.live.runFire", "idea.live.runWatchbox", "idea.live.running",
        "idea.live.waiting", "idea.live.success", "idea.live.error",
        "idea.live.noReceipt", "idea.live.copied", "idea.live.copyError",
        *{f"idea.live.metric.{name}" for name in (
            "detections", "returned", "weather", "bbox", "matches",
            "liveMatches", "layers", "evaluated",
        )},
        "idea.live.yes", "idea.live.none", "idea.live.summaryFire",
        "idea.live.summaryWatchbox",
    }
    missing_dynamic = dynamic_proof_keys - en_keys
    if missing_dynamic:
        fail(f"proof runtime locale keys missing: {sorted(missing_dynamic)}")

    for pattern in PUBLIC_GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            hit = FORBIDDEN.search(text)
            if hit:
                fail(f"forbidden path/token in {path.relative_to(ROOT)}: {hit.group(0)!r}")

    # Production caches static files for seven days. Every internal idea-page
    # navigation must carry the release token so a stale HTML/data pair cannot
    # degrade into "Idea not found" after a catalog release.
    index_text = (ROOT / "index.html").read_text(encoding="utf-8")
    boards_js = (ROOT / "js" / "boards.js").read_text(encoding="utf-8")
    if "ideas.html?id=" in index_text or "ideas.html?id=" in boards_js:
        fail("idea-page links must put a release token before id")
    for relative in ("index.html", "ideas.html", "js/boards.js", "js/idea-page.js", "js/i18n.js", "js/proof.js"):
        text = (ROOT / relative).read_text(encoding="utf-8")
        if RELEASE_VERSION not in text:
            fail(f"{relative}: missing release token {RELEASE_VERSION}")

    ru_text = (ROOT / "locales" / "ru.json").read_text(encoding="utf-8")
    calque = FORBIDDEN_RU_CALQUES.search(ru_text)
    if calque:
        fail(f"locales/ru.json contains forbidden literal calque: {calque.group(0)!r}")

    # gaia.jamming.read@v1 is curated CyberNews threat intel, not raw RF sensing.
    # atlas.gnss.degradation.read@v1 is derived delivery-path degradation, not
    # proof of jamming. The portal card must keep that distinction in every locale.
    jamming_denials = {
        "en": ("not raw rf sensing", "raw spectrum measurement"),
        "ru": ("не сырые радиочастотные", "сырое измерение спектра"),
        "es": ("no sensado rf crudo", "medición de espectro cruda"),
        "fr": ("pas de la mesure rf brute", "mesure spectrale brute"),
        "zh": ("不是原始 rf 感知", "原始频谱测量"),
    }
    for lang, needles in jamming_denials.items():
        lead = str(locales[lang].get("idea.gnss-jamming-alert.lead") or "").lower()
        not_ = str(locales[lang].get("idea.gnss-jamming-alert.not") or "").lower()
        combined = f"{lead}\n{not_}"
        missing = [n for n in needles if n not in combined]
        if missing:
            fail(
                f"locales/{lang}.json: idea.gnss-jamming-alert must keep the "
                f"not-RF-sensing distinction (missing {missing!r})"
            )

    # One capability, two national networks, two DIFFERENT licences. The copy
    # used to say Finnish-only and told buyers to credit Fintraffic on every
    # paid artifact — which is the wrong credit for a Norwegian reading, and
    # this guard was pinning that wording in place. Require both sources and
    # both licences instead, so the SKU can never quietly grow a third source
    # while the page still names one.
    ais_denials = {
        "en": ("not gfw", "own-edge", "fintraffic", "kystverket", "cc by 4.0", "nlod"),
        "ru": ("не gfw", "own-edge", "fintraffic", "kystverket", "cc by 4.0", "nlod"),
        "es": ("no gfw", "ais edge", "fintraffic", "kystverket", "cc by 4.0", "nlod"),
        "fr": ("pas gfw", "ais edge", "fintraffic", "kystverket", "cc by 4.0", "nlod"),
        "zh": ("非 gfw", "自有", "fintraffic", "kystverket", "cc by 4.0", "nlod"),
    }
    for lang, needles in ais_denials.items():
        lead = str(locales[lang].get("idea.nordic-ais.lead") or "").lower()
        not_ = str(locales[lang].get("idea.nordic-ais.not") or "").lower()
        hard = str(locales[lang].get("idea.nordic-ais.hard") or "").lower()
        combined = f"{lead}\n{not_}\n{hard}"
        missing = [n for n in needles if n not in combined]
        if missing:
            fail(
                f"locales/{lang}.json: idea.nordic-ais must name BOTH sources and "
                f"BOTH licences (Fintraffic/CC BY 4.0 + Kystverket/NLOD) and stay "
                f"not-GFW / not-own-edge (missing {missing!r})"
            )

    # The demo card is what a buyer reads before paying; it must not name one
    # licence for a SKU that serves two.
    ais_demo = str(
        (boards["ideas"].get("nordic-ais", {}).get("demo") or {}).get("source") or ""
    ).lower()
    for needle in ("fintraffic", "kystverket", "cc by 4.0", "nlod"):
        if needle not in ais_demo:
            fail(f"boards.json: nordic-ais demo.source omits {needle!r}")

    # Advisory-position honesty: the cyclone page must never drift into
    # selling a forecast, and must keep the basin boundary (no JTWC / NW-Pacific).
    cyclone_denials = {
        "en": ("not a forecast track", "jtwc", "nhc"),
        "ru": ("не прогноз трека", "jtwc", "nhc"),
        "es": ("no es una trayectoria pronosticada", "jtwc", "nhc"),
        "fr": ("pas une trajectoire pr", "jtwc", "nhc"),
        "zh": ("不是预报路径", "jtwc", "nhc"),
    }
    for lang, needles in cyclone_denials.items():
        combined = "\n".join(
            str(locales[lang].get(f"idea.cyclone-watch.{part}") or "")
            for part in ("teaser", "lead", "not", "hard")
        ).lower()
        missing = [n for n in needles if n not in combined]
        if missing:
            fail(
                f"locales/{lang}.json: idea.cyclone-watch must stay advisory-position "
                f"(not-forecast, not-JTWC, NHC named) — missing {missing!r}"
            )

    # The ADS-B card is published as a hypothesis BECAUSE of two blockers; if
    # either word disappears, the card has started overselling.
    adsb_denials = {
        "en": ("odbl", "share-alike", "device_id"),
        "ru": ("odbl", "share-alike", "device_id"),
        "es": ("odbl", "share-alike", "device_id"),
        "fr": ("odbl", "share-alike", "device_id"),
        "zh": ("odbl", "相同方式共享", "device_id"),
    }
    for lang, needles in adsb_denials.items():
        combined = "\n".join(
            str(locales[lang].get(f"idea.adsb-overflight.{part}") or "")
            for part in ("lead", "not", "hard")
        ).lower()
        missing = [n for n in needles if n not in combined]
        if missing:
            fail(
                f"locales/{lang}.json: idea.adsb-overflight must keep both blockers "
                f"named (ODbL share-alike + device_id-only anchor) — missing {missing!r}"
            )

    # Same drift risk as AIS: the SKU gained PTWC after the page was written.
    tsunami_denials = {
        "en": ("not a tide", "cap", "ptwc"),
        "ru": ("не мареограф", "cap", "ptwc"),
        "es": ("no un mareógrafo", "cap", "ptwc"),
        "fr": ("pas un marégraphe", "cap", "ptwc"),
        "zh": ("非验潮", "cap", "ptwc"),
    }
    for lang, needles in tsunami_denials.items():
        lead = str(locales[lang].get("idea.tsunami-cap.lead") or "").lower()
        not_ = str(locales[lang].get("idea.tsunami-cap.not") or "").lower()
        combined = f"{lead}\n{not_}"
        missing = [n for n in needles if n not in combined]
        if missing:
            fail(
                f"locales/{lang}.json: idea.tsunami-cap must keep CAP / not-tide-gauge "
                f"(missing {missing!r})"
            )

    print(
        f"OK: {len(idea_ids)} ideas · {len(LANGS)} locales · "
        f"{len(boards['boards'])} boards · public hygiene clean"
    )


if __name__ == "__main__":
    main()
