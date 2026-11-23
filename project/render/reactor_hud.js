// render/reactor_hud.js -- the live readout. It compares against world.baseline, which is
// captured once when the scene is built, so the drift cannot quietly read zero.

const fmt = (x, n = 3) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(n));

export function criticality(k) {
  if (Number.isNaN(k)) return "waiting for data";
  const word = k < 0.98 ? "subcritical" : k > 1.02 ? "supercritical" : "critical";
  return `${k.toFixed(2)} (${word})`;
}

export class ReactorHUD {
  constructor(el) {
    this.el = el;
    this.warn = 0.01;      // red past 1 % energy error
  }

  // The six readouts the Week 12 lesson asks for, behind ?debug=1 or the D key.
  // Drift turns red past 1 %, which is the tolerance I stated in my proposal.
  debugRows(world, timing, row, lvl) {
    const d = world.drift();
    const p = world.momentum().length();
    const vMax = world.maxSpeed();
    return [
      "<hr>",
      row("<b>DEBUG</b>", "?debug=1 or D"),
      row("E", `${world.totalEnergy().toFixed(4)} J`),
      row("drift &Delta;E/E&#8320;", `${(d.dE * 100).toFixed(3)} %`, lvl(d.dE),
          "Red past 1 %, the tolerance stated in my proposal"),
      row("|p|", `${p.toFixed(4)}`, "",
          "Total momentum. NOT a conservation check in this project: fission creates neutrons, "
          + "absorption destroys them, and the walls push. It is here to spot a sudden jump, which "
          + "would mean an asymmetric impulse"),
      row("bodies", `${world.bodies.length} (${world.nCount} neutrons)`),
      row("contacts this step", `${world.contactsThisStep}`,
          world.contactsThisStep > 40 ? "warn" : "",
          "Resolved by the engine in the last step. A count that never falls to 0 means repeated resolution"),
      row("max |v|", `${vMax.toFixed(2)} m/s`, vMax > world.p.vMax + 1e-9 ? "bad" : "",
          `Speed limit is ${world.p.vMax} m/s. Above that would mean the guard is not firing`),
      row("fps", `${timing.fps.toFixed(1)}`),
      world.conservative ? row("mode", "CONSERVATIVE", "good",
          "No source, fission, absorption, leakage or heat bath. Energy must be conserved") : "",
    ];
  }

  update(world, timing, acc, extra = {}) {
    this.debug = !!extra.debug;
    const d = world.drift();
    const le = world.ledgerError();
    const nb = world.neutronBalance();
    const k = world.kEff();
    const lvl = (x) => (Math.abs(x) > this.warn ? "bad" : Math.abs(x) > this.warn / 10 ? "warn" : "good");
    const atCap = world.nCount >= world.p.cap;
    const row = (label, value, cls = "", tip = "") =>
      `<div class="hud-row ${cls}"${tip ? ` title="${tip}"` : ""}><span>${label}</span><b>${value}</b></div>`;
    const c = extra.cursor;
    const corners = extra.corners;

    this.el.innerHTML = [
      row("t", `${world.time.toFixed(3)} s${extra.paused ? " (paused)" : ""}`),
      row("neutrons", `${world.nCount} / ${world.p.cap}${atCap ? " cap reached" : ""}`, atCap ? "bad" : "",
          "At the cap, new births are dropped and k_eff is not reliable"),
      row("k<sub>eff</sub>", criticality(k), "", "Neutrons produced by fission divided by neutrons lost, over the last 4 s"),
      row("fissions", world.count.fissions),
      row("fuel temp", `${world.T.toFixed(1)} &deg;`, world.T > world.p.Tcool + 40 ? "warn" : "",
          "Each fission heats the fuel. The coolant carries heat away."),
      row("fission rate vs cold", `${(100 * world.fuelFactor()).toFixed(0)} %`,
          world.p.feedback ? (world.fuelFactor() < 0.5 ? "warn" : "good") : "",
          world.p.feedback ? "Hot fuel fissions less readily, which is what holds the power steady"
                           : "Temperature feedback is OFF: nothing but the neutron cap limits a runaway"),
      row("heat balance", `${(100 * world.heatBalance().rel).toFixed(3)} %`, lvl(world.heatBalance().rel),
          "Heat generated minus heat removed minus heat stored, as a fraction of the heat generated"),
      row("rod / leak", `${world.count.absRod} / ${world.count.leaked}`),
      row("neutron balance", nb.ok ? "exact" : `MISMATCH ${nb.actual} vs ${nb.expected}`, nb.ok ? "good" : "bad",
          "start + source + fired + born - fissions - rods - leaks must equal the count"),
      "<hr>",
      row("KE", `${fmt(world.kineticEnergy(), 1)} J`),
      row("PE (lattice)", `${fmt(world.potentialEnergy(), 1)} J`),
      row("E with ledger", `${fmt(d.E, 1)} J`),
      row("&Delta;E/E&#8320;", `${(d.dE * 100).toFixed(3)} %`, "",
          "Change since the scene was built, against the starting energy. In a reactor this is EXPECTED to be large: "
          + "fission creates energy and absorption destroys it, so E0 is not a meaningful yardstick. The ledger error below is the honest test."),
      row("ledger error", `${(le.rel * 100).toFixed(3)} %`, lvl(le.rel),
          "Energy error against all the energy created by fission, the source and you"),
      "<hr>",
      row("cursor", c ? `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}) m` : "(move over the canvas)"),
      corners ? row("canvas corners", `(${corners.xmin.toFixed(2)}, ${corners.ymin.toFixed(2)}) to (${corners.xmax.toFixed(2)}, ${corners.ymax.toFixed(2)})`) : "",
      "<hr>",
      row("integrator", world.integrator.constructor.label),
      row("collisions", world.collisionCount),
      row("fps", timing.fps.toFixed(0)),
      row("physics", `${timing.physicsMs.toFixed(2)} ms/frame`),
      row("render", `${timing.renderMs.toFixed(2)} ms/frame`),
      row("steps/frame", `${acc.stepsLastFrame}${acc.clamped ? " (clamped)" : ""}`),
      ...(this.debug ? this.debugRows(world, timing, row, lvl) : []),
    ].join("");

    this.el.setAttribute("aria-label",
      `${world.nCount} neutrons, multiplication factor ${criticality(k)}, fuel temperature ${world.T.toFixed(0)} degrees, `
      + `energy ledger error ${(le.rel * 100).toFixed(2)} percent`);
  }
}
