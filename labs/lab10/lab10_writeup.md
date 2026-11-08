# Lab 10: Interactive Simulation (Block 3 Checkpoint)

Name: 
Date: 11/8/2026
Lab: PHYS 311 Module 10

**AI use disclaimer:** AI (Claude) was used in preparing this code and write-up for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done; all of it included input and assistance from myself and many iterations and human attempts are consolidated into what is seen here.

Live link: `https://<username>.github.io/phys311/labs/lab10/`

The project is a toy reactor core, the **Reactor Core Explorer**. It runs on my Lab 9 engine, which is copied in unchanged. All the new code is in `scenes/reactor.js`, `input.js`, `ui.js`, `main.js` and three new files in `render/`.

Items marked **[you]** below need something only I can do: a screenshot, a real browser, or a phone.

## A1: Coordinate-correct input

`eventToWorld()` in `input.js` does two steps. It first turns the viewport position into canvas pixels with the ratio `canvas.width / rect.width`, which handles CSS scaling and the retina buffer. Then it runs my camera backwards with `camera.screenToWorld`. All input uses `pointerdown`, `pointermove` and `pointerup`, so a mouse, a finger and a stylus all work.

The Live diagnostics panel shows the cursor's physics coordinates, and the canvas draws a crosshair at that point. The panel also shows the physics coordinates of the four canvas corners. The canvas is fitted with no padding, so the corners should equal the view bounds, (-0.40, -0.40) to (20.40, 12.40), to within one pixel (the buffer height is rounded to whole pixels).

**[you] Insert screenshot: the cursor on each of the four corners, with the readout visible.**

| Corner | Expected (x, y) in m | Readout when I clicked it |
|---|---|---|
| bottom-left | (-0.40, -0.40) | [you] |
| bottom-right | (20.40, -0.40) | [you] |
| top-left | (-0.40, 12.40) | [you] |
| top-right | (20.40, 12.40) | [you] |

Automated check (`tests/validate.js`): clicks map through the camera with a worst error of 2.7e-15 m for a 1x buffer, a 4x retina buffer, and a canvas shrunk or stretched by CSS. The four corners land within 0.0037 m, which is under one pixel.

**[you] Phone check: [what happened when I tried it by touch]**

## A2: Simulation controls

| Control | Key | What I checked |
|---|---|---|
| Pause / Resume | Space | Physics freezes, the picture keeps drawing. The button label follows the state |
| Single step | . | Pauses first, then advances exactly one DT. Worst gap between the clock change and DT is 2.95e-17 s (1.9e-16 in the stub-browser test) |
| Reset | R | Rebuilds the core from the same seed, keeps the sliders, and takes a new energy baseline. After a reset the energy drift reads 0 |
| Speed 0.25x to 2x | - and + | Scales the clock that feeds the accumulator. DT never changes. At 2x the page covers 2.03 times the simulated time of 1x |
| Integrator | menu | Euler, Euler-Cromer or Velocity Verlet, switched live with no reset |

Speed scales time and never DT, so physics still advances in identical slices. The proof is in `tests/validate.js`. The state after step 1500 is bit-for-bit identical at 60 Hz, 144 Hz, jittery frames, 0.25x and 2x. A 2 s stall is clamped to 30 steps instead of 240.

## A3: Parameter sliders

Four sliders change the physics live, and each has a readout that updates as it moves and a spoken value (`aria-valuetext`). All values go through `parseFloat` and are clamped in code as well as in the HTML.

| Slider | Range | Why this upper bound |
|---|---|---|
| Control rods | 0 to 100 % | 100 % puts the rods to the floor of the core |
| Moderator | 0 to 100 % | 100 % fills every lattice site |
| Reflector | 0 to 95 % | At 100 % nothing could ever leak |
| Neutron source | 0 to 20 per s | More than this fills the 400 neutron cap from the source alone |
| Speed | 0.25x to 2x | A frame is clamped at 0.25 s, so more than 2x only drops time |
| Timestep DT | 1/480, 1/240, 1/120, 1/60 s | See below |

**How I chose the upper bound for DT.** There are two stability limits.

