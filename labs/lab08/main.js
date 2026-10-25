"use strict";

import { Vec2 } from "./vec2.js";

const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

const G_EARTH = 9.81;
const K_SPRING = 1.0;            // spring scene: m = k = 1, like Lab 3
const MAX_FRAME = 0.25;          // never try to catch up on more than this much time
const MAX_TRAIL = 200;           // positions kept in the fading trail
const AUTO_RELAUNCH_MS = 2000;   // wait this long after a landing, then relaunch

// ---------------------------------------------------------------------------
// Part A: Vec2 self-test (every result was worked out by hand first)
// ---------------------------------------------------------------------------

function vec2SelfTest() {
  console.log("--- Vec2 self-test ---");
  const a = new Vec2(1, 2);
  const b = new Vec2(3, 4);

  const copy = a.clone();
  copy.x = 99;                       // changing the clone must not change a

  const checks = [
    ["add",        "(1,2) + (3,4)",                  [a.add(b).x, a.add(b).y],                  [4, 6]],
    ["sub",        "(3,4) - (1,2)",                  [b.sub(a).x, b.sub(a).y],                  [2, 2]],
    ["mul",        "(1,2) * 3",                      [a.mul(3).x, a.mul(3).y],                  [3, 6]],
    ["dot",        "(1,2) . (3,4)",                  [a.dot(b)],                                [11]],
    ["length",     "|(3,4)|",                        [b.length()],                              [5]],
    ["lengthSq",   "|(3,4)|^2",                      [b.lengthSq()],                            [25]],
    ["normalized", "(3,4) / 5",                      [b.normalized().x, b.normalized().y],      [0.6, 0.8]],
    ["addTo",      "(1,1).addTo((2,3))",             [new Vec2(1, 1).addTo(new Vec2(2, 3)).x, new Vec2(1, 1).addTo(new Vec2(2, 3)).y], [3, 4]],
    ["addScaled",  "(1,1).addScaled((2,4), 0.5)",    [new Vec2(1, 1).addScaled(new Vec2(2, 4), 0.5).x, new Vec2(1, 1).addScaled(new Vec2(2, 4), 0.5).y], [2, 3]],
    ["clone",      "copy.x = 99, original x is",     [a.x],                                     [1]],
  ];

  let allPass = true;
  for (const [name, description, got, expected] of checks) {
    const pass = got.every((value, i) => Math.abs(value - expected[i]) < 1e-12);
    if (!pass) allPass = false;
    console.log(`${name.padEnd(11)} ${description.padEnd(30)} got [${got}]  expected [${expected}]  ${pass ? "PASS" : "FAIL"}`);
  }
  console.log(allPass ? "All Vec2 checks passed." : "Some Vec2 checks FAILED.");
}

// ---------------------------------------------------------------------------
// Part B: Body, force models, integrators
// ---------------------------------------------------------------------------

class Body {
  constructor(x, y, vx, vy, m = 1, radius = 0.3) {
    this.pos = new Vec2(x, y);
    this.vel = new Vec2(vx, vy);
    this.acc = new Vec2(0, 0);
    this.accOld = new Vec2(0, 0);   // Verlet needs last step's acceleration
    this.force = new Vec2(0, 0);
    this.m = m;
    this.radius = radius;
  }

  clearForce() {
    this.force.set(0, 0);
  }

  kineticEnergy() {
    return 0.5 * this.m * this.vel.lengthSq();
  }
}

// each force model clears the accumulator, adds its forces, then sets acc = force / m

function gravityAccel(bodies) {
  for (const b of bodies) {
    b.clearForce();
    b.force.y += -b.m * G_EARTH;
    b.acc.set(b.force.x / b.m, b.force.y / b.m);
  }
}

function gravityPotential(bodies) {
  let total = 0;
  for (const b of bodies) total += b.m * G_EARTH * b.pos.y;
  return total;
}

// spring anchored at the origin, no rest length
function springAccel(bodies) {
  for (const b of bodies) {
    b.clearForce();
    b.force.addScaled(b.pos, -K_SPRING);
    b.acc.set(b.force.x / b.m, b.force.y / b.m);
  }
}

function springPotential(bodies) {
  let total = 0;
  for (const b of bodies) total += 0.5 * K_SPRING * b.pos.lengthSq();
  return total;
}

// same signature for both integrators, so swapping one for the other is a one-line change

function eulerCromer(bodies, dt, accelFn) {
  accelFn(bodies);
  for (const b of bodies) {
    b.vel.addScaled(b.acc, dt);   // velocity first
    b.pos.addScaled(b.vel, dt);   // then position with the new velocity
  }
}

