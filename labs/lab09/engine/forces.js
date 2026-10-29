// engine/forces.js -- every force has apply(world), and conservative ones have potentialEnergy(world).
// Internal forces go on as an equal and opposite pair on back-to-back lines:
//     a.applyForce(F);
//     b.applyForce(F.neg());
// so momentum conservation is built in. World never has to check it.
// isInternal = true marks forces that stay inside the system.

import { vec } from "./vec2.js";

export class Gravity {
  constructor(g = 9.81, groundY = 0) { this.g = g; this.groundY = groundY; }

  apply(world) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.applyForce(vec(0, -b.m * this.g));
    }
  }

  potentialEnergy(world) {
    let U = 0;
    for (const b of world.bodies) if (!b.isStatic) U += b.m * this.g * (b.pos.y - this.groundY);
    return U;
  }
}

// quadratic drag, F = -c |v| v. no potential, energy leaves on purpose
export class Drag {
  constructor(c = 0.1) { this.c = c; }

  apply(world) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      const speed = b.vel.length();
      if (speed > 0) b.applyForce(b.vel.mul(-this.c * speed));
    }
  }
}

// Hooke spring between two bodies
export class Spring {
  constructor(a, b, k = 100, restLength = null) {
    this.a = a;
    this.b = b;
    this.k = k;
    this.restLength = restLength ?? b.pos.sub(a.pos).length();
    this.isInternal = true;
  }

  apply() {
    const d = this.b.pos.sub(this.a.pos);
    const L = d.length();
    if (L === 0) return;
    const F = d.mul(this.k * (L - this.restLength) / L);   // pulls a toward b when stretched
    this.a.applyForce(F);
    this.b.applyForce(F.neg());
  }

  potentialEnergy() {
    const stretch = this.b.pos.sub(this.a.pos).length() - this.restLength;
    return 0.5 * this.k * stretch * stretch;
  }
}

// pairwise 1/r^2 attraction. softening keeps r -> 0 from blowing up to NaN
export class NewtonGravity {
  constructor(G = 1, softening = 0.01) {
    this.G = G;
    this.eps = softening;
    this.isInternal = true;
  }

  apply(world) {
    const bs = world.bodies;
    const e2 = this.eps * this.eps;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        const d = b.pos.sub(a.pos);
        const r2 = d.lengthSq() + e2;
        const F = d.mul(this.G * a.m * b.m / (r2 * Math.sqrt(r2)));
        a.applyForce(F);          // equal ...
        b.applyForce(F.neg());    // ... and opposite
      }
    }
  }

  // softened potential, matches the softened force
  potentialEnergy(world) {
    const bs = world.bodies;
    const e2 = this.eps * this.eps;
    let U = 0;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        U -= this.G * bs[i].m * bs[j].m / Math.sqrt(bs[j].pos.sub(bs[i].pos).lengthSq() + e2);
      }
    }
    return U;
  }
}
