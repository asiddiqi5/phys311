// main.js -- the only file that knows about both engine/ and render/.
// it builds a scene, runs the accumulator loop, and hooks up the controls.

import { Accumulator } from "./engine/world.js";
import { INTEGRATORS } from "./engine/integrators.js";
import { Camera } from "./render/camera.js";
import { Renderer } from "./render/renderer.js";
import { HUD } from "./render/hud.js";
import { SCENES } from "./scenes/scenes.js";
import { validate, runScaling } from "./tests/validate.js";

const $ = (id) => document.getElementById(id);
const canvas = $("sim");
const camera = new Camera(canvas);
const renderer = new Renderer(canvas, camera);
const hud = new HUD($("hud"));

let world = null;
let acc = new Accumulator(1 / 240);
let running = true;
let sceneKey = "billiards";
const timing = { fps: 60, physicsMs: 0, renderMs: 0, lastMs: null };

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(r.width - 20));
  canvas.height = Math.max(240, Math.floor(canvas.width * 0.58));
  if (world) camera.fit(world.view);
}

function buildScene() {
  const s = SCENES[sceneKey];
  const opts = {
    integrator: $("integrator").value,
    broadPhase: $("broadphase").value,
    e: Number($("restitution").value),
  };
  if (s.nChoices) opts.n = Number($("nBodies").value);
  world = s.make(opts);
  world.separatingGuard = $("guard").checked;
  world.captureBaseline();          // once, here. never inside frame()
  renderer.clearTrails();
  acc = new Accumulator(1 / Number($("dt").value));
  camera.fit(world.view);
  $("note").textContent = world.note ?? "";
}

// a new scene loads its own defaults first
function changeScene() {
  sceneKey = $("scene").value;
  const s = SCENES[sceneKey];
  const nSel = $("nBodies");
  nSel.innerHTML = "";
  nSel.disabled = !s.nChoices;
  for (const n of s.nChoices ?? ["fixed"]) {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = n;
    nSel.appendChild(o);
  }
  if (s.nChoices) nSel.value = s.defaultN;
  $("restitution").value = s.defaultE;
  $("eValue").textContent = s.defaultE.toFixed(2);
  $("dt").value = s.dt;
  $("integrator").value = s.integrator;
  renderer.showTrails = sceneKey === "nBody";
  $("trails").checked = renderer.showTrails;
  buildScene();
}

/* ---------------------------------------------------------- controls */

function fillSelects() {
  for (const [k, v] of Object.entries(SCENES)) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = v.label;
    $("scene").appendChild(o);
  }
  for (const [k, C] of Object.entries(INTEGRATORS)) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = C.label;
    $("integrator").appendChild(o);
  }
}

function togglePause() {
  running = !running;
  $("playpause").textContent = running ? "Pause" : "Play";
  acc.reset();                      // throw away the time spent paused
}

function showOutput(text, ok = true) {
  const panel = $("testOut");
  panel.style.display = "block";
  panel.textContent = text;
  panel.className = "tests " + (ok ? "good" : "bad");
}

function wire() {
  $("scene").onchange = changeScene;
  $("nBodies").onchange = buildScene;
  $("dt").onchange = buildScene;
  $("reset").onclick = buildScene;
  $("playpause").onclick = togglePause;
  $("stepOnce").onclick = () => { world.step(acc.DT); renderer.recordTrails(world); };

  // these change the running world without a reset
  $("integrator").onchange = () => { world.integrator = new INTEGRATORS[$("integrator").value](); };
  $("broadphase").onchange = () => { world.broadPhase = $("broadphase").value; };
  $("guard").onchange = () => { world.separatingGuard = $("guard").checked; };
  $("restitution").oninput = () => {
    world.restitution = Number($("restitution").value);
    $("eValue").textContent = world.restitution.toFixed(2);
  };

  $("trails").onchange = (e) => { renderer.showTrails = e.target.checked; renderer.clearTrails(); };
  $("vectors").onchange = (e) => { renderer.showVectors = e.target.checked; };
  $("grid").onchange = (e) => { renderer.showGrid = e.target.checked; };

  $("runTests").onclick = () => {
    showOutput("running (about 15 s)...");
    setTimeout(() => {
      const r = validate();
      showOutput(r.text, r.passed === r.total);
      acc.reset();
    }, 30);
  };

  $("runBench").onclick = () => {
    showOutput("running, the page freezes for a few seconds...");
    setTimeout(() => {
      const saved = world;
      const r = runScaling({ renderFrame: (w) => { camera.fit(w.view); renderer.draw(w); } });
      world = saved;
      camera.fit(world.view);
      showOutput(r.text);
      acc.reset();
    }, 30);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (ev) => {
    if (["SELECT", "INPUT"].includes(ev.target.tagName)) return;
    if (ev.key === "r" || ev.key === "R") buildScene();
    if (ev.key === "p" || ev.key === "P") togglePause();
  });

  // drag to pan, scroll to zoom
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.offsetX, y: e.offsetY, c: { ...camera.center } };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    camera.center.x = drag.c.x - (e.offsetX - drag.x) / camera.scale;
    camera.center.y = drag.c.y + (e.offsetY - drag.y) / camera.scale;
  });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    camera.scale *= Math.exp(-e.deltaY * 0.0015);
  }, { passive: false });
}

/* ---------------------------------------------------------- the loop */

function frame(nowMs) {
  if (timing.lastMs !== null && nowMs > timing.lastMs) {
    timing.fps = 0.9 * timing.fps + 0.1 * (1000 / (nowMs - timing.lastMs));
  }
  timing.lastMs = nowMs;

  if (running) {
    const t0 = performance.now();
    acc.advance(nowMs, (DT) => world.step(DT));
    timing.physicsMs = 0.9 * timing.physicsMs + 0.1 * (performance.now() - t0);
    renderer.recordTrails(world);

    const bad = world.firstBadBody();
    if (bad) {
      console.error("NaN body!", bad);
      togglePause();
      $("note").textContent = `Paused: a body went non-finite at t = ${world.time.toFixed(3)} s.`;
    }
  }

  const t1 = performance.now();
  renderer.draw(world);             // draw every frame, even when paused
  timing.renderMs = 0.9 * timing.renderMs + 0.1 * (performance.now() - t1);
  hud.update(world, timing, acc);
  requestAnimationFrame(frame);
}

fillSelects();
wire();
resize();
changeScene();
requestAnimationFrame(frame);

// for the Console
window.getWorld = () => world;
window.validate = () => validate().text;