function velocityVerlet(bodies, dt, accelFn) {
  accelFn(bodies);
  for (const b of bodies) {
    b.accOld.set(b.acc.x, b.acc.y);
    // r_new = r + v dt + 0.5 a dt^2
    b.pos.x += b.vel.x * dt + 0.5 * b.acc.x * (dt * dt);
    b.pos.y += b.vel.y * dt + 0.5 * b.acc.y * (dt * dt);
  }
  accelFn(bodies);   // acceleration again at the new positions
  for (const b of bodies) {
    // v_new = v + 0.5 (a_old + a_new) dt
    b.vel.x += 0.5 * (b.accOld.x + b.acc.x) * dt;
    b.vel.y += 0.5 * (b.accOld.y + b.acc.y) * dt;
  }
}

const integrators = { eulerCromer, velocityVerlet };

// ---------------------------------------------------------------------------
// Scenes and energy
// ---------------------------------------------------------------------------

function makeProjectile(speed = 20, angleDeg = 50) {
  const angle = angleDeg * (Math.PI / 180);   // Math.cos wants radians
  const ball = new Body(0, 0, speed * Math.cos(angle), speed * Math.sin(angle), 1, 0.3);
  return { name: "projectile", bodies: [ball], accelFn: gravityAccel, potentialFn: gravityPotential, t: 0, landed: false };
}

function makeSpring() {
  const bob = new Body(1, 0, 0, 0, 1, 0.1);
  return { name: "spring", bodies: [bob], accelFn: springAccel, potentialFn: springPotential, t: 0, landed: false };
}

function kineticTotal(bodies) {
  let total = 0;
  for (const b of bodies) total += b.kineticEnergy();
  return total;
}

function totalEnergy(scene) {
  return kineticTotal(scene.bodies) + scene.potentialFn(scene.bodies);
}

function stepScene(scene, integrator, dt) {
  integrator(scene.bodies, dt, scene.accelFn);
  scene.t += dt;
  if (scene.name === "projectile") {
    const b = scene.bodies[0];
    if (b.pos.y < 0 && b.vel.y < 0) scene.landed = true;
  }
}

// ---------------------------------------------------------------------------
// Part C1: headless run, no rendering and no ground
// ---------------------------------------------------------------------------

function runHeadless(integrator, steps = 1200, dt = 1 / 120) {
  const scene = makeProjectile();
  for (let i = 0; i < steps; i++) integrator(scene.bodies, dt, scene.accelFn);
  const b = scene.bodies[0];
  return { steps, dt, x: b.pos.x, y: b.pos.y, vx: b.vel.x, vy: b.vel.y, E: totalEnergy(scene) };
}

function headlessReport() {
  const lines = ["Headless run: 1200 steps, DT = 1/120 (10 s), no rendering"];
  for (const name of Object.keys(integrators)) {
    const r = runHeadless(integrators[name], 1200, 1 / 120);
    lines.push("", name,
      `  x  = ${r.x}`,
      `  y  = ${r.y}`,
      `  vx = ${r.vx}`,
      `  vy = ${r.vy}`,
      `  E  = ${r.E}`);
  }
  const text = lines.join("\n");
  logEl.textContent = text;
  console.log(text);
}
window.runHeadless = headlessReport;   // so it can be called from the Console

// ---------------------------------------------------------------------------
// Camera: physics coordinates (meters, y up) to pixels (y down)
// ---------------------------------------------------------------------------

class Camera {
  constructor(canvas, scale = 50, originX = 0, originY = 0) {
    this.canvas = canvas;
    this.scale = scale;        // pixels per physics unit
    this.originX = originX;    // physics coordinate at the left edge
    this.originY = originY;    // physics coordinate at the bottom edge
  }

  toScreen(v) {
    return {
      x: (v.x - this.originX) * this.scale,
      y: this.canvas.height - (v.y - this.originY) * this.scale,   // the y flip
    };
  }

  toWorld(px, py) {
    return new Vec2(
      px / this.scale + this.originX,
      (this.canvas.height - py) / this.scale + this.originY
    );
  }
}

const VIEWS = {
  static:     { scale: 50,  originX: -1, originY: -1,                    tick: 1,   labelEvery: 1, ground: true },
  projectile: { scale: 20,  originX: -2, originY: -2,                    tick: 1,   labelEvery: 5, ground: true },
  spring:     { scale: 150, originX: -3, originY: -canvas.height / 300,  tick: 0.5, labelEvery: 2, ground: false },
};

const cameras = {};
for (const name of Object.keys(VIEWS)) {
  const v = VIEWS[name];
  cameras[name] = new Camera(canvas, v.scale, v.originX, v.originY);
}

// ---------------------------------------------------------------------------
// State, read from the page so a browser refresh cannot put them out of sync
// ---------------------------------------------------------------------------

let view = document.getElementById("scene").value;
let integratorName = document.getElementById("integrator").value;
let variableMode = document.getElementById("timestepMode").value === "variable";
let dtDenom = Number(document.getElementById("dt").value);

