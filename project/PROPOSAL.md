# Final Project Proposal — PHYS 311

**Name: Aidan Siddiqi**  **Date:** Week 11
**Repo:** `github.com/<username>/phys311` → `project/`
**Live:** `<username>.github.io/phys311/project/`

**AI use disclaimer:** AI (Claude) was used extensively in preparing this code and write-up for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done; all of it included input and assistance from myself and many iterations and human attempts are consolidated into what is seen here.

---

## 1. Title & Pitch

**Reactor Core Explorer: slide the control rods and watch a chain reaction find its own level.**

You move sliders on a flat toy reactor core and watch the neutron population grow, hold
steady, or die out, while the fuel heats up and pushes back on the reaction heating it.

---

## 2. The Physics

Four kinds of body, all discs, all already in my Lab 10 engine:

| Interaction | Expression |
|---|---|
| Neutron–atom collision | elastic, impulse along the line of centres, $e = 1$. Equal masses, so a neutron keeps $1 - \tfrac{8A}{3(1+A)^2} = \tfrac13$ of its energy on average |
| Moderator lattice | $\vec F = -k(\vec r - \vec r_0)$, $k = 120$, each atom tethered to its site |
| Heat bath (coolant) | $\vec F = -c\vec v + \sqrt{2ck_BT/\Delta t}\,\vec\xi$, $c = 8$, $k_BT = 1$ |
| Fission | on contact with fuel, $P = 0.55$ if $E_k < 4$ else $0.02$; removes the neutron, creates 2–3 at $v = 14$ |
| Absorption / Leakage | control rods absorb on contact; the boundary reflects with probability `albedo`, else the neutron is lost |
| Mouse Grab | $\vec F = k_m(\vec r_\text{cursor} - \vec r) - c_m\vec v$, $k_m = 200$, $c_m = 20$ |

**The one new thing: fuel temperature feedback.** The fuel gets a temperature:

$$\frac{dT}{dt} = \frac{q\,\dot N_f - \lambda (T - T_c)}{C}, \qquad
P_\text{fission}(T) = P_0\left[1 - \alpha (T - T_c)\right]$$

with $q$ the heat per fission, $\dot N_f$ the fission rate, $\lambda$ the coolant flow, $C$ the fuel
heat capacity and $\alpha$ the feedback strength. Hot
fuel captures neutrons without fissioning, so $k$ falls as the core heats. My
Lab 10 engine has no state that is not a body, and nothing that feeds back on a reaction rate.

**Integrator:** Velocity Verlet at a fixed `DT = 1/120 s` in the Week 9 accumulator, with
Euler-Cromer and Euler selectable at runtime. The lattice springs are stiff and conservative, which
is where a symplectic method works well. Over 20 s the energy ledger error is 0.21 % for Verlet,
0.54 % for Euler-Cromer and 30 % for Euler.

**Units:** arbitrary. Core 20 × 12 units, neutron speeds 1–20, fuel temperature 20–60, population
0–400 (a hard cap).

---

## 3. Three-Tier Scope

**MUST: end of Week 12**

- Fuel temperature, heating per fission, Newton cooling, integrated at the fixed `DT`
- Fission probability suppressed by temperature, clamped to $[0,1]$
- Controls for feedback strength, coolant flow, and an on/off switch
- HUD rows for fuel temperature, fission rate against cold fuel, and the heat-balance residual
- A plain-language explainer panel for non-nuclear visitors
- **Deployed to GitHub Pages and loading cleanly**

**SHOULD: Week 13**

- Delayed neutrons, a small fraction of births held back by seconds
- An operator challenge to hold the power in a band while the coolant drifts
- `VALIDATION.md` with the full numerical report
- Reduce the contact artifact found in Test 3b below

**COULD: droppable**

- Xenon poisoning, **droppable**
- A shareable URL encoding the slider settings, **droppable**

---

## 4. Validation Plan

**Test 1: equilibrium against a closed form.** Setting both rates to zero gives a quadratic: 
$\Delta T = T - T_c$: $\;k_0\alpha\,\Delta T^2 - (k_0-1)\,\Delta T - Sq/\lambda = 0$.

- Quantity: steady $T$ and $N$ · Expected: the positive root · **Tolerance: < 0.1 %** in the point
  model, **< 5 %** for the 120 s average in the full simulation

**Test 2: heat ledger closes.**

- Quantity: heat generated − removed − stored, over heat generated · Expected: zero
  · **Tolerance: < 10⁻⁶** over 60 s. Measured: **0.000 %**

**Test 3: switch off.** My normal energy readout is meaningless, because fission creates energy
and absorption destroys it. Turning the reactions off restores a testable system.

- **3a, empty core** (no source, no fission, no moderator, reflector 1): $\max|\Delta E/E_0|$ over
  60 s, **tolerance < 10⁻¹⁰ %**. Measured **7.7 × 10⁻¹⁴ %**
- **3b, soft lattice** (moderator back at $k = 5$, bath off): **tolerance < 1.5 % for Verlet**.
  Measured **0.92 % Verlet, 1.97 % Euler-Cromer, 490 % Euler**

I first ran 3b at the normal stiffness ($k = 120$) and it failed at **61 %**. When a neutron overlaps a moderator atom, the engine's positional correction displaces the atom off its site and a stiff spring stores energy nobody paid for. The error falls to 12.8 %, 0.78 % and 0.04 % as $k$ drops to 30, 5 and 0.5. So 3b runs at $k = 5$, which isolates the integrator from the contact artifact, and fixing the artifact is a SHOULD item.

**Test 4: the feedback does what it claims.**

- Quantity: births dropped at the 400 cap over 150 s with the rods 20 % in
  · **Tolerance: > 1000 off, < 50 on**. Measured **1980 off, 0 on**

**Test 5 : timestep.** Steady $T$ at `DT = 1/60` through `1/480`, **tolerance < 0.5 %**. Spike
measures 0.0 %.

**Test 6: determinism.** Same seed, 3000 steps, twice: **bit-for-bit identical**.

---

## 5. Biggest Risk + Fallback

The thing most likely to sink this project is delayed neutrons making the simulation feel sluggish
or disconnected, a birth queue measured in seconds inside a loop that steps in hundredths, and
my fallback is to ship the prompt-only reactor I already have and spend Week 13 on the operator
challenge and the validation report, which needs no new physics.

---

## 6. Timeline

| Week | Deliverable |
|---|---|
| 11 | Proposal, risk spike, workshop review |
| 12 | MUST tier complete, Tests 1–4 passing, deployed |
| 13 | SHOULD tier, `VALIDATION.md`, README, write-up |

---

## 7. Audience

Curious non-physicists and intro-physics students. The peer feedback on my Lab 10 said the terms
confused people outside nuclear, which is why the explainer is in MUST. After two minutes, they
should understand that a reactor is held steady by its own heat.
