// tests/validate.js -- headless checks. Runs in Node and from the page.
//     node tests/validate.js        (from the lab09 folder)
// This only works because engine/ and scenes/ never touch the DOM.

import { vec } from "../engine/vec2.js";
import { Body } from "../engine/body.js";
import { resolveContact } from "../engine/collisions.js";
import { billiards, ballPit, nBody, molecules } from "../scenes/scenes.js";

const results = [];
const log = [];
function out(s) { log.push(s); if (typeof window === "undefined") console.log(s); }
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  out(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(44)} ${detail}`);
}

function run(world, dt, T, onStep) {
  world.captureBaseline();
  const n = Math.round(T / dt);
  for (let i = 0; i < n; i++) { world.step(dt); if (onStep) onStep(world); }
  return world;
}

const e2 = (x) => x.toExponential(2);

export function validate() {
  results.length = 0;
  log.length = 0;
  out("=".repeat(78));
  out("LAB 9 ENGINE");
  out("=".repeat(78));

  /* --- 1. separating guard ------------------------------------------- */
  out("\n[1] Overlapping pair that is already separating");
  {
    const a = new Body({ pos: vec(0, 0), vel: vec(-1, 0), radius: 0.5 });
    const b = new Body({ pos: vec(0.9, 0), vel: vec(1, 0), radius: 0.5 });
    const J = resolveContact(a, b, 1.0, true);
    out(`    impulse = ${J}, velocities after: ${a.vel.x}, ${b.vel.x}`);
    check("separating pair gets no impulse", J === null && a.vel.x === -1 && b.vel.x === 1, "guard works");
  }

  /* --- 2. jitter --------------------------------------------------------- */
  out("\n[2] Jitter: ball pit, 100 balls, e = 0.6, mean KE from t = 20 to 22 s");
  {
    const meanKE = (guard) => {
      const w = ballPit({ n: 100, e: 0.6 });
      w.separatingGuard = guard;
      run(w, 1 / 240, 20);
      let ke = 0, vmax = 0;
      for (let i = 0; i < 480; i++) {
        w.step(1 / 240);
        ke += w.kineticEnergy() / 480;
        for (const b of w.bodies) if (!b.isStatic) vmax = Math.max(vmax, b.vel.length());
      }
      return { ke, vmax };
    };
    const on = meanKE(true), off = meanKE(false);
    out(`    guard on : KE = ${on.ke.toFixed(3)} J, fastest = ${on.vmax.toFixed(2)} m/s`);
    out(`    guard off: KE = ${off.ke.toFixed(3)} J, fastest = ${off.vmax.toFixed(2)} m/s`);
    check("pile is calmer with the guard", off.ke > 1.5 * on.ke, `KE ratio off/on = ${(off.ke / on.ke).toFixed(2)}`);
  }

  /* --- 3 and 4. the B2 box tests ----------------------------------------- */
  for (const e of [1.0, 0.8]) {
    out(`\n[${e === 1 ? 3 : 4}] Box, 20 balls, no gravity, e = ${e}, 60 s, DT = 1/240`);
    const w = billiards({ n: 20, e });
    let rises = 0, Eprev = w.totalEnergy();
    const p0 = w.momentum().length(), pi0 = w.internalMomentum().length(), E0 = w.totalEnergy();
    run(w, 1 / 240, 60, (wd) => {
      const E = wd.totalEnergy();
      if (E > Eprev * (1 + 1e-12)) rises++;
      Eprev = E;
    });
    const d = w.drift();
    out(`    |p|         t=0: ${p0.toFixed(12)}   t=60: ${w.momentum().length().toFixed(12)}`);
    out(`    |p - J_ext| t=0: ${pi0.toFixed(12)}   t=60: ${w.internalMomentum().length().toFixed(12)}`);
    out(`    E           t=0: ${E0.toFixed(12)}   t=60: ${d.E.toFixed(12)}`);
    out(`    pair collisions = ${w.collisionCount}, wall hits = ${w.bounds.hits}, steps where E rose = ${rises}`);
    check(`e = ${e}: p - J_ext conserved`, d.dpInt < 1e-12, `|d(p - J_ext)|/|p0| = ${e2(d.dpInt)}`);
    if (e === 1) check("e = 1: elastic box keeps energy", Math.abs(d.dE) < 1e-10, `dE/E0 = ${e2(d.dE)}`);
    else check("e = 0.8: energy never rises", rises === 0, `dE/E0 = ${(100 * d.dE).toFixed(2)} %, rises = ${rises}`);
  }

  /* --- 5. isolated (no walls): plain |p| holds ------------------------- */
  out("\n[5] No walls, isolated: |dp|/|p0| for several e");
  {
    let worst = 0;
    for (const e of [1.0, 0.8, 0.5, 0.0]) {
      const w = billiards({ n: 20, e, walls: false });
      run(w, 1 / 240, 10);
      const d = w.drift();
      worst = Math.max(worst, d.dp);
      out(`    e = ${e.toFixed(1)}   |dp|/|p0| = ${e2(d.dp)}   KE kept = ${(100 * w.kineticEnergy() / w.baseline.E).toFixed(2)} %   collisions = ${w.collisionCount}`);
    }
    check("isolated momentum to round-off", worst < 1e-12, `worst = ${e2(worst)}`);
  }

  /* --- 6. N-body ---------------------------------------------------------- */
  out("\n[6] N-body, 60 s, DT = 1/240");
  {
    const rows = {};
    for (const integ of ["Euler", "EulerCromer", "VelocityVerlet"]) {
      const w = nBody({ integrator: integ });
      const star = w.bodies[0];
      const r0 = w.bodies.slice(1, 6).map((b) => b.pos.sub(star.pos).length());
      let worst = 0, rDev = 0;
      run(w, 1 / 240, 60, (wd) => {
        worst = Math.max(worst, Math.abs(wd.drift().dE));
        wd.bodies.slice(1, 6).forEach((b, i) => {
          rDev = Math.max(rDev, Math.abs(b.pos.sub(star.pos).length() / r0[i] - 1));
        });
      });
      rows[integ] = { worst, rDev, bad: !!w.firstBadBody(), p: w.momentum().length() };
      out(`    ${integ.padEnd(15)} max |dE/E0| = ${e2(worst)}   max planet r change = ${(100 * rDev).toFixed(1)} %   |p| = ${e2(rows[integ].p)}`);
    }
    const v = rows.VelocityVerlet;
    check("Verlet: bounded, no escape, no NaN", v.worst < 1e-4 && v.rDev < 0.2 && !v.bad, `max |dE/E0| = ${e2(v.worst)}`);
    check("Verlet beats Euler-Cromer beats Euler", v.worst < rows.EulerCromer.worst && rows.EulerCromer.worst < rows.Euler.worst,
          `${e2(rows.Euler.worst)} > ${e2(rows.EulerCromer.worst)} > ${e2(v.worst)}`);
  }

  /* --- 7. molecules ------------------------------------------------------ */
  out("\n[7] Molecules, e = 1, Verlet, 60 s: energy error vs DT");
  {
    const drifts = [];
    let pWorst = 0;
    for (const den of [120, 240, 480]) {
      const w = molecules({});
      let worst = 0;
      run(w, 1 / den, 60, (wd) => { worst = Math.max(worst, Math.abs(wd.drift().dE)); });
      drifts.push(worst);
      pWorst = Math.max(pWorst, w.drift().dpInt);
      out(`    DT = 1/${den}   max |dE/E0| = ${e2(worst)}   |d(p - J_ext)|/|p0| = ${e2(w.drift().dpInt)}`);
    }
    check("energy error shrinks with DT, < 1% at 1/480", drifts[2] < drifts[1] && drifts[1] < drifts[0] && drifts[2] < 0.01,
          `${e2(drifts[0])} > ${e2(drifts[1])} > ${e2(drifts[2])}`);
    check("springs + pairs keep p - J_ext", pWorst < 1e-12, `worst = ${e2(pWorst)}`);
  }

  /* --- 8. broad phase ---------------------------------------------------- */
  out("\n[8] Brute Force vs Spatial Hash, 200 balls, 5 s");
  {
    const wb = billiards({ n: 200, broadPhase: "brute" });
    const wh = billiards({ n: 200, broadPhase: "hash" });
    run(wb, 1 / 240, 5);
    run(wh, 1 / 240, 5);
    const diff = Math.max(...wb.bodies.map((b, i) => b.pos.sub(wh.bodies[i].pos).length()));
    out(`    brute: ${wb.stats.checks} checks/step, ${wb.collisionCount} collisions`);
    out(`    hash : ${wh.stats.checks} checks/step, ${wh.collisionCount} collisions`);
    out(`    max position difference = ${diff}`);
    check("broad phase does not change the physics", diff === 0, `max |dr| = ${diff}`);
    check("hash does far fewer checks", wh.stats.checks < wb.stats.checks / 4, `${wh.stats.checks} vs ${wb.stats.checks}`);
  }

  const passed = results.filter((r) => r.ok).length;
  out("\n" + "=".repeat(78));
  out(`${passed} / ${results.length} checks passed`);
  out("=".repeat(78));
  return { results, text: log.join("\n"), passed, total: results.length };
}

// physics cost per frame at 60 fps (4 steps of 1/240). renderFrame is browser only
export function runScaling({ sizes = [20, 50, 100, 200, 500], modes = ["brute", "hash"],
                             steps = 120, renderFrame = null } = {}) {
  const lines = ["N     broad   checks/step   physics ms/frame   render ms/frame   est. fps"];
  const rows = [];
  for (const mode of modes) {
    for (const n of sizes) {
      const w = billiards({ n, broadPhase: mode });
      for (let i = 0; i < 60; i++) w.step(1 / 240);      // warm up
      const t0 = performance.now();
      for (let i = 0; i < steps; i++) w.step(1 / 240);
      const physicsMs = 4 * (performance.now() - t0) / steps;
      let renderMs = NaN;
      if (renderFrame) {
        const r0 = performance.now();
        for (let i = 0; i < 30; i++) renderFrame(w);
        renderMs = (performance.now() - r0) / 30;
      }
      const fps = Math.min(60, 1000 / (physicsMs + (Number.isNaN(renderMs) ? 0 : renderMs)));
      rows.push({ n, mode, checks: w.stats.checks, physicsMs, renderMs, fps });
      lines.push(`${String(n).padEnd(5)} ${mode.padEnd(7)} ${String(w.stats.checks).padStart(11)}   ${
        physicsMs.toFixed(3).padStart(16)}   ${Number.isNaN(renderMs) ? "      (browser)" : renderMs.toFixed(3).padStart(15)}   ${fps.toFixed(0).padStart(8)}`);
    }
  }
  return { rows, text: lines.join("\n") };
}

if (typeof window === "undefined") {
  const { passed, total } = validate();
  console.log("\n" + runScaling().text);
  process.exit(passed === total ? 0 : 1);
}
