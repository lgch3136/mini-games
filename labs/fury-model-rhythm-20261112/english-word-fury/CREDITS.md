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
