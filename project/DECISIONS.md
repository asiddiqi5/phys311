# Decisions

Three lines for what I planned, what I did, why.

## Week 12: Conservative mode and control rods

Planned: the conservative switch zeroes the source, fission, the heat bath and leakage.
Did: it also stops control rods from absorbing, leaving them as elastic obstacles.
Why: retracted rods park at y = 12.35 and the core top is y = 12. The contact distance is
0.36, so a retracted rod still grazes the top of the box and swallowed a neutron during the
test. Absorption is a dissipative channel, so it belongs in the list that gets switched off.

## Week 12: Lattice stiffness vs. the conservative test

Planned: ship the stiff moderator lattice (k = 120) and expect the conservative test to pass.
Did: shipped k = 120 anyway, and reported the test as failing at 81 % at DT = 1/120.
Why: the error is a contact artifact. The engine pushes an overlapping
neutron and atom apart, which moves the atom off its spring's rest site and stores energy
nobody paid for. It scales with stiffness (81 % at k = 120, 19 % at k = 30, 1.4 % at k = 5)
and shrinks with DT. Softening the lattice would pass the test but let struck atoms fly out
of the core, which I fixed deliberately in Week 11. Fixing the contact handling is the right
answer and it is first on next week's list.

## Week 12: Momentum readout

Planned: show total momentum and "internal" momentum as a conservation check.
Did: show total momentum only, labelled as not a conservation check.
Why: fission creates neutrons and absorption destroys them, so neither quantity is conserved
in this project. Claiming otherwise would have been a false validation. It stays on the HUD
as a jump detector.

## Scope

Planned: possibly cut something at the Wednesday checkpoint.
Did: cut nothing. The MUST tier was already complete.
Why: the Week 11 spike cleared the feedback loop before I committed to it, so I built the
feature that week instead of waiting for Week 12.
