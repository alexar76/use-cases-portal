/**
 * Idea detail page — ?id= from data/boards.json + locales
 */
import { mountPreview } from "./preview3d.js?v=20260818b";
import { currentLang, onDict, getDict } from "./i18n.js?v=20260818b";

const DATA_VERSION = "20260818b";

const base = document.documentElement.dataset.base || "";
// Ids that were renamed after the page had already been shared. Dropping one
// turns a link someone sent a colleague into "Idea not found", so keep the old
// spelling resolving to the new card. Entries are permanent; renames are not.
const ID_ALIASES = {
  // The SKU grew from Finnish-only to Finnish + Norwegian public AIS.
  "finnish-ais": "nordic-ais",
};
const rawId = new URLSearchParams(location.search).get("id") || "";
const id = ID_ALIASES[rawId] || rawId;
const VISITOR_STORAGE_KEY = "aimarket-use-proof-visitor";
const RECEIPT_ORIGIN = "https://modelmarket.dev";
const VERIFIER_ORIGIN = "https://verify.modelmarket.dev";
const MAX_INVOKE_BYTES = 1024 * 1024;
const LIVE_CASES = {
  "fire-hotspot": { endpoint: "/live/fire-weather", runKey: "idea.live.runFire" },
  "verified-watchbox": { endpoint: "/live/watchbox", runKey: "idea.live.runWatchbox" },
};

const els = {
  missing: document.getElementById("idea-missing"),
  page: document.getElementById("idea-page"),
  canvas: document.getElementById("idea-canvas"),
  chip: document.getElementById("idea-chip"),
  title: document.getElementById("idea-title"),
  lead: document.getElementById("idea-lead"),
  who: document.getElementById("idea-who"),
  artifact: document.getElementById("idea-artifact"),
  not: document.getElementById("idea-not"),
  hard: document.getElementById("idea-hard"),
  rails: document.getElementById("idea-rails"),
  liveWrap: document.getElementById("idea-livepath-wrap"),
  livePath: document.getElementById("idea-livepath"),
  sourcesWrap: document.getElementById("idea-sources-wrap"),
  sources: document.getElementById("idea-sources"),
  liveProof: document.getElementById("idea-live-proof"),
  liveRun: document.getElementById("idea-live-run"),
  liveStatus: document.getElementById("idea-live-status"),
  liveResult: document.getElementById("idea-live-result"),
  liveSummary: document.getElementById("idea-live-summary"),
  liveMetrics: document.getElementById("idea-live-metrics"),
  liveVerify: document.getElementById("idea-live-verify"),
  liveShare: document.getElementById("idea-live-share"),
  liveJson: document.getElementById("idea-live-json"),
  cta: document.getElementById("idea-cta"),
  back: document.getElementById("idea-back"),
  statusNote: document.getElementById("idea-status-note"),
  ready: document.getElementById("idea-ready"),
  build: document.getElementById("idea-build"),
  briefLabel: document.getElementById("idea-brief-label"),
  briefTitle: document.getElementById("idea-brief-title"),
  readyLabel: document.getElementById("idea-ready-label"),
  buildLabel: document.getElementById("idea-build-label"),
  flowInput: document.getElementById("idea-flow-input"),
  flowProduct: document.getElementById("idea-flow-product"),
  flowResult: document.getElementById("idea-flow-result"),
  vizMode: document.getElementById("idea-viz-mode"),
  architecture: document.getElementById("idea-architecture"),
  nodeDetail: document.getElementById("idea-node-detail"),
  simulator: document.getElementById("idea-simulator"),
  demoBadge: document.getElementById("idea-demo-badge"),
  labGrid: document.querySelector(".idea-lab-grid"),
  gateLabel: document.getElementById("idea-gate-label"),
  settlementResult: document.getElementById("idea-settlement-result"),
  stateExplainer: document.getElementById("idea-state-explainer"),
  simStage: document.querySelector(".idea-sim-stage"),
  receiptToggle: document.getElementById("idea-receipt-toggle"),
  receipt: document.getElementById("idea-receipt"),
  receiptId: document.getElementById("idea-receipt-id"),
  receiptVerdict: document.getElementById("idea-receipt-verdict"),
  receiptCapability: document.getElementById("receipt-capability"),
  receiptSource: document.getElementById("receipt-source"),
  receiptSignature: document.getElementById("receipt-signature"),
  receiptSeq: document.getElementById("receipt-seq"),
  receiptPrice: document.getElementById("receipt-price"),
  receiptSettlement: document.getElementById("receipt-settlement"),
  receiptNote: document.getElementById("idea-receipt-note"),
};

