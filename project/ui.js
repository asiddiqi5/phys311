// ui.js -- wires the HTML controls to the simulation, and holds the CSV recorder (bonus).
// Presentation only, so it lives outside engine/. A slider changes a plain parameter on the world.

export const DT_CHOICES = [1 / 480, 1 / 240, 1 / 120, 1 / 60];

const $ = (id) => document.getElementById(id);

// Every slider is clamped here as well as in the HTML, so a bad value can never reach the physics.
// Upper bounds, and why:
//   source 20 /s     more than this fills the 400 neutron cap from the source alone
//   albedo 95 %      at 100 % nothing could ever leak, and the chain could not be switched off by leakage
//   speed 2x         the accumulator clamps a frame at 0.25 s, so more than 2x just drops time
//   DT 1/60 s        the coarsest step. the fastest neutron (20 m/s) then moves 0.33 m per step, still
//                    less than the 0.36 m contact distance, so it cannot tunnel through an atom.
//                    the mouse spring needs dt < 2 / sqrt(200) = 0.14 s, so it is stable too
const SLIDERS = {
  rods:      { min: 0,    max: 100, fmt: (v) => `${v.toFixed(0)} %`,      set: (v, c) => c.world().setRods(v / 100) },
  moderator: { min: 0,    max: 100, fmt: (v) => `${v.toFixed(0)} %`,      set: (v, c) => c.world().setModerator(v / 100) },
  albedo:    { min: 0,    max: 95,  fmt: (v) => `${v.toFixed(0)} %`,      set: (v, c) => { c.world().p.albedo = v / 100; } },
  source:    { min: 0,    max: 20,  fmt: (v) => `${v.toFixed(0)} /s`,     set: (v, c) => { c.world().p.source = v; } },
  fireSpeed: { min: 0.5,  max: 14,  fmt: (v) => `${v.toFixed(1)} m/s`,    set: (v, c) => { c.state.fireSpeed = v; } },
  speed:     { min: 0.25, max: 2,   fmt: (v) => `${v.toFixed(2)}x`,       set: (v, c) => { c.state.speed = v; } },
  dt:        { min: 0,    max: 3,   fmt: (v) => `1/${Math.round(1 / DT_CHOICES[Math.round(v)])} s`, set: (v, c) => c.actions.setDT(Math.round(v)) },
};

export function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

export function makeAnnouncer(el) {
  return (msg) => { if (el) el.textContent = msg; };
}

// ctx = { world(), state, renderer, actions, recorder }
export function setupUI(ctx) {
  // sliders. .value is always a string, so parse it at the boundary
  for (const [id, s] of Object.entries(SLIDERS)) {
    const el = $(id);
    if (!el) continue;
    el.min = s.min; el.max = s.max;
    el.addEventListener("input", () => {
      const v = clamp(parseFloat(el.value), s.min, s.max);
      showSlider(id, v);
      s.set(v, ctx);
    });
  }

  $("integrator").addEventListener("change", (e) => ctx.actions.setIntegrator(e.target.value));

  const toggles = {
    trails:     (on) => { ctx.renderer.showTrails = on; if (!on) ctx.renderer.clearTrails(); },
    speedColor: (on) => { ctx.renderer.colorBySpeed = on; },
    flashes:    (on) => { ctx.renderer.showFlashes = on; },
    vectors:    (on) => { ctx.renderer.showVectors = on; },
    showChart:  (on) => { $("chart-box").hidden = !on; },
    teleport:   (on) => { ctx.actions.setTeleport(on); },
  };
  for (const [id, fn] of Object.entries(toggles)) {
    const el = $(id);
    if (el) el.addEventListener("change", () => fn(el.checked));
  }

  const buttons = {
    "btn-play": ctx.actions.togglePause, "btn-step": ctx.actions.stepOnce, "btn-reset": ctx.actions.reset,
    "btn-scram": ctx.actions.scram, "btn-fire": ctx.actions.fire, "btn-csv": ctx.actions.downloadCSV,
  };
  for (const [id, fn] of Object.entries(buttons)) {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
  }

  sync(ctx);
}

function showSlider(id, v) {
  const s = SLIDERS[id];
  const out = $(id + "-out");
  const text = s.fmt(v);
  if (out) out.textContent = text;
  const el = $(id);
  if (el) el.setAttribute("aria-valuetext", text);      // a screen reader says "75 %", not "75"
}

// push the current state into the controls. used after a reset or a keyboard change
export function sync(ctx) {
  const w = ctx.world();
  const values = {
    rods: w.p.rods * 100, moderator: w.p.moderator * 100, albedo: w.p.albedo * 100, source: w.p.source,
    fireSpeed: ctx.state.fireSpeed, speed: ctx.state.speed, dt: ctx.state.dtIndex,
  };
  for (const [id, v] of Object.entries(values)) {
    const el = $(id);
    if (el) el.value = v;
    showSlider(id, v);
  }
  const play = $("btn-play");
  if (play) {
    play.textContent = ctx.state.running ? "Pause" : "Resume";
    play.setAttribute("aria-pressed", String(!ctx.state.running));
  }
  const integ = $("integrator");
  if (integ) integ.value = w.integrator.constructor.name;
}

/* ------------------------------------------------ CSV export (bonus) */

// one row every 0.1 s of simulated time, taken inside the step so the spacing is exact
export class Recorder {
  constructor(every = 0.1, maxRows = 12000) {
    this.every = every;
    this.maxRows = maxRows;
    this.rows = [];
    this.next = 0;
  }

  reset() { this.rows = []; this.next = 0; }

  sample(world) {
    if (world.time + 1e-9 < this.next) return;
    while (this.next <= world.time + 1e-9) this.next += this.every;

    let keN = 0, keM = 0, sx = 0, sy = 0, sv = 0, n = 0;
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      const ke = b.kineticEnergy();
      if (b.group === "n") { keN += ke; sx += b.pos.x; sy += b.pos.y; sv += b.vel.length(); n++; }
      else keM += ke;
    }
    const c = world.count, p = world.p;
    this.rows.push({
      t: world.time,
      neutrons: world.nCount,
      k_eff: world.kEff(),
      fissions: c.fissions,
      births: c.bornReal,
      rod_absorptions: c.absRod,
      leaked: c.leaked,
      fired: c.fired,
      from_source: c.sourced,
      dropped_at_cap: c.dropped,
      KE_neutrons: keN,
      KE_moderator: keM,
      PE_lattice: world.potentialEnergy(),
      E_with_ledger: world.totalEnergy(),
      dE_over_E0: world.drift().dE,
      ledger_error_rel: world.ledgerError().rel,
      rods_pct: p.rods * 100,
      moderator_pct: p.moderator * 100,
      reflector_pct: p.albedo * 100,
      neutron_mean_x: n ? sx / n : NaN,
      neutron_mean_y: n ? sy / n : NaN,
      neutron_mean_speed: n ? sv / n : NaN,
    });
    if (this.rows.length > this.maxRows) this.rows.shift();
  }
}

// numbers keep full precision. a missing value (no neutrons yet) is left empty
export function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v) => (typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v));
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n") + "\n";
}

export function downloadCSV(rows, filename = "reactor_run.csv") {
  const blob = new Blob([toCSV(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
