// render/renderer.js -- draws a World. Reads it, never changes it.

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = camera;
    this.showTrails = false;
    this.showVectors = false;
    this.showGrid = true;
    this.trails = new Map();     // body -> list of world points
    this.trailLength = 400;
  }

  clearTrails() { this.trails.clear(); }

  recordTrails(world) {
    if (!this.showTrails) return;
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      let t = this.trails.get(b);
      if (!t) { t = []; this.trails.set(b, t); }
      t.push({ x: b.pos.x, y: b.pos.y });
      if (t.length > this.trailLength) t.shift();
    }
  }

  draw(world) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.showGrid) this.drawGrid();
    if (world.bounds && world.bounds.enabled) this.drawBounds(world.bounds);
    if (this.showTrails) this.drawTrails();
    this.drawSprings(world);
    for (const b of world.bodies) this.drawBody(b);
    if (this.showVectors) for (const b of world.bodies) this.drawVectors(b);
  }

  drawGrid() {
    const { ctx, canvas, camera } = this;
    const step = niceStep(100 / camera.scale);
    const tl = camera.screenToWorld({ x: 0, y: 0 });
    const br = camera.screenToWorld({ x: canvas.width, y: canvas.height });
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(tl.x / step) * step; x < br.x; x += step) {
      const s = camera.worldToScreen({ x, y: 0 });
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, canvas.height);
    }
    for (let y = Math.ceil(br.y / step) * step; y < tl.y; y += step) {
      const s = camera.worldToScreen({ x: 0, y });
      ctx.moveTo(0, s.y);
      ctx.lineTo(canvas.width, s.y);
    }
    ctx.stroke();
  }

  drawBounds(b) {
    const { ctx, camera } = this;
    const a = camera.worldToScreen({ x: b.xmin, y: b.ymax });
    const c = camera.worldToScreen({ x: b.xmax, y: b.ymin });
    ctx.strokeStyle = "rgba(255,130,0,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
  }

  drawTrails() {
    const { ctx, camera } = this;
    ctx.lineWidth = 1.5;
    for (const [body, pts] of this.trails) {
      if (pts.length < 2) continue;
      ctx.strokeStyle = body.color + "66";     // same color, faded
      ctx.beginPath();
      let s = camera.worldToScreen(pts[0]);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pts.length; i++) {
        s = camera.worldToScreen(pts[i]);
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }
  }

  // any force with two ends (a Spring) gets drawn as a line
  drawSprings(world) {
    const { ctx, camera } = this;
    ctx.strokeStyle = "rgba(230,237,243,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const f of world.forces) {
      if (!f.a || !f.b) continue;
      const p = camera.worldToScreen(f.a.pos), q = camera.worldToScreen(f.b.pos);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  drawBody(b) {
    const { ctx, camera } = this;
    const s = camera.worldToScreen(b.pos);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(camera.lengthToScreen(b.radius), 2), 0, 2 * Math.PI);
    ctx.fill();
  }

  drawVectors(b) {
    if (b.isStatic) return;
    const { ctx, camera } = this;
    const s = camera.worldToScreen(b.pos);
    const k = camera.scale * 0.12;
    const arrow = (v, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + v.x * k, s.y - v.y * k);    // flip y here too
      ctx.stroke();
    };
    arrow(b.vel, "#4ec9f5");
    arrow(b.acc, "#ff5d5d");
  }
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
