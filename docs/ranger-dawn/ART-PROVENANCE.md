# Dawn Operations — asset provenance

Generated 2026-09-05 using the **built-in imagegen tool** (imagegen skill), not the external API fallback. New original scene artwork; no commercial game sprites or extracted ROM textures. The following are the exact prompts supplied. WebP conversion changes format/quality only. The ground renderer crops the upper 19 source pixels to align the visible lip with the physical surface.

## 1. Distant jungle research outpost

Production asset: `english-word-ranger/assets/dawn-outpost.webp`, 1536×1024, WebP quality 88.

Prompt:

> Create one original game background asset for a premium 2D side-scrolling action game, landscape panorama 3:2, maximum practical resolution. A lush abandoned tropical research outpost at dawn, distant stacked limestone cliffs and waterfalls, a few elegantly drawn retro-futuristic communications towers partly reclaimed by jungle, fine hanging vines, layered canopy, teal mist, warm honey sunlight streaming softly from upper left. Style: beautifully art-directed hand-painted 2D game background with crisp illustrative forms and delicate material shading, restrained atmospheric perspective, akin a lovingly painted adventure game, NOT pixelated, NOT blocky, NOT photorealistic, NOT a UI mockup. Pure side-view scenery: all details are distant scenery behind the gameplay. Upper 50 percent has airy pale teal sky and layered cliffs, lower half has shaded jungle and old research structures, quiet low-contrast center. Balanced warm ivory, desaturated jade, slate teal, small amber windows. The entire bottom edge is shadowy distant foliage; do NOT paint a playable ground, a walkway, foreground platforms, obstacles, characters, weapons, projectiles, text, borders or interface. No logos or watermarks. This image will scroll slowly behind sharply outlined gameplay objects; silhouettes and depth must read without visual noise. Deliver only the finished background image.

## 2. Moss and rock ground

Production asset: `english-word-ranger/assets/moss-rock.webp`, 1254×1254, WebP quality 87. The first generated asset was attached as a style/palette reference after visual inspection.

Prompt:

> Use the attached jungle game background only as the PALETTE AND PAINTING STYLE reference. Create a new ORIGINAL production game texture, not a landscape: a SQUARE, perfectly orthographic SIDE-VIEW cutaway of a mossy rocky jungle ground block, filling every edge, one flat straight horizontal playable surface EXACTLY at the top edge of the image. Tileable horizontally with matching left/right edges. The upper 5% is a thin continuous light warm olive grass/moss lip, illuminated at its upper rim; beneath it are beautifully hand-painted dark slate-jade sandstone ledges, organic irregular layered fractured rock, subtle roots reaching down through cracks, delicate material shading and stippling; slightly darker downward. Cohesive fine painterly detail matching the provided game scene. Moderately large geological forms so it still reads at 150-pixel height. Full-bleed texture: solid opaque material from top edge to bottom edge, NO sky, NO perspective top surface, NO grassy field, NO transparent margin, NO side border, NO discrete floating platform, NO trees, NO characters, NO UI, NO text, NO watermarks. Keep a clean absolutely level collision edge at the very top, no grass blades extending above the image. Avoid block/checkerboard repetition, avoid polygonal low-poly triangles, avoid photographic micro-noise. It will be used as a repeatable foreground ground texture in a 2D side-scrolling game.

## 3. Gameplay cover and UI evidence

`english-word-ranger/assets/dawn-gameplay.webp` is a screenshot of the real renderer during the normal-input boss encounter, not an imagegen illustration. `docs/ranger-dawn/mobile-*.webp` are responsive browser screenshots. These are compressed for repository size, not artistically edited.

Legacy art remains in the repository for history/rollback, but the rebuilt game does not load the previous atlases, cutout animations or cover. The stage geometry, articulated characters, projectiles and mechanical enemies are drawn at the real canvas resolution. There is no intentionally pixelated low-resolution intermediate buffer.
