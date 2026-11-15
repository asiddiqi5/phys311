// engine/vec2.js -- 2D vector, same as Lab 8 plus neg/cross/perp/zero.
// add/sub/mul/neg return NEW vectors. addTo/addScaled/set/zero change this one.

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) { this.x = x; this.y = y; return this; }
  zero() { this.x = 0; this.y = 0; return this; }
  clone() { return new Vec2(this.x, this.y); }

  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec2(this.x * s, this.y * s); }
  neg() { return new Vec2(-this.x, -this.y); }
  perp() { return new Vec2(-this.y, this.x); }

  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; }   // z component
  lengthSq() { return this.x * this.x + this.y * this.y; }
  length() { return Math.sqrt(this.lengthSq()); }

  normalized() {
    const L = this.length();
    return L === 0 ? new Vec2() : this.mul(1 / L);
  }

  // in place, for hot loops
  addTo(v) { this.x += v.x; this.y += v.y; return this; }
  addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; return this; }
}

const vec = (x, y) => new Vec2(x, y);

export { Vec2, vec };
