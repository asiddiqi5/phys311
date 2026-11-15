// render/stripchart.js -- neutron population over time on a second canvas, log scale.
// A straight line is exponential growth or decay. Reads the world, never changes it.

export class StripChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.window = 40;      // seconds of simulated time on screen
    this.dpr = 1;
  }

  draw(world) {
    const { ctx, canvas, dpr } = this;
    const w = canvas.width, h = canvas.height;
    const pad = { l: 42 * dpr, r: 10 * dpr, t: 10 * dpr, b: 22 * dpr };
    const cap = Math.max(world.p.cap, 10);
    const yOf = (n) => pad.t + (h - pad.t - pad.b) * (1 - Math.log10(Math.max(n, 1)) / Math.log10(cap));

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, w, h);

    const s = world.samples;
    const tEnd = s.length ? s[s.length - 1].t : 0;
    const tStart = Math.max(0, tEnd - this.window);
    const xOf = (t) => pad.l + (w - pad.l - pad.r) * ((t - tStart) / this.window);

    ctx.font = `${10 * dpr}px monospace`;
    ctx.lineWidth = dpr;
    for (const n of [1, 10, 100, cap]) {
      const y = yOf(n);
      ctx.strokeStyle = n === cap ? "rgba(255,93,93,0.5)" : "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "#9aa7b8";
      ctx.fillText(n === cap ? `${n} cap` : String(n), 4 * dpr, y + 3 * dpr);
    }
    ctx.fillStyle = "#9aa7b8";
    ctx.fillText(`neutrons (log scale), last ${this.window} s`, pad.l, h - 6 * dpr);

    if (s.length < 2) return;
    ctx.strokeStyle = "#ff8200";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    let started = false;
    for (const p of s) {
      if (p.t < tStart) continue;
      const x = xOf(p.t), y = yOf(p.N);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
