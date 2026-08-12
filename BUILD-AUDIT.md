# Build ideas — audit · pitfalls · engineering · sharper briefs

Internal. Use before selling any idea as “easy on our rails.”  
Status chips on the portal are marketing honesty; this file is engineering honesty.

---

## Cross-cutting risks (all ideas)

| Pitfall | Why it bites |
|---|---|
| **Sparse LIVE fleet** | Most lat-lon won’t have a nearby attested device. Products silently degrade to SIM / forecast APIs and lose the moat story. |
| **Attestation ≠ physical truth** | Ed25519 proves *who signed*, not that the sensor isn’t in a fridge. Need twins, history, multi-source, partner SLA. |
| **Liability of advice** | “Delay crane 6h” is a decision product → legal disclaimer + human-in-loop for v1. |
| **Hub liquidity** | Insight apps assume someone publishes + someone buys. Cold-start: seed fleet + design partners before ARR slides. |
| **Capability versioning** | `gaia.*.read@v1` schemas drift; apps must pin versions and handle silence / refund paths. |
| **Regulatory verticals** | Insurance, energy, compliance — oracle layer is easier than becoming the regulated actor. Stay “input + receipt.” |
| **Ops / on-call** | Continuous streams need uptime, key rotation, replay, abuse limits — not just a demo invoke. |

**Platform dependencies to budget in every brief:** device registry, key custody, PoV settle edge cases, ATLAS LIVE labeling rules, rate limits, idempotent receipts, retention of attestations for disputes.

---

## 01 — Weather Risk Analyst

**Portal claim:** Buy ~$0.001 weather → sell $0.25–$2 decision.

### Pitfalls
- Score model is the product; attestation alone doesn’t score frost/crane risk.
- Wrong site resolution (geocode vs nearest LIVE station) → wrong advice with a pretty receipt.
- Buyers may want *forecast*, not *nowcast*; GAIA strength is attested present, not NWP.
- Price $0.25–$2 needs willingness-to-pay proof (LOI), not COGS math.
- If fleet thin → you’re a thin wrapper on commercial weather + optional GAIA when available (position that explicitly).

### Engineering hard parts
- Rules / ML engine with explainability (`drivers[]`) and versioned models.
- Nearest-device routing + fallback policy (LIVE only / LIVE+SIM / refuse).
- Report store + dispute pack (receipt + inputs + model hash).
- Alerting channels (API, Telegram, webhooks) with dedupe and ack.
- Liability copy + kill-switch for recommendations.

### Improved problem statement
> **Ship a Hub-native capability** that, for a site (lat-lon or place id), returns a **versioned risk report** (score 0–100, drivers, optional threshold trigger) backed by **verified GAIA weather reads when LIVE coverage exists**, otherwise **explicit degrade/refuse**. Buyer pays for the *decision artifact*; insurance payouts remain out of scope. Success = ≥3 design partners using reports in weekly ops for 4 weeks, with attestation attached to ≥70% of paid reports.

---

## 02 — Parametric trigger service

**Portal claim:** Threshold on GAIA → event to insurer/MGA; we stay oracle + settlement.

### Pitfalls
- Insurers need **basis risk**, oracle governance, dispute windows, jurisdiction — not a webhook toy.
- Single sensor / single parameter is easy to game or fail; real policies use indices, averaging, multiple stations.
- “Trigger” implies money movement; if MGA isn’t integrated, you’re a notification bus (still useful — don’t overclaim).
- Regulatory: don’t look like an unlicensed claims adjuster.

### Engineering hard parts
- Policy-as-data: parameter, window, aggregation, quorum, cooldown, replay.
- Exactly-once / at-least-once delivery with signed trigger receipts.
- Partner adapters (SFTP, REST, email) + sandbox canaries.
- Audit log immutable enough for underwriter diligence.
- Simulation mode against historical series before go-live.

### Improved problem statement
> **Build a threshold automation** that subscribes to named GAIA capabilities, evaluates **declared policy rules** (window, agg, breach), and emits a **signed TriggerEvent** (inputs + rule hash + attestation ids) to a partner endpoint. No payout execution in v1. Success = one MGA/sandbox partner accepts the event schema in a paper or pilot policy appendix; 100% of fires reproducible from stored receipts.

---

## 03 — Cold-chain evidence wall

**Portal claim:** Continuous temp/air on ATLAS · breach packs for logistics.

### Pitfalls
- Logistics wants **shipment-level** identity (trailer, pallet), not anonymous pins.
- Continuous ingest ≠ pay-per-call Hub UX; need streaming / batch settle economics.
- Counterparties disagree on thresholds; product is shared evidence, not who is “right.”
- Hardware install on trucks is sales+ops heavy; software-only fails without publishers.

### Engineering hard parts
- High-cardinality time-series store + retention tiers.
- Shipment binding (QR / order id ↔ device id).
- Breach detection with hysteresis; pack export (PDF/JSON) with signatures.
- Multi-tenant ACLs (shipper vs carrier vs insurer).
- ATLAS layer performance with dense fleets.

### Improved problem statement
> **For a bound shipment + device**, ingest attested temp/air, detect breaches against a **counterparty-agreed profile**, and produce a **shareable evidence pack** (series digests + attestations + breach intervals). ATLAS shows LIVE trail. v1 success = one lane (shipper+carrier) using packs in weekly exception review; no automated financial penalties in-app.

---

## 04 — Site-stop / crane wind agent

**Portal claim:** Local weather → ops alert with attestation on the ticket.

### Pitfalls
- Safety-critical: false negative = injury risk; false positive = costly downtime. Hard to sell without certified process.
- Site microclimate ≠ nearest city station.
- Unions / GC / insurers have existing stop-work procedures; agent must **fit** them, not invent parallel law.
- “Agent” hype vs dumb reliable threshold + SMS may be what wins.

