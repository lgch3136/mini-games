# 原创素材与许可

全部新素材使用原生 image_gen 工具或本项目 Blender 脚本制作；没有使用 CLI/API 替代模型，也没有复制参考视频的图像、音乐或角色。

## 实际采用的 imagegen 资产

- `shared/first-person/assets/coast-sky.webp`，游戏中天空和环境反射；源图为 `exec-005b6460-560a-49c3-a8a0-b0a4bd368fe1.png`。导出 WebP 仅作编码转换。
- `shared/first-person/assets/concrete.webp`，射击场景建筑真实材质；源图为 `exec-c921637f-7ec3-4fa2-9330-a773e3c48a51.png`。

### 海岸环境提示词

Create an original production game asset: a seamless 360-degree equirectangular panorama, wide 2:1 aspect ratio, for the distant sky and mountain environment of a first-person coastal racing game. Elegant cinematic early morning, muted apricot gold sunrise at the left quarter, luminous powder blue upper sky with delicate high cirrus clouds. Layered blue-gray Mediterranean coastal mountains far away along the LOWER THIRD, distant calm ocean at the very bottom. The horizon must sit at exactly mid-height of the image; most mountain peaks remain below the horizontal middle, ample open clear sky overhead. All elements extremely distant, no nearby ground, no roads, no vehicles, no architecture, no lettering, no UI, no border, no watermark. Left/right edges visually match for wrapping around 360 degrees. Controlled realistic lighting with rich atmospheric depth, not a poster, no dramatic black silhouettes or saturated neon. This image will be mapped onto the sky in the actual 3D game, not used to fake a game screenshot.

### 建筑材质提示词

Original production video-game environment material. A perfectly flat orthographic seamless square albedo texture of weathered light gray industrial concrete facade with large subtle panel joints, finely porous cement, restrained worn muted blue-gray paint and hairline cracks, small pale mineral streaks. Sci-fi research station abandoned near a coast, elegant industrial architecture, plausible PBR base color. Diffuse evenly lit surface only, absolutely no directional shadows, no perspective, no room, no scene, no objects, no decorative bolts, no lettering, no UI, no border, no watermark. Medium-low visual contrast, not grungy noise; material detail should still read when mapped onto big 3D walls. Seamlessly tileable in both directions, avoid visible focal marks, clean microtexture.

## Blender / Web Audio / 第三方

`build_models.py` 生成 apex-car、pulse-rifle、ion-drone、crawler、sentry，全部原创硬表面模型，按材质合批。建模源文件与 glTF 均在 shared/first-person/assets。音乐音效均为原创程序合成，未引入需额外授权的歌曲。

Three.js 使用仓库已有 MIT 许可版本 0.185.1，许可证位于 shared/vendor/three-0.185.1/LICENSE。游戏合集卡片使用实际运行截图，不使用生成的假实机图。
