# Style decisions, contact and a punish that can be performed

- Lin answers a visible incoming projectile with a wave and controls kick/anti-air distance. Mei rolls through projectiles and pressures standing/crouching guard with a low/overhead before confirmed cancels. Shan's advancing heavy can absorb one mid during its visible startup/active phase, takes the actual damage, and remains interruptible by a second mid, low or throw. His close-range objective is the command throw.
- Projectile clashes respect vertical overlap; a super survives a weaker wave. Decisions use the opponent's visible state, then execute through the existing reaction delay and move startup.
- Dojo feedback reports the actual recovery window, selected startup and late-input frames. The instructor closes to a punishable distance and teaches the 6-frame B kick after blocking a heavy. A short jab was often out of range after real block pushback; this is fixed and tested from the real starting positions for all three heroes.
- Contact drives different head/body/low-hit poses, striking shoulder compression and armored recoil. Fixed-frame hitstop holds the pose. The snapshot includes an independent copy of contact data.
- Optional hit-driven words are called companion exposure. They no longer grant meter or claim memorization.

Validation: `node --test tests/fury-combat.test.mjs tests/quality2-race*.test.mjs`.

An offline inspection can render the exact production pose controls against the existing Blender meshes:

```
node tools/quality2-fury/inspect-runtime-pose.mjs /tmp/fury-pose-review
blender --background --threads 4 --python tools/quality2-fury/render-runtime-pose.py -- /tmp/fury-pose-review
```

The three inspected phases show planted feet, glove/upper-body contact, and articulated recovery. This is a CPU Blender geometry/pose inspection, not a WebGL screenshot or a claim about mobile performance. Browser touch, WebGL lighting and frame pacing remain unverified.
