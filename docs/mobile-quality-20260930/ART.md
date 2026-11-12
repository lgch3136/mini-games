# Original mastery art and motion

Four enamel-and-metal mastery medals were modeled and rendered by **Blender 4.3.2**, rather than sourced from an external asset pack. These are performance rewards in game result cards. They are deliberately small and secondary to actual score/coaching.

- Editable `.blend` sources are retained in the full delivery patch; regenerate them locally with the included Blender scripts
- Reproducible procedural source: `tools/mobile-art/build_medals.py`
- Runtime: `shared/mobile-art/medal-{bronze,silver,gold,prism}.webp`, 256×256, alpha, approximately 10–12 KB each
- Human-reviewed contact sheet: `mastery-medals-preview.jpg`
- Original output; no third-party models, textures, fonts or asset licenses

Run from repo root:

```sh
blender -b -t 2 --python tools/mobile-art/build_medals.py
python3 tools/mobile-art/compress_medals.py
XDG_DATA_HOME=/tmp/mini-godot-data XDG_CACHE_HOME=/tmp/mini-godot-cache XDG_CONFIG_HOME=/tmp/mini-godot-config godot --headless --path tools/mobile-art --script export_motion.gd
```

Godot 4.6.3's Tween interpolation authors the reward entrance curve offline. The actual executed export creates `reward-motion.json` (21 samples) and `reward-motion.css`, so the browser plays the tested curve with CSS and **does not download Godot or WASM**. The shared stylesheet limits this animation to `.mastery-medal`, and disables it for reduced motion. This is an appropriate asset-authoring use of the tools, not a claim of a native-engine rewrite.

The first Blender run exposed missing OpenImageDenoise support; reproducible source now explicitly disables denoising. Godot's first run could not write its default user directory; only its cache/data/config locations were relocated to writable `/tmp` paths. No security settings changed.

## Game-specific original 3D cover scenes

Blender also generated **three actual modeled and lit dioramas** for Bomber, Miner and Breaker. These replace dated baked-text packaging on their menus/catalog cards; they are illustrations, not screenshots or a claim that the 2D gameplay became 3D.

- `tools/mobile-art/build_arcade_covers.py` recreates the three editable `*-diorama.blend` scenes; the original binaries remain in the full delivery patch
- `shared/mobile-art/{bomber,miner,breaker}-diorama.webp` (960×640; 80/65/54 KB)
- Cycles CPU, 160 max samples, adaptive sampling; original models/materials
- Iterated after inspecting rendered pixels: increased sampling, adjusted Miner camera twice to avoid a cut-off beam
- Runtime source and compression are reproducible; generated intermediate PNGs and Blender backups are ignored
- Existing Flappy/Thunder/Beat covers additionally compressed to WebP without changing their original artwork

Regenerate dioramas with `blender -b -t 2 --python tools/mobile-art/build_arcade_covers.py`, optionally `COVER=miner` to render only one scene. Then run the compression script above. Final contact sheet is `mobile-covers-preview.jpg`.


Production publishing includes all browser assets and full procedural authoring scripts. The four large editable Blender binaries are retained in the durable delivery patch rather than blocking the runtime release; the scripts regenerate them locally.
