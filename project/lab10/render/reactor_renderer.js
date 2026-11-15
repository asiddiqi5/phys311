// render/reactor_renderer.js -- draws the reactor. Reads the world, never changes it.
// It extends the Lab 9 Renderer, so render/renderer.js itself is untouched.

import { Renderer } from "./renderer.js";

const E_SLOW = 0.5, E_FAST = 98;        // energy range of the speed colors (0.5 v^2 at v = 1 and v = 14)

export function speedHue(energy) {
  const t = Math.min(1, Math.max(0, Math.log(Math.max(energy, 1e-9) / E_SLOW) / Math.log(E_FAST / E_SLOW)));
  return Math.round(215 * (1 - t));      // blue is slow, red is fast
}

export class ReactorRenderer extends Renderer {
  constructor(canvas, camera) {
    super(canvas, camera);
    this.trailLength = 24;
    this.showTrails = true;
    this.showVectors = false;
    this.showGrid = false;
    this.colorBySpeed = true;
    this.showFlashes = true;
    this.dpr = 1;
    // set by input.js, read here: the cursor, a grabbed body, and a slingshot aim
    this.overlay = { cursor: null, grab: null, aim: null };
  }

  // trails for neutrons only, and forget the ones that were absorbed so the map cannot grow
  recordTrails(world) {
    if (!this.showTrails) return;
    const seen = new Set();
    for (const b of world.bodies) {
      if (b.group !== "n") continue;
      seen.add(b);
      let t = this.trails.get(b);
      if (!t) { t = []; this.trails.set(b, t); }
      t.push({ x: b.pos.x, y: b.pos.y });
      if (t.length > this.trailLength) t.shift();
    }
    for (const b of this.trails.keys()) if (!seen.has(b)) this.trails.delete(b);
  }

