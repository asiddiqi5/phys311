Four body simulation

My four body simulation uses the body, world, gravity, spring, and verlet classes from
my lab seven engine. Uniform gravity and an undamped spring are the two forces used. The
elastic body to body collisions and elastic box to wall collisions are shown, and the
spring force is used to connect bodies 3 and 4.

To run the notebook put the notebook and the engine in the same folder. The similation
bodies, system run time, dt, and forces located in the Setup Section can then be changed 
or kept. Then run the simulation can be ran by first running the engine-import cell,
setup cell, and then the demo cell in that order. The simulation will then display the
trajectories, conservation checks, and the screenshots of the simulation. The momentum is
corrected for the known gravity and wall impulses and the energy includes gravitational
and spring potential energy.