// engine/world.js -- owns bodies, forces, walls, integrator and the diagnostics.
// Layering rule: nothing in engine/ touches the DOM, the drawing context or the
// animation loop. That is why tests/validate.js can run this in Node.

import { vec } from "./vec2.js";
import { EulerCromer } from "./integrators.js";
import { bruteForcePairs, SpatialHash, resolveContact } from "./collisions.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class World {
  constructor({ integrator = new EulerCromer(), broadPhase = "brute", restitution = 0.9 } = {}) {
    this.bodies = [];
    this.forces = [];
    this.bounds = null;                // a BoxBounds, or null for no walls
    this.integrator = integrator;
    this.restitution = restitution;
    this.broadPhase = broadPhase;      // "brute" or "hash"
    this.hash = new SpatialHash(1);
    this.collisions = true;
    this.separatingGuard = true;       // the vn > 0 check. off only for the jitter demo
    this.time = 0;
    this.steps = 0;
    this.collisionCount = 0;
    this.externalImpulse = vec(0, 0);  // momentum put in by walls and static bodies
    this.stats = { checks: 0, lastStepMs: 0 };
    this._baseline = null;
  }

  add(body) { this.bodies.push(body); return body; }
  addForce(force) { this.forces.push(force); return force; }

  /* ---------------------------------------------------------- stepping */

  computeForces() {
    for (const b of this.bodies) b.clearForce();      // 1. reset
    for (const f of this.forces) f.apply(this);         // 2. accumulate
  }

  step(dt) {
    const t0 = now();
    this.computeForces();                               // 1 + 2
    this.integrator.step(this, dt);                     // 3. integrate
    if (this.bounds) this.bounds.apply(this);           // 4. walls ...
    this.resolveCollisions();                           //    ... and pairs
    this.time += dt;                                    // 5. advance clock
    this.steps++;
    this.stats.lastStepMs = now() - t0;
  }

  resolveCollisions() {
    if (!this.collisions || this.bodies.length < 2) { this.stats.checks = 0; return; }
    let pairs;
    if (this.broadPhase === "hash") {
      let rMax = 0;
      for (const b of this.bodies) rMax = Math.max(rMax, b.radius);
      this.hash.cellSize = Math.max(2 * rMax, 1e-6);
      pairs = this.hash.pairs(this.bodies, this.stats);
    } else {
      pairs = bruteForcePairs(this.bodies, this.stats);
    }

    for (const [a, b] of pairs) {
      const J = resolveContact(a, b, this.restitution, this.separatingGuard);
      if (!J) continue;
      this.collisionCount++;
      // a static body is outside the system, so its push counts as external
      if (a.isStatic) this.externalImpulse.addTo(J);
      if (b.isStatic) this.externalImpulse.addScaled(J, -1);
    }
  }

  /* -------------------------------------------------------- diagnostics */

  kineticEnergy() {
    let K = 0;
    for (const b of this.bodies) K += b.kineticEnergy();
    return K;
  }

  potentialEnergy() {
    let U = 0;
    for (const f of this.forces) U += f.potentialEnergy?.(this) ?? 0;
    return U;
  }

  totalEnergy() { return this.kineticEnergy() + this.potentialEnergy(); }

  momentum() {
    const p = vec(0, 0);
    for (const b of this.bodies) if (!b.isStatic) p.addTo(b.momentum());
    return p;
  }

  // momentum minus what walls and static bodies put in. pair collisions alone keep this fixed
  internalMomentum() { return this.momentum().sub(this.externalImpulse); }

  angularMomentum(about = vec(0, 0)) {
    let L = 0;
    for (const b of this.bodies) if (!b.isStatic) L += b.m * b.pos.sub(about).cross(b.vel);
    return L;
  }

  // true if gravity or drag pushes on the system from outside
  hasExternalField() { return this.forces.some((f) => !f.isInternal); }

  firstBadBody() { return this.bodies.find((b) => !b.isFinite()) ?? null; }

  // take the starting values ONCE (when a scene is built). the HUD compares to these.
  // recomputing them every frame would make the drift read 0 forever
  captureBaseline() {
    this._baseline = {
      E: this.totalEnergy(),
      p: this.momentum(),
      pInt: this.internalMomentum(),
      L: this.angularMomentum(),
    };
    return this._baseline;
  }

  get baseline() { return this._baseline ?? this.captureBaseline(); }

  drift() {
    const b = this.baseline;
    const E = this.totalEnergy();
    const p = this.momentum();
    const rel = (x, x0) => (Math.abs(x0) < 1e-12 ? Math.abs(x - x0) : (x - x0) / Math.abs(x0));
    // relative change in a vector, or the absolute change if it started at ~0
    const relVec = (v, v0) => {
      const L0 = v0.length();
      return L0 < 1e-12 ? v.sub(v0).length() : v.sub(v0).length() / L0;
    };
    return {
      E, p,
      dE: rel(E, b.E),
      dp: relVec(p, b.p),
      dpInt: relVec(this.internalMomentum(), b.pInt),
      dL: rel(this.angularMomentum(), b.L),
    };
  }
}

// fixed physics step, variable frame rate (same accumulator as Lab 8, as a class).
// clamping the frame time stops the spiral of death after a stall or tab switch
export class Accumulator {
  constructor(DT = 1 / 240, maxFrame = 0.25) {
    this.DT = DT;
    this.maxFrame = maxFrame;
    this.acc = 0;
    this.lastMs = null;
    this.stepsLastFrame = 0;
    this.clamped = false;
  }

  reset() { this.acc = 0; this.lastMs = null; }

  // calls stepFn(DT) zero or more times
  advance(nowMs, stepFn) {
    if (this.lastMs === null) { this.lastMs = nowMs; return; }
    let frame = (nowMs - this.lastMs) / 1000;    // ms to seconds
    this.lastMs = nowMs;
    this.clamped = frame > this.maxFrame;
    if (this.clamped) frame = this.maxFrame;
    this.acc += frame;
    let n = 0;
    while (this.acc >= this.DT) { stepFn(this.DT); this.acc -= this.DT; n++; }
    this.stepsLastFrame = n;
  }
}
