/**
 * Card previews — Three.js with a hard context cap.
 *
 * Chrome kills blank canvases once too many WebGL contexts exist (~8–16).
 * Pause/resume kept every card alive → all contexts died after scrolling.
 *
 * Rules:
 *   - at most MAX_LIVE renderers (1 mobile / 4 desktop = one board row; hero may use one more)
 *   - off-screen cards: dispose + replace <canvas> + CSS poster
 *   - on-screen: mount on a fresh canvas; preempt least-visible if at cap
 *   - never leave opacity:0 without a poster
 *   - on webglcontextlost: tear down cleanly and allow remount
 */
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse =
  window.matchMedia("(pointer: coarse)").matches ||
  window.matchMedia("(max-width: 767px)").matches;

// One Physical-oracle row is 4 cards — with MAX_LIVE=2 the right pair stayed on
// CSS posters forever (equal-ratio preempt refuses to steal). Cap at a full row.
const MAX_LIVE = coarse ? 1 : 4;
const minFrameMs = coarse ? 1000 / 20 : 1000 / 40;
const DISPOSE_MS = 180;

function hex(c) {
  return new THREE.Color(c || "#3de0c5");
}

function paintPoster(host, accent) {
  if (!host) return;
  host.classList.add("icard-viz--poster");
  host.style.setProperty("--viz-accent", accent || "#3de0c5");
  const c = host.querySelector("canvas[data-scene]");
  if (c) {
    c.style.opacity = "0";
    c.style.visibility = "hidden";
  }
}

function clearPoster(host) {
  if (!host) return;
  host.classList.remove("icard-viz--poster");
  const c = host.querySelector("canvas[data-scene]");
  if (c) {
    c.style.opacity = "1";
    c.style.visibility = "visible";
  }
}

function freshCanvas(old, scene, accent) {
  const next = document.createElement("canvas");
  next.setAttribute("data-scene", scene);
  next.setAttribute("data-accent", accent);
  next.style.cssText = "width:100%;height:100%;display:block;opacity:0;visibility:hidden";
  old.replaceWith(next);
  return next;
}

function makeScene(kind, accent) {
  const group = new THREE.Group();
  const col = hex(accent);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    metalness: 0.25,
    roughness: 0.4,
    emissive: col,
    emissiveIntensity: 0.35,
  });
  const wire = new THREE.MeshBasicMaterial({
    color: col,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
  });
  const seg = coarse ? 16 : 28;

  if (kind === "globe" || kind === "storm" || kind === "pins") {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, seg, seg), wire));
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, Math.max(12, seg - 4), Math.max(12, seg - 4)),
      mat.clone()
    );
    core.material.transparent = true;
    core.material.opacity = 0.35;
    group.add(core);
    for (let i = 0; i < (coarse ? 5 : 8); i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      const th = (i / 8) * Math.PI * 2;
      const ph = 0.4 + (i % 3) * 0.35;
      p.position.set(
        Math.sin(ph) * Math.cos(th) * 0.72,
        Math.cos(ph) * 0.72,
        Math.sin(ph) * Math.sin(th) * 0.72
      );
      group.add(p);
    }
  } else if (kind === "hex" || kind === "embed") {
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 6), mat.clone());
        m.material.transparent = true;
        m.material.opacity = 0.55;
        m.rotation.x = Math.PI / 2;
        m.position.set(c * 0.48, r * 0.42, (r + c) * 0.04);
        group.add(m);
      }
    }
  } else if (kind === "shield") {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.18, 6), mat);
    shield.rotation.x = Math.PI / 2;
    group.add(shield);
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 8, 48), wire));
  } else if (kind === "star") {
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), wire));
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat));
  } else if (kind === "blocks") {
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35 + i * 0.08, 0.35), mat.clone());
      b.material.transparent = true;
      b.material.opacity = 0.5 + i * 0.08;
      b.position.set((i - 2) * 0.28, i * 0.05 - 0.2, (i % 2) * 0.12);
      group.add(b);
    }
  } else if (kind === "platonic") {
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), wire));
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.38), mat));
  } else if (kind === "radar") {
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 8, 64), wire));
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 48), wire));
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), mat);
    needle.position.y = 0.2;
    needle.name = "needle";
    group.add(needle);
  } else if (kind === "threshold" || kind === "pack" || kind === "receipt") {
    // Flat slab reads as “broken 3D” next to globes — stack + ring so it spins in depth.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.1), mat.clone());
    slab.material.transparent = true;
    slab.material.opacity = 0.45;
    group.add(slab);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.09, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bar.position.set(0, 0.12, 0.08);
    group.add(bar);
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.028, 8, 48), wire));
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    pip.position.set(0.35, -0.18, 0.2);
    group.add(pip);
  } else {
    group.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.42, 0.12, coarse ? 64 : 100, 16), mat));
  }

  group.userData.spin = kind === "radar" ? 1.4 : 0.35;
  return group;
}

