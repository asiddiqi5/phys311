# Week 12 Progress Log: Reactor Core Explorer

**Name: Aidan Siddiqi**  **Live:** `https://asiddiqi5.github.io/phys311/project/`

**AI use disclaimer:** AI (Claude) was used extensively in preparing this code and write-up for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done; all of it included input and assistance from myself and many iterations and human attempts are consolidated into what is seen here.

---

## 1. MUST tier status

| Item | Status | Note |
|---|---|---|
| Fuel Temperature: heating per fission, Newton cooling at the fixed DT | Done | |
| Fission Probability suppressed by temperature, clamped to [0, 1] | Done | |
| Controls for feedback strength, coolant flow, on/off | Done | Sliders plus a checkbox |
| HUD Rows: fuel temp, fission rate vs cold fuel, heat balance | Done | |
| Plain-Language explainer panel | Done | Written after peer feedback that the terms were confusing to non-nuclear readers |
| Deployed to GitHub Pages | Done | |

Nothing cut. The Week 11 spike cleared the feedback loop before I committed to it, so I
built the feature that week rather than waiting.

Also built this week, for Part B:

| Item | Status |
|---|---|
| Debug HUD behind `?debug=1` and the D key | Done |
| Conservative test mode | Done |
| Per-step contact count and max-speed readouts | Done |

## 2. Validation results

Both tests are the ones I promised in my Week 11 proposal.

| Test | Expected | Measured | Pass? |
|---|---|---|---|
| **1. Equilibrium temperature vs. the closed form.** Mean fuel T over t = 60–180 s against the quadratic `k₀αΔT² − (k₀−1)ΔT − Sq/λ = 0` | within 5 % | rods 20 %: predicted 33.35, measured 34.42, **3.2 %**. rods 40 %: predicted 32.72, measured 32.18, **1.7 %** | **Pass** |
| **2. Heat ledger closes.** Heat generated − removed − stored, over heat generated | < 10^-6 | 60 s: **1.1 × 10^-13**. 180 s: **2.4 × 10^-12** | **Pass** |
| **3. Conservative reduction.** max \|ΔE/E₀\| over 60 s with every dissipative and driving term off | < 1.5 % (Verlet) | **80.6 %** at DT = 1/120 with the shipped lattice | **Fail: see below** |

The only measured input to test 1 is the cold-fuel k (1.206 at rods 20 %, 1.021 at 40 %,
measured with feedback off over t = 2-8 s). The predicted temperature uses no fitted
parameter. The measured neutron lifetime, L = 18.8 s, is needed only for the population
prediction.

### Why Test 3 Fails

It is not the new feature and it is not the integrator. When a neutron overlaps a moderator
atom, the engine pushes the pair apart. That displaces the atom off its spring's
rest site, and the spring stores energy nobody paid for. The stored amount is
`1/2k * overlap^2`, so it scales with the lattice stiffness.

The evidence, all from an identical starting state of 60 neutrons, 60 s, conservative mode
on from t = 0:

| Lattice | DT = 1/60 | 1/120 | 1/240 | 1/480 |
|---|---|---|---|---|
| k = 120 (shipped) | 86.9 % | 80.6 % | 61.6 % | 38.0 % |
| k = 30 | 45.2 % | 19.1 % | 9.1 % | 3.6 % |
| k = 5 | 3.9 % | 1.4 % | 0.5 % | 0.5 % |
| no lattice at all | 7.7e-14 % | 7.7e-14 % | 1.1e-13 % | 6.2e-14 % |

With no lattice, the core loop and the collision code conserve energy to machine precision,
so the error lives entirely in the spring-plus-contact interaction. It shrinks with DT and
with stiffness, which is the signature of a discretization artifact rather than a sign error.

The reacting reactor's honest diagnostic is the heat ledger and the energy ledger, which book
every flow the engine cannot see. Those read 0.000 % and about 0.2 %.

### Fixed Timestep under CPU Throttling

With DevTools CPU throttling at 8x, six seconds of wall time advanced the simulation clock by
6.02 s, both throttled and unthrottled, a ratio of 1.00. The accumulator runs fewer steps per
frame under load, but every step is the same size, so the physics is unchanged.

### Bonus: DT-halving Convergence (run early)

Mean fuel temperature over t = 60–180 s, rods 20 %:

| DT | mean T | mean N | change vs. the next finer step |
|---|---|---|---|
| 1/60 | 34.041 | 168 | 1.11 % |
| 1/120 | 34.422 | 185 | 1.06 % |
| 1/240 | 34.792 | 192 | 0.51 % |
| 1/480 | 34.972 | 202 | — |

Converging, and the step-to-step change roughly halves. It has not flattened at 1/480, so
the shipped DT = 1/120 carries about a 1 % bias in the steady temperature. That is inside
the 5 % tolerance I set for test 1, and worth one sentence in the final write-up.

## 3. Decisions Made this Week

Full entries in `DECISIONS.md`. Summary:

- **Conservative mode also disables rod absorption.** Retracted rods still graze the top of
  the core, so one got through during the test.
- **Kept the stiff lattice and reported test 3 as failing.** Softening it would pass the test
  but undo the Week 11 fix that keeps struck atoms inside the core. Fixing the contact
  handling is the right answer and is first on next week's list.
- **Dropped the "internal momentum" readout.** Neither momentum figure is conserved here,
  because fission creates neutrons and absorption destroys them. Claiming otherwise would
  have been a false validation.
- **Cut nothing from the MUST tier.**

## 4. Two Bugs

### Bug 1: conservative mode still absorbed a neutron

- **Symptom:** With every dissipative term switched off, the neutron count still dropped by
  one over 60 s, and the rod-absorption counter ticked up.
- **Cause:** Geometry. Fully retracted rods park at y = 12.35 and the top of the
  core is y = 12. The rod-plus-neutron contact distance is 0.36, so a retracted rod still
  reaches 0.35 into the box and can swallow a neutron grazing the ceiling.
- **Fix:** Absorption is a dissipative channel, so conservative mode now skips it. The rod
  stays in place as an elastic obstacle, which is conservative. The count now holds exactly.

### Bug 2: energy error larger than the body's whole energy

- **Symptom:** While dragging a neutron with the mouse spring, the energy ledger error grew
  larger than the kinetic energy of the neutron being dragged.
- **Cause:** The mouse spring is an outside force, so its work has to be booked. I was
  sampling force*velocity once mid-step. The damping term is large and nearly cancels the
  spring term, so a single mid-step sample of their difference is badly wrong.
- **Fix:** Replaced it with the exact work identity for the step, using the forces actually
  applied at the start and end and the velocities before and after. The residual is now
  2.7 × 10^-15 of the neutron's energy.

## 5. Next week: the three SHOULD items, in order

1. **Fix the contact artifact behind test 3.** Resolve contact at the true time of impact, or
   correct the spring's reference position when the engine displaces a tethered atom. Success
   is test 3 under 1.5 % with the shipped lattice.
2. **Delayed neutrons.** Hold a small fraction of births back by a few seconds. This is the
   real reason reactors are controllable, and it is the SHOULD item with the most physics in
   it. The neutron balance must still close exactly.
3. **`VALIDATION.md`.** The full numerical report, with every table above re-run on the final
   build, plus the convergence study extended to 1/960.

If item 1 turns out to need engine surgery, I will stop, write up the tradeoff, and do items 2
and 3 instead. The fallback named in my proposal still stands.
