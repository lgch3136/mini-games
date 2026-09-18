import test from "node:test";
import assert from "node:assert/strict";
import { Strike, MAPS, DT } from "../english-signal-strike/world.mjs";
import { strikePilot, navigateStrike } from "./first-person-pilot.mjs";
for (const map of MAPS) {
  test(`${map.id}: authored route reaches every relay without crossing solid cover`, () => {
    for (let checkpoint = 0; checkpoint < 3; checkpoint++) {
      const w = new Strike({ map: map.id, checkpoint }),
        s = w.snapshot(),
        m = {},
        goal = s.relaysPosition[checkpoint];
      navigateStrike(s, m, goal);
      const start = (Math.round(s.p.z) + 162) * 37 + Math.round(s.p.x) + 18;
      assert.ok(m.dist[start] >= 0);
    }
  });
  test(`${map.id}: normal keyboard/mouse pilot clears all three sectors`, () => {
    const w = new Strike({ map: map.id }),
      m = {};
    let old = {};
    for (let i = 0; i < 120 * 230 && !w.finished && !w.dead; i++) {
      const a = strikePilot(w.snapshot(), m),
        k = a.keys;
      w.step(
        {
          mx: Number(!!k.KeyD) - Number(!!k.KeyA),
          my: Number(!!k.KeyW) - Number(!!k.KeyS),
          fire: k.KeyJ,
          use: k.KeyE,
          reloadTap: k.KeyR && !old.KeyR,
          lookX: a.lookX,
          lookY: a.lookY,
        },
        DT,
      );
      old = k;
    }
    assert.ok(
      w.finished,
      JSON.stringify({
        map: map.id,
        time: w.time,
        zone: w.zone,
        kills: w.kills,
        p: w.p,
      }),
    );
    assert.equal(w.relays.filter(Boolean).length, 3);
    assert.ok(w.p.hp > 0);
  });
}
