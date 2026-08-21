/**
 * Live proof, clickable architecture, glossary, and transparent economics.
 * The snapshot is read-only. A GAIA invoke only happens after an explicit click.
 */
import { currentLang, getDict, onDict } from "./i18n.js?v=20260818b";

const SNAPSHOT_URL = "/live/snapshot.json";
const INVOKE_URL = "/live/weather";
const LIVE_WEATHER_DEVICE_ID = "om-wx-01";
// Misses tolerated before the card says the fleet is unavailable. Covers the ATLAS
// snapshot warm-up after a redeploy without ever substituting a cached value.
const UNAVAILABLE_AFTER_FAILURES = 3;

// Station chosen for THIS page load. Kept so the 30s poll refreshes one sensor rather
// than shuffling the fleet; cleared implicitly on reload, which is where the variety
// comes from. Reset to null to force a fresh draw (e.g. the held sensor went offline).
let selectedPinId = null;
const SNAPSHOT_TIMEOUT_MS = 35_000;
const INVOKE_TIMEOUT_MS = 25_000;
const INVOKE_RETRY_DELAYS_MS = [750];
const TRANSIENT_INVOKE_STATUSES = new Set([502, 503, 504]);
const CURL_COMMAND = `VISITOR="use-$(openssl rand -hex 12)"
curl -sS https://modelmarket.dev/ai-market/v2/invoke \\
  -H 'Content-Type: application/json' \\
  -H "X-AIMarket-Sandbox-Visitor: $VISITOR" \\
  -d '{"product_id":"gaia.gateway","capability_id":"gaia.weather.read@v1","source_hub":"https://iot.modelmarket.dev","input":{"device_id":"${LIVE_WEATHER_DEVICE_ID}"}}'
# provenance_receipt.receipt_url → canonical AWR
# provenance_receipt.verifier_url → local signature check`;
const VISITOR_STORAGE_KEY = "aimarket-use-proof-visitor-v2";
const RECEIPT_ORIGIN = "https://modelmarket.dev";
const VERIFIER_ORIGIN = "https://verify.modelmarket.dev";
const MAX_RECEIPT_BYTES = 1024 * 1024;

const $ = (id) => document.getElementById(id);
const elements = {
  liveCard: $("live-evidence"),
  liveStatus: $("live-proof-status"),
  livePlace: $("live-proof-place"),
  liveSource: $("live-proof-source"),
  liveTemp: $("live-proof-temp"),
  liveHumidity: $("live-proof-humidity"),
  liveWind: $("live-proof-wind"),
  liveFreshness: $("live-proof-freshness"),
  run: $("run-live-request"),
  copy: $("copy-live-command"),
  command: $("hello-command"),
  output: $("live-request-output"),
  idle: document.querySelector(".console-output-idle"),
  result: document.querySelector(".console-output-result"),
  verdict: $("request-verdict"),
  latency: $("request-latency"),
  device: $("request-device"),
  reading: $("request-reading"),
  seq: $("request-seq"),
  attestation: $("request-attestation"),
  price: $("request-price"),
  receipt: $("request-receipt"),
  timestamp: $("request-timestamp"),
  architectureNumber: $("architecture-number"),
  architectureTitle: $("architecture-title"),
  architectureCopy: $("architecture-copy"),
  architectureLink: $("architecture-link"),
  metricLive: $("metric-live"),
  metricStations: $("metric-stations"),
  metricLayers: $("metric-layers"),
  metricUpdated: $("metric-updated"),
  proofCapsule: $("portable-proof"),
  proofReceiptId: $("proof-receipt-id"),
  proofIssuer: $("proof-issuer"),
  verifyProof: $("verify-proof"),
  shareProof: $("share-proof"),
  openProofJson: $("open-proof-json"),
  copyProofJson: $("copy-proof-json"),
};

