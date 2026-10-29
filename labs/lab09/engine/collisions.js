// engine/collisions.js -- broad phase, narrow phase, impulse response, walls.
// Broad phase: which pairs COULD touch (cheap).
// Narrow phase: do they actually overlap (exact).
// Response: push them apart, then apply the restitution impulse.

/* ---------------------------------------------------------- broad phase */

export function bruteForcePairs(bodies, stats) {
  const pairs = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) pairs.push([bodies[i], bodies[j]]);
  }
  if (stats) stats.checks = pairs.length;
  return pairs;
}

// uniform grid. cellSize should be at least 2x the largest radius
export class SpatialHash {
  constructor(cellSize = 1) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  key(i, j) { return i + "," + j; }

  build(bodies) {
    this.cells.clear();
    bodies.forEach((b, idx) => {
      b._idx = idx;
      b._ci = Math.floor(b.pos.x / this.cellSize);
      b._cj = Math.floor(b.pos.y / this.cellSize);
      const k = this.key(b._ci, b._cj);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(b);
    });
  }

  pairs(bodies, stats) {
    this.build(bodies);
    const out = [];
    for (const b of bodies) {
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const cell = this.cells.get(this.key(b._ci + di, b._cj + dj));
          if (!cell) continue;
          for (const o of cell) if (b._idx < o._idx) out.push([b, o]);   // each pair once
        }
      }
    }
    // same order brute force uses, so switching broad phase can't change the physics
    out.sort((p, q) => p[0]._idx - q[0]._idx || p[1]._idx - q[1]._idx);
    if (stats) stats.checks = out.length;
    return out;
  }
}

/* --------------------------------------------------------- narrow phase */

export function overlapping(a, b) {
  const R = a.radius + b.radius;
  return b.pos.sub(a.pos).lengthSq() < R * R;
}

/* -------------------------------------------------------------- response */

// push the pair apart, split by INVERSE mass so the push adds no net momentum
export function positionalCorrection(a, b, n, depth, percent = 0.8, slop = 1e-4) {
  const invSum = a.invMass + b.invMass;
  if (invSum === 0) return;
  const mag = Math.max(depth - slop, 0) * percent / invSum;
  a.pos.addScaled(n, -mag * a.invMass);
  b.pos.addScaled(n, mag * b.invMass);
}

// disc-disc contact. returns the impulse given to b (a gets minus that), or null
export function resolveContact(a, b, e = 0.9, useGuard = true) {
  if (a.group !== null && a.group === b.group) return null;

  const d = b.pos.sub(a.pos);
  const dist = d.length();
  const R = a.radius + b.radius;
  if (dist === 0 || dist >= R) return null;

  const invSum = a.invMass + b.invMass;
  if (invSum === 0) return null;           // two static bodies

  const n = d.mul(1 / dist);               // unit normal, a to b
  const vn = b.vel.sub(a.vel).dot(n);      // > 0 means separating

  // the guard. a pair that overlaps but is already moving apart only gets
  // pushed out, no impulse. without this it gets kicked back together (jitter)
  if (useGuard && vn > 0) {
    positionalCorrection(a, b, n, R - dist);
    return null;
  }

  const j = -(1 + e) * vn / invSum;
  const J = n.mul(j);
  a.vel.addScaled(J, -a.invMass);
  b.vel.addScaled(J, b.invMass);

  positionalCorrection(a, b, n, R - dist);
  return J;
}

/* ------------------------------------------------------------- boundaries */

// box walls: clamp the position, then reflect the velocity with e.
// walls are an EXTERNAL force, so momentum is not conserved while they are on.
// at e = 1 energy still is, a wall flips a sign and does no work.
// the momentum the walls add goes in world.externalImpulse so pair collisions can be checked alone.
export class BoxBounds {
  constructor(xmin, ymin, xmax, ymax) {
    Object.assign(this, { xmin, ymin, xmax, ymax });
    this.enabled = true;
    this.hits = 0;
  }

  apply(world) {
    if (!this.enabled) return;
    const e = world.restitution;
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      const r = b.radius;
      const vx0 = b.vel.x, vy0 = b.vel.y;
      if (b.pos.x - r < this.xmin) { b.pos.x = this.xmin + r; b.vel.x = Math.abs(b.vel.x) * e; this.hits++; }
      if (b.pos.x + r > this.xmax) { b.pos.x = this.xmax - r; b.vel.x = -Math.abs(b.vel.x) * e; this.hits++; }
      if (b.pos.y - r < this.ymin) { b.pos.y = this.ymin + r; b.vel.y = Math.abs(b.vel.y) * e; this.hits++; }
      if (b.pos.y + r > this.ymax) { b.pos.y = this.ymax - r; b.vel.y = -Math.abs(b.vel.y) * e; this.hits++; }
      world.externalImpulse.x += b.m * (b.vel.x - vx0);
      world.externalImpulse.y += b.m * (b.vel.y - vy0);
    }
  }
}
