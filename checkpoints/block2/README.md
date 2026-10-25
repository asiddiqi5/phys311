# Block 2 Checkpoint: Engine Demo

This checkpoint runs a multi-body scene on my Lab 7 physics engine, lab07_engine. Two diatomic molecules (two atoms joined by a spring) collide in free space. The demo checks that energy, momentum, and angular momentum behave correctly, and it adds a new force without changing the engine.

**AI use disclaimer:** AI (Claude) was used in preparing this notebook for coding assistance, tidying up code, and improving code flow/organization. This is not to say that there was no human work done in this code; all lines included input and assistance from myself and many iterations and human attempts are consolidated into the notebook and Demo seen below and other related files. 

## Files

```
checkpoints/
    README.md                  this file
    block2_checkpoint.ipynb    the demo notebook (run this)
    figures/                   Figures 1 to 4, written by the notebook
    lab07_engine/              my Lab 7 engine, unchanged
```

If the engine only exists in labs/lab07/, the first cell of the notebook finds it there.

## Architecture

The engine has four components. World owns the other three and runs the loop.

```
World  (owns everything and runs the loop)
  |-- bodies:      list of Body            (mass, position, velocity, radius, force accumulator)
  |-- forces:      list of Force           (apply(world), potential_energy(world))
  |-- colliders:   list of Collider        (resolve(world))
  |-- integrator:  one Integrator          (step(world, dt))
```

One call to World.step(dt) does five things in order:

1. Clear every body's force and torque accumulator.
2. Every Force adds to the accumulators.
3. The Integrator reads the accumulators and advances the state.
4. Every Collider detects and resolves contacts.
5. The clock advances.

A force never needs to know what other forces exist. It only adds to body.force. Each force also reports its own potential energy, so World.energy() stays correct no matter which forces are present.

In this demo the World holds four atoms (A1, A2, B1, B2), two Spring forces (the bonds), one NewtonGravity force (a weak attraction between all atoms), one CircleCollisions collider, and a VelocityVerlet integrator.

## How to run

1. Install Python 3.10 or newer, then `pip install numpy matplotlib notebook`.
2. Keep block2_checkpoint.ipynb next to the lab07_engine folder (or leave the engine in labs/lab07).
3. Run `jupyter notebook`, open block2_checkpoint.ipynb, and choose Kernel, then Restart & Run All. It takes about 30 seconds.
4. The four figures are saved to figures/.

## What the demo shows

- **Scene.** 4 interacting bodies, 2 force types plus Drag in one run, and atom-atom collisions (4 in the elastic run).
- **Figures 1 and 2.** A collision walkthrough, and where the energy goes. Kinetic energy turns into bond energy at impact and the bonds keep vibrating.
- **Figure 3, the validation panel.** Three runs of the same scene.
  - Elastic: energy is conserved to 0.07 percent, momentum to 2e-14 kg m/s, and angular momentum to 0.08 percent.
  - Inelastic (e = 0.8): energy drops in steps at collisions, down to 0.51 of its start. Momentum and angular momentum are still conserved.
  - Elastic with drag: energy, momentum, and angular momentum all fall, which is correct because drag is an outside force.
- **Figure 4.** A new force, HarmonicTrap, added in 11 lines. Energy stays conserved and momentum changes, as it should.

## Adding a force

A new force is a class with one required method.

```python
class MyForce(Force):
    def apply(self, world):
        for b in world.bodies:
            b.force += ...          # add to the accumulator

    def potential_energy(self, world):
        return 0.0                  # only needed if the force is conservative

world.add_force(MyForce())
```

Body, Integrator, and World do not change.

## Limits

- Collisions are frictionless, so they change velocities but never spin.
- After a collision, overlapping atoms are pushed apart. This causes a small error in energy and angular momentum that shrinks with the time step. It is why the elastic run is not exactly conserved.
- The weak attraction is NewtonGravity with a small G. It stands in for an intermolecular force.
- Collision checking tests every pair, which is fine for 4 bodies and would need a broad-phase grid for hundreds.
