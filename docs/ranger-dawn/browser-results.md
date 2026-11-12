# Browser verification — 2026-09-05

Environment: current macOS computer, Codex in-app Browser. No headless Chrome process was launched. Local HTTP server, same modules as production. Values below are observations, not promises for other hardware.

## Real-time normal-input replay

Scenario: stage 0, standard health, actual project vocabulary, renderer and audio active, no HP/position modification. Paused at 23 seconds for inspection, then resumed to the finish. These are simulation seconds, not wall time including the inspection pause.

```json
{
  "status": "won",
  "time": 34.86,
  "stage": 0,
  "hp": 6,
  "kills": 14,
  "words": 1,
  "bossHp": 0,
  "p50FrameMs": 16.7,
  "p95FrameMs": 17.6,
  "p95WorkMs": 1.3,
  "width": 2037,
  "height": 1146,
  "voices": 0,
  "audioState": "suspended",
  "running": false,
  "totalFrames": 2025
}
```

Canvas backing resolution: about 2.33 million pixels. `WorkMs` is JavaScript simulation/draw submission time, not complete CPU/GPU/compositor time. Browser warning/error logs for the final replay were empty.

## Production-page DOM input tests

All 15 checks passed after the final gameplay/renderer edits:

1. Start button enters the formal game.
2. D/right-move binding is received.
3. Player moves, then stops when key is released (x = 196.36 after the test sequence).
4. Held shooting emits multiple shots (5).
5. Jump and movement can overlap.
6. Left joystick movement and right fire/drag aiming are independent (rightward movement + −45° aim).
7. Canceling right pointer does not release left movement.
8. Two pointers on one action retain the second pointer's hold.
9. Canceling all pointers leaves no stuck input.
10. Pause stops simulation time and animation loop.
11. Pause leaves voices = 0, audioState = suspended, musicTimer = false.
12. Resume does not inherit old input.
13. Blur pauses automatically.
14. Retry does not duplicate combat state or held input.
15. Menu leaves voices = 0, musicTimer = false, and no game RAF.

These tests dispatch DOM events to the real input handlers. They are not a physical multi-finger handset test. Browser warning/error logs for the final input run were empty.

## Responsive inspection

- 390×844, DPR 2, touch emulation: square playfield; all buttons below the battlefield; no horizontal overflow.
- 844×390, DPR 2, touch emulation: full-screen playfield; translucent edge controls, independent fire/aim.
- 320×568, DPR 2: no horizontal overflow; menu start button bottom at 545 CSS px, accessible without scrolling; the remainder of the menu can scroll vertically.
- 540-world-unit narrow playthroughs: all three routes complete. Boss fully enters the view before activation; player/boss arena boundaries account for the narrow viewport.

Screenshots are in this directory. Small screens are browser-emulated, not claims of testing every iOS/Android device. Human evaluation of challenge, variety and fun remains distinct from these correctness checks.
