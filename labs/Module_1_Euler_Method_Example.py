import numpy as np
import matplotlib.pyplot as plt

# Parameters
g = 9.81       # m/s², gravitational acceleration
m = 0.145      # mass of a baseball, kg
r = 0.0366     # radius of a baseball, m
Cd = 0.47      # drag coefficient for a sphere
rho = 1.225    # air density, kg/m^3 
dt = 0.05      # time step in seconds
t_max = 40     # total simulation time
A = np.pi * r**2    # cross

# Initial conditions: launched at 45°, speed 20 m/s
v0 = 20.0
angle = np.radians(45)
x, y = 0.0, 0.0
vx, vy = v0 * np.cos(angle), v0 * np.sin(angle)

# Storage lists for plotting
xs, ys, ts = [x], [y], [0.0]

# Euler integration loop
t = 0.0
while t < t_max and y >= 0.0:
    # Compute acceleration (only gravity here)
    ax = 0.0
    ay = -g

    # Update velocity (Euler)
    vx = vx + ax * dt
    vy = vy + ay * dt

    # Update position (Euler)
    x = x + vx * dt
    y = y + vy * dt

    t += dt
    xs.append(x)
    ys.append(y)
    ts.append(t)

# Plot trajectory
plt.figure(figsize=(8, 4))
plt.plot(xs, ys, 'b-', linewidth=2)
plt.xlabel('x (m)')
plt.ylabel('y (m)')
plt.title('Projectile Trajectory — Euler Method')
plt.grid(True, alpha=0.3)
plt.axis('equal')
plt.show()