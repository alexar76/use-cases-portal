/** Scroll reveal + 3D tilt cards */
function observeReveals(root = document) {
  const reveals = root.querySelectorAll(".reveal:not(.on)");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("on");
          io.unobserve(e.target);
        }
      });
    },
    // Fire as soon as any pixel enters — large grids used to stay opacity:0 forever
    // because only a sliver of the block was on screen (< threshold).
    { threshold: 0, rootMargin: "0px 0px -4% 0px" }
  );
  reveals.forEach((el) => io.observe(el));
  // Hash / deep-link: force the target section visible immediately
  const hash = (location.hash || "").replace(/^#/, "");
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      target.classList.add("on");
      target.querySelectorAll(".reveal").forEach((el) => el.classList.add("on"));
    }
  }
  // Anything already in the first viewport
  reveals.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add("on");
  });
}

observeReveals();
document.addEventListener("portal:dom", () => observeReveals());
// Safety net: never leave the page looking "empty" if IO mis-fires
setTimeout(() => {
  document.querySelectorAll(".reveal:not(.on)").forEach((el) => el.classList.add("on"));
}, 1800);

/* magnetic tilt on cards */
const cards = document.querySelectorAll("[data-tilt], a.card.tilt, a.icard");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

cards.forEach((card) => {
  if (reduce) return;
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * 12;
    const ry = (x - 0.5) * 14;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

/* year stamp */
const y = document.getElementById("year");
if (y) y.textContent = String(new Date().getFullYear());
