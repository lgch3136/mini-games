# Narrow lines and useful lap comparison

- Each race circuit has a road-attached three-gate boost line. The opposite lane stays open. Missing a narrow gate loses the reward; the visible bollards have real collision separation and slow the car. All three clean gates grant 1.55 seconds of exit boost, once per lap.
- Rivals prepare their line before the feature, yield if another driver blocks it, and choose the narrow line or defend the wide lane. They receive the same clean-line reward.
- Four actual sector times are compared with the prior lap/local reference, kept separate by circuit, mode, difficulty and assist. Standing-start S1 has a separate reference from flying-lap S1, so launch acceleration is not mislabeled improvement. The result identifies the most expensive sector and its collisions. Storage failures do not prevent driving. Solo history is capped.
- Chassis roll and brake/boost pitch move the sprung body; the four tyre pivots compensate to remain on the road. The chase camera follows the road slope and gives a little more room during a slide. Route/split information is transient instead of always covering the track.

Validation: `node --test tests/apex-*.test.mjs tests/quality2-race*.test.mjs`. The ordinary-input two-lap coast comparison is approximately 120.61s clean risk line, 121.24s safe lane, and 124.69s striking the gate posts. These are deterministic simulation results, not human times. Full ordinary-input races remain covered for every circuit in race and item modes. Actual tyre vertices remain 0.005–0.017 world units above the road at the tested maximum lean/brake poses.

WebGL presentation, iPhone Safari touch latency and on-device frame pacing have not been verified in this environment. The blocked browser path was not bypassed.
