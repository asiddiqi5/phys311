import numpy as np


# every force implements apply(world); conservative ones also give a potential energy
class Force:
    def apply(self, world):
        raise NotImplementedError

    def potential_energy(self, world):
        return 0.0


class Gravity(Force):
    def __init__(self, g=9.81):
        self.g = g

    def apply(self, world):
        for b in world.bodies:
            if not b.fixed:
                b.force += np.array([0.0, -b.m * self.g])

    def potential_energy(self, world):
        return sum(b.m * self.g * b.r[1] for b in world.bodies if not b.fixed)


class Drag(Force):
    def __init__(self, c=0.1, quadratic=True):
        self.c = c
        self.quadratic = quadratic

    def apply(self, world):
        for b in world.bodies:
            if b.fixed:
                continue
            if self.quadratic:
                b.force += -self.c * np.linalg.norm(b.v) * b.v
            else:
                b.force += -self.c * b.v


class Spring(Force):
    def __init__(self, a, b, k=1.0, rest=0.0):
        self.a = a
        self.b = b
        self.k = k
        self.rest = rest

    def apply(self, world):
        d = self.b.r - self.a.r
        length = np.linalg.norm(d)
        if length == 0:
            return
        f = self.k * (length - self.rest) * d / length
        self.a.force += f
        self.b.force -= f

    def potential_energy(self, world):
        length = np.linalg.norm(self.b.r - self.a.r)
        return 0.5 * self.k * (length - self.rest)**2


class NewtonGravity(Force):
    def __init__(self, G=1.0, soft=0.0):
        self.G = G
        self.soft = soft

    # one force vector per pair, +f on one body and -f on the other
    def apply(self, world):
        bodies = world.bodies
        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                a, b = bodies[i], bodies[j]
                d = b.r - a.r
                dist2 = np.dot(d, d) + self.soft**2
                f = self.G * a.m * b.m * d / dist2**1.5
                a.force += f
                b.force -= f

    def potential_energy(self, world):
        bodies = world.bodies
        total = 0.0
        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                d = bodies[j].r - bodies[i].r
                dist = np.sqrt(np.dot(d, d) + self.soft**2)
                total -= self.G * bodies[i].m * bodies[j].m / dist
        return total