let disposePreview = null;
let cachedIdea = null;
let activePerspective = "developer";
let activeState = "live";
let activeNode = 0;
let loaded = false;
let loadError = false;
let liveProofState = { mode: "idle", payload: null, provenance: null, message: "" };
let liveShareTimer = null;

function chipKey(chip) {
  if (chip === "live-wedge") return "chip.live";
  if (chip === "live-rails") return "chip.rails";
  if (chip === "example") return "chip.example";
  if (chip === "partner") return "chip.partner";
  if (chip === "live") return "chip.liveSurface";
  return "chip.idea";
}

function maturityKey(chip) {
  if (chip === "live") return "live";
  if (chip === "live-wedge") return "ready";
  if (chip === "live-rails") return "rails";
  if (chip === "example") return "example";
  if (chip === "partner") return "partner";
  return "idea";
}

function emitInteraction(control, value) {
  document.dispatchEvent(new CustomEvent("portal:idea-interaction", {
    detail: { idea: id, control, value },
  }));
}

function demoVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && /^use-[a-z0-9-]{12,80}$/i.test(existing)) return existing;
    const random = globalThis.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    const visitor = `use-${random}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, visitor);
    return visitor;
  } catch (_) {
    return `use-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

function localeName() {
  return ({ en: "en-US", ru: "ru-RU", es: "es-ES", fr: "fr-FR", zh: "zh-CN" })[currentLang()] || "en-US";
}

function safeReceiptUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.origin !== RECEIPT_ORIGIN) return null;
    if (!/^\/ai-market\/v2\/p\/provenance\/receipt\/[^/]+$/.test(url.pathname)) return null;
    if (url.username || url.password || url.hash || url.search) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function proofShareUrl(provenance) {
  const receiptUrl = safeReceiptUrl(provenance?.receipt_url);
  if (!receiptUrl) return null;
  try {
    const verifier = new URL(String(provenance?.verifier_url || VERIFIER_ORIGIN));
    if (verifier.origin !== VERIFIER_ORIGIN || verifier.username || verifier.password) return null;
    verifier.pathname = "/";
    verifier.search = "";
    verifier.hash = "";
    verifier.searchParams.set("receipt_url", receiptUrl.toString());
    verifier.searchParams.set("lang", currentLang());
    return verifier.toString();
  } catch (_) {
    return null;
  }
}

function compactTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(localeName(), {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(date);
}

function bboxLabel(payload) {
  const bbox = payload?.bbox;
  if (!bbox || ![bbox.west, bbox.south, bbox.east, bbox.north].every(Number.isFinite)) return "52–57°E · 50–54°N";
  return `${bbox.west}–${bbox.east}°E · ${bbox.south}–${bbox.north}°N`;
}

function liveMetrics(payload, dict) {
  if (id === "fire-hotspot") {
    const evidence = payload?.evidence || {};
    const detectionCount = evidence.live_fire_detection_count ?? payload?.hotspot_count ?? payload?.hotspots?.length ?? 0;
    const returnedCount = evidence.returned_detection_count ?? payload?.hotspots?.length ?? 0;
    const weather = evidence.nearby_weather_available ?? Boolean(payload?.weather);
    return [
      [dict["idea.live.metric.detections"] || "LIVE DETECTIONS", new Intl.NumberFormat(localeName()).format(detectionCount)],
      [dict["idea.live.metric.returned"] || "RETURNED", new Intl.NumberFormat(localeName()).format(returnedCount)],
      [dict["idea.live.metric.weather"] || "WEATHER ≤1000 KM", weather ? (dict["idea.live.yes"] || "YES") : (dict["idea.live.none"] || "NONE · HONEST")],
      [dict["idea.live.metric.bbox"] || "FIXED BBOX", bboxLabel(payload)],
    ];
  }
  return [
    [dict["idea.live.metric.matches"] || "MATCHES", new Intl.NumberFormat(localeName()).format(payload?.match_count ?? 0)],
    [dict["idea.live.metric.liveMatches"] || "LIVE MATCHES", new Intl.NumberFormat(localeName()).format(payload?.live_match_count ?? 0)],
    [dict["idea.live.metric.layers"] || "LAYERS", (payload?.layers || []).join(" + ") || "fire + weather"],
    [dict["idea.live.metric.evaluated"] || "EVALUATED", compactTime(payload?.evaluated_at || payload?.generated_at)],
  ];
}

function liveSummary(payload, dict) {
  if (id === "fire-hotspot") {
    // ATLAS free-form summaries are currently English.  Keep the live numbers
    // below, but use reviewed portal copy for the sentence so switching locale
    // never leaks an untranslated upstream paragraph into the proof card.
    return dict["idea.live.summaryFire"] || payload?.summary || payload?.risk_note
      || payload?.drivers?.[0] || "Source-attributed FIRMS evidence returned.";
  }
  const total = new Intl.NumberFormat(localeName()).format(payload?.live_match_count ?? payload?.match_count ?? 0);
  return (dict["idea.live.summaryWatchbox"] || "{count} LIVE matches in the fixed watchbox.").replace("{count}", total);
}

function renderLiveProof(dict) {
  const config = LIVE_CASES[id];
  if (!els.liveProof || !config) {
    if (els.liveProof) els.liveProof.hidden = true;
    return;
  }
  els.liveProof.hidden = false;
  if (els.liveRun) {
    const label = dict[config.runKey] || dict["idea.live.run"] || "Run LIVE scenario";
    els.liveRun.querySelector("span").textContent = liveProofState.mode === "running"
      ? (dict["idea.live.running"] || "Routing LIVE data…") : label;
    els.liveRun.disabled = liveProofState.mode === "running";
  }
  if (els.liveStatus) {
    els.liveStatus.dataset.state = liveProofState.mode === "error" ? "error" : liveProofState.mode;
    const statusKey = liveProofState.mode === "running" ? "idea.live.waiting"
      : liveProofState.mode === "success" ? "idea.live.success"
        : liveProofState.mode === "error" ? "idea.live.error" : "idea.live.ready";
    els.liveStatus.textContent = liveProofState.mode === "error" && liveProofState.message
      ? `${dict[statusKey] || "Invoke refused"}: ${liveProofState.message}`
      : (dict[statusKey] || "Ready · fixed public bbox · public demo · charged $0");
  }
  const ready = liveProofState.mode === "success" && liveProofState.payload && liveProofState.provenance;
  if (els.liveResult) els.liveResult.hidden = !ready;
  if (!ready) return;

  const receiptUrl = safeReceiptUrl(liveProofState.provenance.receipt_url);
  const shareUrl = proofShareUrl(liveProofState.provenance);
  if (!receiptUrl || !shareUrl) {
    liveProofState = { mode: "error", payload: null, provenance: null, message: dict["idea.live.noReceipt"] || "Portable receipt unavailable" };
    renderLiveProof(dict);
    return;
  }
  els.liveSummary.textContent = liveSummary(liveProofState.payload, dict);
  els.liveMetrics.innerHTML = "";
  liveMetrics(liveProofState.payload, dict).forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    els.liveMetrics.appendChild(row);
  });
  els.liveVerify.href = shareUrl;
  els.liveJson.href = receiptUrl.toString();
}

async function runLiveProof() {
  const config = LIVE_CASES[id];
  if (!config || liveProofState.mode === "running") return;
  liveProofState = { mode: "running", payload: null, provenance: null, message: "" };
  renderLiveProof(getDict() || {});
  emitInteraction("live_invoke", "started");
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-AIMarket-Sandbox-Visitor": demoVisitorId(),
      },
      body: "{}",
    });
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_INVOKE_BYTES) throw new Error("response too large");
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_INVOKE_BYTES) throw new Error("response too large");
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { throw new Error(`HTTP ${response.status} · invalid JSON`); }
    if (!response.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    if (payload?.ok === false || payload?.success === false) {
      throw new Error(payload?.refuse_reason || payload?.error || "upstream refused");
    }
    const provenance = payload?.provenance_receipt;
    const receiptUrl = safeReceiptUrl(provenance?.receipt_url);
    const shareUrl = proofShareUrl(provenance);
    if (!provenance?.receipt_id || !provenance?.issuer || !receiptUrl || !shareUrl) {
      throw new Error((getDict() || {})["idea.live.noReceipt"] || "Portable AWR receipt unavailable");
    }
    liveProofState = { mode: "success", payload, provenance, message: "" };
    renderLiveProof(getDict() || {});
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    els.liveResult?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    emitInteraction("live_invoke", provenance.receipt_id);
  } catch (error) {
    liveProofState = { mode: "error", payload: null, provenance: null, message: error?.message || "unknown error" };
    renderLiveProof(getDict() || {});
    emitInteraction("live_invoke", "failed");
  }
}

