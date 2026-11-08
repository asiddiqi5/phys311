import numpy as np
class Body:
    def __init__(self, mass, pos, vel, radius=0.1, I=None):
        self.m = mass
        self.r = np.array(pos, dtype=float)
        self.v = np.array(vel, dtype=float)
        self.radius = radius
        self.theta = 0.0
        self.omega = 0.0
        self.I = I if I is not None else 0.5 * mass * radius**2
        self.force = np.zeros(2)
        self.torque = 0.0
    def clear_accumulators(self):
        self.force[:] = 0.0
        self.torque = 0.0

class Gravity:
    """Uniform gravitational field, with acceleration g directed downward."""
    def __init__(self, g=9.81):
        self.g = np.array([0.0, -g])
    def apply(self, world):
        for body in world.bodies:
            body.force += body.m * self.g
    def potential_energy(self, world):
        return sum(-body.m * np.dot(self.g, body.r) for body in world.bodies)

class Drag:
    def __init__(self, c):
        self.c = c
    def apply(self, world):
        for body in world.bodies:
            body.force += -self.c * np.linalg.norm(body.v) * body.v

class Spring:
    """Spring between two bodies, optionally with axial damping."""
    def __init__(self, body1, body2, stiffness, rest_length, damping=0.0):
        self.body1 = body1
        self.body2 = body2
        self.k = stiffness
        self.rest_length = rest_length
        self.damping = damping
    def apply(self, world):
        delta = self.body2.r - self.body1.r
        distance = np.linalg.norm(delta)
        if distance == 0.0:
            return
        direction = delta / distance
        relative_speed = np.dot(self.body2.v - self.body1.v, direction)
        magnitude = (self.k * (distance - self.rest_length) + self.damping * relative_speed)
        force = magnitude * direction
        self.body1.force += force
        self.body2.force -= force
    def potential_energy(self, world):
        distance = np.linalg.norm(self.body2.r - self.body1.r)
        return 0.5 * self.k * (distance - self.rest_length) ** 2

class NewtonGravity:
    """Pairwise Newtonian gravity between all bodies."""
    def __init__(self, G=6.67430e-11, softening=1e-9):
        self.G = G
        self.softening = softening
    def apply(self, world):
        for i, body1 in enumerate(world.bodies):
            for body2 in world.bodies[i + 1:]:
                delta = body2.r - body1.r
                distance_squared = np.dot(delta, delta) + self.softening**2
                if distance_squared == 0.0:
                    continue
                force = (self.G * body1.m * body2.m * delta / distance_squared**1.5)
                body1.force += force
                body2.force -= force
    def potential_energy(self, world):
        energy = 0.0
        for i, body1 in enumerate(world.bodies):
            for body2 in world.bodies[i + 1:]:
                delta = body2.r - body1.r
                distance = np.sqrt(np.dot(delta, delta) + self.softening**2)
                if distance > 0.0:
                    energy -= self.G * body1.m * body2.m / distance
        return energy

class EulerCromer:
    def step(self, world, dt):
        for body in world.bodies:
            body.v += (body.force / body.m) * dt
            body.r += body.v * dt
            body.omega += (body.torque / body.I) * dt
            body.theta += body.omega * dt

class Verlet:
    """Velocity-Verlet integrator; recalculates forces at the new positions."""
    def step(self, world, dt):
        bodies = world.bodies
        acceleration = [body.force / body.m for body in bodies]
        angular_acceleration = [body.torque / body.I for body in bodies]
        for body, a, alpha in zip(bodies, acceleration, angular_acceleration):
            body.r += body.v * dt + 0.5 * a * dt**2
            body.theta += body.omega * dt + 0.5 * alpha * dt**2
        world.accumulate_forces()
        for body, a_old, alpha_old in zip(bodies, acceleration, angular_acceleration):
            a_new = body.force / body.m
            alpha_new = body.torque / body.I
            body.v += 0.5 * (a_old + a_new) * dt
            body.omega += 0.5 * (alpha_old + alpha_new) * dt

class World:
    def __init__(self, integrator):
        self.bodies = []
        self.forces = []
        self.integrator = integrator
        self.time = 0.0
        self.history = []

    def add_body(self, body):
        self.bodies.append(body)
    def add_force(self, force):
        self.forces.append(force)

    def accumulate_forces(self):
        for body in self.bodies:
            body.clear_accumulators()
        for force in self.forces:
            force.apply(self)

    def record_state(self):
        kinetic = sum(
            0.5 * body.m * np.dot(body.v, body.v)
            + 0.5 * body.I * body.omega**2
            for body in self.bodies)
        potential = sum(
            force.potential_energy(self)
            for force in self.forces
            if hasattr(force, "potential_energy"))
        momentum = sum(
            (body.m * body.v for body in self.bodies),
            start=np.zeros(2),)
        angular_momentum = sum(
            body.m * (body.r[0] * body.v[1] - body.r[1] * body.v[0])
            + body.I * body.omega
            for body in self.bodies)
        self.history.append({
            "time": self.time,
            "positions": np.array([body.r.copy() for body in self.bodies]),
            "kinetic_energy": kinetic,
            "potential_energy": potential,
            "total_energy": kinetic + potential,
            "momentum": momentum.copy(),
            "angular_momentum": angular_momentum,
        })
        
    def step(self, dt):
        if not self.history:
            self.record_state()

        self.accumulate_forces()
        self.integrator.step(self, dt)
        self.handle_collisions()
        self.time += dt
        self.record_state()
    def handle_collisions(self):
        for i, body1 in enumerate(self.bodies):
            for body2 in self.bodies[i + 1:]:
                delta = body2.r - body1.r
                distance = np.linalg.norm(delta)
                min_distance = body1.radius + body2.radius
                if distance >= min_distance:
                    continue

                normal = (delta / distance if distance > 0.0 else np.array([1.0, 0.0]))
                inv_m1 = 1.0 / body1.m
                inv_m2 = 1.0 / body2.m
                inv_mass_sum = inv_m1 + inv_m2

                overlap = min_distance - distance
                body1.r -= normal * overlap * inv_m1 / inv_mass_sum
                body2.r += normal * overlap * inv_m2 / inv_mass_sum

                relative_velocity = body2.v - body1.v
                normal_speed = np.dot(relative_velocity, normal)
                if normal_speed < 0.0:
                    impulse = -2.0 * normal_speed / inv_mass_sum
                    body1.v -= impulse * inv_m1 * normal
                    body2.v += impulse * inv_m2 * normal