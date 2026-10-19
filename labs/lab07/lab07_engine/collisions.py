import numpy as np


# collide_1d and collide_2d are the Lab 4 functions
def collide_1d(m1, m2, u1, u2, e=1.0):
    total_m = m1 + m2
    v_cm = (m1 * u1 + m2 * u2) / total_m
    v1 = v_cm - e * (m2 / total_m) * (u1 - u2)
    v2 = v_cm + e * (m1 / total_m) * (u1 - u2)
    return v1, v2


def collide_2d(m1, m2, r1, r2, v1, v2, e=1.0):
    r1, r2 = np.asarray(r1, float), np.asarray(r2, float)
    v1, v2 = np.asarray(v1, float), np.asarray(v2, float)

    n = r2 - r1
    dist = np.linalg.norm(n)
    if dist == 0:
        return v1, v2
    n = n / dist

    u1n, u2n = np.dot(v1, n), np.dot(v2, n)
    v1t = v1 - u1n * n
    v2t = v2 - u2n * n

    new1n, new2n = collide_1d(m1, m2, u1n, u2n, e)

    return v1t + new1n * n, v2t + new2n * n


# narrow phase for two circles
def overlapping(a, b):
    return np.linalg.norm(b.r - a.r) < (a.radius + b.radius)


class CircleCollisions:
    def __init__(self, e=1.0):
        self.e = e
        self.count = 0

    # broad phase is just every pair for now
    def resolve(self, world):
        bodies = [b for b in world.bodies if b.radius > 0 and not b.fixed]
        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                a, b = bodies[i], bodies[j]
                if overlapping(a, b):
                    self.handle(a, b)

    def handle(self, a, b):
        approaching = np.dot(b.v - a.v, b.r - a.r) < 0
        if approaching:
            a.v, b.v = collide_2d(a.m, b.m, a.r, b.r, a.v, b.v, self.e)
            self.count += 1
        self.separate(a, b)

    # push the pair apart along the line of centers, the lighter body moves more
    def separate(self, a, b):
        d = b.r - a.r
        dist = np.linalg.norm(d)
        if dist == 0:
            return
        n = d / dist
        overlap = a.radius + b.radius - dist
        total = a.m + b.m
        a.r -= n * overlap * (b.m / total)
        b.r += n * overlap * (a.m / total)


class BoxWalls:
    def __init__(self, xmin, xmax, ymin, ymax, e=1.0):
        self.xmin, self.xmax = xmin, xmax
        self.ymin, self.ymax = ymin, ymax
        self.e = e
        self.count = 0

    def resolve(self, world):
        for b in world.bodies:
            if b.fixed or b.radius <= 0:
                continue
            if b.r[0] - b.radius < self.xmin:
                b.r[0] = self.xmin + b.radius
                self.bounce(b, 0, 1.0)
            if b.r[0] + b.radius > self.xmax:
                b.r[0] = self.xmax - b.radius
                self.bounce(b, 0, -1.0)
            if b.r[1] - b.radius < self.ymin:
                b.r[1] = self.ymin + b.radius
                self.bounce(b, 1, 1.0)
            if b.r[1] + b.radius > self.ymax:
                b.r[1] = self.ymax - b.radius
                self.bounce(b, 1, -1.0)

    # sign is the direction the wall pushes back, only bounce if the body is moving into it
    def bounce(self, b, axis, sign):
        if b.v[axis] * sign < 0:
            b.v[axis] = -self.e * b.v[axis]
            self.count += 1
