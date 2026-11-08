# Lab 10: Reactor Core Explorer

**AI use disclaimer:** AI (Claude) was used in preparing this code and write-up for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done; all of it included input and assistance from myself and many iterations and human attempts are consolidated into what is seen here.

**Reference:** the folder layout and the `engine/` and `render/` modules are my Lab 9 code, copied in unchanged. I used the Week 10 lesson and reference project as a guide for the UI ideas (a spring to drag bodies, the accessibility checklist, headless tests). The reactor, the slingshot preview, the visuals, the energy and neutron ledgers, and the tests are new.

Live link: https://asiddiqi5.github.io/phys311/labs/lab10/

## 1. What is This?

A toy nuclear reactor core you can *react* with (pun intended). Slide the control rods and the moderator to push the chain reaction above or below critical (k = 1), and watch the number of neutrons grow, hold steady, or die out. You can also fire your own neutrons with the mouse or your finger.

## 2. What Physics does it Implement?

- **Bodies:** Neutrons are small balls that never collide with each other (meaning they share a collision group). Fuel and control rods are static discs. Moderator atoms are light discs on stiff springs.
- **Collisions (like Week 4):** Every neutron-atom collision is a real two-body elastic collision from the engine (restitution e = 1, impulse along the line of centers, push-apart weighted by inverse mass, and the separating guard). Moderator atoms are as light as a neutron, so a neutron keeps on average one third of its energy per collision with one, and loses two thirds. That is why a moderator slows neutrons down.
- **Reactions:** A neutron that touches fuel causes a fission with probability 0.55 if it is slow (kinetic energy under 4) and 0.02 if it is fast. A fission removes that neutron and creates 2 or 3 fast ones. A neutron that touches a control rod is absorbed. A neutron that crosses the core boundary is reflected with probability `reflector` and if not then it is lost.
- **Forces and heat (like Week 3):** Each moderator atom hangs on a stiff spring (k = 120) and is coupled to a heat bath (damping 8 and random kicks at temperature kT = 1). Slow neutrons settle at a thermal speed instead of stopping, and an atom that a neutron strikes is pulled straight back to its site. This is a coolant.
- **Energy and integrators (like Week 2):** Velocity Verlet, Euler-Cromer or Euler, swappable live. The time step is fixed (accumulator), and speed scales the clock, never DT.
- **Mouse:** Grabbing a body adds a damped spring toward the cursor as a Force (k = 200, c = 20). The slingshot launches a neutron with speed equal to 4 times the pull length, capped at a fast neutron (14 m/s).

Everything is in arbitrary units. It repeats the engine’s five step stages in one place, as is explained in the write-up.

## 3. How to Use it?

Open the page. Neutrons are colored by speed (blue slow, red fast). The core opens a little subcritical (rods 60 % in, k about 0.9), with the start up source keeping 40 to 70 neutrons alive. Pull the rods out to about 40 % and the chain sustains itself. Pull them further and the population grows until it hits the cap. Push them in, or take the moderator out, and it dies away.

| Control | What it does |
|---|---|
| **Control rods inserted** (slider, 0 to 100 %) | Slides the three rod columns down into the core. Rods absorb every neutron they touch. |
| **Moderator amount** (slider, 0 to 100 %) | Fraction of lattice sites holding a moderator atom. At 0 % the chain cannot sustain itself. |
| **Reflector** (slider, 0 to 95 %) | Chance that a neutron reaching the core edge is sent back instead of lost. |
| **Neutron source** (slider, 0 to 20 per s) | Start-up source that adds fast neutrons at random places. |
| **Fire speed** (slider, 0.5 to 14 m/s) | Speed of a neutron fired with the button or the F key. |
| **Fire (F)** | Fires one neutron from the left edge. |
| **SCRAM (S)** | Pushes the rods fully in at once. |
| **Pause / Resume (Space)** | Freezes the physics. The picture keeps drawing. |
| **Step (.)** | Pauses, then advances exactly one DT. |
| **Reset (R)** | Rebuilds the core from the same seed and keeps your slider settings. Takes a new energy baseline. |
| **Speed** (slider, 0.25x to 2x; keys - and +) | Scales the clock that feeds the accumulator. DT does not change. |
| **Timestep DT** (slider: 1/480, 1/240, 1/120, 1/60 s) | The fixed physics step. 1/60 is the coarsest, see the limits. |
| **Integrator** (menu) | Euler, Euler-Cromer or Velocity Verlet, changed live with no reset. |
| **Neutron trails / Color by speed / Fission flashes / Velocity arrows / Population chart** (checkboxes; T toggles trails) | Display options. Color by speed shows a legend. |
| **Download CSV** | Saves the recorded run, one row every 0.1 s of simulated time (22 columns). |
| **Teleport drag** (checkbox) | The wrong way to drag, kept as a demo. |
| **Mouse or touch: press on empty space, pull back, release** | Slingshot. A dashed line shows where the neutron will first hit, and what. |
| **Mouse or touch: press on a neutron or atom** | Grabs it with the spring. Release to throw it. |
| **Esc** | Lets go of a grab or cancels an aim. |

The **Live diagnostics** panel also shows the cursor's physics coordinates and the physics coordinates of the four canvas corners.

