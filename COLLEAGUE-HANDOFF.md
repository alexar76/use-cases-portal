# Use-cases portal — handoff for colleague

**Folder (canonical in aicom):** [`use-cases-portal/`](.)  
**Suggested public host:** `use.modelmarket.dev` (or `portal.modelmarket.dev`) → this folder as web root.  
**Origin sketch:** PromoMaterials (do not ship internal paths / data-room links on the public site).

This doc is the **ideology + working contract**. Ship against it; ask before inventing a second narrative.

---

## 1. What this surface is

A **public wow + onboarding + GTM** page for the physical-oracle / agent-economy story:

| Block | Job |
|-------|-----|
| **Hero + 3D glass** | Emotional proof: “this is live rails, not slides.” |
| **Onboarding** | One door, three steps, live URLs. Roles: See · Buy · Publish · Build · Invest. |
| **Rails** | Six live surfaces (GAIA, ATLAS, Hub, Oracles, Metis, Factory). |
| **Use cases** | Six cards — what it *already feels like*. One job + one CTA each. |
| **Build** | Eight product ideas on our infra with **honest status chips**. |
| **Sensors** | Yes, people can publish sensors — as **providers of attested relays**, not USB plug-and-play. |
| **Investors** | Short intro + approximate adjacent TAM + **named sources** + disclaimer. Orientation, not a prospectus. |

It is **not**:

- the ecosystem encyclopedia (`ecosystem-landing`)
- School / academies (`edu-landing`, courses)
- a data room or investor PDF store
- a monorepo tour
- a promise that every lat/lon has LIVE coverage

---

## 2. Core ideology (do not dilute)

1. **Physical truth → agent economy.** Agents buy facts about the world; settlement happens when the fact is honest.
2. **Rails before narrative.** Every claim should have a live URL or an honest “idea / design partner” chip.
3. **LIVE vs SIM is sacred.** Never imply simulation is LIVE. Badges stay English identifiers.
4. **Receipt discipline.** device_id · signature · seq · Pay-on-Verified (honest → pay · fault → refund · silence → $0).
5. **Thin wedges, not becoming the regulated actor on day one.** Oracle + settlement + evidence; insurance payouts / certified safety / utility wholesale stay out of scope unless the audit says otherwise.
6. **Public copy ≠ internal pack.** No `strategy/investor-pack/`, no “ask for the data room,” no PromoMaterials paths on the internet.

Glossary for terms (датчик / показание / квитанция / расчёт / ретранслятор / поставщик; brands stay Latin):  
`aicom/docs/localization-glossary.md`

---

## 3. Audience map

| Who | Onboarding door | Success in 5–15 min |
|-----|-----------------|---------------------|
| Curious human | **See** | Opens ATLAS, understands LIVE vs SIM pin |
| Agent / app builder | **Buy** | Finds a GAIA capability on Hub; grasps PoV |
| Sensor operator | **Publish** | Sees relay → GAIA → Hub → ATLAS path |
| Product builder | **Build** | Picks one idea + reads BUILD-AUDIT |
| Angel / micro-investor | **Invest** | Touches product first, then reads disclaimer + sources |

---

## 4. Direction boards (Build)

Public screen `#boards` — **7 directions · thin wedges only**. Cards open `ideas.html?id=<slug>` with 3D preview.

| Board | Ideas |
|-------|-------|
| Physical | weather-risk · sensor-publisher · fire-hotspot · situation-brief · gnss-jamming-alert · parametric-trigger · evidence-export |
| Marketplace | capability-15 · hub-embed |
| Safety | warden-mcp |
| Verify | metis-answers · awr-receipts |
| Factory | factory-oneshot |
| Oracles | fair-draw |
| Ops | momus-gate |

**Cut from public board:** cold-chain, crane site-stop, grid intensity, prediction resolver, ACEX, Hunt, desktop SKUs, bridges, **radiation-evidence** (weak payer / free Safecast / overlaps evidence-export), **atlas-watchbox as hero** (plumbing SKU `atlas.watchbox.check@v1` lives under fire/situation products — not a GTM card).

**ATLAS composite SKUs (live on atlas.modelmarket.dev):** `atlas.situation.brief@v1`, `atlas.fire.weather@v1`, `atlas.nearest.read@v1`, `atlas.watchbox.check@v1` — `/.well-known/ai-market.json` + `/ai-market/v2/invoke`.

---

## 5. Tech shape (as shipped)

```
use-cases-portal/
  index.html          # single page
  css/portal.css
  js/i18n.js          # en/ru/es/fr/zh + ?lang= + localStorage
  js/onboard.js       # role tabs + ?path=
  js/scene.js         # Three.js CDN planetary glass
  js/main.js          # reveal + card tilt
  locales/*.json      # all UI strings (glossary-aligned)
  assets/*.png        # self-contained card art
  BUILD-AUDIT.md      # eng honesty for Build ideas
  COLLEAGUE-HANDOFF.md  # this file
  README.md
```

- Static site; needs HTTP (ES modules + `fetch` for locales). No build step today.
- Three.js from `unpkg` — fine for wow; for production harden CDN / vendor if you want.
- i18n attributes: `data-i18n` (text) · `data-i18n-html` (trusted HTML with `<strong>` / `<code>` only).

---

## 6. What to do next (recommended backlog)

### Must before domain cutover
- [ ] Point DNS / CDN at this folder as root (or `/` under a host).
- [ ] Smoke: all five langs, all five onboard paths, all external live links.
- [ ] Confirm **zero** internal paths in HTML + locales (`rg 'PromoMaterials|investor-pack|data room'`).
- [ ] OG image + title/description per locale (optional but good for share).

### Product / content
- [ ] Wire “add sensor” step to the real multi-lang guide: `docs/add-gaia-atlas-sensor.md` (+ i18n siblings) when public URL is stable.
- [ ] Replace or compress large PNGs if first paint is heavy (~4 MB assets today).
- [ ] Prefer real ATLAS/GAIA captures over promo stills when they age.
- [ ] Keep Build chips honest when 01/08 status changes.

### Out of scope unless Alex asks
- Embedding investor PDFs or a gated data room on this host.
- Turning the page into a second ecosystem-landing.
- Translating BUILD-AUDIT into five languages (EN eng doc is enough for now).

---

## 7. Deploy notes

Local:

```bash
cd use-cases-portal
python3 -m http.server 8765
# http://localhost:8765/?lang=ru#onboard
# http://localhost:8765/?path=publish#onboard
```

Sibling landings (do not merge): `ecosystem-landing/`, `edu-landing/`, `aicom-landing/`, `seo-landings/`.

GitHub Pages: `.github/workflows/pages.yml` publishes the static root to
`https://alexar76.github.io/use-cases-portal/`. CI runs `scripts/validate.py`
(locale parity + public-path hygiene). Satellite id: `use-cases-portal`.

---

## 8. Voice checklist (PR review)

- One job per section / card.
- Brand or product name readable without the nav.
- LIVE / SIM / GAIA / ATLAS / Hub / Metis / capability ids **untranslated**.
- Investor numbers: approximate, adjacent, sourced, disclaimed — never “our ARR.”
- No “plug any USB”; providers + attested relays only.
- No data-room / internal repo paths on the public page.

---

## 9. Contact for decisions

Product narrative / what may be claimed as live: **Alex**.  
Colleague owns: polish, deploy, performance, link hygiene, i18n QA, visual polish within this ideology.
