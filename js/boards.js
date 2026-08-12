/**
 * Render direction boards + idea cards from data/boards.json
 */
import { mountAll } from "./preview3d.js?v=20260811u";

const root = document.getElementById("boards-root");
if (!root) {
  /* idea pages don't need boards */
} else {
  const base = document.documentElement.dataset.base || "";

  async function load() {
    const res = await fetch(`${base}data/boards.json`);
    const data = await res.json();
    root.innerHTML = "";

    data.boards.forEach((board) => {
      const section = document.createElement("div");
      section.className = "board reveal";
      section.style.setProperty("--board-accent", board.accent);
      section.id = `board-${board.id}`;

      section.innerHTML = `
        <header class="board-head">
          <div class="board-kicker" data-i18n="board.${board.id}.kicker"></div>
          <h3 class="board-title" data-i18n="board.${board.id}.title"></h3>
          <p class="board-sub" data-i18n="board.${board.id}.sub"></p>
        </header>
        <div class="board-grid"></div>
      `;
      const grid = section.querySelector(".board-grid");

      board.ideas.forEach((slug) => {
        const idea = data.ideas[slug];
        if (!idea) return;
        const chipClass =
          idea.chip === "live-wedge"
            ? "chip-live"
            : idea.chip === "live-rails"
              ? "chip-live"
              : idea.chip === "partner"
                ? "chip-partner"
                : idea.chip === "live"
                  ? "chip-live"
                  : "chip-idea";
        const chipKey =
          idea.chip === "live-wedge"
            ? "chip.live"
            : idea.chip === "live-rails"
              ? "chip.rails"
              : idea.chip === "partner"
                ? "chip.partner"
                : idea.chip === "live"
                  ? "chip.liveSurface"
                  : "chip.idea";

        const a = document.createElement("a");
        a.className = "icard";
        a.href = `${base}ideas.html?id=${encodeURIComponent(slug)}`;
        a.innerHTML = `
          <div class="icard-viz" aria-hidden="true">
            <canvas data-scene="${idea.scene || board.scene}" data-accent="${idea.accent || board.accent}"></canvas>
            <div class="icard-glow"></div>
          </div>
          <div class="icard-body">
            <span class="chip ${chipClass}" data-i18n="${chipKey}"></span>
            <h4 data-i18n="idea.${slug}.title"></h4>
            <p data-i18n="idea.${slug}.teaser"></p>
            <span class="icard-go" data-i18n="boards.open">Open idea →</span>
          </div>
        `;
        grid.appendChild(a);
      });

      root.appendChild(section);
    });

    /* re-apply i18n if already loaded */
    document.dispatchEvent(new CustomEvent("portal:dom"));
    mountAll(root);

    /* reveal observer for new nodes */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("on");
        });
      },
      { threshold: 0.1 }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  load().catch(console.error);
}
