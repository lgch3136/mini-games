# 单词斗魂 · 截风擂台

2026-09-05。本轮重建格斗游戏，不修改已重制的跑酷、突击队或其他游戏。

## 制作与运行

- Blender 4.5.13 LTS：程序化创建三名原创角色的实体网格、服装、面部、肘膝关节和具名分段控制结构。源文件 `english-word-fury/art/crosswind-fighters.blend` 可继续编辑；生成脚本为同目录 `build_fighters.py`。
- 导出三个 GLB（约 260–290 KB / 人），运行时通过 Three.js WebGL 加载。模型不是渲染成图片再贴回画面，也不需要玩家安装 Blender。
- 这是**刚性分段关节模型**，不是一套蒙皮变形 / 动捕角色库。两段 IK 维持肢体长度，动作关键姿势由战斗帧表驱动；物理 60 Hz，显示位置与关节姿势插值。
- 固定 16:9、固定世界距离，手机只缩放视图，不改变移动速度、攻击范围或碰撞盒。无强制屏幕震动、动态缩放或全屏命中闪光。
- imagegen 内置工具生成统一暮港背景；实际保存为 `english-word-fury/assets/harbor-dusk-v2.webp`。生成提示见 [art-prompt.md](art-prompt.md)。角色、招式、命中表现由代码和 Blender 资产实现。
- 本地依赖 Three.js 0.185.1 与其 MIT 许可 GLTF 加载工具。没有远程 JS CDN 或第三方游戏模型依赖。

Blender 重建示例（把可执行文件路径换成自己的安装路径）：

```sh
Blender --background --threads 2 --python english-word-fury/art/build_fighters.py
```

## 玩法与动作规范

- 三局两胜、街机连战、无限体力练习、本地双人；三名角色有移动、伤害和部分招式帧数 / 距离差异。
- 四键轻重拳脚、站蹲普通技、短跳 / 大跳、空中攻击、双击奔跑 / 后撤、回避、抓投 / 拆投。
- 后方向防上中段，后下防下段；下段击穿站防，劈挂和跳入击穿蹲防。防御消耗 guard，打空重招存在明确收招。
- 命中或被挡后才开放取消窗口：轻拳 → 重拳 → 气波。保留伤害递减、计数、受击硬直与短暂角色命中停顿。
- 支持方向指令与快捷键：气波 / 对空 / 突进 / 一格奥义；防御取消消耗一格。未满足能量或状态条件的招式不会硬插入。
- 按攻击瞬间锁存方向；不要求方向持续到下一帧。跳跃在同一帧内按下松开也识别为短跳。
- AI 使用已经发生的对战状态进行延迟决策，按距离处理逼近、牵制、对空、波动与投技，不直接读取尚未执行的玩家输入。
- 拼词使用原项目词库，按纯英文 3–10 字母去重后为 2,159 个词。每次有效命中推进，整词完成补充少量能量；可在菜单关闭，不在交战中弹问答框打断。

## 参考与边界

1. [SNK 官方 KOF ’97 页面](https://www.snk-corp.co.jp/us/games/kof-portal/series/97/)：版本与系统背景。
2. [用户提供的 KOF97 逆向项目 Action.s](https://github.com/luxiaoming/kof97react/blob/master/src/Action.s)：检查了动作持续时间、判定、声音、位移、取消标志分离的结构。这个项目是 M68K 汇编重建，**不是 React 网页游戏**。未复制 ROM、美术、音轨或汇编代码。
3. [Konami NES《Tournament Fighters》原说明书扫描](https://www.retrogames.cz/manualy/NES/TMNT-Tournament_Fighters_-_NES.pdf)：作为双键 / 方向攻防语境的参考，不混用 SNES、Mega Drive 和 NES 三个不同版本的数据。
4. [Meng To 的 Three.js / Blender 案例](https://x.com/MengTo/status/2096213835460084184)：在内置浏览器读到了原帖与嵌入视频。原帖说明实时游戏用程序化 Three.js，之后在 Blender 重建场景制作预告。本作采用 Blender → GLB → 实时动作的资产链，未把预渲染画面冒充实时游戏。
5. [Blender glTF 导出文档](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)：参考模型层级、材质和 glTF 导出流程。

本作是原创格斗游戏的重建，不是 KOF ’97 / 激龟快打 ROM 移植；数值为本作编排，不声称是原版逐帧数据。测试通过证明本轮约束成立，不代表已经达到经典商业游戏的内容量或人工动画完成度。

## 回归

```sh
node --test tests/fury-combat.test.mjs
python3 -m http.server 4173 --bind 127.0.0.1
```

浏览器打开 `tests/fury-browser.html`，可点击“操作回归”“60 秒交战”“停止 / 释放”。脚本只调用正式页面 UI 和键盘 / 触屏事件，读取诊断，不直接改世界位置、血量或 AI 状态。战斗单测是独立纯逻辑测试，允许构造受控状态；二者不可混淆。

正式页面只暴露只读 `furyDiagnostics()`，没有自测快捷改血 / 无敌后门。性能与检查记录见 [browser-results.md](browser-results.md)。

## 资源策略

暂停、出招表、退出、失焦、后台隐藏均停止 RAF、音乐定时器并清理活动音源。页面离开时关闭 AudioContext、释放模型几何体 / 材质 / 阴影纹理 / WebGL renderer。渲染 DPR 上限 1.5；两位角色共约 16K 三角形，89 次 draw call；特效最多 36 项，同屏投射物通常不超过 2 个。

Blender 只用于离线制作，不随游戏启动。测试不使用无头 Chrome / Playwright 浏览器进程。
