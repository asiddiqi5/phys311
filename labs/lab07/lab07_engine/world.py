import numpy as np

from .integrators import EulerCromer


class World:
    def __init__(self, integrator=None):
        self.bodies = []
        self.forces = []
        self.colliders = []
        self.integrator = integrator if integrator is not None else EulerCromer()
        self.time = 0.0
        self.watchers = {}
        self.history = {}

    def add_body(self, body):
        if body.name == '':
            body.name = 'body' + str(len(self.bodies))
        self.bodies.append(body)
        return body

    def add_force(self, force):
        self.forces.append(force)
        return force

    def add_collider(self, collider):
        self.colliders.append(collider)
        return collider

    # stage 1 and 2: clear every accumulator, then let every force add to them
    def compute_forces(self):
        for b in self.bodies:
            b.clear_accumulators()
        for f in self.forces:
            f.apply(self)

    # stage 3, 4, 5: integrate, resolve collisions, advance the clock
    def step(self, dt):
        self.integrator.step(self, dt)
        for c in self.colliders:
            c.resolve(self)
        self.time += dt

    def kinetic_energy(self):
        return sum(b.kinetic_energy() for b in self.bodies)

    def potential_energy(self):
        return sum(f.potential_energy(self) for f in self.forces)

    def energy(self):
        return self.kinetic_energy() + self.potential_energy()

    def momentum(self):
        total = np.zeros(2)
        for b in self.bodies:
            total += b.momentum()
        return total

    def angular_momentum(self):
        return sum(b.angular_momentum() for b in self.bodies)

    # recording: a watcher is a name plus a function that takes the world
    def watch(self, name, fn):
        self.watchers[name] = fn

    def watch_conserved(self):
        self.watch('E', lambda w: w.energy())
        self.watch('px', lambda w: w.momentum()[0])
        self.watch('py', lambda w: w.momentum()[1])
        self.watch('L', lambda w: w.angular_momentum())

    def watch_positions(self):
        for b in self.bodies:
            self.watch(b.name + '.x', lambda w, b=b: b.r[0])
            self.watch(b.name + '.y', lambda w, b=b: b.r[1])
            self.watch(b.name + '.vx', lambda w, b=b: b.v[0])
            self.watch(b.name + '.vy', lambda w, b=b: b.v[1])

    def record(self):
        self.history.setdefault('t', []).append(self.time)
        for name, fn in self.watchers.items():
            self.history.setdefault(name, []).append(fn(self))

    def results(self):
        return {name: np.array(values) for name, values in self.history.items()}

    # runs for t_end or a fixed number of steps, or until stop(world) is true
    def run(self, dt, t_end=None, steps=None, stop=None, record_every=1):
        if steps is None:
            steps = int(np.ceil(t_end / dt - 1e-9))
        self.history = {}
        self.record()
        for n in range(1, steps + 1):
            self.step(dt)
            stopping = stop is not None and stop(self)
            if n % record_every == 0 or stopping:
                self.record()
            if stopping:
                break
        return self.results()
