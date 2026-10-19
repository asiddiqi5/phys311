# every integrator has one method, step(world, dt)

class Euler:
    def step(self, world, dt):
        world.compute_forces()
        for b in world.bodies:
            if b.fixed:
                continue
            a = b.force * b.inv_mass()
            alpha = b.torque * b.inv_inertia()
            b.r += b.v * dt
            b.v += a * dt
            b.theta += b.omega * dt
            b.omega += alpha * dt


class EulerCromer:
    def step(self, world, dt):
        world.compute_forces()
        for b in world.bodies:
            if b.fixed:
                continue
            b.v += b.force * b.inv_mass() * dt
            b.r += b.v * dt
            b.omega += b.torque * b.inv_inertia() * dt
            b.theta += b.omega * dt


class VelocityVerlet:
    def step(self, world, dt):
        world.compute_forces()
        old = []
        for b in world.bodies:
            a = b.force * b.inv_mass()
            alpha = b.torque * b.inv_inertia()
            old.append((a, alpha))
            if not b.fixed:
                b.r += b.v * dt + 0.5 * a * dt**2
                b.theta += b.omega * dt + 0.5 * alpha * dt**2

        # forces again at the new positions, then finish the velocity updata
        world.compute_forces()
        for b, (a, alpha) in zip(world.bodies, old):
            if b.fixed:
                continue
            a_new = b.force * b.inv_mass()
            alpha_new = b.torque * b.inv_inertia()
            b.v += 0.5 * (a + a_new) * dt
            b.omega += 0.5 * (alpha + alpha_new) * dt
