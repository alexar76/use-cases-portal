/** Role-based onboarding path switcher */
const tabs = document.querySelectorAll("[data-path]");
const panels = document.querySelectorAll("[data-panel]");

function showPath(id) {
  tabs.forEach((btn) => {
    const on = btn.getAttribute("data-path") === id;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
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
});

const q = new URLSearchParams(location.search).get("path");
let initial = "see";
if (q && document.querySelector(`[data-panel="${q}"]`)) initial = q;
else {
  try {
    const s = sessionStorage.getItem("aimarket-portal-path");
    if (s && document.querySelector(`[data-panel="${s}"]`)) initial = s;
  } catch (_) {}
}
showPath(initial);
