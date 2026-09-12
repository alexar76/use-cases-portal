/**
 * Planetary glass — lightweight Three.js hero
 * No textures required; procedural globe + LIVE pins + starfield
 *
 * Mobile: skip WebGL hero entirely — phones share ~8 contexts with card
 * previews; keeping a full-screen globe alive blanks every board card after
 * a few scrolls. CSS `.stage--fallback` covers the hero instead.
 */
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvasHost = document.getElementById("stage");
if (!canvasHost) throw new Error("#stage missing");

const coarse =
  window.matchMedia("(pointer: coarse)").matches ||
  window.matchMedia("(max-width: 767px)").matches;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (coarse) {
  canvasHost.classList.add("stage--fallback");
} else {

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.2, 3.35);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
} catch (err) {
  console.warn("[scene] WebGL unavailable — static hero", err);
  canvasHost.classList.add("stage--fallback");
}

if (!renderer) {
  // CSS fallback only — do not touch WebGL APIs below.
} else {

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
canvasHost.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

/* starfield */
{
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 18 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xb8c8e8,
    size: 0.035,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
  });
  scene.add(new THREE.Points(geo, mat));
}

const sphereSeg = 64;
const wireSeg = 28;


/* atmosphere shell */
const atmos = new THREE.Mesh(
  new THREE.SphereGeometry(1.28, sphereSeg, sphereSeg),
  new THREE.MeshBasicMaterial({
    color: 0x3de0c5,
    transparent: true,
    opacity: 0.11,
    side: THREE.BackSide,
  })
);
root.add(atmos);

/* soft glow shell */
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1.42, Math.max(24, sphereSeg - 16), Math.max(24, sphereSeg - 16)),
  new THREE.MeshBasicMaterial({
    color: 0x1a8a7a,
    transparent: true,
    opacity: 0.07,
    side: THREE.BackSide,
  })
);
root.add(glow);

/* globe wire + dark body */
const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1.12, sphereSeg, sphereSeg),
  new THREE.MeshStandardMaterial({
    color: 0x0a1524,
    metalness: 0.35,
    roughness: 0.55,
    emissive: 0x061018,
  })
);
root.add(globe);

const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.SphereGeometry(1.125, wireSeg, Math.max(12, wireSeg - 8))),
  new THREE.LineBasicMaterial({ color: 0x3a5a78, transparent: true, opacity: 0.35 })
);
root.add(wire);

/* latitude rings */
for (const y of [-0.55, 0, 0.55]) {
  const r = Math.sqrt(Math.max(0.01, 1.12 * 1.12 - y * y));
  const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(coarse ? 48 : 96).map((p) => new THREE.Vector3(p.x, y, p.y));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  root.add(new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x2a6a7a, transparent: true, opacity: 0.45 })));
}

/* LIVE pins */
const pinGroup = new THREE.Group();
root.add(pinGroup);
const pinGeo = new THREE.SphereGeometry(0.028, coarse ? 8 : 12, coarse ? 8 : 12);
const liveMat = new THREE.MeshBasicMaterial({ color: 0x3de0c5 });
const simMat = new THREE.MeshBasicMaterial({ color: 0xf0c14a });
const pinData = [];

function latLonToVec(lat, lon, radius) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

const sites = [
  [52.5, 13.4, true], [40.7, -74.0, true], [35.7, 139.7, true],
  [51.5, -0.12, true], [-33.9, 18.4, false], [1.3, 103.8, true],
  [55.75, 37.62, true], [37.77, -122.4, true], [-23.5, -46.6, false],
  [28.6, 77.2, true], [48.85, 2.35, true], [25.2, 55.3, true],
  [-37.8, 144.9, true], [59.9, 30.3, false], [41.9, 12.5, true],
];

const siteList = coarse ? sites.slice(0, 9) : sites;

siteList.forEach(([lat, lon, live], i) => {
  const mesh = new THREE.Mesh(pinGeo, live ? liveMat : simMat);
  const v = latLonToVec(lat, lon, 1.14);
  mesh.position.copy(v);
  pinGroup.add(mesh);
  /* pulse ring */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.055, coarse ? 16 : 24),
    new THREE.MeshBasicMaterial({
      color: live ? 0x3de0c5 : 0xf0c14a,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  ring.position.copy(v);
  ring.lookAt(0, 0, 0);
  pinGroup.add(ring);
  pinData.push({ mesh, ring, phase: i * 0.7, live });
});

/* orbiting mote */
const mote = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
root.add(mote);

const amb = new THREE.AmbientLight(0x6a7a9a, 0.55);
const key = new THREE.DirectionalLight(0x9fe8d8, 1.1);
key.position.set(3, 2, 4);
const fill = new THREE.DirectionalLight(0x4060a0, 0.4);
fill.position.set(-3, -1, -2);
scene.add(amb, key, fill);

let mx = 0,
  my = 0,
  tx = 0,
  ty = 0;
window.addEventListener("pointermove", (e) => {
  tx = (e.clientX / window.innerWidth) * 2 - 1;
  ty = (e.clientY / window.innerHeight) * 2 - 1;
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
let lastFrame = 0;
const minFrameMs = coarse ? 1000 / 24 : 0;
let alive = true;
let inView = true;
let raf = 0;

canvasHost.addEventListener(
  "webglcontextlost",
  (e) => {
    e.preventDefault();
    alive = false;
    cancelAnimationFrame(raf);
    raf = 0;
    canvasHost.classList.add("stage--fallback");
  },
  false
);

// preventDefault() above asks the browser for a restore; take it when it comes
// (THREE re-uploads GPU resources itself) instead of staying on the fallback forever.
canvasHost.addEventListener(
  "webglcontextrestored",
  () => {
    canvasHost.classList.remove("stage--fallback");
    alive = true;
    lastFrame = 0;
    kick();
  },
  false
);

function frame(now) {
  if (!alive || !inView) {
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(frame);
  if (minFrameMs && now - lastFrame < minFrameMs) return;
  lastFrame = now || performance.now();

  const t = clock.getElapsedTime();
  mx += (tx - mx) * 0.04;
  my += (ty - my) * 0.04;

  if (!reduce) {
    root.rotation.y = t * 0.12 + mx * 0.35;
    root.rotation.x = 0.18 + my * 0.12;
    atmos.rotation.y = -t * 0.05;
    mote.position.set(Math.cos(t * 0.7) * 1.55, Math.sin(t * 0.45) * 0.35, Math.sin(t * 0.7) * 1.55);
    pinData.forEach((p) => {
      const s = 1 + Math.sin(t * 2.2 + p.phase) * 0.35;
      p.ring.scale.setScalar(s);
      p.ring.material.opacity = 0.25 + Math.sin(t * 2.2 + p.phase) * 0.25;
    });
  }

  camera.position.x = mx * 0.25;
  camera.position.y = 0.35 - my * 0.15;
  camera.lookAt(0, 0, 0);
  try {
    renderer.render(scene, camera);
  } catch (err) {
    console.warn("[scene] render failed", err);
    alive = false;
    canvasHost.classList.add("stage--fallback");
  }
}

function kick() {
  if (!alive || !inView || raf) return;
  raf = requestAnimationFrame(frame);
}

if (typeof IntersectionObserver !== "undefined") {
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) kick();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { rootMargin: "40px 0px", threshold: 0.01 }
  );
  io.observe(canvasHost);
}

kick();

} // end renderer boot
} // end desktop hero (!coarse)
