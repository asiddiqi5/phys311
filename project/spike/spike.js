// spike.js -- 90-minute risk spike for the final project.
// RISK: if I make fuel temperature feed back on the fission rate, does the reactor settle
// at a steady power, or does it oscillate / stall / need a timestep I cannot afford?
// Throwaway prototype. No engine, no rendering, no UI.
// Run: node spike.js
"use strict";

// Strip the reactor down to the two numbers that talk to each other:
//   N = neutron population, T = fuel temperature
//   dN/dt = (k - 1) * N / L + S       k falls as the fuel heats
//   dT/dt = (heat * N / L - cooling * (T - Tc)) / C
const P = { k0: 1.35, alpha: 0.004, L: 0.35, S: 4, heat: 1, cooling: 5, C: 12, Tc: 20 };

function run(opts = {}, seconds = 300, dt = 1 / 120) {
  const p = { ...P, ...opts };
  let N = 40, T = 20;
  for (let i = 0; i < seconds / dt; i++) {
    const k = p.k0 * (1 - p.alpha * (T - p.Tc));
    N = Math.max(0, Math.min(400, N + ((k - 1) * N / p.L + p.S) * dt));
    T += (p.heat * N / p.L - p.cooling * (T - p.Tc)) / p.C * dt;
  }
  return { N, T, k: p.k0 * (1 - p.alpha * (T - p.Tc)) };
}

const f = (x, n = 1) => x.toFixed(n);

// --- 1. no feedback: this is my project today ---------------------------------
const off = run({ alpha: 0 });
console.log("1. No feedback (alpha = 0):");
console.log(`   N = ${f(off.N, 0)} (that is the 400 cap), k stuck at ${f(off.k, 2)}.`);
console.log("   Nothing but my neutron cap stops it. That is the problem I am fixing.\n");

// --- 2. with feedback: does it settle, and where? -----------------------------
// At equilibrium both rates are zero, which gives a quadratic in dT = T - Tc:
//   k0*alpha*dT^2 - (k0-1)*dT - S*heat/cooling = 0
function predict(p) {
  const a = p.k0 * p.alpha, b = -(p.k0 - 1), c = -p.S * p.heat / p.cooling;
  const dT = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return { T: p.Tc + dT, N: p.cooling * dT * p.L / p.heat };
}
console.log("2. With feedback, measured vs the closed form:");
console.log("   alpha     T model   T formula     N model   N formula");
for (const alpha of [0.002, 0.004, 0.008, 0.02]) {
  const r = run({ alpha }), q = predict({ ...P, alpha });
  console.log(`   ${String(alpha).padEnd(8)} ${f(r.T).padStart(8)} ${f(q.T).padStart(10)} ${f(r.N, 0).padStart(11)} ${f(q.N, 0).padStart(10)}`);
}
console.log("   They agree to the digits shown. It settles, and it settles where it should.\n");

// --- 3. does it need a finer timestep than I use? -----------------------------
console.log("3. Timestep (alpha = 0.02, the stiffest case):");
for (const d of [60, 120, 240, 480]) {
  const r = run({ alpha: 0.02 }, 300, 1 / d);
  console.log(`   DT = 1/${String(d).padEnd(4)}  T = ${f(r.T, 3)}   N = ${f(r.N, 1)}`);
}
console.log("   No change. The loop is slow compared with my 1/120 physics step.\n");

// --- 4. how hard can I push it before it misbehaves? --------------------------
console.log("4. Turning the feedback up (with slow cooling, the worst case):");
for (const alpha of [0.01, 0.05, 0.12, 0.3]) {
  const r = run({ alpha, cooling: 0.5 }, 600);
  console.log(`   alpha ${String(alpha).padEnd(6)} N = ${f(r.N, 0).padStart(4)}   T = ${f(r.T).padStart(6)}   ${r.N < 2 ? "<-- core shuts down" : ""}`);
}
console.log("   It does not oscillate. It dies. So the slider needs an upper limit.");
