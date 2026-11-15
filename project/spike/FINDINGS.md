# Spike Findings — temperature feedback

**Risk:** if fuel temperature feeds back on the fission rate, does the reactor settle at a steady
power, or does it oscillate, stall, or need a finer timestep than I can afford?

**What I built:** `spike.js`. I stripped the reactor down to two numbers, neutron population and fuel
temperature, with no engine and no graphics. Run it with `node spike.js`; `output.txt` has the run.

**What happened:**

1. With no feedback there is no steady state. The population runs to my 400 neutron cap and sits
   there. That is my project today, and it is the thing I am fixing.
2. With feedback it settles. I worked out the equilibrium by hand and the prototype lands on the
   same temperature and population at every feedback strength I tried.
3. The timestep does not matter. The answer is the same at 1/60 through 1/480, so the loop is slow
   compared with my 1/120 physics step. That was my second worry and it is not an issue.
4. The failure mode is not what I expected. I was braced for oscillation. Turning the feedback up
   does not make it ring, it makes the core shut down: above about alpha = 0.1 with slow cooling the
   population drops to nothing.

**What I got wrong:** my first equilibrium formula was off by 20 to 30 %, and I assumed the
prototype was buggy. The formula was buggy. I had dropped the source term, which keeps a slightly
subcritical core alight.

**Scope decision:** temperature feedback stays in MUST. It settles, it matches theory, and it needs
no special timestep. I will cap the feedback slider at 0.05 because of test 4, and say in the README
that too much feedback shuts the core down.