- The mouse spring has k = 200 and m = 1. The lesson's condition is Δt < 2 / sqrt(k/m) = 2 / 14.1 = 0.141 s. The lattice springs (k = 120) allow Δt < 2 / sqrt(120) = 0.183 s.
- A neutron must not skip over an atom in one step. It tunnels if |v| Δt is larger than the contact distance, which is the neutron radius plus the atom radius, 0.06 + 0.30 = 0.36 m. I limit neutron speed to 20 m/s, so Δt must be under 0.36 / 20 = 0.018 s.

The tunneling limit is the tighter one. The coarsest DT I allow is 1/60 s = 0.0167 s, where a neutron at the speed limit moves 0.333 m per step, just under 0.36 m. This is the same condition as the Week 9 tunneling rule.

## B1: Grabbing, throwing and the slingshot

**Grab.** Pressing on a neutron or a moderator atom adds a damped spring toward the cursor as a Force (`MouseSpring` in `input.js`, k = 200, c = 20). The body still collides. In the test, a neutron dragged onto a fuel atom reacted (1 fission) and the spring let go by itself. A released neutron keeps the velocity it had (2.67 m/s in the test). The mouse is an outside force, so its work is booked in the energy ledger. The ledger error while holding a neutron is 2.7e-15 of its energy.

**Slingshot.** Press on empty space, pull back, and release. The neutron's speed is 4 times the pull length, capped at 14 m/s. While aiming, a dashed line shows the pull and a solid line shows the straight path to the first thing the neutron will touch, with a ring there and a label such as "5.4 m/s (fast) -> hits fuel". Between collisions a neutron moves in a straight line, so the preview is exact on a cold lattice. In 84 test shots every real first contact was within 3 cm of the prediction (worst 0.006 m). On the live page the atoms jiggle, so the real hit can land slightly off.

**Why teleport-dragging breaks the physics.** I added a "Teleport drag" checkbox so I could try it. It sets `body.pos` directly to the cursor. Two things go wrong, and I measured both.

1. **No collisions, so bodies pass through things, and release gives no velocity.** In the test I dragged a neutron straight across two fuel columns at 0.35 m per step. There were 0 fissions, because the neutron jumped over every atom. Its velocity stayed (0.00, 0.00), so letting go would drop it dead, not throw it. This is the same tunneling problem as a fast body through a thin wall.
2. **Energy is meaningless.** With teleport on, I dragged a moderator atom 3 m out of its site. The atom's spring now holds 1/2 k d^2 = 540 J, and nobody paid for it, so the energy ledger jumped from 0 to 540 J in one step. Dragging the same atom with the mouse spring books the work. The leftover was 1.5 J out of the 211 J the lattice held (0.7 %), which is the integrator's own error.

**[you] What I saw when I tried it in the browser. Grab a neutron with teleport on and drag it across a fuel column. Then grab a moderator atom and drag it a few meters, and watch the ledger error: [describe it in your own words]**

## B2: Visuals that reveal physics

Each one has its own checkbox in the Display section.

| Visual | What a viewer can now understand that they could not before |
|---|---|
| Neutron trails (alpha fade) | The path history: long straight runs between collisions and sharp turns at each collision, so you can see a neutron wander through the lattice |
| Color by speed, with a legend (blue slow, red fast) | Moderation. A red neutron turns green and then blue after a few collisions with moderator atoms, and the blue ones are the slow neutrons that cause fission |
| Fission flashes | Where and when fissions happen. Above critical the flashes get visibly more frequent |
| Velocity arrows | Direction and speed as a vector. A collision shows up as an arrow that suddenly turns |
| Population chart (log scale) | Exponential growth and decay as a straight line. The slope shows how far from critical the core is, and the line flattens at the 400 cap |

The legend uses words as well as color, and fuel, rods and moderator are told apart by shape (ring, square, disc) as well as color.

**[you] Insert screenshots: the running core with the HUD visible, and a runaway chain with the chart.**

## B3: Responsive and accessible