## 4. How Do I Know it's Right?

Results from the test run:

| Check | Result |
|---|---|
| Engine collision code vs theory: mean energy a neutron keeps per elastic collision, 2D discs, formula 1 - 8A / (3 (1 + A)^2) | A = 1: 0.3342 vs 0.3333. A = 2: 0.4069 vs 0.4074. A = 12: 0.8104 vs 0.8107. A = 235: 0.9888 vs 0.9887. Momentum conserved to 2.2e-16 |
| Neutron balance: start + source + fired + born - fissions - rod absorptions - leaks = count | Exact (integers) in every run, including 4000 random actions and a runaway at the cap |
| Energy ledger over 60 s, DT = 1/120, as a fraction of the energy created by fission, the source and the user | Velocity Verlet 0.187 %, Euler-Cromer 0.497 %, Euler 23.7 % |
| The same, after 20 s, at DT = 1/480, 1/240, 1/120, 1/60 | Verlet 0.04, 0.11, 0.21, 0.23 %. Euler-Cromer 0.14, 0.25, 0.54, 2.19 % (red at 1/60). Euler 5.2, 11.8, 30.0, 70.3 % |
| Moderator atoms over 40 s | Farthest from its site 1.41 m. Farthest past the orange line 0.35 m. 99.9 % of samples inside the line |
| Reactions alone (no moderator) | Energy booked exactly: error 0 |
| Work done by the mouse | Booked to 2.7e-15 of the neutron's energy |
| Same physics at any frame rate: 60 Hz, 144 Hz, jittery frames, speed 0.25x, speed 2x | State at step 1500 is bit-for-bit identical. A reset is deterministic |
| Each single step | Advances t by exactly DT |
| A 2 s stall | Clamped to 30 steps instead of 240 |
| Criticality, control rods 0 / 40 / 100 % | k = 1.46 / 1.02 / 0.78 |
| Criticality, moderator 0 / 50 / 100 % | k = 0.28 / 1.22 / 1.46. With no moderator, 100 neutrons die out |
| Slingshot preview vs real flights (cold lattice) | 84 of 84 hit within 3 cm of the prediction, worst 0.006 m |
| Clicks to physics coordinates | Exact through the camera under CSS scaling and a 4x retina buffer. Corners within one pixel of the view bounds |
| Runaway chain (rods out, reflector 90 %) | Stops at the 400 neutron cap, 1460 births dropped, no NaN, about 1.3 ms per step |
| Abuse: 4000 random actions, 35 resets, 155 grabs | No NaN, no overflow, balance exact, worst ledger error 1.80 % (Euler-Cromer at DT = 1/60 alone reads about 2 %) |
| `engine/` has no `ctx`, `canvas`, `document` or `window` | Checked by the test |

The **neutron balance** is an exact integer identity. The **energy ledger** books every flow the engine cannot see, so neutron energy absorbed by fuel and rods or lost by leaking, the energy of newly born neutrons, the heat bath, the source, atoms added or removed by the slider, and the mouse's work. The HUD's "ledger error" is what is left over, so it measures the solver and not the reactions. It turns red past 1 %. The leftover most likely comes from the engine pushing a neutron and a spring-held atom apart after contact. It shrinks as DT shrinks and grows with the lattice stiffness.

## 5. What are its Limits?

- 2D, circles only, arbitrary units. It is a toy and cannot predict a real reactor.
- No heat feedback and no delayed neutrons. Real reactors are controllable largely because of delayed neutrons.
- Neutrons never collide with each other.
- A speed limit of 20 m/s on neutrons stops tunneling. It is the "speed cap" fix from Week 9 and it is not physical. At DT = 1/60 a neutron at the limit moves 0.33 m per step, less than the 0.36 m contact distance. That is also why 1/60 is the coarsest DT.
- A cap of 400 neutrons protects the frame rate. At the cap, births are dropped and k_eff is not reliable. The HUD says so.
- A hard hit can still push a moderator atom up to about 1.4 m from its site before its spring pulls it back. Atoms are not held inside the orange square by a wall, only by their springs.
- The slingshot preview is a straight line to the first atom, using where the atoms are right now. The atoms jiggle, so the real hit can land slightly off.
- Grabbing and throwing a body needs a pointer. Keyboard users can fire neutrons (F) and run everything else.
- The ledger error depends on DT and on the integrator. Euler fails on purpose.

## Run It

- **Browser:** right-click `index.html` in VS Code and choose Open with Live Server.
- **GitHub Pages:** push to `labs/lab10/`, and use only relative paths and lowercase file names.

## Layout

```
index.html, style.css, main.js    main.js only wires things together
input.js                          pointer and keyboard: eventToWorld, MouseSpring, slingshot, hotkeys
ui.js                             controls, slider clamping, announcements, CSV recorder
engine/                           Lab 9 engine, unchanged. No DOM anywhere
render/                           camera.js, renderer.js, hud.js from Lab 9 (unchanged; this page uses
                                  its own reactor_hud.js, so hud.js is kept only because the lab says
                                  to copy render/ over), plus reactor_renderer.js, reactor_hud.js,
                                  stripchart.js (new)
scenes/reactor.js                 the reactor: a World subclass and one force
```
