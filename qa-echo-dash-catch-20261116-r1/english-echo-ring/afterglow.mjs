import{STEP as n}from"./sim.mjs?v=20261116-dash-catch-r1";export function advanceAfterglow(i,f,e,p){for(e+=p;e+1e-12>=n;)i.update(n,f,!1),f.ring.step(n),e=Math.max(0,e-n);return e}
