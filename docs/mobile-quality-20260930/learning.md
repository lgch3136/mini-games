# Learning / flow games: mobile-quality iteration, 2026-09-30

## Status and evidence boundary

Implementation and production-behavior tests are complete for this iteration. **The visual/device acceptance gate remains open.** No edited-build screenshot, iPhone/Safari playtest, touch-latency measurement, speaker/headphone listening test, or sustained thermal/FPS measurement is claimed here.

Local Chromium startup was denied (`socket() Operation not permitted`) and cloud-browser localhost navigation was blocked. No isolation or security settings were changed, and no restricted route was bypassed. An authorized preview is needed for the browser checklist below.

The changes retain each renderer, input system, vocabulary, and game identity. Shared result medals are actual Blender-generated assets; their reveal animation comes from the integration owner's Godot export. Neither tool is claimed as the runtime engine for these web games.

## Actual game changes

### Typebound
- A direct **8-word warm-up** starts in a no-damage focus session without the initial route-selection detour. A **20-word focus target** or the original unrestricted journey can also be selected
- Practice goals live in `Journey`, end exactly on the committed word, and reject further typing/continuation after completion. Merely typing the final letter does not count; Space still commits it
- In-context coaching teaches the first key, correction without deleting, Space, three-word resonance, and the existing guard/parry opportunity
- Result stars distinguish completion, at least 95% accuracy, and a completely clean target. Review advice is based on the run's actual mistake words
- Progress appears above battle; compact focus sessions hide unused combat controls to preserve keyboard space. Very short screens have a vertical fallback rather than clipping the keyboard
- Replaying a focus result preserves that mode; existing nine-room journey and review progression remain available

### Word Snake
- Default **five-word basket**, optional **ten-word orchard**, and original endless garden
- The engine owns the word goal, terminal win flag, and one-shot completion event; Snake stops safely with input released on a completed basket
- Three independently explained stars: complete the basket, no collisions, independent answers without hints/mistakes
- On-screen progress, complete word/meaning recap, and actionable next-run advice
- Local mastery is separated by goal, spelling/answer mode, vocabulary level, and arena. Blocked storage does not prevent play

### Echo Ring
- Default **90-second trial** plus original endless survival, independently selectable from three-shield / one-hit difficulty
- Goals: survive 90 seconds, five reflected kills, ten-chain. Skill stars earned in a failed trial remain honest partial progress; the survival star requires a clear
- The simulation, not a wall-clock timer, owns completion. A lethal hit wins no survival star and cannot be followed by a same-tick victory
- Opening coach transitions through movement/fire, dangerous gold returns, and dash, then retires
- Trial HUD has deliberately positioned rows for desktop, small portrait, and short landscape, rather than falling into an absolute canvas overlay at top zero
- Scores are now separated between trial and survival and between difficulty modes; legacy endless highs remain readable

### Temple Dash
- Default rhythm **one-song expedition** reaches a genuine ending and results. Continuous full-song looping remains a menu choice; free-run mode is unchanged
- Real press/release timing errors and misses by gesture generate the recap. Calibration advice only appears with at least 12 samples and sufficiently consistent timing, and uses real milliseconds at the selected speed
- Three stars distinguish full composition completion, 85% accuracy, and 95% accuracy. Records distinguish track, difficulty, playback speed, and single-song versus loop session
- Rolling timing samples are capped at 256, gesture categories are finite, and input is cleared at the ending
- **Startup failure recovery:** unavailable WebGL/renderer construction or rejected asset preparation now shows a visible retry / return-to-hub panel instead of an indefinitely disabled start button. Static module load errors also have an HTML-level fallback

### Word Beat
- **One-song challenge**, **complete practice** (mistakes do not prematurely end a song), and the original continuous mode
- Finishing one song no longer forces the entire song to repeat because one spelling letter was missed
- First-use coarse-pointer devices default to **4K**; saved 4K/5K/7K choice is respected. Source MIDI charts are preserved
- **±200 ms judgment calibration** changes only input/hold/miss judgment timing, never accompaniment scheduling. Both directions are explained in the menu
- Results include stars, recent signed timing median, and advice derived from consistent bias or the weakest lane. Timing samples are capped at 256 and labelled as recent
- Records distinguish song, key count, judgment difficulty, and session type
- Retry clears previous scores, samples, particles, held lanes, and completion state. Audio voices are tracked/disconnected on natural end and stopped when leaving/retrying, preventing old scheduled sounds from bleeding into a new song
- A cross-review found a lethal hold-release could be followed by another miss in the same frame after results were rendered. Terminal state guards and frame exit now keep the finalized result/counts immutable; a regression executes this exact production sequence
- Blur/background pauses the score. Interrupted long notes require a real re-grip within half a second rather than silently completing an unheld tail
- Portrait HUD hierarchy, minimum 44px menu/transport buttons, safe-area padding, scrollable song settings, readable calibration options, and viewport zoom lock removal

## Validation performed

Command:

```sh
node --test tests/mobile-quality-learning.test.mjs \
  tests/typebound*.test.mjs tests/echo-*.test.mjs tests/snake-*.test.mjs \
  tests/temple-*.test.mjs tests/journey-polish-20260930.test.mjs
```

Result at this revision: **176 passed, 0 failed**. This is the learning-focused suite, not a claim about the entire repository's aggregate result.

