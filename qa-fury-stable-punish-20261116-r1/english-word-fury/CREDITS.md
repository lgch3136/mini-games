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


## 普通截风波收招与足锚修订 r2（2026-11-08，待独立复验）
`lin-wave-planted-r2.png` 使用内置 imagegen 在本项目原二维图集上修订。原始图集、生成记录与编辑源仅保留于私有制作包。运行时只更换图集与位置登记信息，不拉伸、重画图片，也不改变战斗数值。第 23–41 帧保留张掌收势，实际动作结束后才回原直拳图集待机帧。其他动作及角色仍有未验收的旧模型。

## 赤绫原创造型候选（2026-11-03，本地未完成实机验收）

本候选重新编写赤绫的几何、材质及服装造型，包括紧凑面部、侧分束发、红黑短武服、护腕与薄底鞋。未使用第三方人物模型、照片、poteto 资产或外部贴图。原始 Blender 脚本与 .blend 保存在私有制作包。

运行文件仍叫 mei-rig-v3.glb 以兼容现有加载器，但其字节是本次原创替换；保留15身体节点和原可选飘带节点、原动作/肢段/判定，不是新蒙皮骨架。凌风、铁岳及原共享纹理未改。离线模型图不是实机截图，造型候选不代表整体格斗质量已达标。


## 铁岳原创造型候选（2026-11-04，未完成实机验收）

铁岳 shan-rig-v3.glb 的几何与配色为本项目原创程序化建模，更新短发、宽面、无袖琥珀背心、包裹前臂和薄底靴。未使用第三方角色、照片或模型素材。可编辑 Blender 工程与 build_shan.py 生成器保留在私有制作包。保留原 16 刚性节点、关节长度、动作与判定，凌风和赤绫模型不变。离线同姿态对照与 CPU 契约检查不能证明真实 WebGL、实战接触、音效或 FPS 已通过。既有旧动作中的低踢起落、后手后甩与翻滚姿态仍未更改。

本次恢复上述已存在原创替换，使用明确日期文件名防止同名v3误选。
