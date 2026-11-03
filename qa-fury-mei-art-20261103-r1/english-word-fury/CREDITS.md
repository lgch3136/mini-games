# Credits — Crosswind

- Original combat engine, animation pose data, models, UI and 132 BPM score: created for this project, 2026-09-05.
- Characters authored with Blender 4.5.13 LTS. Editable source and reproducible script in `art/`.
- 2026-09-06 v3 characters: tailored seams, cuffs, boot trim, sculpted jaw/nose and swept hair. Current editable source: `art/crosswind-fighters-v3.blend`.
- Shared garment jacquard: built-in imagegen, `assets/wind-jacquard-v3.jpg`; generation record in `../docs/fury-crosswind/textile-prompt.md`.
- Harbor backdrop: generated with the built-in imagegen tool. Prompt and use documented in `../docs/fury-crosswind/art-prompt.md`.
- Three.js 0.185.1 and GLTFLoader / BufferGeometryUtils / SkeletonUtils: MIT, © Three.js authors. License in `../shared/vendor/three-0.185.1/LICENSE`.
- Bounded Web Audio instrumentation base: the project's original Word Ranger Soundtrack class. Crosswind has its own original composition and combat effects.
- Vocabulary: original shared project wordbank `../shared/vocabulary.js`.

No KOF / TMNT character art, ROMs, music or extracted animation cels are distributed.

## 凌风人物动作样板 v4（2026-11-03，未完成真实试玩验收）
lin-rig-v4.glb 为本项目新编写的原创几何与材质；原始构建脚本和 .blend 存于私有制作包，不是第三方角色/皮肤。v4 保留刚性分段节点接口，未声称是完整蒙皮骨骼。新动作只路由凌风，其他两人沿用 v3。此样板未改格斗数值或存档；离线渲染仅用于造型/姿态检查。

动作样板 r2：修正凌风肩带接点与轻拳IK，原招式窗口/判定不变；这是离线姿态修订，不代表已完成实机对战验收。

凌风重脚姿态独立动作试玩 r2（2026-11-03）：原创分段姿态与支撑脚转向；降膝分离护手，沿用人物r2模型，未改判定或其余角色。仍偏前踢形态，不声称自然横扫。普通WebGL动作与实战接触未验。

## 赤绫原创造型候选（2026-11-03，本地未完成实机验收）

本候选重新编写赤绫的几何、材质及服装造型，包括紧凑面部、侧分束发、红黑短武服、护腕与薄底鞋。未使用第三方人物模型、照片、poteto 资产或外部贴图。原始 Blender 脚本与 .blend 保存在私有制作包。

运行文件仍叫 mei-rig-v3.glb 以兼容现有加载器，但其字节是本次原创替换；保留15身体节点和原可选飘带节点、原动作/肢段/判定，不是新蒙皮骨架。凌风、铁岳及原共享纹理未改。离线模型图不是实机截图，造型候选不代表整体格斗质量已达标。
