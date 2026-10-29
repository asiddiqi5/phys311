// render/hud.js -- live conservation readout, compared against world.baseline,
// which main.js captures once when a scene is built.

const fmt = (x, n = 4) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(3) : x.toFixed(n));

export class HUD {
  constructor(el) {
    this.el = el;
    this.warn = 0.01;      // red past 1% energy drift
  }

  update(world, timing, acc) {
    const d = world.drift();
    const level = Math.abs(d.dE) > this.warn ? "bad" : Math.abs(d.dE) > this.warn / 10 ? "warn" : "good";
    const pInt = world.hasExternalField() ? "n/a (external field)" : d.dpInt.toExponential(2);
    const row = (label, value, cls = "") =>
      `<div class="hud-row ${cls}"><span>${label}</span><b>${value}</b></div>`;

    this.el.innerHTML = [
      row("t", `${world.time.toFixed(2)} s`),
      row("bodies", world.bodies.length),
      row("integrator", world.integrator.constructor.label),
      row("collisions", world.collisionCount),
      "<hr>",
      row("KE", `${fmt(world.kineticEnergy())} J`),
      row("PE", `${fmt(world.potentialEnergy())} J`),
      row("E", `${fmt(d.E)} J`, level),
      row("&Delta;E/E&#8320;", `${(d.dE * 100).toFixed(4)} %`, level),
      row("|p|", fmt(d.p.length(), 6)),
      row("|&Delta;p|/|p&#8320;|", d.dp.toExponential(2)),
      row("|&Delta;(p - J<sub>ext</sub>)|/|p&#8320;|", pInt),
      "<hr>",
      row("fps", timing.fps.toFixed(0)),
      row("physics", `${timing.physicsMs.toFixed(2)} ms/frame`),
      row("render", `${timing.renderMs.toFixed(2)} ms/frame`),
      row("pair checks", `${world.stats.checks} /step`),
      row("steps/frame", `${acc.stepsLastFrame}${acc.clamped ? " (clamped)" : ""}`),
    ].join("");
  }
}
