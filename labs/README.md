# Lab 9: Multi-Body Browser Simulation

**AI use disclaimer:** AI (Claude) was used in preparing this code and write-up for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done; all of it included input and assistance from myself and many iterations and human attempts are consolidated into what is seen here.

**Reference:** the structure follows the PHYS 311 Week 9 reference engine. I reused its layout and patterns, including the World/Body/Force/Integrator split, `captureBaseline()` and `drift()`, `BoxBounds`, the spatial hash, the Accumulator class, the side-panel HUD and the PASS/FAIL validation file. The scenes, the wall-impulse bookkeeping and the tests are my own.

Live link: https://YOUR-USERNAME.github.io/phys311/labs/lab09/

## Running it

- **Browser:** right-click `index.html` in VS Code and choose Open with Live Server. ES modules do not load from `file://`.
- **Headless:** from the `lab09` folder, run `node tests/validate.js`. It runs 13 checks and exits non-zero if any fail.

## Layout

```
index.html, style.css
main.js              the only file that knows about both engine/ and render/
package.json         only tells Node these are ES modules

engine/              pure physics, no DOM
  vec2.js            Vec2 from Lab 8, plus neg, cross, perp, zero
  body.js            one disc: pos, vel, acc, force, m, radius, isStatic
  forces.js          Gravity, Drag, Spring, NewtonGravity
  integrators.js     Euler, EulerCromer, VelocityVerlet
  collisions.js      brute force pairs, SpatialHash, resolveContact, BoxBounds
  world.js           World (five-stage step, diagnostics) and Accumulator

render/              drawing only, reads the world and never changes it
  camera.js          world to screen, the only place the y flip lives
  renderer.js        bodies, springs, trails, vectors, grid, walls
  hud.js             live conservation readout

scenes/scenes.js     four scenes, each returns a fresh World
tests/validate.js    13 headless checks plus the scaling benchmark
```

Layering check: `grep -rnE "ctx|canvas|document|window|requestAnimationFrame" engine/` finds nothing.

## Scenes

1. **Billiards box (no gravity).** 20 to 500 balls, masses 1 to 2 kg. Walls and pair collisions. Used for the momentum and energy tests.
1b. **Ball pit.** Gravity, light drag and five static pegs. Used for the jitter demo.
2. **N-body gravity.** A star, five planets and a moon, softened Newtonian gravity with G = 1 (as in Lab 5), with trails.
3. **Diatomic molecules.** Heavy and light atoms on springs, like the HCl bond from my Block 1 checkpoint, colliding in a box.

## Controls

| Control | What it does |
|---|---|
| Simulation | Switches scene and loads its defaults |
| Integrator | Euler, Euler-Cromer or Velocity Verlet, swapped live with no reset |
| Bodies | Number of bodies (scenes 1, 1b, 3) |
| Restitution e | Walls and pairs, changed live |
| Fixed timestep DT | 1/120 to 1/1000 s |
| Broad phase | Brute force or spatial hash, changed live |
| Separating guard | The vn > 0 check. Uncheck it for the jitter demo |
| trails, v & a, grid | Drawing options |
| Pause, Step, Reset | Also P and R on the keyboard |
| Run 13 checks | Same as `node tests/validate.js` |
| Scaling benchmark | Physics and render time for 20 to 500 bodies |

Drag the canvas to pan and scroll to zoom.

## HUD

t, bodies, integrator, collisions, KE, PE, E, ΔE/E0 (green, yellow past 0.1%, red past 1%), |p|, |Δp|/|p0|, |Δ(p − J_ext)|/|p0|, fps, physics and render ms per frame, pair checks per step, and steps per frame.

J_ext is the momentum the walls and static pegs have put in. Pair collisions alone keep p − J_ext fixed. The HUD shows n/a for it when gravity or drag acts, since those also push from outside.