- The canvas buffer is the CSS width times `devicePixelRatio`, and it keeps the world in view on resize. CSS gives it `width: 100%; height: auto`, and `touch-action: none` stops a drag from scrolling the page. The layout becomes one column below 860 px.
- Every control is a real HTML element with a `<label for>`. Tab reaches all of them, and a visible orange focus ring shows where you are. Sliders speak their values ("75 %") and not bare numbers.
- Keyboard: Space, ., R, - and +, F, S, T and Esc. F fires a neutron, which is the keyboard route to the slingshot.
- The canvas has `tabindex="0"`, an `aria-label`, and descriptive fallback text inside the `<canvas>` element. A polite live region announces pause, reset, firing, SCRAM and speed changes. The HUD keeps an `aria-label` with the main numbers.
- Meaning is never carried by color alone: the speed legend has words, objects differ in shape, and k_eff is printed with the word "subcritical", "critical" or "supercritical".
- `prefers-reduced-motion` starts the page paused, with trails and flashes off.

**Known gap.** Grabbing and throwing a neutron needs a pointer. A keyboard user can fire neutrons but cannot grab one.

**The unplugged-mouse test.** I unplugged the mouse and tried to: pause and resume, step, reset, change the rods, change the integrator, and fire a neutron. **[you] Result, reported honestly: [what worked and what did not]**

## Part C: Make it worth visiting

**Purpose, as written on the page:** "A toy nuclear reactor core. Slide the control rods and the moderator to push the chain reaction above or below critical (k = 1) and watch the neutron population respond. Fire your own neutrons with the mouse."

**Direction.** An explorable phenomenon. The surprise is that taking out the moderator, or sliding the rods in, shuts the chain reaction down, and sliding them out lets it run away until it hits the cap.

**Physics from Blocks 1 and 2.**

- **Week 4, collisions.** Every neutron-atom collision is the engine's elastic two-body collision. Moderator atoms are as light as a neutron, so a neutron keeps on average one third of its energy per collision. That is the moderator.
- **Week 2, energy and integrators.** A live energy ledger, and the integrator menu. Euler fails visibly.
- **Week 3, springs.** The moderator lattice is atoms on springs, with damping and kicks as a heat bath.

**Quantitative validation.** Results from `node tests/validate.js` (47 checks) and `node tests/smoke-dom.js` (53 checks).

| Result | Value |
|---|---|
| Mean energy kept per collision vs 1 - 8A / (3 (1 + A)^2), for A = 1, 2, 12, 235 | 0.3342 / 0.4069 / 0.8104 / 0.9888 against 0.3333 / 0.4074 / 0.8107 / 0.9887 |
| Momentum in every collision | Conserved to 2.2e-16 |
| Neutron balance (an integer identity) | Exact in every run, including 4000 random actions and a runaway |
| Energy ledger error over 60 s, DT = 1/120, as a fraction of the energy created | Velocity Verlet 0.187 %, Euler-Cromer 0.497 %, Euler 23.7 % |
| Control rods 0 / 40 / 100 % | k = 1.46 / 1.02 / 0.78 |
| Moderator 0 / 50 / 100 % | k = 0.28 / 1.22 / 1.46. With no moderator, 100 neutrons die out |

The collision formula is a real test of the engine's collision code, not of my reactor. It uses the engine's own `resolveContact` with a random impact parameter.

**Honest note on the energy ledger.** The leftover error is mostly the engine's push-apart step moving a spring-held atom a little, which is an O(DT) artifact. It shrinks as DT shrinks and grows with the lattice stiffness. Reactions alone (no moderator) book energy exactly. The error also depends on the integrator and the DT:

| After 20 s | DT = 1/480 | 1/240 | 1/120 | 1/60 |
|---|---|---|---|---|
| Velocity Verlet | 0.04 % | 0.11 % | 0.21 % | 0.23 % |
| Euler-Cromer | 0.14 % | 0.25 % | 0.54 % | 2.19 % |
| Euler | 5.2 % | 11.8 % | 30.0 % | 70.3 % |

The HUD turns red past 1 %. Verlet stays green at every DT the page allows. Euler-Cromer goes red only at the coarsest step, and Euler fails at every step.

## Robustness log

The first table is automated: Node scripts and a stub browser. They are not a real browser.

