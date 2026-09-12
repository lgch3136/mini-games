# 键旅 · 绘本版美术来源

日期：2026-09-12。使用内置 image_gen 工具生成，未使用 CLI/API 备用路径，未使用商业游戏素材。每张图都是实际战斗背景，同时用于对应章节地图。

生成 PNG 保留在原目录，项目内采用 cwebp -q 84 编码为 1536×1024 WebP，没有修改画面内容。地面接触位置逐张目视标定，不直接把角色贴在同一高度的背景上。

| 场景 | 项目文件 | 原始 PNG |
| --- | --- | --- |
| 雾林 | letterwood-story.webp | /Users/liugancheng/.codex/generated_images/019ffb3e-28d9-7200-aecc-66d67ae642a4/exec-c121b838-1ed9-48b7-9f6a-16207dfecbd1.png |
| 潮汐藏书 | tide-library-story.webp | /Users/liugancheng/.codex/generated_images/019ffb3e-28d9-7200-aecc-66d67ae642a4/exec-90568c0e-8ce2-40d1-aeb0-b5efaf5f2f95.png |
| 曙光书塔 | sunrise-observatory-story.webp | /Users/liugancheng/.codex/generated_images/019ffb3e-28d9-7200-aecc-66d67ae642a4/exec-a51a7ca6-c079-4b4c-bc6b-535db4ed63a1.png |

角色、书灵、四类敌人、弹道、花朵、护盾为原创 Canvas 2D 程序绘制；不是生成的大图平移。角色采用分层绘制的脚、身体、头、围巾、手臂和书本，并由独立动画时钟连接姿势。音乐为原创 Web Audio 合成，三个章节各有旋律，连词加入和弦分解伴奏，不采用商业录音或旋律。

## 完整生成提示词

### letterwood

Use case: stylized-concept. Asset type: actual in-game 2D side-view typing adventure environment, landscape 1536x1024. Create an original premium charming storybook game background, clean hand-painted gouache shapes, softly beveled illustrated forms, subtle paper grain, inviting saturated colors with clear light and shade, not photorealistic and not pixel art. Composition: wide side-on theatrical scene, a perfectly continuous flat walkable stage across the entire width at 76% image height. The central 75% of the image is open breathing room for separately animated characters and magic. Detailed framing environment mostly at far edges and behind, no large foreground objects blocking the ground. Ground fills bottom 24%, smooth distinct lit surface, avoid noisy texture. No characters, creatures, letters, labels, UI, border, watermark or split panels. Camera fixed slightly above ground looking horizontally, no steep top-down perspective. Scene: A sunlit mint-green enchanted forest book garden, rounded old trees at the edges, little terracotta mushroom clusters at the ground edges, curved branches holding warm paper lanterns, an open ancient turquoise stone arch in the distant middle, soft peach sun rays and pale cream sky through leaves, emerald and sage foliage, warmly lit mossy sandstone walkway. Upbeat sense of beginning a friendly magical adventure. Ground contact exactly at 76% height.

### tide-library

Use case: stylized-concept. Asset type: actual in-game 2D side-view typing adventure environment, landscape 1536x1024. Create an original premium charming storybook game background, clean hand-painted gouache shapes, softly beveled illustrated forms, subtle paper grain, inviting saturated colors with clear light and shade, not photorealistic and not pixel art. Composition: wide side-on theatrical scene, a perfectly continuous flat walkable stage across the entire width at 76% image height. The central 75% of the image is open breathing room for separately animated characters and magic. Detailed framing environment mostly at far edges and behind, no large foreground objects blocking the ground. Ground fills bottom 24%, smooth distinct lit surface, avoid noisy texture. No characters, creatures, letters, labels, UI, border, watermark or split panels. Camera fixed slightly above ground looking horizontally, no steep top-down perspective. Scene: A luminous twilight tidal library courtyard, teal shallow water reflecting a lavender sky, elegant rounded aqueduct arches far in the distance, tall blue-purple book-tower silhouettes at the edges, cyan aquatic plants and shell-shaped lanterns confined to the edges, few floating book-shaped architectural islands in the sky. Flat side-on blue stone bridge across entire foreground, golden trim and reflected turquoise light. Periwinkle, cobalt, lilac and soft coral accents. Magical and inviting, not gloomy. Ground contact exactly at 76% height.

### sunrise-observatory

Use case: stylized-concept. Asset type: actual in-game 2D side-view typing adventure environment, landscape 1536x1024. Create an original premium charming storybook game background, clean hand-painted gouache shapes, softly beveled illustrated forms, subtle paper grain, inviting saturated colors with clear light and shade, not photorealistic and not pixel art. Composition: wide side-on theatrical scene, a perfectly continuous flat walkable stage across the entire width at 76% image height. The central 75% of the image is open breathing room for separately animated characters and magic. Detailed framing environment mostly at far edges and behind, no large foreground objects blocking the ground. Ground fills bottom 24%, smooth distinct lit surface, avoid noisy texture. No characters, creatures, letters, labels, UI, border, watermark or split panels. Camera fixed slightly above ground looking horizontally, no steep top-down perspective. Scene: A golden sunrise sky observatory high above a sea of peach clouds, rounded ivory towers with copper domes and hanging golden celestial rings at the far edges, a distant small sun glowing through a great circular gate, warm honey and coral light, deep plum shadow accents. Flat side-on ivory-and-coral stone terrace across full foreground, tiny golden leaf plants at edges. Light, hopeful grand finale of an enchanted book journey. Avoid busy stars everywhere. Ground contact exactly at 76% height.
