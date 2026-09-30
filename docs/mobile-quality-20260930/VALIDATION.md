# Final local verification snapshot

Base commit: `61ba37d2ed8a21d7ccb754ad04a653a2125521a7`
Local development branch: `quality/mobile-2026-deep-pass`
Publication: **not performed**

## Passed

- Full production-code suite: **557 / 557**, 0 failures, 0 skipped
- Baseline had 469 tests; this pass adds **88** behavior/regression tests: arcade26, learning24, action29, shared7, Ranger lifecycle2
- Repeated independent review caught and regressed terminal-frame changes after results in Beat and Flappy, Thunder close-shot skip bypassing ramming, mixed Temple record modes, Bomber speed downgrades, Miner held-letter rotation, and Ranger BFCache disposal
- Ranger ordinary-input pilots: six routes × two simulated world widths (960/540), **12 / 12 won**, normal health
- Arcade production fixtures: actual timed Miner hook paths, seeded solvability/escape checks, and 63,000 existing Thunder/Flappy fuzz frames
- Echo ordinary-input pilots: three seeds survived the new 90-second trial; the learning report separates timed-state checks from actual simulation inputs
- All three Fury characters completed all four guided combat lessons through normal simulated input rather than setting lesson progress
- **149** production source files scanned; **290** local HTML/CSS/import references resolve
- **168** JavaScript files pass `node --check`
- All 15 game HTML entries use viewport-fit=cover and exactly one shared presentation CSS import; no duplicate element IDs found
- Dependency-aware cache revision propagation settled (second run changed0 files)
- `git diff --check` clean
- Blender4.3.2 actually rendered four medals plus three original diorama covers; generated pixels inspected and compositions iterated
- Godot4.6.3 actually exported the reward motion curve; samples finite/bounded/exact-settling in tests; CSS reduced-motion fallback present

Logs: `test-results.txt`, `resource-check.txt`, `ranger-desktop.txt`, `ranger-mobile.txt`. No runtime dependencies added.

## Observed baseline browser evidence

Supported cloud browser opened the existing public Miner menu/game and the repository's phone-width iframe layout page. This revealed the long Flappy tutorial, small secondary controls, dense Beat setup and oversized retro Miner cover, informing the new layouts/art.

The same browser's console explicitly reported `GL_VENDOR = Disabled, GL_RENDERER = Disabled` and WebGL context-creation errors for Temple/Fury. That is an environment capability limit; not a claim these games fail on all devices. New startup-error UI is covered by production entry tests.

## Blocked / not passed

- Edited-build browser screenshots and real interactions for all15: shell Chromium cannot create its socket; supported cloud-browser localhost returns ERR_BLOCKED_BY_CLIENT
- An independently published preview requires user approval. No preview or production deployment was performed
- Even with accessible preview, current cloud WebGL cannot validate3D gameplay; a permitted GPU-enabled browser/device is still required
- iPhone/Safari hardware input, keyboard viewport, notch/home-indicator geometry, silent switch/audio interruptions, headphones, sustained frame timing, thermal/battery use
- Subjective first-use comprehension, feel and challenge balance still require human-style visual/touch playtests

A green simulation suite is a strong local regression checkpoint. **It does not establish that all15 already meet finished native-iOS game quality.** Continue from the review workbench once preview/renderer access is available, fix each visual/playability finding, then repeat the relevant tests.