/** @type {Set<{ card: object, dispose: Function }>} */
const live = new Set();

function createPreview(canvas, sceneKind, accent, card, onDead) {
  const host = canvas.parentElement || canvas;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (err) {
    console.warn("[preview3d] WebGL unavailable", err);
    paintPoster(host, accent);
    return null;
  }

  const gl = renderer.getContext();
  if (!gl || gl.isContextLost?.()) {
    try {
      renderer.dispose();
    } catch {
      /* ignore */
    }
    paintPoster(host, accent);
    return null;
  }

  renderer.setClearColor(0x070b14, 1);
  clearPoster(host);

  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
  cam.position.set(0, 0.15, 3.1);
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1);
  key.position.set(2, 3, 4);
  sc.add(key);
  const obj = makeScene(sceneKind, accent);
  sc.add(obj);

  let raf = 0;
  let running = true;
  let lastFrame = 0;
  const t0 = performance.now();
  let alive = true;

  const resize = () => {
    if (!alive || !renderer) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    try {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
    } catch {
      return;
    }
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
  };

  const renderOnce = () => {
    try {
      renderer.render(sc, cam);
    } catch (err) {
      console.warn("[preview3d] render failed", err);
      kill();
    }
  };

  const tick = (now) => {
    if (!running || !alive) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
    if (now - lastFrame < minFrameMs) return;
    lastFrame = now;
    if (gl.isContextLost?.()) {
      kill();
      return;
    }
    const t = (now - t0) / 1000;
    if (!reduce) {
      obj.rotation.y = t * obj.userData.spin;
      obj.rotation.x = Math.sin(t * 0.4) * 0.12;
      const needle = obj.getObjectByName("needle");
      if (needle) needle.rotation.z = t * 2.2;
    }
    renderOnce();
  };

  const kill = () => {
    if (!alive) return;
    alive = false;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.removeEventListener("webglcontextlost", onLost);
    try {
      ro.disconnect();
    } catch {
      /* ignore */
    }
    try {
      sc.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      // dispose() alone leaves the GL context alive until GC; zombie contexts
      // pile up while scrolling and Chrome reaps the oldest LIVE one (the hero).
      renderer.forceContextLoss();
      renderer.dispose();
    } catch {
      /* ignore */
    }
    renderer = null;
    live.delete(token);
    if (onDead) onDead();
  };

  const onLost = (e) => {
    e.preventDefault();
    kill();
  };
  canvas.addEventListener("webglcontextlost", onLost, false);

  resize();
  renderOnce();
  requestAnimationFrame(resize);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  raf = requestAnimationFrame(tick);

  const token = {
    card,
    dispose() {
      kill();
    },
  };
  live.add(token);
  return token;
}

export function mountPreview(canvas, { scene = "globe", accent = "#3de0c5" } = {}) {
  if (!canvas) return () => {};
  const host = canvas.parentElement || canvas;
  paintPoster(host, accent);
  let current = canvas;
  const card = { host, ratio: 1, want: true };
  let handle = createPreview(current, scene, accent, card, () => {
    handle = null;
    current = freshCanvas(current, scene, accent);
    paintPoster(host, accent);
  });
  return () => {
    if (handle) handle.dispose();
    handle = null;
    paintPoster(host, accent);
  };
}

/** @type {object[]} */
const registry = [];

