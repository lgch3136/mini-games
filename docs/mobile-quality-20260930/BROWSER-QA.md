# Live browser QA checkpoint · 2026-09-30

Updated 15:22 UTC. Cloud Chrome browser. Public workbench: <https://lgch3136.github.io/mini-games/tests/mobile-quality-browser.html?build=1c18094c>. Production commits observed: initial `1ce991fd4555ba013326c63920521b344f519555`, then corrected `11ceb6081f3c460ff5ea24aa60518d4b03a932fe`, then visual-fix release `3e19d9b6c03a486d9dcf6edeaabcd48799f8a82d`, and final scoped release `1c18094c0c4ef2d4a028a5145ea575d2e88a75e2`.

**Coverage is not a blanket pass.** All 10 two-dimensional titles now have meaningful live input/state coverage, and 5 WebGL titles have fallback-only coverage: 15/15 inspected beyond a menu. This does not mean every level, success route or input method passed. Five WebGL games cannot run in this browser: console explicitly reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`. No graphics/security settings were bypassed.

The initial workbench's borders made nominal 390×844 / 320×568 / 844×390 into 388×842 / 318×566 / 842×388. Release r3 corrected this; the new 844×390 content dimensions were directly measured through the rendered HTML. Sizes below use the corrected intended dimensions unless marked initial.

Screenshots were visually inspected at the states described below. No standalone screenshot file bundle is included. This is viewport testing, **not physical iPhone, Safari, audio listening, multi-touch latency, sustained FPS, battery or thermal acceptance**.

| Game | Actual input/state evidence | Layout evidence and open boundary |
|---|---|---|
| Word Bomber | Start, bomb produced real life loss, pause/resume, resize | r3 screenshot recheck at all three sizes: fixed landscape separates left HUD, central maze, right controls; portrait retained. No full round/supply completion in browser |
| Word Miner | Initial live cast earned 113; aim guide, pause/resume and smaller resize work. Active landscape cast, natural timer-expiry result, then Retry reset to 75 seconds / 0 score / fresh word | All three sizes observed. r5 landscape dynamite target measured 82.09×44px, within the viewport. No successful contract/shop completion |
| Word Breaker | Launch→recall charge1→0→aim line→relaunch, score and lost life. r3 landscape brick hit/reflection and return to portrait preserve destroyed brick/score | r3 all three sizes: brick boxes no longer overlap, HUD clears top row. Shorter landscape field is brisk; multi-second interaction latency cannot certify human reaction balance. No whole level clear |
| Thunder Fighter | Dash visibly enters 7s cooldown, natural failure results/medal, Retry resets 100 HP / 0 score, pause/resume | Initial all three sizes readable. No boss/refit completion; no physical simultaneous drag/fire test |
| Typebound | Eight real words committed with normal typing/Space; one deliberate wrong key then correction; pause mid-word; truthful 97.9%, 2-star result; Retry resets 0/8 | r4: coach and 320px header fixed; full landscape typing card visible after another real 8-word completion / Retry / rotation, then normal typing and Space committed another word. Portrait keyboard used successfully; desktop fine-pointer CSS intentionally hides the wide keyboard, so coarse-pointer landscape remains unverified |
| Echo Ring |90s trial starts, natural collision failure at 13s gives 0 stars, Retry resets 3 shields/01:30, pause works. Keyboard fire/dash attempt made but success not separately established before failure |All three sizes visually checked;320×568 play/result screenshots. No 90s completion |
| Apex Drive |Renderer fails as expected in disabled-WebGL browser; visible fallback and return-to-hub actually works |r4 all three sizes: explanation now clearly readable. No 3D gameplay pass |
| Signal Strike |Visible WebGL requirement / return fallback; expected constructor failure |All three sizes readable. No 3D gameplay pass |
| Moonblade |Visible foreground WebGL/resource failure and return link; measured return target 46px high |All three sizes readable. No 3D gameplay pass |
| Word Fury |Start changes to loading-failed; WebGL error text exists |r4 all three sizes: failure layer now foreground; its return link actually reaches the hub. No 3D gameplay pass |
| Temple Dash |Clear unavailable-WebGL panel; Reload returns to actionable failure; return-to-hub actually works |All three sizes readable and buttons reachable. No 3D gameplay pass |
| Flappy Word |Actual takeoff/collision, truthful 1-crossing / 0-answer failure, Retry resets 3 hearts / 0 progress, pause/resume |r4 all three sizes: portrait flight centered with separate landscape panels; hint/sound/pause each measured 44×44 and inside the viewport. Takeoff→pause and portrait restoration work. Sustained glide hand-feel unverified |
| Word Snake |Five-word start, actual direction change, pause/resume, rotation pauses with preserved-board explanation, return-to-menu and new start reset 3 hearts / 0 words |r4 landscape direction targets measured 44×44, sit below the board, and accept input; portrait restoration works. No full basket completion |
| Word Beat | Selected 4K, started song, paused/resumed, sent normal lane keys, observed moving notes, natural 20-miss failure and weakest-lane advice; Retry and pause work | Small portrait play, tall portrait result and landscape play/result captured. Result scroll reaches Retry. No full practice-song completion or audio/calibration listening |
| Word Ranger | Started mission, normal grenade input changed count 3→2, paused, checkpoint retry restored 3; jump/roll keys sent but their individual outcome not separately established | All three sizes rendered. r5 opening notice sits 8px below the tactical card at both portrait sizes; no overlap. No mission victory, live boss UI or physical dual-thumb test |

## Confirmed defects and disposition

1. Bomber landscape mission/build text covered maze; fixed and rechecked live in r3
2. Breaker resized brick positions without corresponding complete-box reflow; rows overlapped, and landscape HUD covered top bricks; fixed and rechecked live in r3. Two new production regression tests, full local 559/559 at that revision
3. Apex failure explanation inherited dark text; high-contrast fix rechecked live at all three sizes in r4
4. Fury failure alert was behind the menu; foreground alert and usable return link rechecked live in r4
5. Typebound coach contrast, 320px header overlap, and short-landscape typing-card placement fixed and rechecked in r4. Clarification: the wide on-screen keyboard is intentionally hidden for this desktop fine-pointer browser; its absence alone is not a mobile clipping defect

6. Flappy short-landscape wrapper clipped essential controls; portrait-world side panels and 44px control bounds rechecked live in r4
7. Snake landscape direction targets were 34px; enlarged 44px in-flow controls measured and rechecked live in r4
8. Ranger portrait tactical card overlapped the opening instruction notice; r5 screenshots at 320×568 and 390×844 confirm separation. Card y=77px, height=63.39px; notice y=148.39px, giving an 8px gap. Boss-message priority has a production-HUD regression, but live boss visuals remain unverified
9. Miner landscape dynamite target was 42px; r5 rendered target measured 82.09×44px and remains in bounds

## Final scope and remaining validation

The agreed browser smoke sweep is complete: all 15 titles were observed beyond their menu, and every concrete visual defect found in this sweep was fixed and rechecked on the deployed follow-up build. This is 10 titles with bounded 2D input/state coverage plus 5 titles with WebGL-unavailable recovery coverage, not 15 complete gameplay passes.

- Two Typebound warm-ups were completed through real typing and Space: one deliberately imperfect 2-star result and one clean 3-star result
- Other long/timing-sensitive success paths are not claimed: Bomber supply clear, Miner shop, Breaker complete level, Thunder boss/refit, Echo 90-second win, Snake full basket, Flappy route mastery, Beat full practice song, Ranger mission/boss
- Real iPhone/iPad Safari, physical multi-touch and hold/cancel feel, headphones/speakers and calibration, silent-switch/background audio, safe areas with browser chrome, sustained GPU/FPS/thermal/battery behavior remain separate acceptance work
- The cloud browser uses a desktop fine pointer. Typebound intentionally hides its wide on-screen keyboard under that media condition; coarse-pointer landscape keyboard placement is not certified by this sweep
- No source-state injection or WebGL/security-setting bypass was used to manufacture a live success

Automated validation for r5 passed 565/565 production tests, 168 JavaScript syntax checks and 290 resource/import references across 149 production source files. These checks are separate from the browser evidence above.
