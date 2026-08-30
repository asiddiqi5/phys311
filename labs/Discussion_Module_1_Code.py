import numpy as np
import matplotlib.pyplot as plt

def simulate_no_drag(dt, t_max=4.0):
    g = 9.81
    v0, angle = 20.0, np.radians(45)
    x, y = 0.0, 0.0
    vx, vy = v0 * np.cos(angle), v0 * np.sin(angle)
    xs, ys = [x], [y]
    t = 0.0
    steps = 0
    while t < t_max and y >= -5 and steps < 100000:
        # acceleration from gravity only
        ax, ay = 0.0, -g

        # Euler update
        vx += ax * dt
        vy += ay * dt
        x += vx * dt
        y += vy * dt

        t += dt
        xs.append(x)
        ys.append(y)
        steps += 1
    return np.array(xs), np.array(ys)

plt.figure(figsize=(8, 5))
for dt, style in [(0.001, 'k-'), (0.01, 'b-'), (0.1, 'g.-'), (1, 'ro-')]:
    xs, ys = simulate_no_drag(dt)
    plt.plot(xs, ys, style, label=f'dt={dt}', alpha=0.8, markersize=4)

plt.axhline(0, color='gray', lw=0.5)
plt.xlabel('x (m)')
plt.ylabel('y (m)')
plt.title("Euler Method: projectile trajectory with differing step size")
plt.legend()
plt.grid(alpha=0.3)
plt.ylim(-5, 12)
plt.tight_layout()
plt.savefig('Module_1_Discussion_Post_Graph.png', dpi=130)
plt.show()