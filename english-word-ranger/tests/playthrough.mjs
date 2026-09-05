import { World, STEP } from "../engine.mjs";
import { createPilot } from "./pilot.mjs";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const scope = { window: {} };
runInNewContext(
  readFileSync(new URL("../../shared/vocabulary.js", import.meta.url), "utf8"),
  scope,
);
const words = [
  ...scope.window.PROJECT_VOCAB.easy,
  ...scope.window.PROJECT_VOCAB.medium,
].filter((w) => /^[a-z]{3,8}$/i.test(w.en));
const stages = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [0, 1, 2];
const width = Number(process.env.RANGER_TEST_WIDTH) || 960;
for (const stage of stages) {
  const w = new World({
      stage,
      seed: 47 + stage * 193,
      difficulty: "normal",
      words,
      width,
    }),
    pilot = createPilot(),
    timeline = [];
  let second = -1;
  for (let i = 0; i < 240 / STEP && w.status === "playing"; i++) {
    w.step(pilot(w));
    if (Math.floor(w.time) !== second) {
      second = Math.floor(w.time);
      timeline.push({
        time: second,
        x: Math.round(w.player.x),
        y: Math.round(w.player.y),
        hp: w.player.hp,
        kills: w.kills,
        boss: +w.boss.hp.toFixed(1),
        phase: w.boss.phase,
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        stage,
        width,
        status: w.status,
        time: +w.time.toFixed(2),
        hp: w.player.hp,
        kills: w.kills,
        words: w.learned.length,
        damage: w.damageTaken,
        metrics: w.metrics,
        final: w.status === "won" ? undefined : timeline.slice(-8),
      },
      null,
      2,
    ),
  );
  if (w.status !== "won") process.exitCode = 1;
}
