/** Role-based onboarding path switcher */
const tabs = [...document.querySelectorAll("[data-path]")];
const panels = document.querySelectorAll("[data-panel]");

function showPath(id) {
  tabs.forEach((btn) => {
    const on = btn.getAttribute("data-path") === id;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
    btn.tabIndex = on ? 0 : -1;
  });
  panels.forEach((panel) => {
    const on = panel.getAttribute("data-panel") === id;
    panel.hidden = !on;
    panel.classList.toggle("is-active", on);
  });
  try {
    sessionStorage.setItem("aimarket-portal-path", id);
  } catch (_) {}
}

tabs.forEach((btn) => {
  btn.addEventListener("click", () => showPath(btn.getAttribute("data-path")));
  btn.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(btn);
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next == null) return;
    event.preventDefault();
    const target = tabs[next];
    showPath(target.getAttribute("data-path"));
    target.focus();
  });
});

const paths = new Set(tabs.map((tab) => tab.dataset.path));
const requested = new URLSearchParams(location.search).get("path");
let saved;
try {
  saved = sessionStorage.getItem("aimarket-portal-path");
} catch (_) {}
showPath(paths.has(requested) ? requested : paths.has(saved) ? saved : "see");
