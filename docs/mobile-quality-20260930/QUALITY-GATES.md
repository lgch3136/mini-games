# Mobile quality pass · 2026-09-30

Base: `61ba37d2ed8a21d7ccb754ad04a653a2125521a7`. Target is a polished **mobile-web** collection, not an unrequested native rewrite or App Store submission. “2026 iOS quality” is an aspiration, not a certification a headless test suite can grant.

## Acceptance gates

1. **Playable session:** understandable start, fair rules, a meaningful bounded objective or deliberate endless mode, a useful result, one-step retry. Replay progression must retain earned value without making unearned promises.
2. **Touch:** comfortably separated controls, no stuck input on cancel/blur/pause, repeated-start/retry does not duplicate listeners or loops. Critical touch controls aim for at least 44 CSS pixels.
3. **Fairness:** warnings describe the actual danger, procedural boards have achievable objectives, unavoidable random locks get recovery, difficulty grows within bounded limits.
4. **Presentation:** readable small-screen hierarchy, score/rank grounded in real performance, distinct genre identity, meaningful feedback rather than covering play with decoration. Reduced-motion preference respected by new animation.
5. **Performance:** no runtime Godot/Blender dependency, compressed tiny generated art, bounded entity/particle counts, no per-frame DOM allocation in added UI, no repeated asset loading per frame.
6. **Reliability:** corrupt or denied storage degrades safely, phase transition/terminal state triggers once, retry resets run metrics but preserves earned records, pause/resume does not advance gameplay unexpectedly.
7. **Evidence:** production-code tests; viewport-specific screenshots and actual input checks when browser available; no assertion that Node fixtures measure GPU FPS, real touch, audio output, thermal/battery use or iPhone Safari.

## Baseline audit and planned proof

| Game | Concrete baseline gap | Implementation / proof |
|---|---|---|
| Typebound | Practice has no guided short-session target | Guided goals, actual run recap, state/reset tests |
| Echo Ring | Survival-only loop | Explicit timed trial versus survival, terminal-state tests |
| Apex Drive | No structured drift mastery goals | Skill goals, per-track scorecard, genuine metrics |
| Signal Strike | Telegraph retargets at fire time | Snapshot aim warning, evade behavior test, shield/mission scorecard |
| Moonblade | Combat depth not retained in meaningful route result | Route mastery and useful retry coaching |
| Word Ranger | Similar performance-feedback gap | Mission scorecard and skill coaching |
| Word Fury | Move depth not taught/retained | Context coaching and earned achievement |
| Bomber | Every round discards build; initial bomb can trap player | Persistent run builds, safe spawn, blast forecast |
| Miner | Procedural quota can be unwinnable; wrong-order return misplaced | Solvable board contracts and precision/cancel controls |
| Breaker | Future-letter lock can stall; uncapped multiball | Recovery cadence, bounded balls, precision catch |
| Thunder Fighter | Limited route/reward cadence | Encounter pacing and fair control cues |
| Snake | Endless-only, weak finish | 5/10-word expeditions and mastery result |
| Flappy Word | Control/telegraph difficulty spikes | Fair warning and route/reward progression |
| Temple Dash | Rhythm automatically loops songs forever | Explicit one-song finish, optional looping, timing recap |
| Word Beat | No mobile timing calibration | Calibrated input and performance feedback |

## Evidence status

- Baseline full suite reproduced: **469/469 passed**, Node 24.
- Blender 4.3.2 Cycles CPU rendered four original transparent mastery medals; preview visually inspected. Runtime WebPs total under 45 KB.
- Godot 4.6.3 ran headless and exported 21 back-ease samples + CSS. Finite/bounded/exact-settling behavior tested.
- Initial new shared tests: **4/4 passed**.
- Browser launch in shell failed with `socket() ... Operation not permitted`.
- Supported cloud-browser localhost navigation returned `ERR_BLOCKED_BY_CLIENT`.
- No restriction bypass attempted. Public preview publication needs authorization. Browser/screenshot gates remain **blocked, not passed** until authorized preview is accessible.
- Real iPhone Safari, multi-touch, silent-switch/audio-interruption, keyboard resize, thermal behavior and sustained GPU frame timing remain device-validation items.

Per-group implementation and final check results are recorded alongside this file. No new deployment is implied by these local edits.

## Independent second review

After the first green aggregate suite, an independent second review covered each game group. This found real boundary bugs requiring further fixes, rather than treating test success as completion:

- Beat could finalize a lethal hold release, then still scan overdue notes in the same frame and mutate the saved/result counts
- Temple's new song/loop modes initially shared a record key
- Bomber's normal speed pickup could reduce the faster supply-upgrade speed
- Miner's held wrong-order letter could return below the playable floor after portrait resize
- Ranger lacked a BFCache restoration path for disposed audio and resize observation

These must have dedicated regressions and a fresh full-suite pass before local handoff. Separately, ordinary-input Echo pilots completed the new 90-second trial at three seeds, and Ranger pilots cleared six routes at both desktop and phone-world widths. Simulated completion is not a substitute for human touch/visual/audio assessment.
