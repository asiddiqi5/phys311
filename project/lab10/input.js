// input.js -- pointer and keyboard input. This is presentation, so it lives outside engine/.
// An event becomes world coordinates, and then either a Force (MouseSpring) or a call to world.fire().
// Nothing in engine/ knows that a mouse exists.

import { vec } from "./engine/vec2.js";

/* ------------------------------------------------ pixels to meters */

// event.clientX is relative to the viewport, not the canvas. Two steps:
//   1. viewport to canvas pixels. the ratio handles CSS scaling and devicePixelRatio
//   2. canvas pixels to meters, the camera run backwards
export function eventToWorld(event, canvas, camera) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  const w = camera.screenToWorld({ x: px, y: py });
  return vec(w.x, w.y);
}

/* ------------------------------------------------ grabbing a body */

// a damped spring from the body to the cursor, added as a Force like any other.
// Stability needs dt < 2 / sqrt(k). with k = 200 that is 0.14 s, and DT never goes above 1/60.
// It is an outside force, so the world books the work it does. Over one step every integrator here
// satisfies  change in KE = (F0 + F1)/2 . (v0 + v1)/2 . dt,  with F0 and F1 the forces actually applied
// at the start and the end of the step. work() returns the share that belongs to this spring
export class MouseSpring {
  constructor(k = 200, c = 20) {
    this.k = k;
    this.c = c;
    this.body = null;
    this.target = null;
    this.f0 = null;          // force at the first evaluation of the step
    this.f1 = null;          // force at the last evaluation of the step
    this.v0 = null;          // velocity before the step
  }

  get active() { return this.body !== null && this.target !== null; }

  grab(body, target) { this.body = body; this.target = target.clone(); }
  release() { this.body = null; this.target = null; this.f0 = this.f1 = this.v0 = null; }

  beginStep() {
    this.f0 = this.f1 = null;
    this.v0 = this.active ? this.body.vel.clone() : null;
  }

  apply(world) {
    if (!this.active) return;
    const b = this.body;
    if (world.bodies.indexOf(b) < 0) { this.release(); return; }   // it was absorbed or removed
    const f = {
      x: this.k * b.m * (this.target.x - b.pos.x) - this.c * b.m * b.vel.x,
      y: this.k * b.m * (this.target.y - b.pos.y) - this.c * b.m * b.vel.y,
    };
    b.force.x += f.x;
    b.force.y += f.y;
    if (!this.f0) this.f0 = f;
    this.f1 = f;
  }

  // called right after integration, before collisions change the velocity
  work(dt) {
    if (!this.active || !this.f0 || !this.v0) return 0;
    const v1 = this.body.vel;
    return 0.5 * ((this.f0.x + this.f1.x) * 0.5 * (this.v0.x + v1.x)
                + (this.f0.y + this.f1.y) * 0.5 * (this.v0.y + v1.y)) * dt;
  }
}

/* ------------------------------------------------ picking */

// topmost first, so a neutron wins over the moderator atom it is sitting on.
// a generous target for touch, since a neutron is tiny
export function bodyAt(world, p) {
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.isStatic) continue;
    const pick = Math.max(b.radius, 0.25);
    const dx = b.pos.x - p.x, dy = b.pos.y - p.y;
    if (dx * dx + dy * dy <= pick * pick) return b;
  }
  return null;
}

/* ------------------------------------------------ slingshot preview */

// Where will a neutron launched from `start` with velocity `v` first touch something?
// Between collisions a neutron moves in a straight line, so this is exact for a cold lattice.
// Real atoms jiggle a little, so the real hit can land slightly off.
export function predictPath(world, start, v) {
  const speed = v.length();
  if (speed === 0) return null;
  const d = v.mul(1 / speed);
  const p = world.p;

  const tx = d.x > 0 ? (p.W - start.x) / d.x : d.x < 0 ? -start.x / d.x : Infinity;
  const ty = d.y > 0 ? (p.H - start.y) / d.y : d.y < 0 ? -start.y / d.y : Infinity;
  let best = { t: Math.max(0, Math.min(tx, ty)), kind: "the edge of the core" };

  const test = (b, kind) => {
    const R = b.radius + p.rn;
    const fx = start.x - b.pos.x, fy = start.y - b.pos.y;
    const B = fx * d.x + fy * d.y;
    const C = fx * fx + fy * fy - R * R;
    if (C < 0) { if (best.t > 0) best = { t: 0, kind }; return; }   // starts inside it
    const disc = B * B - C;
    if (disc < 0) return;
    const t = -B - Math.sqrt(disc);
    if (t >= 0 && t < best.t) best = { t, kind };
  };
  for (const b of world.fuel) test(b, "fuel");
  for (const b of world.rodBodies) if (b.pos.y < p.H + 0.5) test(b, "a control rod");
  for (const b of world.atoms) test(b, "moderator");

  return { kind: best.kind, t: best.t, hit: vec(start.x + d.x * best.t, start.y + d.y * best.t) };
}