const architecture = {
  source: { number: "01", titleKey: "proof.arch.source", key: "proof.arch.source.body", href: "https://open-meteo.com/en/docs" },
  gaia: { number: "02", title: "GAIA", key: "proof.arch.gaia.body", href: "https://iot.modelmarket.dev" },
  atlas: { number: "03", title: "ATLAS", key: "proof.arch.atlas.body", href: "https://atlas.modelmarket.dev" },
  hub: { number: "04", title: "HUB", key: "proof.arch.hub.body", href: "https://modelmarket.dev" },
  product: { number: "05", titleKey: "proof.arch.product", key: "proof.arch.product.body", href: "ideas.html?v=20260818b&id=fire-hotspot" },
  metis: { number: "+", title: "METIS", key: "proof.arch.metis.body", href: "https://metis.modelmarket.dev" },
};

let snapshot = null;
let activeArchitecture = "source";
let copyTimer = null;
let proofTimer = null;
let currentProof = null;
let snapshotRetryTimer = null;
let snapshotFailures = 0;
let snapshotLoading = false;
let hasSuccessfulSnapshot = false;
let lastSnapshotFreshness = "";
let invokeCooldownTimer = null;

function dictValue(key, fallback = "") {
  return getDict()?.[key] ?? fallback;
}

function formatDict(key, fallback, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    String(dictValue(key, fallback)),
  );
}

