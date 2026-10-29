// scenes/scenes.js -- each scene is a function that returns a fresh World.
// No scene touches the canvas, so tests/validate.js can run every one of them in Node.
// None of these needed an engine change.

import { vec } from "../engine/vec2.js";
import { Body } from "../engine/body.js";
import { World } from "../engine/world.js";
import { Gravity, Drag, Spring, NewtonGravity } from "../engine/forces.js";
import { BoxBounds } from "../engine/collisions.js";
import { INTEGRATORS } from "../engine/integrators.js";

const ORANGE = "#ff8200";
const BLUE = "#4ec9f5";
const GRAY = "#8892a6";

// seeded random numbers, so a scene starts the same every time
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWorld(integrator, opts) {
  return new World({ integrator: new INTEGRATORS[integrator](), ...opts });
}

// n spots on a jittered grid inside a box, so nothing starts overlapping
function gridSpots(n, rand, box, r) {
  const W = box.xmax - box.xmin, H = box.ymax - box.ymin;
  const cols = Math.ceil(Math.sqrt(n * W / H));
  const rows = Math.ceil(n / cols);
  const dx = W / cols, dy = H / rows;
  const wiggle = Math.max(0, Math.min(dx, dy) / 2 - r - 0.02);
  const spots = [];
  for (let k = 0; k < n; k++) {
    const i = k % cols, j = Math.floor(k / cols);
    spots.push(vec(box.xmin + (i + 0.5) * dx + (rand() * 2 - 1) * wiggle,
                   box.ymin + (j + 0.5) * dy + (rand() * 2 - 1) * wiggle));
  }
  return spots;
}

const BOX = { xmin: 0, ymin: 0, xmax: 18, ymax: 10.4 };
const boxView = { xmin: -0.3, ymin: -0.3, xmax: 18.3, ymax: 10.7 };

