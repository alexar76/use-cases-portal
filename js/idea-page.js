/**
 * Idea detail page — ?id= from data/boards.json + locales
 */
import { mountPreview } from "./preview3d.js?v=20260811u";
import { onDict, getDict } from "./i18n.js?v=20260811u";

const base = document.documentElement.dataset.base || "";
const id = new URLSearchParams(location.search).get("id") || "";

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
  cta: document.getElementById("idea-cta"),
  back: document.getElementById("idea-back"),
};

let disposePreview = null;
let cachedIdea = null;

function chipKey(chip) {
  if (chip === "live-wedge") return "chip.live";
  if (chip === "live-rails") return "chip.rails";
  if (chip === "partner") return "chip.partner";
  if (chip === "live") return "chip.liveSurface";
  return "chip.idea";
}

async function loadIdea() {
  const res = await fetch(`${base}data/boards.json`);
  const data = await res.json();
  cachedIdea = data.ideas[id] || null;
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

function paint() {
  const dict = getDict() || {};
  if (!cachedIdea) {
    els.missing.hidden = false;
    els.page.hidden = true;
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
  els.chip.textContent = dict[ck] || cachedIdea.chip;
  els.chip.className =
    "chip " +
    (ck.includes("partner") ? "chip-partner" : ck.includes("idea") && !ck.includes("live") ? "chip-idea" : "chip-live");
  const railHref = {
    GAIA: "https://iot.modelmarket.dev",
    ATLAS: "https://atlas.modelmarket.dev",
    Hub: "https://modelmarket.dev",
    Oracles: "https://oracles.modelmarket.dev",
    Metis: "https://metis.modelmarket.dev",
    AWR: "https://verify.modelmarket.dev",
    Factory: "https://magic-ai-factory.com",
    WARDEN: "https://github.com/alexar76/warden",
    MOMUS: "https://github.com/alexar76/momus",
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
loadIdea().catch(console.error);
