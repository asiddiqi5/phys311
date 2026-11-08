// main.js -- wiring only. It builds the reactor, runs the accumulator loop, and connects
// engine/, render/, input.js and ui.js. There is no physics and no drawing in this file.

import { vec } from "./engine/vec2.js";
import { Accumulator } from "./engine/world.js";
import { INTEGRATORS } from "./engine/integrators.js";
import { Camera } from "./render/camera.js";
import { ReactorRenderer } from "./render/reactor_renderer.js";
import { ReactorHUD } from "./render/reactor_hud.js";
import { StripChart } from "./render/stripchart.js";
import { buildReactor } from "./scenes/reactor.js";
import { Input, MouseSpring, bindKeys } from "./input.js";
import { setupUI, sync, makeAnnouncer, Recorder, downloadCSV, clamp, DT_CHOICES } from "./ui.js";

const $ = (id) => document.getElementById(id);
const canvas = $("sim");
const camera = new Camera(canvas);
const renderer = new ReactorRenderer(canvas, camera);
const hud = new ReactorHUD($("hud"));
const chart = new StripChart($("chart"));
const announce = makeAnnouncer($("live"));

const state = { running: true, speed: 1, dtIndex: 2, fireSpeed: 3 };
const timing = { fps: 60, physicsMs: 0, renderMs: 0 };
const spring = new MouseSpring();
const recorder = new Recorder();
let acc = new Accumulator(DT_CHOICES[state.dtIndex]);
let world = null;
let cursor = null;

/* ---------------------------------------------------------- the scene */

// a reset keeps the slider settings, rebuilds everything else from the same seed, and
// takes a fresh energy baseline (the constructor does that, so E0 is never stale)
function build() {
  const keep = world
    ? { rods: world.p.rods, moderator: world.p.moderator, albedo: world.p.albedo,
        source: world.p.source, integrator: world.integrator.constructor.name }
    : {};
  world = buildReactor(keep);
  world.addForce(spring);
  world.externals.push(spring);
  spring.release();
  recorder.reset();
  world.observers.push((w) => recorder.sample(w));
  renderer.clearTrails();
  renderer.overlay.grab = null;
  renderer.overlay.aim = null;
  $("note").textContent = world.note;
  acc.reset();
  resize();
}

/* ---------------------------------------------------------- size and pixels */

// the drawing buffer is the CSS size times devicePixelRatio, so lines stay sharp on a phone.
// CSS gives the canvas width: 100% and height: auto, so the aspect ratio follows the buffer
function resize() {
  if (!world) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(280, Math.floor($("stage").clientWidth));
  const v = world.view;
  const aspect = (v.ymax - v.ymin) / (v.xmax - v.xmin);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssW * aspect * dpr);
  renderer.dpr = dpr;
  camera.fit(v, 1);           // pad = 1, so the canvas corners are exactly the view bounds

  const c = $("chart");
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(150 * dpr);
  chart.dpr = dpr;
}

function corners() {
  const tl = camera.screenToWorld({ x: 0, y: 0 });
  const br = camera.screenToWorld({ x: canvas.width, y: canvas.height });
  return { xmin: tl.x, ymin: br.y, xmax: br.x, ymax: tl.y };
}

/* ---------------------------------------------------------- actions */

const DT = () => DT_CHOICES[state.dtIndex];

function setSpeed(v) {
  state.speed = clamp(v, 0.25, 2);
  sync(ctx);
  announce(`Speed ${state.speed.toFixed(2)} times`);
}

