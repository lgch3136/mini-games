# 2026-09-28 · 轻量光效与原创封面

## 生成方式与用途

使用 Codex 内置 `image_gen`（built-in）生成，无外部 API 或抓取的商业游戏素材。四张封面是原创概念封面，不是实机截图；游戏本体仍以清晰、轻量的几何画面为主。

从回响边界与卡丁车封面派生了一张真正透明的柔光贴图，分别用于键旅输入光点、回响边界碰撞回响、卡丁车漂移/喷射轮边光和零界突围命中/蓄力/中继光。没有将大幅封面直接覆盖到可玩画面。

封面从 1536 × 1024 压缩为 960 × 640 WebP（q86）；柔光从 1280 × 1280 缩为 256 × 256 WebP（保留 alpha，q86）。仅做尺寸与编码转换，原生图完整保留。

## 文件

- typebound：[项目素材](../../english-typebound/assets/cover-light-20260928.webp)
- echo：[项目素材](../../english-echo-ring/assets/cover-light-20260928.webp)
- apex：[项目素材](../../english-apex-drive/assets/cover-light-20260928.webp)
- strike：[项目素材](../../english-signal-strike/assets/cover-light-20260928.webp)
- halo：[项目素材](../../shared/light/assets/halo-20260928.webp)

原生 PNG 保存在本地生成记录中，不随网站发布；仓库包含游戏实际使用的压缩素材和下面的完整生成提示词。

## 完整提示词

### typebound

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover for an actual minimalist English typing game named Typebound (do not render any title). Show a single luminous mint comet moving along an elegant curved ribbon of light across a midnight teal space; a small handful of ivory keyboard keycaps, A S D, are floating along the path like stepping stones, with one pressed key emitting an amber wave. The subject is focused rhythmic typing, not a fantasy character. Premium restrained abstract game art, smooth elastic light, satin material, rich dark negative space, sophisticated turquoise and warm cream palette. Readable at thumbnail size. No people, no cartoon character, no UI metrics, no typography other than the 3 keycap letters, no logo, no watermark, no noisy particle cloud. This design will guide the actual in-game light trails.
```

### echo

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover for minimalist arcade game Echo Ring, no title text. Near top-down view of one fine luminous mint circular membrane in a deep midnight navy void, internally filled with a delicately warped flexible wire grid. One tiny clear triangular mint ship just inside the rim; a few gold and cyan light paths reflect across the circular space with a soft local ripple at impact. Premium restrained interactive-installation quality, razor-clear small silhouettes and silky light falloff. The circle is the principal form; actual gameplay uses simple geometry. No spaceship illustration, no busy galaxy, no lens-flare streak across whole scene, no text, no logos, no watermark.
```

### apex

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover for cute original arcade kart game Mochi Rally, no title text. An original small cream bunny driving a squat rounded mint kart with four dark rounded tyres drifts around a smooth coastal asphalt hairpin. Two tasteful pastel cyan tyre glints and short warm gold turbo trails emphasize the drifting movement. Stylized matte 3D toy aesthetic, peach sky, mint sea, ivory railings, soft lilac distant hills, bright gentle late-afternoon light, clean readable silhouette and smooth curves. Match a lightweight 3D game built from rounded geometry, do not exaggerate into photorealism. Full kart visible, bunny ears in frame, no franchise characters, no text, no UI, no watermark.
```

### strike

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover for original first-person robot action game Signal Strike, no title text. First-person view of a compact ivory and graphite pulse rifle in lower right aimed into a clean geometric coastal sci-fi relay courtyard. A few small hovering mechanical sentries ahead, one cyan relay beacon, warm amber sunset shafts and mint-cyan strip lights reflected subtly on slate ground. Premium stylized low-poly architectural art, broad simple coherent shapes, controlled luminous accents, clear combat sightlines, deep teal and sandstone materials. Not a photorealistic war scene. No humans, no blood, no lettering, no UI, no text, no watermark. The scene must be achievable by a lightweight real-time 3D browser game.
```

### halo（派生透明素材）

参考图：上列 echo、apex 原生封面。

```text
Use case: precise-object-edit. Asset type: one reusable transparent game VFX sprite derived from the restrained optical glow in the reference covers. Input images are style references only, not backgrounds to keep. Generate one centered circular soft luminous pearl-white halo with an ivory core, a broad very faint mint outer aureole and extremely subtle concentric optical ripples. The core must occupy only 12 percent of the square; all light must fade smoothly to fully transparent well before every image edge, leaving at least 15 percent fully transparent margin. This is a compositable glow texture for projectile hits, typing pulses and tyre/engine light, tinted at runtime. Symmetric, soft continuous falloff, high quality antialiased translucent light. No surrounding scene, no objects, no star points, no long streaks, no black or checkerboard background, no text, no multiple sprites. Actual alpha transparency.
```
