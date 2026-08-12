<!-- aicom-mirror-notice -->
> **📖 Read-only mirror.** `use-cases-portal` is published from the canonical AI-Factory monorepo.
> **Pull requests are not accepted** — any commit pushed here is overwritten by
> `scripts/mirror_satellites.sh` on the next sync.
> 🐞 Found a bug or have a request? Please **[open an issue](https://github.com/alexar76/use-cases-portal/issues)**.

# AIMarket use-cases portal

<!-- aicom-readme-badges -->
<p align="center">
  <a href="https://github.com/alexar76/use-cases-portal/actions/workflows/ci.yml"><img src="https://raw.githubusercontent.com/alexar76/use-cases-portal/main/docs/badges/ci.svg" alt="CI" /></a>
  <a href="https://github.com/alexar76/use-cases-portal/actions/workflows/pages.yml"><img src="https://github.com/alexar76/use-cases-portal/actions/workflows/pages.yml/badge.svg" alt="Pages deploy" /></a>
  <a href="https://alexar76.github.io/use-cases-portal/"><img src="https://raw.githubusercontent.com/alexar76/use-cases-portal/main/docs/badges/landing.svg" alt="Landing" /></a>
  <img src="https://raw.githubusercontent.com/alexar76/use-cases-portal/main/docs/badges/i18n.svg" alt="5 languages" />
  <img src="https://raw.githubusercontent.com/alexar76/use-cases-portal/main/docs/badges/static.svg" alt="Static site" />
  <a href="https://github.com/alexar76/use-cases-portal/blob/main/LICENSE"><img src="https://raw.githubusercontent.com/alexar76/use-cases-portal/main/docs/badges/license.svg" alt="License: MIT" /></a>
</p>
<!-- /aicom-readme-badges -->


<p align="center">
  <strong>Public wow + onboarding + direction boards</strong><br>
  Physical truth → agent economy · live rails · honest Build chips · five languages
</p>

<p align="center">
  <a href="https://alexar76.github.io/use-cases-portal/"><b>▶ Open the portal →</b></a>
  ·
  <a href="https://atlas.modelmarket.dev/"><b>ATLAS</b></a>
  ·
  <a href="https://github.com/alexar76/aicom/blob/main/docs/localization-glossary.md"><b>Glossary</b></a>
</p>

---

Part of the [AICOM open agent economy](https://github.com/alexar76/aicom). Suggested production host: `use.modelmarket.dev` (GitHub Pages is the always-on mirror).

## What it is

| Block | Job |
|-------|-----|
| Hero + 3D glass | Emotional proof — live rails, not slides |
| Onboarding | One door, three steps, live URLs (See · Buy · Publish · Build · Invest) |
| Rails | GAIA, ATLAS, Hub, Oracles, Metis, Factory |
| Use cases | Thin wedges that already feel real |
| Direction boards | 7 boards · thin idea pages with 3D previews |
| Sensors / investors | Honest publish path + approximate adjacent TAM with sources |

It is **not** the ecosystem encyclopedia, School, a data room, or a monorepo tour.

Ideology + handoff: [`COLLEAGUE-HANDOFF.md`](COLLEAGUE-HANDOFF.md) · Build honesty: [`BUILD-AUDIT.md`](BUILD-AUDIT.md)

## Boards

| Board | Ideas |
|-------|-------|
| Physical | Weather Risk · Publisher kit · Wildfire Desk · Situation Brief · Nearest LIVE · GNSS jamming alert · Parametric TriggerEvent · Evidence export |
| Marketplace | Capability in 15 min · Hub embed |
| Safety | WARDEN for MCP |
| Verify | Metis answers · AWR receipts |
| Factory | Brief → product |
| Oracles | Fair draw / VRF |
| Ops | MOMUS → deploy gate |

## Local

```bash
cd use-cases-portal
python3 -m http.server 8765
# http://localhost:8765/#boards
# http://localhost:8765/ideas.html?id=weather-risk&lang=ru
python3 scripts/validate.py
```

Static site (ES modules + `fetch` for locales) — serve over HTTP, not `file://`.

## Layout

| Path | Role |
|------|------|
| `index.html` | Portal + `#boards` |
| `ideas.html?id=` | Idea detail + 3D hero |
| `data/boards.json` | Board / idea registry |
| `js/` · `css/` · `locales/` · `assets/` | UI |
| `.github/workflows/` | CI validate + GitHub Pages |
| `scripts/validate.py` | Locale parity + public hygiene |

## Publish (alexar76)

From the aicom monorepo (scripts only — never ad-hoc remotes):

```bash
./scripts/push_gitea_monorepo.sh
GH_PAT=<token> ./scripts/publish_all_repos.sh --satellite use-cases-portal
```

Pages: [alexar76.github.io/use-cases-portal](https://alexar76.github.io/use-cases-portal/)

## License

MIT — see [`LICENSE`](LICENSE).