const actions = {
  togglePause() {
    state.running = !state.running;
    acc.reset();                       // throw away the time spent paused
    sync(ctx);
    announce(state.running ? "Running" : "Paused");
  },

  // exactly one DT. it pauses first, so t on the HUD goes up by DT and nothing else
  stepOnce() {
    if (state.running) { state.running = false; acc.reset(); }
    world.step(DT());
    renderer.recordTrails(world);
    sync(ctx);
    announce(`Stepped to t = ${world.time.toFixed(3)} seconds`);
  },

  reset() { build(); sync(ctx); announce("Simulation reset"); },
  speedUp() { setSpeed(state.speed + 0.25); },
  speedDown() { setSpeed(state.speed - 0.25); },

  // the keyboard route to the slingshot: a neutron from the left edge, at the speed on the slider
  fire() {
    const y = 1 + Math.random() * (world.p.H - 2);
    const ok = world.fire(vec(0.25, y), vec(state.fireSpeed, 0));
    announce(ok ? `Fired a neutron at ${state.fireSpeed.toFixed(1)} meters per second`
                : "The population cap is full, so no neutron was added");
  },

  scram() { world.scram(); sync(ctx); announce("SCRAM. Control rods fully inserted"); },

  toggleTrails() {
    renderer.showTrails = !renderer.showTrails;
    if (!renderer.showTrails) renderer.clearTrails();
    $("trails").checked = renderer.showTrails;
  },

  cancel() { input.cancel(); },
  setDT(i) {
    state.dtIndex = clamp(Math.round(i), 0, DT_CHOICES.length - 1);     // an index, never a fraction
    acc = new Accumulator(DT_CHOICES[state.dtIndex]);
  },

  setIntegrator(name) {
    world.integrator = new INTEGRATORS[name]();
    world.p.integrator = name;
    announce(`Integrator ${world.integrator.constructor.label}`);
  },

  setTeleport(on) {
    input.teleport = on;
    announce(on ? "Teleport drag on. This is the wrong way to drag, for the write-up" : "Teleport drag off");
  },

  downloadCSV() {
    if (!recorder.rows.length) { announce("Nothing recorded yet"); return; }
    downloadCSV(recorder.rows);
    announce(`Downloaded ${recorder.rows.length} rows`);
  },
};

const ctx = { world: () => world, state, renderer, actions };

/* ---------------------------------------------------------- the loop */

// speed scales the clock that feeds the accumulator. it never scales DT,
// so physics still advances in identical slices, just more or fewer per second
let lastNow = null, vclock = 0, lastHud = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);        // first, so one bad frame cannot stop the loop
  try {
    if (lastNow !== null) {
      const real = nowMs - lastNow;
      if (real > 0) timing.fps = 0.9 * timing.fps + 0.1 * (1000 / real);
      vclock += Math.max(0, real) * state.speed;
    }
    lastNow = nowMs;

    if (state.running) {
      const t0 = performance.now();
      acc.advance(vclock, (step) => world.step(step));
      timing.physicsMs = 0.9 * timing.physicsMs + 0.1 * (performance.now() - t0);
      renderer.recordTrails(world);
      if (world.firstBadBody()) {          // should not happen. rebuild instead of freezing
        console.error("non-finite body, rebuilding the scene");
        announce("A body went non-finite, so the scene was rebuilt");
        build();
      }
    }

    const t1 = performance.now();
    renderer.draw(world);
    timing.renderMs = 0.9 * timing.renderMs + 0.1 * (performance.now() - t1);

    if (nowMs - lastHud > 100) {
      hud.update(world, timing, acc, { cursor, corners: corners(), paused: !state.running });
      chart.draw(world);
      lastHud = nowMs;
    }
  } catch (err) {
    console.error(err);
    state.running = false;
    sync(ctx);
    announce("Paused because of an error. Press R to reset");
  }
}

/* ---------------------------------------------------------- start */

const input = new Input({
  canvas, camera, renderer, spring,
  getWorld: () => world,
  onCursor: (p) => { cursor = p; },
  announce,
});

build();
setupUI(ctx);
bindKeys(actions);

window.addEventListener("resize", resize);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe($("stage"));
document.addEventListener("visibilitychange", () => { lastNow = null; acc.reset(); });

// respect the system setting: start paused, no trails, no flashing
if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  state.running = false;
  renderer.showTrails = false;
  renderer.showFlashes = false;
  $("trails").checked = false;
  $("flashes").checked = false;
  sync(ctx);
  announce("Started paused because your system asks for reduced motion. Press Space to run.");
}

window.getWorld = () => world;       // for the Console
requestAnimationFrame(frame);