/* ------------------------------------------------- 1. billiards box */
export function billiards({ n = 20, e = 1.0, integrator = "EulerCromer", broadPhase = "brute",
                            walls = true, seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const w = makeWorld(integrator, { restitution: e, broadPhase });
  const r = n <= 50 ? 0.3 : n <= 200 ? 0.2 : 0.13;
  // with no walls, start them bunched up in the middle so they still collide
  const region = walls ? BOX : { xmin: 6, ymin: 3, xmax: 12, ymax: 7.4 };
  for (const p of gridSpots(n, rand, region, r)) {
    const m = 1 + rand();                        // 1 to 2 kg
    const speed = 2 + 2 * rand(), ang = 2 * Math.PI * rand();
    w.add(new Body({ pos: p, vel: vec(speed * Math.cos(ang), speed * Math.sin(ang)),
                     m, radius: r * Math.sqrt(m / 1.5), color: m > 1.5 ? ORANGE : BLUE }));
  }
  if (walls) w.bounds = new BoxBounds(BOX.xmin, BOX.ymin, BOX.xmax, BOX.ymax);
  w.view = boxView;
  w.note = "No gravity. |p| changes at every wall bounce, since a wall is an outside force. "
         + "|p - J_ext| takes out what the walls gave, so it should not move. "
         + "At e = 1 energy holds. For e < 1, it can only go down.";
  return w;
}

/* ------------------------------------------------- 1b. ball pit */
export function ballPit({ n = 100, e = 0.6, integrator = "EulerCromer", broadPhase = "brute", seed = 2 } = {}) {
  const rand = mulberry32(seed);
  const w = makeWorld(integrator, { restitution: e, broadPhase });
  w.addForce(new Gravity(9.81, 0));
  w.addForce(new Drag(0.02));
  for (const [x, y] of [[4.5, 3], [9, 4.2], [13.5, 3], [6.75, 1.4], [11.25, 1.4]]) {
    w.add(new Body({ pos: vec(x, y), radius: 0.6, isStatic: true, color: GRAY, name: "peg" }));
  }
  const r = n <= 100 ? 0.3 : 0.2;
  for (const p of gridSpots(n, rand, { xmin: 0.5, ymin: 6, xmax: 17.5, ymax: 10.2 }, r)) {
    w.add(new Body({ pos: p, vel: vec(3 * (rand() - 0.5), 0), radius: r,
                     color: rand() > 0.5 ? ORANGE : BLUE }));
  }
  w.bounds = new BoxBounds(BOX.xmin, BOX.ymin, BOX.xmax, BOX.ymax);
  w.view = boxView;
  w.note = "Gravity, light drag and five static pegs. Energy is supposed to drop.";
  return w;
}

/* ------------------------------------------------- 2. N-body gravity */
// star + five planets + a moon, G = 1 like Lab 5. planets are spaced several
// mutual Hill radii apart so nothing gets thrown out
export function nBody({ e = 1.0, integrator = "VelocityVerlet", seed = 3 } = {}) {
  const rand = mulberry32(seed);
  const w = makeWorld(integrator, { restitution: e });
  w.collisions = false;
  const G = 1;
  w.addForce(new NewtonGravity(G, 0.005));

  const star = w.add(new Body({ m: 1, radius: 0.12, color: "#ffd166", name: "star" }));
  const planets = [
    { r: 0.6, m: 2e-4 }, { r: 0.95, m: 5e-4 }, { r: 1.45, m: 1e-3, host: true },
    { r: 2.05, m: 3e-4 }, { r: 2.7, m: 6e-4 },
  ];
  let host = null;
  for (const pl of planets) {
    const ang = 2 * Math.PI * rand();
    const v = Math.sqrt(G * star.m / pl.r);
    const b = w.add(new Body({
      pos: vec(pl.r * Math.cos(ang), pl.r * Math.sin(ang)),
      vel: vec(-v * Math.sin(ang), v * Math.cos(ang)),
      m: pl.m, radius: pl.host ? 0.045 : 0.035, color: pl.host ? ORANGE : BLUE,
    }));
    if (pl.host) host = b;
  }

  // moon at about 0.4 of the orange planet's Hill radius
  const dm = 0.04, vm = Math.sqrt(G * host.m / dm);
  const out = host.pos.normalized();
  w.add(new Body({
    pos: host.pos.add(out.mul(dm)), vel: host.vel.add(out.perp().mul(vm)),
    m: 1e-6, radius: 0.015, color: "#e6edf3", name: "moon",
  }));

  // star gets the opposite momentum so the center of mass sits still
  const p = w.momentum().sub(star.momentum());
  star.vel = p.mul(-1 / star.m);

  w.view = { xmin: -4.6, ymin: -2.9, xmax: 4.6, ymax: 2.9 };
  w.note = "Newtonian gravity with Velocity Verlet. Energy should wobble but be bound, "
         + "and |p| stays at zero because every pull is applied as +F and -F.";
  return w;
}

/* ------------------------------------------------- 3. diatomic molecules */
// heavy + light atom on a spring, like the HCl bond from my Block 1 checkpoint,
// now with a box full of them colliding
export function molecules({ n = 8, e = 1.0, integrator = "VelocityVerlet", broadPhase = "brute", seed = 4 } = {}) {
  const rand = mulberry32(seed);
  const w = makeWorld(integrator, { restitution: e, broadPhase });
  const k = 200, L0 = 0.8, mL = 1, mH = 3, M = mL + mH;

  gridSpots(n, rand, { xmin: 1, ymin: 1, xmax: 17, ymax: 9.4 }, 0.8).forEach((c, g) => {
    const u = vec(Math.cos(2 * Math.PI * rand()), 0);
    u.y = Math.sqrt(1 - u.x * u.x) * (rand() > 0.5 ? 1 : -1);
    const L = L0 * (1 + 0.15 * (rand() * 2 - 1));     // start stretched or squeezed a bit
    const vAng = 2 * Math.PI * rand(), vcm = 1.5 + 1.5 * rand();
    const Vcm = vec(vcm * Math.cos(vAng), vcm * Math.sin(vAng));
    const spin = 3 * (rand() * 2 - 1);                 // rad/s about the center of mass
    const rH = u.mul(-L * mL / M), rL = u.mul(L * mH / M);

    const heavy = w.add(new Body({ pos: c.add(rH), vel: Vcm.add(rH.perp().mul(spin)),
                                   m: mH, radius: 0.35, group: g, color: "#8ad67b" }));
    const light = w.add(new Body({ pos: c.add(rL), vel: Vcm.add(rL.perp().mul(spin)),
                                   m: mL, radius: 0.25, group: g, color: "#e6edf3" }));
    w.addForce(new Spring(heavy, light, k, L0));
  });

  w.bounds = new BoxBounds(BOX.xmin, BOX.ymin, BOX.xmax, BOX.ymax);
  w.view = boxView;
  w.note = "No Gravity, e = 1, so KE + spring PE should hold. Clamping an atom to a wall changes "
         + "its bond length, which adds a small energy error that shrinks with DT.";
  return w;
}

export const SCENES = {
  billiards: { label: "1 - Billiard Box (no gravity)", make: billiards, nChoices: [20, 50, 100, 200, 500], defaultN: 20, defaultE: 1.0, dt: 240, integrator: "EulerCromer" },
  ballPit:   { label: "1b - Ball Pit (gravity and static pegs)", make: ballPit, nChoices: [40, 100, 200], defaultN: 100, defaultE: 0.6, dt: 240, integrator: "EulerCromer" },
  nBody:     { label: "2 - N-body Gravity (star, planets, one moon)", make: nBody, nChoices: null, defaultE: 1.0, dt: 240, integrator: "VelocityVerlet" },
  molecules: { label: "3 - Diatomic Molecules (Springs)", make: molecules, nChoices: [4, 8, 16, 32], defaultN: 8, defaultE: 1.0, dt: 480, integrator: "VelocityVerlet" },
};