  draw(world) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.showGrid) this.drawGrid();
    this.drawCore(world);
    for (const b of world.bodies) if (b.name === "moderator") this.drawBody(b);
    for (const b of world.bodies) if (b.isStatic) this.drawBody(b);
    if (this.showTrails) this.drawTrails();
    for (const b of world.bodies) if (b.group === "n") this.drawBody(b);
    if (this.showVectors) for (const b of world.bodies) if (b.group === "n") this.drawVectors(b);
    if (this.showFlashes) this.drawFlashes(world);
    this.drawGrab();
    this.drawAim();
    this.drawCrosshair();
    if (this.colorBySpeed) this.drawLegend();
  }

  // the core boundary. a thicker line means a better reflector
  drawCore(world) {
    const { ctx, camera, dpr } = this;
    const p = world.p;
    const a = camera.worldToScreen({ x: 0, y: p.H });
    const c = camera.worldToScreen({ x: p.W, y: 0 });
    ctx.strokeStyle = `rgba(255,130,0,${0.3 + 0.6 * p.albedo})`;
    ctx.lineWidth = (2 + 5 * p.albedo) * dpr;
    ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
  }

  drawBody(b) {
    const { ctx, camera, dpr } = this;
    const s = camera.worldToScreen(b.pos);
    const r = camera.lengthToScreen(b.radius);

    if (b.name === "moderator") {
      ctx.fillStyle = "rgba(59,110,165,0.30)";
      ctx.strokeStyle = "rgba(120,170,230,0.45)";
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (b.name === "fuel") {                 // a ring with a dot
      ctx.strokeStyle = "#ffd166";
      ctx.fillStyle = "rgba(255,209,102,0.18)";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(r * 0.25, 1.5 * dpr), 0, 2 * Math.PI);
      ctx.fill();
    } else if (b.name === "rod") {                  // a square with a cross
      ctx.fillStyle = "#4b5566";
      ctx.fillRect(s.x - r, s.y - r, 2 * r, 2 * r);
      ctx.strokeStyle = "#aab4c8";
      ctx.lineWidth = dpr;
      ctx.strokeRect(s.x - r, s.y - r, 2 * r, 2 * r);
      ctx.beginPath();
      ctx.moveTo(s.x - r, s.y - r); ctx.lineTo(s.x + r, s.y + r);
      ctx.moveTo(s.x + r, s.y - r); ctx.lineTo(s.x - r, s.y + r);
      ctx.stroke();
    } else {                                         // a neutron
      ctx.fillStyle = this.colorBySpeed ? `hsl(${speedHue(b.kineticEnergy())}, 90%, 60%)` : b.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(r, 2.4 * dpr), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // a ring that grows and fades around each fission, for 0.35 s of simulated time
  drawFlashes(world) {
    const { ctx, camera, dpr } = this;
    ctx.lineWidth = 2 * dpr;
    for (const ev of world.events) {
      const age = world.time - ev.t;
      if (age < 0 || age > 0.35) continue;
      const s = camera.worldToScreen(ev);
      ctx.strokeStyle = `rgba(255,240,160,${1 - age / 0.35})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, camera.lengthToScreen(0.3 + age * 3.5), 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // the line from a grabbed body to the cursor
  drawGrab() {
    const g = this.overlay.grab;
    if (!g || !g.body || !g.target) return;
    const { ctx, camera, dpr } = this;
    const a = camera.worldToScreen(g.body.pos), b = camera.worldToScreen(g.target);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // text on a dark box so it stays readable
  label(text, x, y, size = 12) {
    const { ctx, dpr } = this;
    const w = text.length * size * 0.62 * dpr + 8 * dpr, h = size * 1.5 * dpr;
    ctx.fillStyle = "rgba(16,20,28,0.82)";
    ctx.fillRect(x - 4 * dpr, y - size * 1.1 * dpr, w, h);
    ctx.fillStyle = "#e6edf3";
    ctx.font = `${size * dpr}px monospace`;
    ctx.fillText(text, x, y);
  }

  // slingshot: the pull-back band, the predicted straight path and a labl
  drawAim() {
    const aim = this.overlay.aim;
    if (!aim) return;
    const { ctx, camera, dpr } = this;
    const s = camera.worldToScreen(aim.start), e = camera.worldToScreen(aim.end);

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (aim.preview) {
      const h = camera.worldToScreen(aim.preview.hit);
      ctx.strokeStyle = aim.slow ? "#8fd3ff" : "#ff9d5c";
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(h.x, h.y, 6 * dpr, 0, 2 * Math.PI);
      ctx.stroke();
    }
    // the label goes beside the pull-back end on the side away from the launch line
    const text = `${aim.speed.toFixed(1)} m/s (${aim.slow ? "slow" : "fast"})` + (aim.preview ? ` -> hits ${aim.preview.kind}` : "");
    const textW = text.length * 12 * 0.62 * dpr + 8 * dpr;
    const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
    const ux = (e.x - s.x) / len, uy = (e.y - s.y) / len;
    let lx = e.x + ux * 30 * dpr + (ux >= 0 ? 6 * dpr : -textW), ly = e.y + uy * 30 * dpr + 5 * dpr;
    lx = Math.min(Math.max(lx, 4 * dpr), this.canvas.width - textW - 4 * dpr);
    ly = Math.min(Math.max(ly, 18 * dpr), this.canvas.height - 8 * dpr);
    this.label(text, lx, ly);
  }

  drawCrosshair() {
    const c = this.overlay.cursor;
    if (!c) return;
    const { ctx, camera, dpr } = this;
    const s = camera.worldToScreen(c), L = 11 * dpr;
    ctx.strokeStyle = "#4ec9b0";
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(s.x - L, s.y); ctx.lineTo(s.x + L, s.y);
    ctx.moveTo(s.x, s.y - L); ctx.lineTo(s.x, s.y + L);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4 * dpr, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // color legend for neutron speed. the words matter
  drawLegend() {
    const { ctx, canvas, dpr } = this;
    const w = 130 * dpr, h = 10 * dpr, x = 16 * dpr, y = canvas.height - 26 * dpr;
    ctx.fillStyle = "rgba(16,20,28,0.82)";
    ctx.fillRect(x - 6 * dpr, y - 22 * dpr, w + 12 * dpr, h + 44 * dpr);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, `hsl(${Math.round(215 * (1 - i / 8))}, 90%, 60%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e6edf3";
    ctx.font = `${11 * dpr}px monospace`;
    ctx.fillText("slow", x, y - 6 * dpr);
    ctx.fillText("fast", x + w - 26 * dpr, y - 6 * dpr);
    ctx.fillText("neutron speed", x, y + h + 14 * dpr);
  }
}
