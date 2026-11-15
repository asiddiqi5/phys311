// render/camera.js -- the only place the y flip lives.
// world: meters, y up. screen: pixels, y down, origin at the top-left.

export class Camera {
  constructor(canvas, { center = { x: 0, y: 0 }, scale = 50 } = {}) {
    this.canvas = canvas;
    this.center = { ...center };   // world point shown at the middle of the canvas
    this.scale = scale;            // pixels per meter
  }

  worldToScreen(p) {
    return {
      x: this.canvas.width / 2 + (p.x - this.center.x) * this.scale,
      y: this.canvas.height / 2 - (p.y - this.center.y) * this.scale,   // flip
    };
  }

  screenToWorld(s) {
    return {
      x: this.center.x + (s.x - this.canvas.width / 2) / this.scale,
      y: this.center.y - (s.y - this.canvas.height / 2) / this.scale,
    };
  }

  lengthToScreen(L) { return L * this.scale; }

  // zoom so a world rectangle fills the canvas
  fit({ xmin, ymin, xmax, ymax }, pad = 1.04) {
    const w = (xmax - xmin) * pad, h = (ymax - ymin) * pad;
    this.scale = Math.min(this.canvas.width / w, this.canvas.height / h);
    this.center = { x: (xmin + xmax) / 2, y: (ymin + ymax) / 2 };
  }
}
