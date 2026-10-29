// engine/body.js -- state of one disc. color is only stored here, the engine never reads it.
import { vec } from "./vec2.js";

let nextId = 0;

export class Body {
  constructor({
    pos = vec(0, 0),
    vel = vec(0, 0),
    m = 1,
    radius = 0.3,
    isStatic = false,   // immovable, infinite mass
    group = null,       // bodies in the same group skip each other (atoms in one molecule)
    color = "#ff8200",
    name = "",
  } = {}) {
    this.id = nextId++;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.acc = vec(0, 0);
    this.force = vec(0, 0);    // accumulator, cleared every step
    this.m = m;
    this.radius = radius;
    this.isStatic = isStatic;
    this.group = group;
    this.color = color;
    this.name = name;
  }

  get invMass() { return this.isStatic ? 0 : 1 / this.m; }

  clearForce() { this.force.zero(); }
  applyForce(F) { this.force.addTo(F); }

  kineticEnergy() { return this.isStatic ? 0 : 0.5 * this.m * this.vel.lengthSq(); }
  momentum() { return this.vel.mul(this.m); }

  isFinite() {
    return Number.isFinite(this.pos.x) && Number.isFinite(this.pos.y) &&
           Number.isFinite(this.vel.x) && Number.isFinite(this.vel.y);
  }
}
