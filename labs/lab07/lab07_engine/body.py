import numpy as np


class Body:
    def __init__(self, mass=1.0, pos=(0.0, 0.0), vel=(0.0, 0.0), radius=0.0,
                 I=None, theta=0.0, omega=0.0, fixed=False, name=''):
        self.m = float(mass)
        self.r = np.array(pos, dtype=float)
        self.v = np.array(vel, dtype=float)
        self.radius = float(radius)
        self.I = 0.5 * self.m * self.radius**2 if I is None else float(I)
        self.theta = float(theta)
        self.omega = float(omega)
        self.fixed = fixed
        self.name = name
        self.force = np.zeros(2)
        self.torque = 0.0

    def clear_accumulators(self):
        self.force = np.zeros(2)
        self.torque = 0.0

    # a fixed body has zero inverse mass, so nothing can move it
    def inv_mass(self):
        if self.fixed:
            return 0.0
        return 1.0 / self.m

    def inv_inertia(self):
        if self.fixed or self.I == 0:
            return 0.0
        return 1.0 / self.I

    def kinetic_energy(self):
        return 0.5 * self.m * np.dot(self.v, self.v) + 0.5 * self.I * self.omega**2

    def momentum(self):
        return self.m * self.v

    def angular_momentum(self):
        orbital = self.m * (self.r[0] * self.v[1] - self.r[1] * self.v[0])
        return orbital + self.I * self.omega
