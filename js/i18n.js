/**
 * Portal i18n — en / ru / es / fr / zh
 * Glossary: aicom/docs/localization-glossary.md
 *
 * Set <html data-base="../"> on nested pages so locale fetch resolves.
 */
const LOCALES = ["en", "ru", "es", "fr", "zh"];
const STORAGE_KEY = "aimarket-portal-lang";
const cache = Object.create(null);
const listeners = new Set();

let current = "en";
let dict = null;

function basePath() {
  return document.documentElement.dataset.base || "";
}

export function currentLang() {
  return current;
}

export function getDict() {
  return dict;
}

export function onDict(fn) {
  listeners.add(fn);
  if (dict) fn(dict);
  return () => listeners.delete(fn);
}

function detectLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q && LOCALES.includes(q)) return q;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored)) return stored;
  } catch (_) {}
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("ru")) return "ru";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

async function loadDict(lang) {
  if (cache[lang]) return cache[lang];
  const res = await fetch(`${basePath()}locales/${lang}.json?v=20260811u`);
  if (!res.ok) throw new Error(`locale ${lang}: ${res.status}`);
  cache[lang] = await res.json();
  return cache[lang];
}

export function apply(d = dict) {
  if (!d) return;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = d[key];
    if (val == null) return;
    el.textContent = val;
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const val = d[key];
    if (val == null) return;
    el.innerHTML = val;
  });
  if (d["meta.title"] && !document.body.dataset.ideaPage) {
    document.title = d["meta.title"];
  }
  const meta = document.querySelector('meta[name="description"]');
  if (meta && d["meta.desc"] && !document.body.dataset.ideaPage) {
    meta.setAttribute("content", d["meta.desc"]);
  }
}

function setActivePill(lang) {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    const on = btn.getAttribute("data-lang") === lang;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

export async function setLang(lang) {
  if (!LOCALES.includes(lang)) lang = "en";
  dict = await loadDict(lang);
  current = lang;
  document.documentElement.lang = lang;
  apply(dict);
  setActivePill(lang);
  listeners.forEach((fn) => {
    try {
      fn(dict);
    } catch (e) {
      console.error(e);
    }
  });
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {}
  const url = new URL(location.href);
  if (lang === "en") url.searchParams.delete("lang");
  else url.searchParams.set("lang", lang);
  history.replaceState(null, "", url);
}

function wireSwitcher() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLang(btn.getAttribute("data-lang")).catch(console.error);
    });
  });
}

document.addEventListener("portal:dom", () => apply(dict));

wireSwitcher();
setLang(detectLang()).catch((err) => {
  console.error(err);
  setLang("en");
});