`tests/mobile-quality-learning.test.mjs`: **24 new behavioral tests**, including:
- Typebound 8/20-word runs through normal typing, Space requirement, truthful stars, correction coaching, terminal input lock
- Snake 5/10-word expeditions through the existing ordinary-input route planner on a 14×22 board, pause invariance, independent hint/collision star costs, terminal state lock
- Echo exact 90-second completion/event uniqueness, lethal terminal state, coaching retirement, skill-star calculation
- Three Temple compositions completed with ordinary timed press/release inputs, no misses, true end state, timing-advice evidence threshold
- Actual Word Beat script executed in a DOM/audio fixture: phone defaults, valid/corrupt/blocked preferences, calibrated hits/misses/holds, one-song ending, no-fail practice, five retries, finite re-grip, oscillator cleanup, five distinct record configurations, 400 hits retaining only 256 timing samples
- Actual Temple startup entry executed with an unavailable-WebGL renderer: visible actionable fallback replaces infinite loading

Existing focused regressions retain the 40-source-score Word Beat self-check, Typebound all-nine-room simulation, Snake long normal-steering tests, Echo collision/optics/input behavior, Temple full-score/linear-motion tests, and render allocation tests.

All edited JavaScript passes `node --check`; `git diff --check` is clean for these owned files. New UI is not rebuilt through `innerHTML` every frame. Word Beat's existing result HTML remains a one-time terminal render; progress is a transform and its label uses the existing text cache.

## Required browser acceptance checklist

Use `tests/mobile-quality-browser.html` with **390×844**, **320×568**, and **844×390** iframes, plus a desktop view. Record the actual browser/device and capture genuine screenshots. Browser-size emulation is not a physical-iPhone test.

1. `english-typebound/`
   - Menu: scroll to warm-up/settings without trapped content
   - Press **八词热身**: verify coach, goal ribbon, active word, 4 keyboard rows, Space, pause and system-keyboard switch remain reachable
   - Make a mistake, correct directly, commit 8 real words; inspect stars + medal + exact words
   - Retry, pause mid-word, background/resume, then complete. On 320×568 verify focus compact layout and fallback scrolling
2. `english-word-snake/`
   - Five-word default, ten-word selection and endless selection understandable
   - Active field remains square-cell motion with readable letters and no goal/HUD overlap; dual-pointer turn + boost/cancel still works
   - Complete a basket through normal steering; inspect translated recap and stars; retry metrics reset
   - Hint vs no hint, pause, landscape rotation, lost pointer and local-storage denial
3. `english-echo-ring/`
   - Trial vs survival remains distinct from flow vs edge difficulty
   - Active trial row stays clear of the ring, notice text and top controls at all three sizes
   - Two-finger movement/fire, dash, release/cancel; opening tips disappear after the teaching window
   - Survive to 90 seconds, inspect partial/full stars, then retry. Also fail on a return and verify appropriate advice
4. `english-temple-dash/`
   - With WebGL supported: menu, count-in, readable arrow/gold rail, pause and multi-touch combinations
   - Complete one composition to results, inspect accuracy/stars/advice, retry; separately confirm loop mode starts a second composition
   - With WebGL disabled/unavailable: immediately visible failure panel; retry and return-to-hub are usable, no infinite loading state
5. `english-word-beat/`
   - First-use touch default4K; change/save7K and reload; menu scroll reaches session, calibration and Start
   - Positive/negative calibration, actual rhythm timing, and headphone delay must be listened to rather than inferred
   - Complete practice on repeated misses to true song end; ordinary challenge still fails on depleted life
   - Pause during a hold, release while paused, resume with/without re-grip; retry repeatedly and listen for stale sound tails
   - Verify result medal, recent timing label, weakest-lane advice and separation of saved records

Remaining release risks: real iOS audio activation/interruption behavior, exact keyboard/safe-area geometry with Safari chrome, long-run GPU/thermal costs, perceived difficulty balance, and actual first-use comprehension. Those cannot be marked passed from these Node tests.

## Typebound live-QA correction, 2026-09-30 14:50 UTC

The sole browser reviewer reproduced low-contrast coaching at 390×844 / 320×568, brand text under the Sound button at 320×568, and a clipped typing card/missing touch keyboard after completing the eight-word warm-up, retrying, and rotating to 844×390.

Corrections are confined to `english-typebound/mobile-quality.css`:
- `#typing-coach` now owns an opaque pale surface and dark foreground (`#e6f2e7` / `#183c35`), 12px text, and a calculated **10.49:1** authored color-pair contrast. This is a color calculation, not a screenshot-based device contrast measurement
- Narrow headers use a three-column grid with a shrinkable brand slot; Back and the three game controls retain minimum44px targets. The brand no longer uses the legacy absolute left74px position
- Short-landscape live layout explicitly places the goal ribbon, arena, typing card, and keyboard. The new ribbon previously consumed an implicit grid cell and displaced the keyboard below the viewport. Vertical overflow remains scrollable when browser chrome reduces available height further

Targeted Node checks after correction: 75/75 pass, including a new opaque coach-color contrast regression. No gameplay rules changed. Actual post-fix screenshots and rotation/keyboard usability must still be verified in the browser after the bundled correction is published.
