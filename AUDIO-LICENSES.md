# Audio sources and licenses

All bundled audio below may be used and redistributed with the games.

| Local file | Source | License |
| --- | --- | --- |
| `shared/audio/platformer-theme.ogg` | “Overworld Theme” by Louswan, [OpenGameArt](https://opengameart.org/content/overworld-theme-0) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `shared/audio/click.ogg`, `shared/audio/confirm.ogg` | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `shared/audio/jump.ogg`, `shared/audio/laser.ogg` | [Kenney Digital Audio](https://kenney.nl/assets/digital-audio) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Attribution is not required by CC0, but the creators are credited here with thanks.

## Word Ranger: Dawn Operations (2026-09-05 rebuild)

`english-word-ranger/sound.js` synthesizes a new, project-authored 32-bar instrumental loop, boss variation, and action sounds with Web Audio. It does not load the shared recordings above, sample commercial game music, or extract ROM audio. The score uses a 126 BPM exploration arrangement and a 144 BPM boss arrangement. Oscillators and a reusable generated noise buffer supply the instruments and effects; no separate third-party recording license is required for these newly authored sounds.

## Temple Dash: Windward Expedition (2026-09-05 rebuild)

`english-temple-dash/sound.js` supplies a newly authored 112 BPM, 32-bar modal score with separate plucked arpeggios, melody, light percussion, environment voicing, and movement/reward/damage sounds. It reuses the bounded Web Audio voice implementation from Word Ranger, not its musical phrases. The runner no longer loads the old shared recording or chip-music loops simultaneously. No commercial music, samples or ROM audio are used; no additional third-party recording license is needed for this original synthesized score.