async function copyLiveProofLink() {
  const shareUrl = proofShareUrl(liveProofState.provenance);
  if (!shareUrl || !els.liveShare) return;
  const dict = getDict() || {};
  try {
    await navigator.clipboard.writeText(shareUrl);
    clearTimeout(liveShareTimer);
    els.liveShare.textContent = dict["idea.live.copied"] || "Proof link copied ✓";
    liveShareTimer = setTimeout(() => {
      els.liveShare.textContent = (getDict() || {})["idea.live.share"] || "Copy proof link";
    }, 1800);
    emitInteraction("proof_link", "copied");
  } catch (_) {
    els.liveShare.textContent = dict["idea.live.copyError"] || "Copy failed";
  }
}

function architectureNodes() {
  const rails = cachedIdea?.rails || [];
  return [...rails.map((name) => ({ name, kind: name.toLowerCase() })), { name: "PRODUCT", kind: "product" }];
}

function paintArchitecture(dict) {
  if (!els.architecture) return;
  els.architecture.innerHTML = "";
  const nodes = architectureNodes();
  nodes.forEach((node, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `idea-arch-node${index === activeNode ? " is-active" : ""}`;
    button.setAttribute("aria-pressed", index === activeNode ? "true" : "false");
    button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${node.name}</strong>`;
    button.addEventListener("click", () => {
      activeNode = index;
      emitInteraction("architecture", node.kind);
      paintArchitecture(getDict() || {});
    });
    els.architecture.appendChild(button);
    if (index < nodes.length - 1) {
      const link = document.createElement("i");
      link.className = "idea-arch-link";
      els.architecture.appendChild(link);
    }
  });
  const selected = nodes[activeNode] || nodes[0];
  let roleKey = ["gaia", "atlas", "hub", "oracles", "metis", "awr", "factory", "warden", "momus", "product"].includes(selected.kind) ? selected.kind : "rail";
  if (roleKey === "gaia" && cachedIdea?.sourceKind === "curated") roleKey = "gaiaCurated";
  const perspectiveKey = `idea.arch.${activePerspective}.${roleKey}`;
  els.nodeDetail.innerHTML = `<strong>${selected.name}</strong><span>${dict[perspectiveKey] || dict[`idea.arch.${activePerspective}.rail`] || ""}</span>`;
}

function stateCopy(dict, state) {
  const demo = cachedIdea?.demo;
  if (!demo) return null;
  const price = `$${demo.priceUsd}`;
  return {
    gate: dict[`idea.state.${state}.gate`] || state,
    settlement: dict[`idea.state.${state}.settlement`] || "",
    explainer: dict[`idea.state.${state}.explain`] || "",
    verdict: dict[`idea.state.${state}.verdict`] || state,
    source: state === "live"
      ? demo.source
      : state === "sim"
        ? (dict["idea.receipt.source.sim"] || "Explicit simulator")
        : (dict["idea.receipt.source.invalid"] || "Unverified input"),
    signature: dict["idea.receipt.signatureSample"] || "NOT PRESENT · SCHEMA SAMPLE",
    seq: dict["idea.receipt.seqSample"] || "not emitted",
    price: state === "live" ? price : "$0.000",
    settlementCode: state === "live" ? "ELIGIBLE_IF_VERIFIED" : state === "sim" ? "DEMO_ONLY" : "REFUSED",
  };
}

function paintState(dict) {
  const copy = stateCopy(dict, activeState);
  if (!copy || !cachedIdea?.demo) return;
  els.simStage.dataset.state = activeState;
  els.gateLabel.textContent = copy.gate;
  els.settlementResult.textContent = copy.settlement;
  els.stateExplainer.textContent = copy.explainer;
  document.querySelectorAll(".idea-state").forEach((button) => {
    const on = button.dataset.state === activeState;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const sampleSlug = cachedIdea.demo.capabilityId.replace(/[^a-z0-9]+/gi, "_").slice(0, 24);
  els.receiptId.textContent = `schema_${sampleSlug}_${activeState}`;
  els.receiptVerdict.textContent = copy.verdict;
  els.receiptVerdict.dataset.state = activeState;
  els.receiptCapability.textContent = cachedIdea.demo.capabilityId;
  els.receiptSource.textContent = copy.source;
  els.receiptSignature.textContent = copy.signature;
  els.receiptSeq.textContent = copy.seq;
  els.receiptPrice.textContent = copy.price;
  els.receiptSettlement.textContent = copy.settlementCode;
  els.receiptNote.textContent = dict[`idea.receipt.${activeState}.note`] || "";
}

function paintPerspective(dict) {
  document.querySelectorAll(".idea-perspective-btn").forEach((button) => {
    const on = button.dataset.perspective === activePerspective;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelector(".idea-perspective")?.setAttribute("data-active", activePerspective);
  const maturity = maturityKey(cachedIdea?.chip);
  const investor = activePerspective === "investor";
  els.briefLabel.textContent = dict[`idea.perspective.${activePerspective}.briefLabel`]
    || dict["idea.brief.label"] || "";
  els.briefTitle.textContent = dict[`idea.perspective.${activePerspective}.briefTitle`]
    || dict["idea.brief.title"] || "";
  els.readyLabel.textContent = dict[`idea.perspective.${activePerspective}.readyLabel`]
    || dict["idea.brief.readyLabel"] || "";
  els.buildLabel.textContent = dict[`idea.perspective.${activePerspective}.buildLabel`]
    || dict["idea.brief.buildLabel"] || "";
  els.ready.textContent = investor
    ? (dict[`idea.brief.investor.${maturity}.ready`] || dict[`idea.brief.${maturity}.ready`] || "")
    : (dict[`idea.brief.${maturity}.ready`] || "");
  els.build.textContent = investor
    ? (dict[`idea.brief.investor.${maturity}.build`] || dict[`idea.brief.${maturity}.build`] || "")
    : (dict[`idea.brief.${maturity}.build`] || "");
  for (const [el, key] of [
    [els.flowInput, "input"], [els.flowProduct, "product"], [els.flowResult, "result"],
  ]) {
    el.textContent = dict[`idea.perspective.${activePerspective}.flow.${key}`]
      || dict[`idea.flow.${key}`] || "";
  }
  paintArchitecture(dict);
}

async function loadIdea() {
  const res = await fetch(`${base}data/boards.json?v=${DATA_VERSION}`);
  if (!res.ok) throw new Error(`boards: ${res.status}`);
  const data = await res.json();
  cachedIdea = data.ideas[id] || null;
  loaded = true;
  paint();
}

function paintLivePath(dict) {
  if (!els.liveWrap || !els.livePath) return;
  const steps = cachedIdea.livePath;
  if (!Array.isArray(steps) || !steps.length) {
    els.liveWrap.hidden = true;
    els.livePath.innerHTML = "";
    return;
  }
  els.liveWrap.hidden = false;
  els.livePath.innerHTML = "";
  steps.forEach((step, i) => {
    const a = document.createElement("a");
    a.className = "path-step path-step--link";
    a.href = step.href || "#";
    a.target = "_blank";
    a.rel = "noopener";
    const n = document.createElement("div");
    n.className = "path-n";
    n.textContent = String(i + 1).padStart(2, "0");
    const strong = document.createElement("strong");
    strong.textContent = dict[step.key] || step.key;
    a.appendChild(n);
    a.appendChild(strong);
    els.livePath.appendChild(a);
  });
}

function paintSources(dict) {
  const sources = cachedIdea?.sources;
  if (!Array.isArray(sources) || !sources.length) {
    els.sourcesWrap.hidden = true;
    els.sources.innerHTML = "";
    return;
  }
  els.sourcesWrap.hidden = false;
  els.sources.innerHTML = "";
  sources.forEach((source) => {
    const link = document.createElement("a");
    link.href = source.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `${dict[source.key] || source.key} ↗`;
    link.addEventListener("click", () => emitInteraction("primary_source", source.key));
    els.sources.appendChild(link);
  });
}

function paint() {
  const dict = getDict() || {};
  if (!loaded) return;
  if (!cachedIdea) {
    els.missing.hidden = false;
    els.page.hidden = true;
    if (loadError) els.missing.textContent = dict["idea.loadError"] || "Unable to load idea.";
    return;
  }
  els.missing.hidden = true;
  els.page.hidden = false;
  const prefix = `idea.${id}`;
  const title = dict[`${prefix}.title`] || id;
  document.title = `${title} · AIMarket`;
  els.title.textContent = title;
  els.lead.textContent = dict[`${prefix}.lead`] || dict[`${prefix}.teaser`] || "";
  els.who.innerHTML = dict[`${prefix}.who`] || "";
  els.artifact.innerHTML = dict[`${prefix}.artifact`] || "";
  els.not.innerHTML = dict[`${prefix}.not`] || "";
  els.hard.innerHTML = dict[`${prefix}.hard`] || "";
  const ck = chipKey(cachedIdea.chip);
  const maturity = maturityKey(cachedIdea.chip);
  els.chip.textContent = dict[ck] || cachedIdea.chip;
  const chipClass =
    cachedIdea.chip === "partner" || cachedIdea.chip === "example"
      ? "chip-partner"
      : ck.includes("idea") && !ck.includes("live")
        ? "chip-idea"
        : "chip-live";
  els.chip.className = "chip " + chipClass;
  els.statusNote.textContent = dict[`idea.status.${maturity}`] || "";
  els.vizMode.textContent = dict[`idea.viz.${maturity}`] || "LIVE SYSTEM";
  const railHref = {
    GAIA: "https://iot.modelmarket.dev",
    ATLAS: "https://atlas.modelmarket.dev",
    Hub: "https://modelmarket.dev",
    Oracles: "https://oracles.modelmarket.dev",
    Metis: "https://metis.modelmarket.dev",
    AWR: "https://verify.modelmarket.dev",
    Factory: "https://magic-ai-factory.com",
    // WARDEN is the MCP firewall shipped inside ARGUS — there is no alexar76/warden repo.
    WARDEN: "https://github.com/alexar76/argus",
    ARGUS: "https://github.com/alexar76/argus",
    MOMUS: "https://github.com/alexar76/momus",
    SKOPOS: "https://skopos.modelmarket.dev",
    Treasury: "https://github.com/alexar76/treasury",
    Lottery: "https://github.com/alexar76/lottery",
  };
  els.rails.innerHTML = "";
  (cachedIdea.rails || []).forEach((r) => {
    const href = railHref[r];
    const el = document.createElement(href ? "a" : "span");
    el.className = "rail-pill";
    el.textContent = r;
    if (href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener";
    }
    els.rails.appendChild(el);
  });
  paintLivePath(dict);
  paintSources(dict);
  renderLiveProof(dict);
  const hasDemo = Boolean(cachedIdea.demo?.capabilityId && cachedIdea.demo?.priceUsd);
  els.simulator.hidden = !hasDemo;
  els.demoBadge.hidden = !hasDemo;
  els.labGrid.classList.toggle("is-architecture-only", !hasDemo);
  if (!hasDemo) {
    els.receipt.hidden = true;
    els.receiptToggle?.setAttribute("aria-expanded", "false");
  }
  paintPerspective(dict);
  if (hasDemo) paintState(dict);
  els.cta.href = cachedIdea.cta || "#";
  els.cta.textContent = dict[`cta.${cachedIdea.ctaKey}`] || dict["cta.open"] || "Open";
  els.back.href = `${base}index.html#boards`;
  document.documentElement.style.setProperty("--board-accent", cachedIdea.accent || "#3de0c5");
  if (els.canvas && !disposePreview) {
    disposePreview = mountPreview(els.canvas, {
      scene: cachedIdea.scene || "globe",
      accent: cachedIdea.accent || "#3de0c5",
    });
  }
}

onDict(() => paint());
loadIdea().catch((error) => {
  console.error(error);
  loaded = true;
  loadError = true;
  paint();
});

document.querySelectorAll(".idea-perspective-btn").forEach((button) => {
  button.addEventListener("click", () => {
    activePerspective = button.dataset.perspective || "developer";
    paintPerspective(getDict() || {});
    emitInteraction("perspective", activePerspective);
  });
});
document.querySelectorAll(".idea-state").forEach((button) => {
  button.addEventListener("click", () => {
    activeState = button.dataset.state || "live";
    paintState(getDict() || {});
    emitInteraction("evidence_state", activeState);
  });
});
els.receiptToggle?.addEventListener("click", () => {
  const open = els.receipt.hidden;
  els.receipt.hidden = !open;
  els.receiptToggle.setAttribute("aria-expanded", open ? "true" : "false");
  els.receiptToggle.classList.toggle("is-open", open);
  emitInteraction("schema_sample", open ? "open" : "closed");
});
els.liveRun?.addEventListener("click", runLiveProof);
els.liveShare?.addEventListener("click", copyLiveProofLink);
