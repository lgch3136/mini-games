# Live browser QA checkpoint · 2026-09-30

Updated 15:00 UTC. Cloud Chrome browser. Public workbench: <https://lgch3136.github.io/mini-games/tests/mobile-quality-browser.html?build=11ceb608>. Production commits observed: initial `1ce991fd4555ba013326c63920521b344f519555`, then corrected `11ceb6081f3c460ff5ea24aa60518d4b03a932fe`.

**Coverage is not a blanket pass.** At this checkpoint 8 two-dimensional titles have meaningful live input/state coverage, and 5 WebGL titles have fallback-only coverage: 13/15 inspected beyond a menu. Beat and Ranger remain pending. Five WebGL games cannot run in this browser: console explicitly reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`. No graphics/security settings were bypassed.

The initial workbench's borders made nominal 390×844 / 320×568 / 844×390 into 388×842 / 318×566 / 842×388. Release r3 corrected this; the new 844×390 content dimensions were directly measured through the rendered HTML. Sizes below use the corrected intended dimensions unless marked initial.

Screenshots were visually inspected at the states described below. No standalone screenshot file bundle is included. This is viewport testing, **not physical iPhone, Safari, audio listening, multi-touch latency, sustained FPS, battery or thermal acceptance**.

| Game | Actual input/state evidence | Layout evidence and open boundary |
|---|---|---|
| Word Bomber | Start, bomb produced real life loss, pause/resume, resize | r3 screenshot recheck at all3 sizes: fixed landscape separates left HUD, central maze, right controls; portrait retained. No full round/supply completion in browser |
| Word Miner | Initial live cast earned113, aim guide visible, pause/resume, smaller resize | Initial two portrait screens readable; landscape pause visible. No full contract/shop; active landscape still needs further look |
| Word Breaker | Launch→recall charge1→0→aim line→relaunch, score and lost life. r3 landscape brick hit/reflection and return to portrait preserve destroyed brick/score | r3 all3 sizes: brick boxes no longer overlap, HUD clears top row. Shorter landscape field is brisk; multi-second interaction latency cannot certify human reaction balance. No whole level clear |
| Thunder Fighter | Dash visibly enters7s cooldown, natural failure results/medal, Retry resets100HP/0score, pause/resume | Initial all3 sizes readable. No boss/refit completion; no physical simultaneous drag/fire test |
| Typebound | Eight real words committed with normal typing/Space; one deliberate wrong key then correction; pause mid-word; truthful97.9%,2-star result; Retry resets0/8 | Both portraits usable, result scrolls. Open defects awaitingr4: low-contrast coach,320px header brand/button overlap,844×390 typing card/keyboard clipped after Retry/rotation |
| Echo Ring |90s trial starts, natural collision failure at13s gives0 stars, Retry resets3 shields/01:30, pause works. Keyboard fire/dash attempt made but success not separately established before failure |All3 sizes visually checked;320×568 play/result screenshots. No90s completion |
| Apex Drive |Renderer fails as expected in disabled-WebGL browser; visible fallback and return-to-hub actually works |All3 sizes. Open defect awaitingr4: dark-on-dark explanation. No3D gameplay pass |
| Signal Strike |Visible WebGL requirement / return fallback; expected constructor failure |All3 sizes readable. No3D gameplay pass |
| Moonblade |Visible foreground WebGL/resource failure and return link; measured return target46px high |All3 sizes readable. No3D gameplay pass |
| Word Fury |Start changes to loading-failed; WebGL error text exists |All3 sizes show failure layer behind menu. Open stacking defect awaitingr4. No3D gameplay pass |
| Temple Dash |Clear unavailable-WebGL panel; Reload returns to actionable failure; return-to-hub actually works |All3 sizes readable and buttons reachable. No3D gameplay pass |
| Flappy Word |Actual takeoff/collision, truthful1-crossing/0-answer failure, Retry resets3 hearts/0progress, pause/resume |Portrait clear. Open landscape defect: narrow wrapper clips HUD controls; a fixed-world side-panel correction is prepared forr4. Glide hand-feel unverified |
| Word Snake |Five-word start, actual direction change, pause/resume, rotation pauses with preserved-board explanation, return-to-menu |All3 sizes readable. Landscape direction targets measured34px; enlargement to44px is prepared forr4. No full basket completion |
| Word Beat |Pending |No live acceptance yet; audio calibration requires listening |
| Word Ranger |Pending |No live acceptance yet |

## Confirmed defects and disposition

1. Bomber landscape mission/build text covered maze; fixed and rechecked live inr3
2. Breaker resized brick positions without corresponding complete-box reflow; rows overlapped, and landscape HUD covered top bricks; fixed and rechecked live inr3. Two new production regression tests, full local559/559 at that revision
3. Apex failure explanation inherits dark text; a scoped high-contrast fix is implemented, deployment/recheck pending
4. Fury failure alert remains behind out-of-arena menu; the scoped fix moves the alert to body to escape stacking context, deployment/recheck pending
5. Typebound coach contrast,320header overlap, and short-landscape grid placement; scoped CSS fixes are implemented, deployment/recheck pending

6. Flappy short-landscape wrapper clipped essential controls; scoped portrait-world/side-panel fix prepared forr4
7. Snake landscape direction targets were34px with no coarse-pointer enlargement;44px in-flow controls prepared forr4

## Next bounded checks

Recheck the pending visual fixes after verified publication. Complete remaining titles through understandable start, one real input, pause/resume, retry or appropriate result, and screenshots at the three sizes. Do not spend unbounded tool-latency time attempting timing-sensitive full clears. Record unverified success routes and physical-device/audio limits explicitly.