let scene = null;
let trail = [];
let E0 = 0;
let accumulator = 0;
let paused = false;
let lagPending = false;
let landedAt = null;
let lastTime = 0;
let lastSteps = 0;
let fps = 60;

function resetScene() {
  scene = view === "spring" ? makeSpring() : makeProjectile();
  E0 = totalEnergy(scene);
  trail = [];
  accumulator = 0;
  landedAt = null;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function label(value) {
  return String(Math.round(value * 100) / 100);
}

function drawLine(p, q) {
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

function drawAxes(cam, config) {
  const left = cam.originX;
  const right = cam.originX + canvas.width / cam.scale;
  const bottom = cam.originY;
  const top = cam.originY + canvas.height / cam.scale;

  ctx.lineWidth = 2;
  ctx.font = "11px monospace";

  // the x axis is the ground (y = 0), the y axis is x = 0
  ctx.strokeStyle = config.ground ? "#28a745" : "#8a8a8a";
  drawLine(cam.toScreen(new Vec2(left, 0)), cam.toScreen(new Vec2(right, 0)));
  ctx.strokeStyle = "#8a8a8a";
  drawLine(cam.toScreen(new Vec2(0, bottom)), cam.toScreen(new Vec2(0, top)));

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#8a8a8a";
  ctx.fillStyle = "#b0b0b0";
  for (let i = Math.ceil(left / config.tick); i * config.tick <= right; i++) {
    const x = i * config.tick;
    const p = cam.toScreen(new Vec2(x, 0));
    drawLine({ x: p.x, y: p.y - 4 }, { x: p.x, y: p.y + 4 });
    if (i % config.labelEvery === 0) ctx.fillText(label(x), p.x - 4, p.y + 18);
  }

  for (let j = Math.ceil(bottom / config.tick); j * config.tick <= top; j++) {
    if (j === 0) continue;           // the 0 is already labelled on the x axis
    const y = j * config.tick;
    const p = cam.toScreen(new Vec2(0, y));
    drawLine({ x: p.x - 4, y: p.y }, { x: p.x + 4, y: p.y });
    if (j % config.labelEvery === 0) ctx.fillText(label(y), p.x - 26, p.y + 4);
  }
}

function drawStaticTest(cam) {
  const circle = cam.toScreen(new Vec2(2, 3));
  const ground = cam.toScreen(new Vec2(2, 0));

  ctx.fillStyle = "#ff8200";
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, 0.3 * cam.scale, 0, 2 * Math.PI);
  ctx.fill();

  // dashed line from the ground up to the circle, to measure the height
  ctx.strokeStyle = "#9cdcfe";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  drawLine(ground, circle);
  ctx.setLineDash([]);

  ctx.fillStyle = "#d4d4d4";
  ctx.font = "14px monospace";
  const gap = ground.y - circle.y;
  ctx.fillText("Part A: coordinate test, circle at (2, 3), radius 0.3 m", 140, 30);
  ctx.fillText(`ground y_px = ${ground.y}, circle y_px = ${circle.y}`, 140, 50);
  ctx.fillText(`gap = ${gap} px = ${gap / cam.scale} m at ${cam.scale} px per m`, 140, 70);
}

function drawTrail(cam) {
  ctx.strokeStyle = "#ff8200";
  ctx.lineWidth = 2;
  for (let i = 1; i < trail.length; i++) {
    ctx.globalAlpha = i / trail.length;          // older points are fainter
    drawLine(cam.toScreen(trail[i - 1]), cam.toScreen(trail[i]));
  }
  ctx.globalAlpha = 1;
}

function drawBodies(cam) {
  const color = scene.name === "spring" ? "#4ec9b0" : "#ff8200";
  for (const b of scene.bodies) {
    const p = cam.toScreen(b.pos);

    if (scene.name === "spring") {
      // the spring itself and its anchor
      const anchor = cam.toScreen(new Vec2(0, 0));
      ctx.strokeStyle = "#6a9955";
      ctx.lineWidth = 2;
      drawLine(anchor, p);
      ctx.fillStyle = "#888";
      ctx.fillRect(anchor.x - 5, anchor.y - 5, 10, 10);
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(b.radius * cam.scale, 4), 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawHud() {
  const b = scene.bodies[0];
  const KE = kineticTotal(scene.bodies);
  const PE = scene.potentialFn(scene.bodies);
  const E = KE + PE;
  const drift = E0 === 0 ? 0 : (E - E0) / E0;

  const lines = [
    `t       = ${scene.t.toFixed(3)} s`,
    `x       = ${b.pos.x.toFixed(3)} m`,
    `y       = ${b.pos.y.toFixed(3)} m`,
    `|v|     = ${b.vel.length().toFixed(3)} m/s`,
    `KE      = ${KE.toFixed(3)} J`,
    `PE      = ${PE.toFixed(3)} J`,
    `E_total = ${E.toFixed(3)} J`,
    `dE/E0   = ${(drift >= 0 ? "+" : "") + drift.toExponential(3)}`,
    `steps/frame = ${lastSteps}   fps = ${fps.toFixed(0)}`,
  ];

  ctx.font = "13px monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(8, 8, 270, lines.length * 18 + 14);
  lines.forEach((text, i) => {
    ctx.fillStyle = i === 7 ? (Math.abs(drift) > 0.01 ? "#f48771" : "#4ec9b0") : "#d4d4d4";
    ctx.fillText(text, 18, 16 + i * 18);
  });
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#d4d4d4";
  ctx.font = "12px monospace";
  const mode = variableMode ? "variable dt (frame time)" : "fixed dt (accumulator)";
  ctx.fillText(`${integratorName} | ${mode} | DT = 1/${dtDenom}`, 10, canvas.height - 10);

  if (scene.landed) {
    ctx.font = "14px monospace";
    ctx.fillText(`LANDED: range x = ${b.pos.x.toFixed(3)} m, E_total = ${E.toFixed(3)} J. Relaunching soon.`, 300, 30);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cam = cameras[view];
  drawAxes(cam, VIEWS[view]);

  if (view === "static") {
    drawStaticTest(cam);
    return;
  }

  drawTrail(cam);
  drawBodies(cam);
  drawHud();
}

// ---------------------------------------------------------------------------
// Time stepping: fixed (accumulator) or variable (frame time)
// ---------------------------------------------------------------------------

function advance(frameTime) {
  const integrator = integrators[integratorName];

  if (variableMode) {
    // the wrong way, kept on purpose so C2 can show what goes wrong
    stepScene(scene, integrator, frameTime);
    return 1;
  }

  const DT = 1 / dtDenom;
  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;   // spiral-of-death guard
  accumulator += frameTime;

  let n = 0;
  while (accumulator >= DT) {
    stepScene(scene, integrator, DT);   // always the same dt
    accumulator -= DT;
    n++;
    if (scene.landed) {
      accumulator = 0;
      break;
    }
  }
  return n;
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const frameTime = (timestamp - lastTime) / 1000;   // ms to s
  lastTime = timestamp;
  if (frameTime > 0) fps = 0.9 * fps + 0.1 * (1 / frameTime);

  if (view !== "static" && !paused && !scene.landed) {
    lastSteps = advance(frameTime);
    trail.push(scene.bodies[0].pos.clone());   // clone, so the trail does not alias the live position
    if (trail.length > MAX_TRAIL) trail.shift();
  }

  if (scene.landed && !paused) {
    if (landedAt === null) landedAt = timestamp;
    else if (timestamp - landedAt > AUTO_RELAUNCH_MS) resetScene();
  }

  render();

  if (lagPending) {
    busyWait(300);        // the next frame will report a long frame time
    lagPending = false;
  }
  requestAnimationFrame(loop);
}

function busyWait(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) { /* spin */ }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function measureStaticScene() {
  const cam = cameras.static;
  const ground = cam.toScreen(new Vec2(2, 0));
  const circle = cam.toScreen(new Vec2(2, 3));
  const gap = ground.y - circle.y;
  console.log(`Part A check: ground y_px = ${ground.y}, circle y_px = ${circle.y}, gap = ${gap} px = ${gap / cam.scale} m`);
}

function togglePause() {
  paused = !paused;
  document.getElementById("pause").textContent = paused ? "Resume (P)" : "Pause (P)";
}

function toggleTimestepMode() {
  variableMode = !variableMode;
  accumulator = 0;
  document.getElementById("timestepMode").value = variableMode ? "variable" : "fixed";
}

document.getElementById("scene").addEventListener("change", e => {
  view = e.target.value;
  resetScene();
  if (view === "static") measureStaticScene();
});
document.getElementById("integrator").addEventListener("change", e => { integratorName = e.target.value; });
document.getElementById("timestepMode").addEventListener("change", e => {
  variableMode = e.target.value === "variable";
  accumulator = 0;
});
document.getElementById("dt").addEventListener("change", e => {
  dtDenom = Number(e.target.value);
  accumulator = 0;
});
document.getElementById("relaunch").addEventListener("click", resetScene);
document.getElementById("pause").addEventListener("click", togglePause);
document.getElementById("lag").addEventListener("click", () => { lagPending = true; });
document.getElementById("headless").addEventListener("click", headlessReport);

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if (key === "r") resetScene();
  if (key === "p") togglePause();
  if (key === "l") lagPending = true;
  if (key === "t") toggleTimestepMode();
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

vec2SelfTest();
measureStaticScene();
resetScene();
console.log("main.js ran successfully");
requestAnimationFrame(loop);