| What I tried | What happened |
|---|---|
| Runaway chain, rods out and reflector at 90 %, 40 s | Peak 400 neutrons (the cap), 1460 births dropped, no NaN, about 1.3 ms per step, balance exact |
| 4000 random actions: sliders to their extremes, moderator toggled, SCRAM, fire, integrator changes, DT changes, mouse grabs, 35 resets, uneven frames, 2 s stalls | No NaN, no overflow, balance exact, worst energy ledger error 1.80 % (Euler-Cromer at DT = 1/60 alone reads about 2 %) |
| 600 random actions through the real controls of `main.js` (stub browser): sliders, keys, buttons, pointer press-drag-release and cancel, window resize | No console error, no NaN, loop still running |
| Euler for 60 s | Stays finite. The energy error is 23.7 %, so it fails visibly but does not crash |
| Fire spam at the cap | Neutrons are refused and the page says so |

**Two bugs the abuse tests found, both fixed.**
1. A fractional value on the DT slider gave a time step of `undefined`, and the clock became NaN. A real slider only gives whole steps, but the code should not trust that, so the DT index is now rounded and clamped.
2. My first way of booking the mouse's work gave an error larger than the neutron's whole energy. The damping term is large and cancels the spring's push, so sampling it mid-step left a big error. I replaced it with the exact work identity for the integrator, and the error is now 2.7e-15.

What I tried in real browsers:

| What I tried | Browser or device | What happened |
|---|---|---|
| Spammed every button and key | [you] | [you] |
| Maxed every slider | [you] | [you] |
| Dragged a neutron into a wall and into fuel at speed | [you] | [you] |
| Resized the window while running | [you] | [you] |
| Opened it on a phone | [you] | [you] |

## Bonus: Download CSV

The **Download CSV** button saves the recorded run, one row every 0.1 s of simulated time, 22 columns: time, neutrons, k_eff, fissions, births, rod absorptions, leaks, fired, source, drops at the cap, kinetic energy of neutrons and of the moderator, lattice potential energy, the ledger energy and its error, the three slider settings, and the mean position and speed of the neutrons.

I checked the file in Python. In one scripted run (601 rows: rods pulled out at 15 s, SCRAM at 38 s) the neutron balance computed from the CSV alone had a worst residual of exactly 0, and the energy ledger error was at most 0.50 %. With the rods out the population doubled about every 4 s and reached the 400 cap at 26 s. After the SCRAM it fell from 399 to 78 by 55 s, where it settles because the source balances the losses.

```python
import pandas as pd
d = pd.read_csv("reactor_run.csv")
made = d.from_source + d.fired + d.births
lost = d.fissions + d.rod_absorptions + d.leaked
print(((d.neutrons - d.neutrons[0]) - ((made - made[0]) - (lost - lost[0]))).abs().max())
```

**[you] Run the snippet on a CSV from the live page and paste the result here: [result]**

## Honest note on engine changes

I changed no file in `engine/` or in the three Lab 9 files in `render/`. The reactor is a `World` subclass in `scenes/reactor.js`, and the new drawing code subclasses the Lab 9 `Renderer`. Neutrons use the engine's collision `group` so they skip each other, fuel and rods use `isStatic`, and the moderator uses an ordinary force.

One place repeats engine code. `ReactorWorld.step()` repeats the engine's five stages, because I needed to read velocities between "integrate" and "collide" to book the mouse's work exactly, and `World.step()` has no hook there. If I started again I would add a small hook to the engine, so the subclass would not need a copy.

## Block 3 Checkpoint

**Gallery Walk post (draft):** "Here is my Lab 10: [link]. It is a toy reactor core. Slide the control rods and the moderator to push the chain reaction above or below critical and watch the neutron population respond. I would like feedback on whether the controls are clear in the first 15 seconds."

**[you] Peer reviews (two):** posted in the Gallery Walk discussion by the response deadline.

## What was hardest

**Design note: the first lattice was too soft.** My first lattice (k = 12) let a struck atom swing up to 3.9 m from its site, so atoms flew out of the orange square before their springs pulled them back. I noticed it by looking at the page. I changed to a stiff lattice with strong damping (k = 120, damping 8). Now atoms stay within 1.4 m of their sites and at most 0.35 m past the line. The price was a higher k (rods out 1.46, where it had been 1.19), a larger ledger error, and retuning the default rod setting to 60 %. A test now checks the excursion.

**[you] Replace this with your own words.** A draft: the hardest part was getting the bookkeeping right when neutrons are created and destroyed. The engine's energy is no longer conserved by itself, so every flow had to go in a ledger, and the first tests showed which flows I had missed.
