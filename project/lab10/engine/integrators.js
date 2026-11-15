// engine/integrators.js -- swappable steppers, all step(world, dt).
// World.step has already filled body.force before these run.
// They only differ in the order of the updates.

function setAcc(world) {
  for (const b of world.bodies) {
    if (b.isStatic) b.acc.zero();
    else b.acc.set(b.force.x / b.m, b.force.y / b.m);
  }
}

export class Euler {
  static label = "Euler (explicit)";
  step(world, dt) {
    setAcc(world);
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.pos.addScaled(b.vel, dt);      // uses the OLD velocity
      b.vel.addScaled(b.acc, dt);
    }
  }
}

export class EulerCromer {
  static label = "Euler-Cromer";
  step(world, dt) {
    setAcc(world);
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.vel.addScaled(b.acc, dt);      // velocity first
      b.pos.addScaled(b.vel, dt);      // then position with the new velocity
    }
  }
}

export class VelocityVerlet {
  static label = "Velocity Verlet";
  // half kick, drift, recompute forces, half kick
  step(world, dt) {
    setAcc(world);
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.vel.addScaled(b.acc, 0.5 * dt);
      b.pos.addScaled(b.vel, dt);
    }
    world.computeForces();             // forces at the new positions
    setAcc(world);
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.vel.addScaled(b.acc, 0.5 * dt);
    }
  }
}

export const INTEGRATORS = { Euler, EulerCromer, VelocityVerlet };
