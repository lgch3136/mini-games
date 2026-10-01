# 月影忍途 · 素材制作记录

2026-09-06。所有图片通过 Codex 内置 imagegen 生成（built-in mode），没有调用用户 API key、使用图片搜索素材或复制原作素材。下列为实际生成时的完整提示词。生成结果转成 WebP 后直接用于游戏，不是仅供宣传的概念图。

## moon-city.webp

```text
Use case: stylized-concept. Production asset: a wide 16:9 hand-painted distant background for an original premium side-scrolling 2.5D ninja action game. A spectacular but restrained moonlit Japanese-inspired coastal city at blue hour in light rain, layered slate blue tiled rooftops, thin amber window light, curved eaves and slender shrine towers in the distance, mountainous silhouettes and a pale ivory moon behind passing clouds. Sophisticated indigo / petrol blue atmosphere with copper-gold lantern accents, crisp architectural detail in middle distance, soft mist in far distance. Empty center-lower region behind the playable character should remain low contrast. Camera exactly side-on to a horizontal platforming game, not a road vanishing into the center; scenic panorama only, no playable platforms or foreground floor, no characters, no people, no closeup plants, no letters, no UI, no logo, no border. Polished painterly game art, cinematic depth, coherent light, not pixel art, not photorealistic. Image fills canvas.
```

## mist-temple.webp

```text
Use case: stylized-concept. Production asset for an original side-scrolling 2.5D ninja action platform game, scenic background only. Wide 16:9 premium hand-painted environment: ancient mountain monastery in mist at late twilight, tall blue-green stone cliffs, narrow waterfalls, tiered shrine roofs and a monumental distant copper temple gate, wind-swept pine silhouettes at the outer sides, silver fog across the middle valley and tiny amber shrine lanterns. Composed for side-view horizontal action: foreground and lower center are open low-contrast dark atmospheric space so real 3D platforms and characters can be added. Distant architecture lies above the middle horizon with layered depth; no road or path aiming toward the viewer. Rich painterly detail, cohesive teal slate and midnight green palette, a hint of pale apricot sky above the clouds. Elegant cinematic atmosphere, restrained contrast in the center, clearly different from a city rooftop scene. No people, characters, enemies, foreground platform, text, logos, interface, border, collage or watermark. Not pixel art, not photorealistic.
```

## castle-stone.webp

```text
Use case: stylized-concept. Production game texture, square seamless albedo material for the visible side walls of a 2.5D moonlit ninja platformer. Beautiful blue-grey aged Japanese castle masonry: orderly large rectangular stone blocks, restrained fine chisel marks, slight weathered edges, very thin recessed mortar seams, sparse subtle moss in crevices. Medium dark slate blue / desaturated teal-grey palette, no black holes, no busy cracks, no random rubble. Straight orthographic material scan, front-facing flat surface, evenly lit, no directional baked shadows, no perspective, no floor, no border, no characters, no text or objects. Clean premium stylized hand-painted stone texture, tile seamlessly on all sides, broad readable shapes and refined quiet detail; not pixel art, not noisy photorealism.
```

## Blender / 运行时

- `art/build_ninja.py`：Blender 4.5 LTS 后台生成脚本，构造忍者、守卫、首领三套原创分节模型，顶点色合并材质。
- `art/moonblade-cast.blend`：可编辑的三套静态造型源文件；动作由 `motion.mjs` 的姿态和 IK 在运行时驱动，不是预渲染动画或皮肤绑定。
- `assets/shinobi.glb`、`assets/warden.glb`、`assets/abbot.glb`：实际 Three.js 角色。
- 屋顶弧瓦、石墙、灯笼骨架、检查点小门与尖刺由 Three.js 实例化几何构建。
- 刀光、飞镖、飞行敌人、雨线与粒子由 Canvas2D 绘制，与三维相机共用投影。
- `assets/gameplay.webp`、`assets/gameplay-temple.webp`：正式游戏输入回放的实际屏幕截图，仅裁掉浏览器/测试工具栏并缩放，没有合成角色或补画效果。
- Three.js 使用仓库已有的 0.185.1 版本，MIT 许可证见 `../shared/vendor/three-0.185.1/LICENSE`。

原版参考仅限规则：跳跃、贴墙蹬跃、即时刀击和消耗忍力的副武器。没有使用商业游戏角色、音乐、关卡数据或 ROM 代码。
