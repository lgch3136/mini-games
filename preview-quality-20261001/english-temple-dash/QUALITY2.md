# Musical phrases, recovery and readable cues

- The three scores have distinct gesture motifs. Longer cadences and large melodic leaps also affect gesture choice. Every cue still starts at a real melody onset; authored hold/diagonal preparation and recovery gaps remain.
- Results offer a 16-beat retry of the most difficult phrase, with eight audible count-in beats. It preserves the original actions/holds, trims and rebases both melody and accompaniment, and uses the same authoritative audio/space clock. The short practice cannot overwrite full-song records or earn full-song stars. Paused/repeated runs use the existing generation-safe audio lifecycle.
- Free-run branch choice now schedules two actual authored obstacle phrases for that branch and biome: riskier jump/low-beam treasure routes, wide calm routes, or word-exposure routes with recovery straights. Already-visible rows are never rewritten.
- Rhythm arrows are original vector strokes with a dark physical backing, including the four diagonals. Their centres and hold tails still use the exact same gold judgement plane. A missed arrow disappears rather than covering the next cue.
- Passive word pickups and results are labeled exposure/companion reading, not independent memory or mastery.

Validation: `node --test tests/temple-*.test.mjs tests/quality2-race*.test.mjs`. The existing full-score ordinary-input tests cover all three scores/difficulties; short retry tests include a hold+diagonal phrase at all six speeds, exact audio rebasing and count-in, fresh state, record exclusion and real branch traversability.

These are simulation/audio-scheduling/geometry checks. WebGL appearance, real multitouch accuracy, audio-device latency and iPhone frame pacing remain unverified; the blocked browser path was not bypassed.