/* ------------------------------------------------ the pointer */

const PULL_TO_SPEED = 4;     // meters of pull to m/s of launch speed

export class Input {
  constructor({ canvas, camera, renderer, getWorld, spring, onCursor = () => {}, announce = () => {} }) {
    Object.assign(this, { canvas, camera, renderer, getWorld, spring, onCursor, announce });
    this.cursor = null;
    this.aim = null;
    this.pointerId = null;
    this.teleport = false;       // the wrong way to drag, kept as a demo for the write-up
    this.teleported = null;
    this.attach();
  }

  attach() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.down(e));
    c.addEventListener("pointermove", (e) => this.move(e));
    c.addEventListener("pointerup", (e) => this.up(e));
    c.addEventListener("pointercancel", () => this.cancel());
    c.addEventListener("pointerleave", () => { if (this.pointerId === null) this.clearCursor(); });
  }

  at(e) { return eventToWorld(e, this.canvas, this.camera); }

  setCursor(p) {
    this.cursor = p;
    this.renderer.overlay.cursor = p;
    this.onCursor(p);
  }

  clearCursor() {
    this.cursor = null;
    this.renderer.overlay.cursor = null;
    this.onCursor(null);
  }

  down(e) {
    if (this.pointerId !== null) return;                       // one pointer at a time
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const world = this.getWorld();
    const p = this.at(e);
    this.setCursor(p);
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);

    const b = bodyAt(world, p);
    if (b && this.teleport) {
      this.teleported = b;
    } else if (b) {
      this.spring.grab(b, p);
      this.renderer.overlay.grab = this.spring;
      this.announce(`Grabbed a ${b.name || "body"}`);
    } else {
      this.aim = { start: p, end: p };
      this.updateAim(world);
    }
  }

  move(e) {
    const p = this.at(e);
    this.setCursor(p);
    if (this.pointerId !== e.pointerId) return;
    const world = this.getWorld();
    if (this.teleported) this.teleported.pos.set(p.x, p.y);   // no force, no collision, no velocity
    else if (this.spring.active) this.spring.target = p.clone();
    else if (this.aim) { this.aim.end = p; this.updateAim(world); }
  }

  up(e) {
    if (this.pointerId !== e.pointerId) return;
    const world = this.getWorld();
    this.canvas.releasePointerCapture?.(e.pointerId);
    if (this.aim) {
      const shot = this.shot(world);
      if (shot && shot.speed > 0.2) {
        if (world.fire(this.aim.start, shot.v)) this.announce(`Fired a neutron at ${shot.speed.toFixed(1)} meters per second`);
        else this.announce("The population cap is full, so no neutron was added");
      }
    }
    this.cancel();
  }

  cancel() {
    this.spring.release();
    this.renderer.overlay.grab = null;
    this.renderer.overlay.aim = null;
    this.aim = null;
    this.teleported = null;
    this.pointerId = null;
  }

  // pull back to launch forward. the speed is the length of the pull, capped at a fast neutron
  shot(world) {
    const pull = this.aim.start.sub(this.aim.end);
    const len = pull.length();
    if (len === 0) return null;
    const speed = Math.min(world.p.vFast, len * PULL_TO_SPEED);
    return { v: pull.mul(speed / len), speed };
  }

  updateAim(world) {
    const shot = this.shot(world);
    const speed = shot ? shot.speed : 0;
    this.renderer.overlay.aim = {
      start: this.aim.start, end: this.aim.end, speed,
      slow: 0.5 * speed * speed < world.p.Ecut,
      preview: shot ? predictPath(world, this.aim.start, shot.v) : null,
    };
  }
}

/* ------------------------------------------------ the keyboard */

// every mouse action has a keyboard route: F fires a neutron, Escape lets go.
// keys are ignored while a form control has focus, so the arrow keys still move sliders
export function bindKeys(actions, target = window) {
  target.addEventListener("keydown", (ev) => {
    const tag = ev.target && ev.target.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
    if (tag === "BUTTON" && (ev.key === " " || ev.key === "Enter")) return;   // let the button click
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const map = {
      " ": actions.togglePause, ".": actions.stepOnce, r: actions.reset,
      "-": actions.speedDown, "+": actions.speedUp, "=": actions.speedUp,
      f: actions.fire, s: actions.scram, t: actions.toggleTrails, Escape: actions.cancel,
    };
    const fn = map[key];
    if (!fn) return;
    if (key === " ") ev.preventDefault();       // do not scroll the page
    fn();
  });
}
