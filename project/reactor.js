// scenes/reactor.js -- a toy 2D reactor core built on the Lab 9 engine.
// Nothing in engine/ is changed. The reactor is a World subclass plus one force.
//
//   neutrons    small bodies that all share group "n", so they never collide with each other
//   fuel        static bodies. a slow neutron that touches one usually causes a fission
//   rods        static bodies in guide channels. they slide in and absorb every neutron they touch
//   moderator   light atoms on stiff springs, coupled to a heat bath. real two-body collisions
//               with them are what slow a fast neutron down
//
// The units are arbitrary. This is a toy, not a model of a real reactor.

import { vec } from "../engine/vec2.js";
import { Body } from "../engine/body.js";
import { World } from "../engine/world.js";
import { INTEGRATORS } from "../engine/integrators.js";

// seeded random numbers, so a run can be repeated exactly
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rand) => {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const PARAMS = {
  W: 20, H: 12,                          // the core, in meters
  fuelX: [2.5, 7.5, 12.5, 17.5],         // fuel columns
  rodX: [5, 10, 15],                     // control rod channels
  seed: 1, integrator: "VelocityVerlet",
  // live settings, the sliders change these while it runs
  rods: 0.6, moderator: 1.0, albedo: 0.75, source: 4,
  // neutrons
  vFast: 14, vMax: 20,                   // vMax keeps |v| dt below one contact distance at DT = 1/60
  Ecut: 4.0, Pthermal: 0.55, Pfast: 0.02,
  rn: 0.06, Rf: 0.3, Rm: 0.3, Rr: 0.3,
  // moderator lattice and heat bath
  kTether: 120, kT: 1.0, cBath: 8.0,     // stiff and well damped, so struck atoms stay near their sites
  cap: 400, N0: 40,
};

// moderator atoms hang on springs from their lattice sites
class LatticeTether {
  constructor(k) { this.k = k; this.items = []; }
  add(body, home) { this.items.push({ body, home }); }
  remove(body) {
    const i = this.items.findIndex((it) => it.body === body);
    if (i >= 0) this.items.splice(i, 1);
  }
  apply() {
    for (const { body, home } of this.items) {
      body.force.x -= this.k * (body.pos.x - home.x);
      body.force.y -= this.k * (body.pos.y - home.y);
    }
  }
  potentialEnergy() {
    let U = 0;
    for (const { body, home } of this.items) {
      const dx = body.pos.x - home.x, dy = body.pos.y - home.y;
      U += 0.5 * this.k * (dx * dx + dy * dy);
    }
    return U;
  }
}

export class ReactorWorld extends World {
  constructor(params = {}) {
    const p = { ...PARAMS, ...params };
    super({ integrator: new INTEGRATORS[p.integrator](), restitution: 1.0, broadPhase: "hash" });
    this.p = p;
    this.rand = mulberry32(p.seed);          // reactions
    this.atomRand = mulberry32(p.seed + 3);  // atom positions and heat-bath kicks
    this.srcRand = mulberry32(p.seed + 5);   // where source neutrons appear
    this.view = { xmin: -0.4, ymin: -0.4, xmax: p.W + 0.4, ymax: p.H + 0.4 };
    this.note = "A toy reactor core. Slide the control rods and moderator to push the chain reaction "
              + "above or below critical (k = 1).";

    // every energy flow that the engine does not see goes in this ledger
    this.ledger = { absorbed: 0, leaked: 0, limited: 0, removed: 0,
                    fissionDrawn: 0, injected: 0, bathOut: 0, bathIn: 0 };
    this.count = { born: 0, bornReal: 0, fissions: 0, absRod: 0, leaked: 0, dropped: 0,
                   sourced: 0, fired: 0, invalid: 0 };
    this.nCount = 0;                // neutrons alive
    this.N0 = 0;                    // neutrons at the start
    this.events = [];               // fission flashes, for the renderer
    this.samples = [];              // {t, N, born, lost} every 0.25 s of simulated time
    this.nextSample = 0;
    this.externals = [];            // outside agents (the mouse spring). each has beginStep() and work(dt)
    this.observers = [];            // functions called with the world after every step
    this.fuel = [];
    this.rodBodies = [];
    this.sites = [];
    this.atoms = [];
    this.targets = new Map();       // grid of the static targets (fuel, rods)

    this.tether = new LatticeTether(p.kTether);
    this.buildCore();
    this.addForce(this.tether);
    this.setRods(p.rods);
    this.setModerator(p.moderator, true);
    for (let i = 0; i < p.N0; i++) this.spawnSource(p.vFast, true);
    this.N0 = this.nCount;
    this.count.sourced = 0;
    this.nextSample = 0;
    this.captureBaseline();
  }

  /* ------------------------------------------------------------ building */

  buildCore() {
    const p = this.p;
    for (const x of p.fuelX) {
      for (let y = 0.8; y < p.H; y += 1.0) {
        this.fuel.push(this.add(new Body({ pos: vec(x, y), radius: p.Rf, isStatic: true, name: "fuel", color: "#ffd166" })));
      }
    }
    // each rod column is a stack of atoms. setRods slides the whole stack down into the core
    const nRod = Math.ceil((p.H + 0.7) / 0.65) + 1;
    for (const x of p.rodX) {
      for (let i = 0; i < nRod; i++) {
        this.rodBodies.push(this.add(new Body({ pos: vec(x, p.H + 1), radius: p.Rr, isStatic: true, name: "rod", color: "#8892a6" })));
      }
    }
    this.rodIndex = this.rodBodies.map((_, k) => k % nRod);

    // moderator lattice sites, with a fixed random mask so the density slider is repeatable
    const maskRand = mulberry32(p.seed + 99);
    for (let x = 0.5; x < p.W; x += 1.0) {
      for (let y = 0.5; y < p.H; y += 1.0) {
        if (this.fuel.some((f) => Math.hypot(f.pos.x - x, f.pos.y - y) < 0.65)) continue;
        if (p.rodX.some((rx) => Math.abs(rx - x) < 0.65)) continue;    // the rod channels stay clear
        this.sites.push({ x, y, mask: maskRand(), body: null });
      }
    }
  }

  // fraction of the core height the rods are pushed in, 0 to 1
  setRods(f) {
    const p = this.p;
    f = Math.min(1, Math.max(0, f));
    p.rods = f;
    const tip = (p.H + 0.35) * (1 - f);
    this.rodBodies.forEach((b, k) => { b.pos.y = tip + 0.65 * this.rodIndex[k]; });
    this.rebuildTargets();
  }

  rebuildTargets() {
    this.targets.clear();
    for (const b of [...this.fuel, ...this.rodBodies]) {
      const key = Math.floor(b.pos.x) + "," + Math.floor(b.pos.y);
      if (!this.targets.has(key)) this.targets.set(key, []);
      this.targets.get(key).push(b);
    }
  }

  // fraction of lattice sites that hold a moderator atom, 0 to 1
  setModerator(d, building = false) {
    const p = this.p;
    d = Math.min(1, Math.max(0, d));
    p.moderator = d;
    for (const s of this.sites) {
      const want = s.mask <= d;
      if (want && !s.body) {
        s.body = this.makeAtom(s);
        if (!building) this.ledger.injected += s.body.kineticEnergy() + this.atomSpringEnergy(s);
      } else if (!want && s.body) {
        this.ledger.removed += s.body.kineticEnergy() + this.atomSpringEnergy(s);
        this.removeAtom(s);
      }
    }
  }

  atomSpringEnergy(s) {
    const dx = s.body.pos.x - s.x, dy = s.body.pos.y - s.y;
    return 0.5 * this.p.kTether * (dx * dx + dy * dy);
  }

  // new atoms start with thermal speed and displacement, as if the coolant was already warm
  makeAtom(s) {
    const p = this.p, r = this.atomRand;
    const sd = Math.sqrt(p.kT / p.kTether), sv = Math.sqrt(p.kT);
    const b = this.add(new Body({
      pos: vec(s.x + sd * gauss(r), s.y + sd * gauss(r)),
      vel: vec(sv * gauss(r), sv * gauss(r)),
      m: 1, radius: p.Rm, color: "#3b6ea5", name: "moderator",
    }));
    this.tether.add(b, vec(s.x, s.y));
    this.atoms.push(b);
    return b;
  }

  removeAtom(s) {
    const i = this.bodies.indexOf(s.body);
    if (i >= 0) this.bodies.splice(i, 1);
    this.atoms.splice(this.atoms.indexOf(s.body), 1);
    this.tether.remove(s.body);
    s.body = null;
  }

  /* ------------------------------------------------------------ neutrons */

  // returns true if the neutron was added. the cap protects the frame rate
  addNeutron(pos, vel) {
    if (this.nCount >= this.p.cap) { this.count.dropped++; return false; }
    this.add(new Body({ pos, vel, m: 1, radius: this.p.rn, group: "n", color: "#ff5d5d", name: "neutron" }));
    this.nCount++;
    return true;
  }

  // a neutron from the start-up source, anywhere in the core
  spawnSource(speed, initial = false) {
    const p = this.p, r = this.srcRand;
    const x = 0.5 + r() * (p.W - 1), y = 0.5 + r() * (p.H - 1), a = r() * 2 * Math.PI;
    const v = vec(speed * Math.cos(a), speed * Math.sin(a));
    if (this.addNeutron(vec(x, y), v)) {
      this.count.sourced++;
      if (!initial) this.ledger.injected += 0.5 * speed * speed;
    }
  }

  // a neutron the user launched
  fire(pos, vel) {
    if (this.addNeutron(pos.clone(), vel.clone())) {
      this.count.fired++;
      this.ledger.injected += 0.5 * vel.lengthSq();
      return true;
    }
    return false;
  }

  scram() { this.setRods(1); }

  /* ------------------------------------------------------------- stepping */

  // The engine's World.step runs five stages: clear forces, apply forces, integrate, collide, advance the
  // clock. It has no hook between "integrate" and "collide", and the outside agents need one (to book
  // their work exactly), so the stages are repeated here. Keep this in step with engine/world.js.
  step(dt) {
    this.bath(dt);
    if (this.p.source > 0 && this.srcRand() < this.p.source * dt) this.spawnSource(this.p.vFast);
    for (const ext of this.externals) ext.beginStep();
    this.computeForces();                                          // 1 + 2
    this.integrator.step(this, dt);                                // 3
    for (const ext of this.externals) this.ledger.injected += ext.work(dt);   // between 3 and 4
    this.resolveCollisions();                                      // 4 (the reactor's react() runs inside)
    this.time += dt;                                               // 5
    this.steps++;
    this.guard();
    this.sample();
    for (const f of this.observers) f(this);
  }

  // runs where the collision stage runs, so reactions happen before the engine bounces anything
  resolveCollisions() {
    this.react();
    super.resolveCollisions();
  }

  react() {
    const p = this.p, rand = this.rand;
    const born = [];
    let w = 0;
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.group !== "n") { bodies[w++] = b; continue; }

      const KE = b.kineticEnergy();
      if (b.pos.x < 0 || b.pos.x > p.W || b.pos.y < 0 || b.pos.y > p.H) {
        if (rand() < p.albedo) {                          // the reflector sends it back, elastically
          if (b.pos.x < 0) { b.pos.x = 0.01; b.vel.x = Math.abs(b.vel.x); }
          if (b.pos.x > p.W) { b.pos.x = p.W - 0.01; b.vel.x = -Math.abs(b.vel.x); }
          if (b.pos.y < 0) { b.pos.y = 0.01; b.vel.y = Math.abs(b.vel.y); }
          if (b.pos.y > p.H) { b.pos.y = p.H - 0.01; b.vel.y = -Math.abs(b.vel.y); }
        } else {
          this.ledger.leaked += KE; this.count.leaked++; this.nCount--;
          continue;
        }
      }

      let removed = false;
      const ci = Math.floor(b.pos.x), cj = Math.floor(b.pos.y);
      for (let di = -1; di <= 1 && !removed; di++) {
        for (let dj = -1; dj <= 1 && !removed; dj++) {
          const bucket = this.targets.get((ci + di) + "," + (cj + dj));
          if (!bucket) continue;
          for (const t of bucket) {
            const dx = t.pos.x - b.pos.x, dy = t.pos.y - b.pos.y;
            const rad = t.radius + b.radius;
            if (dx * dx + dy * dy >= rad * rad) continue;
            if (t.name === "rod") {                       // absorbed by a control rod
              this.ledger.absorbed += KE; this.count.absRod++; removed = true; break;
            }
            if (dx * b.vel.x + dy * b.vel.y <= 0) continue;   // already moving away: no second chance
            const P = KE < p.Ecut ? p.Pthermal : p.Pfast;     // a slow neutron is far more likely to fission
            if (rand() < P) {
              this.ledger.absorbed += KE; this.count.fissions++; removed = true;
              this.events.push({ x: t.pos.x, y: t.pos.y, t: this.time });
              born.push(t, rand() < 0.5 ? 2 : 3);
              break;
            }
            // otherwise the engine bounces it off the (static) nucleus
          }
        }
      }
      if (removed) this.nCount--; else bodies[w++] = b;
    }
    bodies.length = w;

    for (let i = 0; i < born.length; i += 2) {
      const t = born[i], nu = born[i + 1];
      for (let k = 0; k < nu; k++) {
        const a = rand() * 2 * Math.PI, r = p.Rf + p.rn + 0.02;
        this.count.born++;
        if (this.addNeutron(vec(t.pos.x + r * Math.cos(a), t.pos.y + r * Math.sin(a)),
                            vec(p.vFast * Math.cos(a), p.vFast * Math.sin(a)))) {
          this.count.bornReal++;
          this.ledger.fissionDrawn += 0.5 * p.vFast * p.vFast;
        }
      }
    }
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  }

  // heat bath on the moderator atoms: damping and random kicks, once per step so it does not
  // depend on the integrator. both are booked in the ledger
  bath(dt) {
    const p = this.p, c = p.cBath, sigma = Math.sqrt(2 * c * p.kT * dt);
    for (const a of this.atoms) {
      const k0 = a.kineticEnergy();
      a.vel.addScaled(a.vel, -c * dt / a.m);
      const k1 = a.kineticEnergy();
      this.ledger.bathOut += k0 - k1;
      a.vel.x += sigma * gauss(this.atomRand) / a.m;
      a.vel.y += sigma * gauss(this.atomRand) / a.m;
      this.ledger.bathIn += a.kineticEnergy() - k1;
    }
  }

  // two safety nets: a speed limit (the "speed cap" fix for tunneling, so it is not physical)
  // and removal of any neutron that went non-finite
  guard() {
    const vMax2 = this.p.vMax * this.p.vMax;
    let w = 0;
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.group === "n") {
        if (!b.isFinite()) { this.count.invalid++; this.nCount--; continue; }
        const v2 = b.vel.lengthSq();
        if (v2 > vMax2) {
          const s = this.p.vMax / Math.sqrt(v2);
          this.ledger.limited += 0.5 * v2 * (1 - s * s);
          b.vel.x *= s; b.vel.y *= s;
        }
      }
      bodies[w++] = b;
    }
    bodies.length = w;
  }

  sample() {
    if (this.time < this.nextSample) return;
    const c = this.count;
    this.samples.push({ t: this.time, N: this.nCount, born: c.born, lost: c.fissions + c.absRod + c.leaked });
    if (this.samples.length > 800) this.samples.shift();
    this.nextSample = this.time + 0.25;
  }

  // k_eff = neutrons produced by fission / neutrons lost, over the last `window` seconds
  kEff(window = 4, minLost = 8) {
    const s = this.samples;
    if (s.length < 2) return NaN;
    const last = s[s.length - 1];
    let first = s[0];
    for (let i = s.length - 1; i >= 0; i--) {
      if (last.t - s[i].t >= window) { first = s[i]; break; }
    }
    const lost = last.lost - first.lost;
    return lost >= minLost ? (last.born - first.born) / lost : NaN;
  }

  /* ---------------------------------------------------------- diagnostics */

  // the engine's energy plus every ledger term, so the drift measures the solver, not the reactions
  totalEnergy() {
    const L = this.ledger;
    return super.totalEnergy() + L.absorbed + L.leaked + L.limited + L.removed
         - L.fissionDrawn - L.injected + L.bathOut - L.bathIn;
  }

  // error against the energy that was ever created by fission, the source or the user
  ledgerError() {
    const err = this.totalEnergy() - this.baseline.E;
    const created = this.ledger.fissionDrawn + this.ledger.injected;
    const scale = Math.max(Math.abs(this.baseline.E), created, 1e-12);
    return { err, created, rel: err / scale };
  }

  // the neutron count must equal what went in minus what came out. this is exact
  neutronBalance() {
    const c = this.count;
    const expected = this.N0 + c.sourced + c.fired + c.bornReal - (c.fissions + c.absRod + c.leaked) - c.invalid;
    return { expected, actual: this.nCount, ok: expected === this.nCount };
  }

  countNeutrons() {
    let n = 0;
    for (const b of this.bodies) if (b.group === "n") n++;
    return n;
  }
}

export function buildReactor(params = {}) {
  return new ReactorWorld(params);
}