### Engineering hard parts
- Site-specific device or trusted nearest LIVE with max distance rule.
- Wind gust vs average semantics; sensor mounting standards.
- On-call escalation, quiet hours, multi-channel confirm.
- Integration with existing ticketing (Procore, email lists).
- Explicit non-certification labeling.

### Improved problem statement
> **Advisory stop-work assistant** for named sites: if attested wind (or related) exceeds site profile, open/update a ticket with **receipt attached**. Default = human must acknowledge. Not a certified safety system. Success = one GC pilot, measured alert precision/recall against their manual log for 30 days.

---

## 05 — Grid intensity reporter

**Portal claim:** `energy.read` / `grid.read` → DR participation receipts.

### Pitfalls
- Grid data is often **utility / ISO controlled**; your sensor may not be the settlement meter of record.
- Carbon/intensity indices are definitional (which grid mix? lag? location?).
- DR programs have strict enrollment and telemetry requirements — high sales cycle.
- Confusing “our meter” with “grid carbon API” kills trust.

### Engineering hard parts
- Meter-grade vs informational class clearly separated in schema.
- Mapping sites → balancing areas / tariffs.
- Aligning capability semantics with existing intensity providers if used as fallback.
- Receipts that utilities might ignore (still useful for ESG storytelling — label as such).

### Improved problem statement
> **Informational intensity + site energy receipts** for operators: attested site `energy.read` plus *declared* intensity source (GAIA grid capability and/or named third-party index with timestamp). Output = participation/ESG pack, **not** wholesale settlement. Success = one energy desk using packs in internal reporting; utility settlement explicitly out of scope for v1.

---

## 06 — Compliance export API

**Portal claim:** Signed time-series packs for auditors · thin SaaS.

### Pitfalls
- Auditors want standards (ISO, SOC evidence language), not novel crypto theater.
- Retention, immutability, access logs, legal hold — boring but mandatory.
- “Compliance” without a named framework is vapor (which regulation? which buyer?).
- Easy to collide with GRC giants unless narrowly scoped (e.g. environmental sensor evidence only).

### Engineering hard parts
- Pack format (hash chain / Merkle of intervals) + offline verify CLI.
- Tenant isolation, SSO, export jobs, watermarking.
- Schema registry for capability types.
- Pricing: seats vs per-pack vs Hub pull-through.

### Improved problem statement
> **Evidence Export API** for orgs already publishing GAIA streams: on demand, emit a **time-bounded, signed pack** (devices, intervals, attestation set, verify instructions) aimed at **environmental / ops auditors**. Pick one beachhead (e.g. cold-chain or site emissions narrative). Success = one customer attaches a pack to a real audit questionnaire; verify tool used by a third party offline.

---

## 07 — Prediction-market resolver

**Portal claim:** Physical resolution via attested sensors vs opaque APIs.

### Pitfalls
- Markets need **unambiguous market specs** (where, what threshold, what time). Sensors are messy.
- Manipulation / sensor placement attacks; oracle disputes are the product.
- Jurisdiction, gambling regulation, and platform risk if you host markets (don’t — resolve only).
- Liquidity and adoption depend on market venues integrating you — BD heavy.

### Engineering hard parts
- MarketSpec schema ↔ capability + aggregation rule.
- Resolution deadlines, challenge periods, multi-oracle quorum.
- Publishing resolutions as signed artifacts venues can pin.
- SIM contamination controls (LIVE-only resolution).

### Improved problem statement
> **Resolution oracle service** (not a market): given a published MarketSpec, compute a **signed Resolution** from LIVE GAIA (or declared multi-source rule) with challenge metadata. Integrate with one venue or internal prediction product as adapter. Success = 10 resolved events with reproducible verify; no custody of stakes in v1.

---

## 08 — Sensor publisher (bring your own fleet)

**Portal claim:** Run LIVE relay → list capability → agents pay; CAPEX on publisher.

### Pitfalls
- “List and earn” needs **demand**; empty Hub = publishers churn.
- Device manufacturing, calibration, connectivity, vandalism — ops business in disguise.
- Key custody: if publisher loses keys or leaks them, fleet trust collapses.
- Pricing races to bottom vs free public APIs unless attestation is valued by buyers.

### Engineering hard parts
- Relay image / docs that non-experts can run (still non-trivial).
- Provisioning, OTA, heartbeat, ATLAS registration.
- Payout / accounting to publishers (tax, KYC if fiat).
- Abuse: spam devices, sybil SIM labeled as LIVE.

### Improved problem statement
> **Publisher kit**: documented path from supported hardware class → signed relay → GAIA capability listing → ATLAS LIVE pin → first paid Hub invoke within a week. Include LIVE/SIM enforcement tests. Success = N external publishers with ≥1 paid invoke each; support burden hours/publisher tracked.

---

## Priority recommendation

| Order | Idea | Why |
|---|---|---|
| 1 | **Situation Brief + Fire+Weather (ATLAS composites)** | Live SKUs on ATLAS; clear markup over raw GAIA; portal wedges updated |
| 2 | **01 Weather Risk Analyst** | Closest single-layer beachhead; still valid |
| 3 | **08 Publisher kit** | Feeds density; without supply, briefs stay sparse |
| 4 | **02 Parametric trigger** | High upside but needs partner |
| Later | crane, evidence export, cold-chain, grid, prediction | Heavier ops / regulation / BD |

---

## Portal copy rule

Every public idea card should answer in one breath:

1. **Who pays**  
2. **What artifact they get**  
3. **What we explicitly do not do**  
4. **Coverage dependency** (LIVE required / degrade policy)

If any of those four is fuzzy, the idea is not ready for micro-investor “wow” — keep it internal until sharpened.