function localeName() {
  return ({ en: "en-US", ru: "ru-RU", es: "es-ES", fr: "fr-FR", zh: "zh-CN" })[currentLang()] || "en-US";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compact(value, visible = 12) {
  const text = String(value || "");
  if (text.length <= visible * 2 + 1) return text || "—";
  return `${text.slice(0, visible)}…${text.slice(-visible)}`;
}

function emit(action, value) {
  document.dispatchEvent(new CustomEvent("portal:proof-action", { detail: { action, value } }));
}

function demoVisitorId() {
  const bucket = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem(VISITOR_STORAGE_KEY) || "null");
    if (stored?.bucket === bucket && /^use-[a-z0-9-]{12,64}$/i.test(stored?.id || "")) {
      return stored.id;
    }
    const random = (globalThis.crypto?.randomUUID?.().replaceAll("-", "")
      || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`).slice(0, 20);
    const visitor = `use-${bucket.replaceAll("-", "")}-${random}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify({ id: visitor, bucket }));
    return visitor;
  } catch (_) {
    return `use-${bucket.replaceAll("-", "")}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function safeReceiptUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.origin !== RECEIPT_ORIGIN || !/^\/ai-market\/v2\/p\/provenance\/receipt\/[^/]+$/.test(url.pathname)) return null;
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
    if (verifier.origin !== VERIFIER_ORIGIN) return null;
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

function paintPortableProof(provenance) {
  const receiptUrl = safeReceiptUrl(provenance?.receipt_url);
  const shareUrl = proofShareUrl(provenance);
  if (!provenance?.receipt_id || !provenance?.issuer || !receiptUrl || !shareUrl) {
    throw new Error(dictValue("proof.console.noPortableReceipt", "Portable AWR receipt unavailable"));
  }

  currentProof = { provenance, receiptUrl: receiptUrl.toString(), shareUrl };
  if (elements.proofReceiptId) elements.proofReceiptId.textContent = provenance.receipt_id;
  if (elements.proofIssuer) {
    elements.proofIssuer.textContent = compact(provenance.issuer, 18);
    elements.proofIssuer.title = provenance.issuer;
  }
  if (elements.verifyProof) elements.verifyProof.href = shareUrl;
  if (elements.openProofJson) elements.openProofJson.href = receiptUrl.toString();
  if (!elements.proofCapsule) return;

  clearTimeout(proofTimer);
  elements.proofCapsule.hidden = false;
  elements.proofCapsule.dataset.state = "idle";
  // Force one layout boundary so a second invoke replays the sealing sequence.
  void elements.proofCapsule.offsetWidth;
  elements.proofCapsule.dataset.state = "sealing";
  window.setTimeout(() => {
    const rect = elements.proofCapsule.getBoundingClientRect();
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (rect.top > window.innerHeight - 80 || rect.bottom < 80) {
      elements.proofCapsule.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }, 180);
  proofTimer = setTimeout(() => {
    elements.proofCapsule.dataset.state = "ready";
  }, 1650);
  emit("portable-proof", provenance.receipt_id);
}

function findPins(payload) {
  // MERGE, don't pick-first. Taking the first Array-typed key meant an empty or
  // partially-populated `pins` shadowed a full `stations` array, and the card showed
  // "TEMPORARILY UNAVAILABLE" while 32 live sensors sat in the payload one key over.
  const merged = [];
  const seen = new Set();
  for (const arr of [payload?.pins, payload?.stations, payload?.readings, payload?.data?.pins]) {
    if (!Array.isArray(arr)) continue;
    for (const pin of arr) {
      const id = String(pin?.id || "");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      merged.push(pin);
    }
  }
  return merged;
}

function findWeatherPin(payload) {
  const pins = findPins(payload);
  const candidates = pins.filter((pin) => {
    const values = pin?.values || pin?.reading?.values || {};
    const live = pin?.live === true || pin?.mode === "live";
    const weather = pin?.layer === "weather" || /weather/i.test(String(pin?.capability_id || ""));
    const attributed = Boolean(pin?.source || pin?.provenance?.source);
    return live && weather && attributed && pin?.online !== false
      && finite(values.temperature ?? values.temperature_c) !== null;
  });
  // Pick at RANDOM among the most complete candidates instead of always showing the
  // same station. The fleet carries ~32 live attributed weather sensors; pinning the
  // card to one made a single upstream hiccup look like the whole fleet was down, and
  // made the hero read like a fixture. Tiering first keeps the card from showing two
  // empty cells when a fuller reading is available.
  const completeness = (pin) => {
    const values = pin?.values || pin?.reading?.values || {};
    return (finite(values.humidity ?? values.humidity_pct) !== null ? 1 : 0)
      + (finite(values.wind_speed ?? values.wind_mps ?? values.wind) !== null ? 1 : 0);
  };
  const best = Math.max(...candidates.map(completeness));
  const tier = candidates.filter((pin) => completeness(pin) === best);

  // STICKY within a session. The snapshot is polled every 30s and this function runs
  // on each poll, so re-drawing at random would swap the city four times a minute —
  // variety turns into a slot machine and the reader can never finish a sentence.
  // Pick once per page load, then keep refreshing THAT station's values; a visitor
  // still meets a different sensor on the next load. If the chosen one drops out of
  // the fleet, fall through to a fresh draw — that is the failover, not a reason to
  // show "unavailable" while 27 others are reporting.
  if (selectedPinId) {
    const held = tier.find((pin) => String(pin?.id || "") === selectedPinId)
      || candidates.find((pin) => String(pin?.id || "") === selectedPinId);
    if (held) return held;
  }
  const drawn = tier[Math.floor(Math.random() * tier.length)] || null;
  selectedPinId = drawn ? String(drawn.id || "") : null;
  return drawn;
}

function sourceName(pin) {
  const source = String(pin?.source || pin?.provenance?.source || "");
  if (/weather\.gov|NOAA|NWS/i.test(source)) return "NOAA / NWS";
  if (/open-meteo/i.test(source)) return "Open-Meteo";
  if (!source) return dictValue("proof.live.attributed", "source-attributed");
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch (_) {
    return source;
  }
}

function setLiveUnavailable() {
  elements.liveCard?.setAttribute("data-state", "unavailable");
  if (elements.liveStatus) elements.liveStatus.textContent = dictValue("proof.live.unavailable", "TEMPORARILY UNAVAILABLE");
  if (elements.livePlace) elements.livePlace.textContent = "ATLAS";
  if (elements.liveSource) elements.liveSource.textContent = dictValue("proof.live.noFake", "No cached value substituted");
  if (elements.liveTemp) elements.liveTemp.textContent = "—";
  if (elements.liveHumidity) elements.liveHumidity.textContent = "—";
  if (elements.liveWind) elements.liveWind.textContent = "—";
  if (elements.liveFreshness) elements.liveFreshness.textContent = dictValue("proof.live.retry", "Retrying shortly");
  if (elements.metricUpdated) elements.metricUpdated.textContent = dictValue("econ.metric.unavailable", "Live fleet unavailable");
}

function setLiveConnecting() {
  // First-load state. Deliberately NOT a value and NOT an error: the fleet may be warm
  // in a moment, and this card's whole point is that it never shows a number it did not
  // just fetch.
  elements.liveCard?.setAttribute("data-state", "connecting");
  if (elements.liveStatus) elements.liveStatus.textContent = dictValue("proof.live.connecting", "CONNECTING TO FLEET");
  if (elements.livePlace) elements.livePlace.textContent = "ATLAS";
  if (elements.liveSource) elements.liveSource.textContent = dictValue("proof.live.noFake", "No cached value substituted");
  if (elements.liveFreshness) elements.liveFreshness.textContent = dictValue("proof.live.retry", "Retrying shortly");
}

function setLiveReconnecting() {
  elements.liveCard?.setAttribute("data-state", "reconnecting");
  if (elements.liveStatus) {
    elements.liveStatus.textContent = dictValue("proof.live.reconnecting", "LIVE · RECONNECTING");
  }
  if (elements.liveFreshness) {
    const retry = dictValue("proof.live.retry", "Retrying shortly");
    elements.liveFreshness.textContent = lastSnapshotFreshness
      ? `${lastSnapshotFreshness} · ${retry}`
      : retry;
  }
}

function paintSnapshot(payload) {
  snapshot = payload;
  const pin = findWeatherPin(payload);
  const summary = payload?.summary || {};
  const values = pin?.values || pin?.reading?.values || {};
  const temperature = finite(values.temperature ?? values.temperature_c);
  if (!pin || temperature === null) throw new Error("No live weather reading in snapshot");

  elements.liveCard?.setAttribute("data-state", "live");
  if (elements.liveStatus) elements.liveStatus.textContent = dictValue("proof.live.connected", "LIVE NOW");
  if (elements.livePlace) elements.livePlace.textContent = pin.place || pin.label || pin.site || pin.id || LIVE_WEATHER_DEVICE_ID;
  if (elements.liveSource) {
    elements.liveSource.textContent = sourceName(pin);
    elements.liveSource.title = String(pin.source || pin?.provenance?.source || "");
  }
  if (elements.liveTemp) elements.liveTemp.textContent = `${temperature.toFixed(1)}°`;
  if (elements.liveHumidity) {
    const humidity = finite(values.humidity ?? values.humidity_pct);
    elements.liveHumidity.textContent = humidity === null ? "—" : `${Math.round(humidity)}%`;
  }
  if (elements.liveWind) {
    const wind = finite(values.wind_speed ?? values.wind_mps ?? values.wind);
    elements.liveWind.textContent = wind === null ? "—" : `${wind.toFixed(1)} m/s`;
  }

  const generated = payload?.generated_at || payload?.timestamp || pin?.timestamp;
  const time = generated ? new Date(generated) : null;
  if (elements.liveFreshness) {
    elements.liveFreshness.textContent = time && !Number.isNaN(time.getTime())
      ? `${dictValue("proof.live.fresh", "Snapshot")}: ${new Intl.DateTimeFormat(localeName(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(time)}`
      : dictValue("proof.live.freshNow", "Fresh ATLAS snapshot");
    lastSnapshotFreshness = elements.liveFreshness.textContent;
  }

  hasSuccessfulSnapshot = true;

  if (elements.metricLive) elements.metricLive.textContent = new Intl.NumberFormat(localeName()).format(finite(summary.live) ?? finite(summary.live_stations) ?? 0);
  if (elements.metricStations) elements.metricStations.textContent = new Intl.NumberFormat(localeName()).format(finite(summary.stations) ?? findPins(payload).length);
  if (elements.metricLayers) elements.metricLayers.textContent = new Intl.NumberFormat(localeName()).format(finite(summary.layers) ?? 0);
  if (elements.metricUpdated) elements.metricUpdated.textContent = dictValue("econ.metric.liveNow", "Current ATLAS fleet snapshot");
}

function scheduleSnapshotRetry() {
  clearTimeout(snapshotRetryTimer);
  const delay = Math.min(30_000, 2_500 * (2 ** Math.min(Math.max(0, snapshotFailures - 1), 3)));
  snapshotRetryTimer = window.setTimeout(() => {
    if (!document.hidden && navigator.onLine !== false) loadSnapshot();
  }, delay);
}

async function loadSnapshot() {
  if (snapshotLoading) return;
  snapshotLoading = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
  try {
    const response = await fetch(SNAPSHOT_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`ATLAS snapshot: ${response.status}`);
    paintSnapshot(await response.json());
    snapshotFailures = 0;
    clearTimeout(snapshotRetryTimer);
  } catch (error) {
    console.warn(error);
    snapshotFailures += 1;
    // Don't declare the fleet down on the FIRST miss. ATLAS rebuilds its snapshot after
    // every redeploy, and during that window it answers 200 with stations that carry no
    // provenance yet — so the honest filter finds nothing and this path runs. Announcing
    // "TEMPORARILY UNAVAILABLE" for a warm-up that resolves in seconds understates a
    // fleet of 32 live sensors. Retry quietly first; only a persistent failure is news.
    if (hasSuccessfulSnapshot) setLiveReconnecting();
    else if (snapshotFailures >= UNAVAILABLE_AFTER_FAILURES) setLiveUnavailable();
    else setLiveConnecting();
    scheduleSnapshotRetry();
  } finally {
    clearTimeout(timeout);
    snapshotLoading = false;
  }
}

function parseInvoke(payload) {
  const result = payload?.result || payload?.output || payload?.data || payload || {};
  const reading = result?.reading || result?.result?.reading || result?.output?.reading || result;
  const values = reading?.values || result?.values || {};
  const attestation = reading?.attestation || result?.attestation || payload?.attestation || {};
  const receipt = payload?.receipt || result?.receipt || payload?.payment_receipt || {};
  const provenance = payload?.provenance_receipt || result?.provenance_receipt || null;
  return { payload, result, reading, values, attestation, receipt, provenance };
}

class InvokeRequestError extends Error {
  constructor(message, { status = 0, code = "", payload = null, retryAfterSeconds = 0 } = {}) {
    super(message);
    this.name = "InvokeRequestError";
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfterSeconds(value) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(300, Math.ceil(numeric)));
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, Math.min(300, Math.ceil((date - Date.now()) / 1000)));
}

async function responseError(response) {
  let payload = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = null;
  }
  const code = String(payload?.error || payload?.sandbox?.error || "");
  const detail = typeof payload?.detail === "string" ? payload.detail.trim() : "";
  return new InvokeRequestError(detail || code || `HTTP ${response.status}`, {
    status: response.status,
    code,
    payload,
    retryAfterSeconds: retryAfterSeconds(response.headers.get("Retry-After")),
  });
}

function setInvokeProgress(text) {
  if (!elements.idle) return;
  elements.idle.hidden = false;
  const message = elements.idle.querySelector("p");
  if (message) message.textContent = text;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestInvoke(visitorId) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS);
  try {
    const response = await fetch(INVOKE_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-AIMarket-Sandbox-Visitor": visitorId,
      },
      body: "{}",
    });
    if (!response.ok) throw await responseError(response);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new InvokeRequestError("request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestInvokeWithRetry(visitorId) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestInvoke(visitorId);
    } catch (error) {
      const retryable = TRANSIENT_INVOKE_STATUSES.has(Number(error?.status || 0))
        || (Number(error?.status || 0) === 0 && navigator.onLine !== false);
      if (!retryable || attempt >= INVOKE_RETRY_DELAYS_MS.length) throw error;
      setInvokeProgress(formatDict(
        "proof.console.retrying",
        "Temporary upstream failure · automatic retry {attempt}/{max}…",
        {
          attempt: attempt + 1,
          max: INVOKE_RETRY_DELAYS_MS.length,
          status: error?.status || "network",
        },
      ));
      emit("live-invoke", `retry-${error?.status || "network"}`);
      await wait(INVOKE_RETRY_DELAYS_MS[attempt]);
    }
  }
}

function showInvokeError(error) {
  elements.output?.setAttribute("data-state", "error");
  if (elements.idle) {
    elements.idle.hidden = false;
    const message = elements.idle.querySelector("p");
    if (message) message.textContent = `${dictValue("proof.console.error", "Live request failed")}: ${error.message}`;
  }
  if (elements.result) elements.result.hidden = true;
}

function startInvokeCooldown(seconds) {
  clearInterval(invokeCooldownTimer);
  const duration = Math.max(1, Math.min(300, Math.ceil(seconds || 12)));
  const until = Date.now() + duration * 1000;
  elements.run.dataset.locked = "cooldown";
  elements.run.disabled = true;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    elements.run.textContent = remaining
      ? formatDict("proof.console.cooldown", "Retry in {seconds}s", { seconds: remaining })
      : dictValue("proof.console.run", "Run live request");
    if (remaining > 0) return;
    clearInterval(invokeCooldownTimer);
    invokeCooldownTimer = null;
    delete elements.run.dataset.locked;
    elements.run.disabled = false;
  };
  tick();
  invokeCooldownTimer = window.setInterval(tick, 1000);
}

function paintInvoke(payload, elapsedMs) {
  const parsed = parseInvoke(payload);
  const { reading, values, attestation, receipt, provenance, result } = parsed;
  if (payload?.ok === false || result?.ok === false) throw new Error(payload?.error || result?.error || "GAIA returned ok=false");
  if (!provenance) throw new Error(dictValue("proof.console.noPortableReceipt", "Portable AWR receipt unavailable"));

  const temperature = finite(values.temperature ?? values.temperature_c);
  const humidity = finite(values.humidity ?? values.humidity_pct);
  elements.output?.setAttribute("data-state", "success");
  if (elements.idle) elements.idle.hidden = true;
  if (elements.result) elements.result.hidden = false;
  if (elements.verdict) elements.verdict.textContent = dictValue("proof.console.signed", "SIGNED RESULT");
  if (elements.latency) {
    const latency = finite(receipt?.latency_ms ?? payload?.latency_ms ?? result?.latency_ms) ?? elapsedMs;
    elements.latency.textContent = `${Math.round(latency)} ms`;
  }
  if (elements.device) elements.device.textContent = reading?.device_id || result?.device_id || LIVE_WEATHER_DEVICE_ID;
  if (elements.reading) {
    const parts = [];
    if (temperature !== null) parts.push(`${temperature.toFixed(1)} °C`);
    if (humidity !== null) parts.push(`${Math.round(humidity)}% RH`);
    elements.reading.textContent = parts.join(" · ") || dictValue("proof.console.readingReceived", "reading received");
  }
  if (elements.seq) elements.seq.textContent = String(reading?.seq ?? result?.seq ?? "—");
  if (elements.attestation) {
    const algorithm = attestation?.algorithm || attestation?.alg || "Ed25519";
    const proof = attestation?.signature || attestation?.sig || attestation?.value || attestation?.public_key || attestation?.key_id;
    elements.attestation.textContent = `${algorithm} · ${compact(proof, 9)}`;
    elements.attestation.title = String(proof || "");
  }
  if (elements.price) {
    const listPrice = finite(payload?.list_price_usd ?? payload?.price_usd ?? result?.price_usd ?? receipt?.price_usd);
    const sandbox = payload?.sandbox?.sandbox === true || payload?.sandbox === true;
    elements.price.textContent = sandbox
      ? `${dictValue("proof.console.catalog", "catalog")} $${(listPrice ?? .001).toFixed(3)} · ${dictValue("proof.console.charged", "charged")} $0`
      : listPrice === null ? "$0.001" : `$${listPrice.toFixed(3)}`;
  }
  if (elements.receipt) {
    elements.receipt.textContent = `AWR/2 · ${compact(provenance.receipt_id, 8)}`;
    elements.receipt.title = provenance.receipt_url;
  }
  if (elements.timestamp) {
    const timestamp = reading?.timestamp || reading?.ts || result?.timestamp || payload?.provenance?.timestamp || payload?.timestamp || new Date().toISOString();
    const remaining = finite(payload?.sandbox?.remaining);
    const allowance = remaining === null
      ? ""
      : ` · ${formatDict("proof.console.remaining", "demo requests left: {count}", { count: remaining })}`;
    elements.timestamp.textContent = `${dictValue("proof.console.returnedAt", "Returned")}: ${timestamp}${allowance}`;
  }
  paintPortableProof(provenance);
}

async function runInvoke() {
  if (!elements.run || elements.run.disabled) return;
  elements.run.disabled = true;
  elements.run.classList.add("is-running");
  elements.run.textContent = dictValue("proof.console.running", "Running GAIA…");
  elements.output?.setAttribute("data-state", "loading");
  if (elements.idle) {
    elements.idle.hidden = false;
    const message = elements.idle.querySelector("p");
    if (message) message.textContent = dictValue("proof.console.waiting", "Requesting a fresh signed reading…");
  }
  if (elements.result) elements.result.hidden = true;

  const started = performance.now();
  try {
    const payload = await requestInvokeWithRetry(demoVisitorId());
    paintInvoke(payload, performance.now() - started);
    emit("live-invoke", payload?.ok !== false ? "success" : "failed");
  } catch (error) {
    console.warn(error);
    if (error?.code === "trial_quota_exhausted") {
      showInvokeError(new Error(dictValue(
        "proof.console.quotaExhausted",
        "Today’s free live requests are used. The demo allowance resets tomorrow.",
      )));
      elements.run.dataset.locked = "quota";
      elements.run.disabled = true;
      elements.run.textContent = dictValue("proof.console.quotaButton", "Daily demo limit reached");
      emit("live-invoke", "quota-exhausted");
    } else if (Number(error?.status || 0) === 429) {
      const seconds = error?.retryAfterSeconds || (error?.code === "rate_limit_exceeded" ? 60 : 12);
      showInvokeError(new Error(formatDict(
        "proof.console.rateLimited",
        "Too many requests. Automatic access resumes in {seconds}s.",
        { seconds },
      )));
      startInvokeCooldown(seconds);
      emit("live-invoke", "rate-limited");
    } else {
      showInvokeError(error);
      emit("live-invoke", "error");
    }
  } finally {
    elements.run.classList.remove("is-running");
    if (!elements.run.dataset.locked) {
      elements.run.disabled = false;
      elements.run.textContent = dictValue("proof.console.run", "Run live request");
    }
  }
}

async function copyCommand() {
  if (!elements.copy) return;
  try {
    await navigator.clipboard.writeText(CURL_COMMAND);
    elements.copy.textContent = dictValue("proof.console.copied", "Copied ✓");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      elements.copy.textContent = dictValue("proof.console.copy", "Copy curl");
    }, 1800);
    emit("copy-curl", "success");
  } catch (error) {
    console.warn(error);
    elements.copy.textContent = dictValue("proof.console.copyError", "Select the command above");
  }
}

function flashButton(button, key, fallback, resetKey, resetFallback) {
  if (!button) return;
  button.textContent = dictValue(key, fallback);
  window.setTimeout(() => {
    button.textContent = dictValue(resetKey, resetFallback);
  }, 1800);
}

async function copyProofLink() {
  if (!currentProof || !elements.shareProof) return;
  try {
    await navigator.clipboard.writeText(currentProof.shareUrl);
    flashButton(elements.shareProof, "proof.capsule.copied", "Proof link copied ✓", "proof.capsule.shareCta", "Copy proof link");
    emit("share-proof", "success");
  } catch (error) {
    console.warn(error);
    flashButton(elements.shareProof, "proof.capsule.copyError", "Copy failed", "proof.capsule.shareCta", "Copy proof link");
  }
}

async function copyReceiptJson() {
  if (!currentProof || !elements.copyProofJson) return;
  elements.copyProofJson.disabled = true;
  try {
    const response = await fetch(currentProof.receiptUrl, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/vc, application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_RECEIPT_BYTES) throw new Error("receipt too large");
    const json = await response.text();
    const bytes = globalThis.TextEncoder ? new TextEncoder().encode(json).length : json.length;
    if (bytes > MAX_RECEIPT_BYTES) throw new Error("receipt too large");
    await navigator.clipboard.writeText(json);
    flashButton(elements.copyProofJson, "proof.capsule.jsonCopied", "JSON copied ✓", "proof.capsule.copyJson", "Copy JSON");
    emit("copy-receipt-json", "success");
  } catch (error) {
    console.warn(error);
    flashButton(elements.copyProofJson, "proof.capsule.copyError", "Copy failed", "proof.capsule.copyJson", "Copy JSON");
  } finally {
    elements.copyProofJson.disabled = false;
  }
}

function paintArchitecture(nodeName = activeArchitecture) {
  const node = architecture[nodeName] || architecture.source;
  activeArchitecture = nodeName;
  document.querySelectorAll(".architecture-node").forEach((button) => {
    const active = button.dataset.node === nodeName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (elements.architectureNumber) elements.architectureNumber.textContent = node.number;
  if (elements.architectureTitle) elements.architectureTitle.textContent = node.titleKey ? dictValue(node.titleKey, "PRODUCT") : node.title;
  if (elements.architectureCopy) elements.architectureCopy.textContent = dictValue(node.key);
  if (elements.architectureLink) elements.architectureLink.href = node.href;
}

function wireArchitecture() {
  document.querySelectorAll(".architecture-node").forEach((button) => {
    button.addEventListener("click", () => {
      paintArchitecture(button.dataset.node);
      emit("architecture", button.dataset.node);
    });
  });
}

function paintGlossary(dict = getDict()) {
  document.querySelectorAll(".term-chip").forEach((button) => {
    const tip = dict?.[`proof.term.${button.dataset.term}`] || "";
    button.dataset.tip = tip;
    button.setAttribute("aria-label", `${button.textContent}: ${tip}`);
  });
}

function wireGlossary() {
  document.querySelectorAll(".term-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const open = !button.classList.contains("is-open");
      document.querySelectorAll(".term-chip.is-open").forEach((item) => item.classList.remove("is-open"));
      button.classList.toggle("is-open", open);
      emit("glossary", button.dataset.term);
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.(".term-chip")) {
      document.querySelectorAll(".term-chip.is-open").forEach((item) => item.classList.remove("is-open"));
    }
  });
}

const economics = {
  buyers: $("econ-buyers"),
  calls: $("econ-calls"),
  price: $("econ-price"),
  take: $("econ-take"),
  buyersOut: $("econ-buyers-out"),
  callsOut: $("econ-calls-out"),
  priceOut: $("econ-price-out"),
  takeOut: $("econ-take-out"),
  volume: $("econ-volume"),
  gmv: $("econ-gmv"),
  providers: $("econ-providers"),
  platform: $("econ-platform"),
};

function paintEconomics() {
  if (!economics.buyers) return;
  const buyers = Number(economics.buyers.value);
  const calls = Number(economics.calls.value);
  const price = Number(economics.price.value) / 1000;
  const take = Number(economics.take.value) / 100;
  const daily = buyers * calls;
  const monthly = daily * price * 30;
  const integers = new Intl.NumberFormat(localeName(), { maximumFractionDigits: 0 });
  const money = (value) => {
    const digits = value < 100 ? 2 : 0;
    return `$${new Intl.NumberFormat(localeName(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;
  };
  economics.buyersOut.textContent = integers.format(buyers);
  economics.callsOut.textContent = integers.format(calls);
  economics.priceOut.textContent = `$${price.toFixed(3)}`;
  economics.takeOut.textContent = `${Math.round(take * 100)}%`;
  economics.volume.textContent = integers.format(daily);
  economics.gmv.textContent = money(monthly);
  economics.providers.textContent = money(monthly * (1 - take));
  economics.platform.textContent = money(monthly * take);
}

function wireEconomics() {
  [economics.buyers, economics.calls, economics.price, economics.take].filter(Boolean).forEach((input) => {
    input.addEventListener("input", paintEconomics);
    input.addEventListener("change", () => emit("economics", input.id));
  });
  paintEconomics();
}

function repaintLocalized(dict) {
  paintArchitecture(activeArchitecture);
  paintGlossary(dict);
  paintEconomics();
  if (snapshot) paintSnapshot(snapshot);
  if (currentProof) {
    const shareUrl = proofShareUrl(currentProof.provenance);
    if (shareUrl) {
      currentProof.shareUrl = shareUrl;
      if (elements.verifyProof) elements.verifyProof.href = shareUrl;
    }
  }
}

if (elements.command) elements.command.textContent = CURL_COMMAND;
elements.run?.addEventListener("click", runInvoke);
elements.copy?.addEventListener("click", copyCommand);
elements.shareProof?.addEventListener("click", copyProofLink);
elements.copyProofJson?.addEventListener("click", copyReceiptJson);
wireArchitecture();
wireGlossary();
wireEconomics();
onDict(repaintLocalized);
loadSnapshot();
setInterval(() => {
  if (!document.hidden) loadSnapshot();
}, 30_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadSnapshot();
});
window.addEventListener("online", loadSnapshot);
