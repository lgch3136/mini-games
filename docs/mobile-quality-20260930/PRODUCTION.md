# Production release · 2026-09-30

The owner explicitly requested direct production publication. The initial complete release is commit `1ce991fd4555ba013326c63920521b344f519555`.

- [Production collection](https://lgch3136.github.io/mini-games/)
- [Successful Pages deployment](https://github.com/lgch3136/mini-games/actions/runs/36728175977)
- [Viewport review workbench](https://lgch3136.github.io/mini-games/tests/mobile-quality-browser.html)

## Confirmed at publication

- Remote runtime tree exactly matched the locally checked source/assets tree
- Main updated normally without force; no intervening remote edits were overwritten
- 557/557 tests, 168 JavaScript syntax checks, and290 local resource/import references passed after restoring the delivery patch
- Pages build and deployment completed successfully for the exact release commit
- Live cloud Chrome rendered the new collection headline and quality-r2 links, without missing hub images or horizontal overflow
- Live Bomber menu rendered the new Blender diorama and new onboarding copy

## Source assets

All required browser assets and complete procedural authoring scripts are included. The four large editable Blender `.blend` binaries remain in the complete delivery patch; the included Blender scripts recreate those scenes. They were omitted from the production transfer to prevent large-source uploads delaying the runtime release. No runtime reference depends on them.

## Ongoing validation

The prior QUALITY-GATES and VALIDATION documents describe the pre-publication checkpoint. Actual post-publication gameplay and responsive-layout checks continue; successful deployment is not a claim of finished iPhone/Safari quality.

Current cloud graphics capability previously reported WebGL disabled. 3D gameplay needs a permitted GPU-capable browser/device; physical multi-touch, Safari keyboard/safe areas, listening tests, sustained performance and thermal/battery behavior remain separate device checks.

The workbench initially counted its two border pixels within the selected width/height. Its content-box correction makes nominal viewport dimensions exact; earlier observations correctly reported actual388×842 for the390×844 option.

## First live-visual corrections

Real browser testing exposed two layout/geometry defects that simulation-only validation had not caught:

- Bomber short landscape HUD/word text overlapped the maze; side panels now separate information, playfield and touch buttons
- Breaker kept fixed brick heights while scaling row positions during rotation; complete brick boxes now reflow, preserve progress and reserve HUD space

Two new production resize regressions were added, and the full suite passes559/559. The follow-up also corrects the workbench's viewport border sizing. These fixes must be rechecked in the deployed browser; physical iPhone validation remains open.

## Additional live-readable interface corrections

The next focused correction protects Apex/Strike failure-text contrast, lifts Fury's failure alert out of the isolated arena layer, and fixes Typebound coach contrast, narrow header overlap and short-landscape keyboard placement. The workbench forwards its build tag to game HTML URLs, preventing stale entry pages during rapid verification. Per-game live evidence and remaining boundaries are tracked in [BROWSER-QA.md](BROWSER-QA.md).

The same focused bundle also keeps Flappy's portrait flight world centered in short landscape with essential controls outside the narrow canvas, and raises Snake's landscape direction/boost targets to44px in its normal footer flow. This preserves the existing flight pace and keeps touch buttons off the board. All remaining device and timing-sensitivity boundaries still apply.

## Bounded review completed across15 entries

The review reached all15 entries: ten2D titles had live input/state-transition coverage, and five3D titles had disabled-WebGL fallback coverage only. r4 visual corrections were rechecked successfully. The remaining scoped correction stacks Ranger's portrait goal/notice/boss messages, gives a living boss priority while preserving goal progress, and makes Miner's dynamite target44px. Boss entry/defeat/retry visibility has a production-HUD regression; an actual live boss victory is not claimed. Final deployed pixel checks are recorded in BROWSER-QA.md.