function preemptWorst(except) {
  let worst = null;
  for (const t of live) {
    const c = t.card;
    if (!c || c === except) continue;
    if (!c.want) {
      worst = t;
      break;
    }
    if (!worst || (c.ratio || 0) < (worst.card.ratio || 0)) worst = t;
  }
  if (!worst) return false;
  // A visible card may only be preempted by a clearly MORE visible one —
  // equal-ratio steals ping-pong forever (a dispose/create context storm).
  if (worst.card.want && (worst.card.ratio || 0) + 0.05 >= ((except && except.ratio) || 0)) {
    return false;
  }
  worst.card._forceStop?.();
  return true;
}

export function mountAll(root = document) {
  const markers = [...root.querySelectorAll("canvas[data-scene]")];
  const cleanups = [];

  markers.forEach((initial) => {
    let canvas = initial;
    const host = canvas.parentElement || canvas;
    const scene = canvas.getAttribute("data-scene") || "globe";
    const accent = canvas.getAttribute("data-accent") || "#3de0c5";
    paintPoster(host, accent);

    let handle = null;
    let want = false;
    let ratio = 0;
    let timer = 0;
    let starting = false;

    const card = {
      host,
      get want() {
        return want;
      },
      get ratio() {
        return ratio;
      },
      _forceStop: null,
    };
    registry.push(card);

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
    };

    const stopNow = () => {
      clearTimer();
      if (!handle) {
        paintPoster(host, accent);
        return;
      }
      handle.dispose();
      handle = null;
      // Critical: new canvas so the next WebGL mount is not poisoned.
      canvas = freshCanvas(canvas, scene, accent);
      paintPoster(host, accent);
      // Someone may be waiting for a slot.
      scheduleAll();
    };
    card._forceStop = stopNow;

    const startNow = () => {
      if (!want || handle || starting) return;
      if (document.visibilityState === "hidden") return;
      if (live.size >= MAX_LIVE) {
        if (!preemptWorst(card)) return;
        if (live.size >= MAX_LIVE) return;
      }
      starting = true;
      try {
        handle = createPreview(canvas, scene, accent, card, () => {
          handle = null;
          canvas = freshCanvas(canvas, scene, accent);
          paintPoster(host, accent);
          if (want) setTimeout(() => startNow(), 200);
        });
        if (!handle) {
          canvas = freshCanvas(canvas, scene, accent);
          paintPoster(host, accent);
        }
      } finally {
        starting = false;
      }
    };

    const scheduleAll = () => {
      // Kick highest-ratio waiters.
      const waiting = registry
        .filter((c) => c.want && !c._hasHandle?.())
        .sort((a, b) => b.ratio - a.ratio);
      // startNow is per-card; call via stored refs
      waiting.forEach((c) => c._tryStart?.());
    };

    card._hasHandle = () => !!handle;
    card._tryStart = startNow;

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              let best = 0;
              let hit = false;
              for (const e of entries) {
                if (e.intersectionRatio > best) best = e.intersectionRatio;
                if (e.isIntersecting && e.intersectionRatio > 0) hit = true;
              }
              ratio = best;
              want = hit;
              if (hit) {
                clearTimer();
                startNow();
              } else {
                clearTimer();
                timer = window.setTimeout(() => {
                  timer = 0;
                  if (!want) stopNow();
                }, DISPOSE_MS);
              }
            },
            { rootMargin: "80px 0px", threshold: [0, 0.05, 0.15, 0.35, 0.6, 1] }
          );

    if (io) {
      io.observe(host);
      cleanups.push(() => {
        io.disconnect();
        clearTimer();
        stopNow();
        const i = registry.indexOf(card);
        if (i >= 0) registry.splice(i, 1);
      });
    } else {
      want = true;
      ratio = 1;
      startNow();
      cleanups.push(() => stopNow());
    }
  });

  const onVis = () => {
    if (document.visibilityState === "hidden") {
      [...live].forEach((t) => t.card?._forceStop?.());
    } else {
      registry
        .filter((c) => c.want)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, MAX_LIVE)
        .forEach((c) => c._tryStart?.());
    }
  };
  document.addEventListener("visibilitychange", onVis);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

  return () => cleanups.forEach((fn) => fn());
}
