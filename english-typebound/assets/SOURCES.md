# 键旅素材来源

## 森林书庭

- 方式：Codex 内置 imagegen（非 CLI / API 回退）。
- 实际项目资源：`english-typebound/assets/letterwood.webp`，1672 × 941，原始生成结果等比例转码为 WebP，未改画面。
- 工作区绝对路径：`/Users/liugancheng/mini-games-review/english-typebound/assets/letterwood.webp`。
- 原始生成文件：`/Users/liugancheng/.codex/generated_images/019ffb3e-28d9-7200-aecc-66d67ae642a4/exec-a2a22139-666a-494b-9899-ad338a6db478.png`。原图保留，网页不依赖该路径。
- 无原视频截图、原作人物、标志或商业游戏贴图作为输入。

完整生成提示词：

> Use case: stylized-concept. Asset type: production background illustration for an original English typing roguelite game called TYPEBOUND, no text in the image. Primary request: a premium hand-painted storybook fantasy forest-ruin arena, wide landscape 16:9 composition. Scene: ancient overgrown library courtyard deep inside an emerald woodland, elegant ruined arches at the far sides, distant stone gate and misty forest in the center background. Warm honey sunlight descends from upper left, finely painted ferns and moss, amber fallen leaves, cool jade shadow, a few tiny firefly points. Low empty stone clearing extends horizontally across the lower half, designed to hold code-rendered characters at 24% and 76% width. Keep center and lower-middle quiet and dark enough for readable cream typography and glowing letter effects; intricate details primarily in the sides, not a busy middle. Camera: horizontal eye-level 2.5D stage with convincing layered depth, not top-down, not a screenshot. Style: sophisticated indie fantasy key art, exquisite material detail with controlled brush texture, strong coherent value grouping, richly colored but restrained. Environment only: no people, no creatures, no UI, no letters, no words, no symbols, no watermark, no huge foreground rocks blocking the stage. Crisp original art, usable as an actual game background.

## 程序画面与声音

`render.mjs` 的角色、书页、光线和粒子为本项目原创 Canvas 路径。`audio.mjs` 使用现有 Soundtrack 的有界声部管理，自行编写 86 BPM 配乐和按键 / 施法声音，不复用其乐曲旋律。无外部音频文件。

合集封面 `english-typebound/assets/gameplay.webp` 来自正式游戏 r5 的普通输入九关回放，第六关句子首领战。原生 1280 × 720 CSS 像素视口、DPR 2；仅裁掉顶部 42 CSS 像素验收工具栏，等比例缩小并转码 WebP。不是生成的场景示意图，也没有合成 UI 或改写成绩。

## 技术核对

输入事件按 [MDN beforeinput 文档](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event)同时处理可取消的 `beforeinput` 和后备 `input` 路径；按 [compositionstart 文档](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event)隔离输入法组词阶段。不将输入法候选字符计为打字错误。
