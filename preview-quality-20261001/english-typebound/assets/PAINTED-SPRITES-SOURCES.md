# Typebound production sprite provenance — 2026-10-01

These seven transparent sprites are actual gameplay assets, not covers or result
medals. Created with the built-in image-generation tool. Its underlying model
version was not exposed by this tool, so no specific model or Blender claim is
made. No commercial character assets were used.

The same existing `letterwood-story.webp` was supplied as the style and lighting
reference for every first-pose asset. The casting pose used the generated
traveller as its edit reference. Each asset was generated separately.

## Delivery and processing

PNG originals remain under `/workspace/scratch/bd2a74888cd3/generated_images/`.
The runtime WebPs in this directory are alpha-preserving proportional resizes
(maximum edge 768 px), encoded at WebP quality 92. No manual background removal,
painting, texture substitution or backdrop baking was performed. The original
transparent alpha comes from the image tool. Runtime source rectangles trim
transparent padding without changing material pixels.

| Runtime asset | Generated PNG |
| --- | --- |
| traveller-painted-20261001.webp | exec-b0d87427-9e6a-4cd9-b16d-124675a40934.png |
| traveller-cast-painted-20261001.webp | exec-0dfc6ef8-619a-4468-9617-21cb56e151ab.png |
| wisp-painted-20261001.webp | exec-04b80a63-f089-4af0-b697-d54c4c971381.png |
| moth-painted-20261001.webp | exec-011a60e9-1d01-4f17-9c62-72410df793d6.png |
| sentinel-painted-20261001.webp | exec-29afc20e-eea3-4264-ba18-df41e399a629.png |
| boss-painted-20261001.webp | exec-d6b7176e-6e51-41d0-82b4-776761678a62.png |
| book-painted-20261001.webp | exec-d28167e4-c289-4a45-99b7-57cb4207e6b5.png |

## Runtime integration

`painted-rigs.mjs` owns calibrated crop, foot-pivot and book-launch coordinates.
The standing and casting poses switch on the actual word event; the projectile
launch point switches at the same instant. Accepted input drives page release,
word flights, impact recoil and collected-word feedback. Breathing is a small
foot-anchored deformation; silhouettes are not large images sliding across the
screen. Soft contact shadows are drawn separately on the calibrated ground.
Reduced motion preserves distinct cast/progress states with spatial movement
removed. The older procedural rigs are retained only as asset-failure fallback.

Seven sprites total 837,022 bytes. All runtime WebPs have an alpha channel.
`tests/quality2-typebound-world.test.mjs` checks actual draw-image use, alpha,
pose/launch alignment, bounded resource pools and ordinary gameplay.
`tests/quality2-typebound-render-preview.mjs` produces actual renderer PNGs via
@napi-rs/canvas. These are not browser or DOM-layout screenshots.

## Exact prompts

### Traveller

Use case: illustration-story. Asset type: production transparent gameplay sprite for a side-view English typing adventure. Reference image is STYLE AND LIGHTING ONLY, do not include its scenery in output. Create ONE full-body young adult scholarly traveller facing right in three-quarter side view, standing on two firmly planted leather boots, hooded deep teal layered linen cloak, muted amber scarf, little worn leather satchel. They hold an open small ivory book forward at chest height in both hands, book on image right, curious determined face. Match the reference's exquisite painted gouache material shading, softly sculpted volume, warm sun from upper left, cool jade reflected shadow, fine colored edges, painterly brush texture. No heavy black outlines, no flat vector shapes, no sticker border, no cute oversized head. Head-to-body ratio 1:4. Clear gameplay silhouette, restrained page glow only. Full body and book fit with generous transparent margin all sides, feet on one horizontal baseline near bottom. True transparent background, no floor, no scenery, no shadow baked outside silhouette, no UI or text or labels. Original character, polished premium 2.5D storybook game art.

### Shared opponent/reading-stand prompt wrapper

Use case: illustration-story. Asset type: ONE production transparent gameplay sprite for an original 2.5D storybook adventure. Reference is STYLE AND LIGHTING ONLY; do not reproduce its background. Subject: [insert exact subject below] Style: exquisite painterly gouache with detailed material shading, softly sculpted 3D volume, warm sunlight from upper left and cool jade reflected shadows, fine colored painted edges, matching the reference fantasy forest. Preserve texture and coherent midtone shading at small gameplay size. Constraints: isolated object on TRUE fully transparent background; clean silhouette alpha, no halo, no bloom, no atmospheric haze, no ground patch, no cast shadow outside the object, no scenery, no black outline, no sticker border, no flat vector shapes, no UI, no labels, no watermark. Generous transparent margin on all sides. This sprite will be animated and composited into the exact painted forest reference.

#### Wisp subject

ONE enchanted ink-spirit opponent, a rounded floating purple-blue creature formed from layered wispy parchment and ink, slightly mischievous luminous cream eyes, tiny two-point parchment crown, facing LEFT in three-quarter view. Softly sculpted body volume with plum shadow and lavender highlight; paper-like irregular torn folds at its lower edge. No arms, no legs, no human body. Fits comfortably inside square composition.

#### Moth subject

ONE enchanted library moth opponent facing LEFT in three-quarter side view. A small pale jade furry body, four beautiful layered translucent parchment wings with ivory and turquoise veining, little amber eyes, elegant curled antennae. Broad butterfly-like silhouette with wings partly lifted, finely shaded paper and velvet material; restrained turquoise and cream with plum shadows. Fits comfortably inside square composition.

#### Sentinel subject

ONE mossy sandstone library sentinel opponent facing LEFT in three-quarter side view, full body including feet on a single ground baseline. Ancient small golem with blocky but rounded carved sandstone armor, moss in joints, turquoise patinated metal trims, two pale jade lit eyes in a visor, no weapon. Clearly shaded volumetric forms with honey lit stone on upper left and cool green shadows. Proportions roughly 3.5 heads tall, stocky but dignified.

#### Owl subject

ONE majestic small owl librarian guardian opponent facing LEFT in three-quarter side view. Full body on two taloned feet with feet on a common baseline. Tawny cream and chestnut feathers, layered hand-painted feather clumps, amber intelligent eyes, ivory facial discs, restrained worn gold crescent crown and dark teal shoulder mantle. Wings folded but slightly raised in alert posture. Strong readable pear-shaped silhouette, sculpted shaded volume, not flat icon.

#### Reading stand subject

ONE open magical ivory storybook resting on a small carved weathered wooden reading stand, viewed from the side in three-quarter perspective, facing diagonally LEFT. A real physical reading stand with central support and wide stable two-foot base, an appropriately modest open book with thick softly curled cream pages and deep teal embossed leather cover, brass corners, no legible letters or text. Warm sunlit left edges, sage shadows, polished illustrated wood grain. Object should feel precious, grounded and gently inviting. Full object including base, not huge oversized pages.

### Casting pose

Create a SECOND ANIMATION POSE of the exact provided full-body young adult teal-cloaked scholarly traveller game sprite. Preserve identity, face, hair, body proportions, cloak and scarf design, satchel, textures, painted gouache finish, warm upper-left lighting and the same full-body scale and camera angle. Change ONLY the pose: the traveller is releasing a spell from the open book, leaning slightly forward to the RIGHT with determined expression, the book held forward and slightly higher by both hands at chest height, front boot a small half-step ahead, cloak and amber scarf following the gesture. Keep book normal sized; do not add magic effects, particles, trails, scenery, or symbols, because runtime will draw those. Full character and boots visible, generous margin all sides. TRUE transparent background; no halo, no vignette, no ground, no cast shadow, no text. Exactly one clean production animation sprite.
