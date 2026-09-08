# 🎮 英语小游戏合集（English Mini-Games）

边玩边学的网页小游戏合集，全部为纯静态页面，部署于 GitHub Pages：

🔗 在线游玩：https://lgch3136.github.io/mini-games/

## 游戏列表

| 游戏 | 玩法 | 入口 |
| --- | --- | --- |
| 键旅 · TYPEBOUND | 英文打字施法：三章九关、路线与遗物、句子首领及错词回练 | [english-typebound](english-typebound/) |
| 回响边界 · ECHO RING | 极简向心射击：危险回弹、连续涟漪、穿行擦弹与连击共鸣 | [english-echo-ring](english-echo-ring/) |
| 团团卡丁 · APEX DRIVE | 萌系兔兔卡丁车；Shift 时长控制轨迹、点油门小喷、连喷 / 断位、双槽道具；三赛道与五位对手 | [english-apex-drive](english-apex-drive/) |
| 零界突围 · SIGNAL STRIKE | 第一人称城市突围：双武器、掩体、突进、三座中继与核心守卫 | [english-signal-strike](english-signal-strike/) |
| 月影忍途 · MOONBLADE | 原创单人 2.5D 忍者闯关：三章路线、贴墙蹬跃、三段连斩、疾步、忍术与两阶段首领 | [english-moonblade](english-moonblade/) |
| 单词突击队 · WORD RANGER | 曙光行动重制：跑跳射击、实体掩体、移动平台、三条编排路线、部件首领战与连续远征，词核提供补给 | [english-word-ranger](english-word-ranger/) |
| 🥊 单词斗魂 · 截风擂台 | Blender 角色 / 连续关节动作 / 四键轻重攻击 / 短跳与指令 / 命中确认 / 三局两胜 / 练习与双人 | [english-word-fury](english-word-fury/) |
| 💣 英语炸弹人 · WORD BOMBER | 炸砖、躲敌、按序收集字母并开启传送门，无限轮次与道具成长 | [english-word-bomber](english-word-bomber/) |
| ⛏️ 英语挖金子 · WORD MINER | 摆动抓钩按序收字母，兼有石头、炸弹、钻石与限时挑战 | [english-word-miner](english-word-miner/) |
| 🧱 英语打砖块 · WORD BREAKER | 控制挡板弹球破砖，按序收字母，四种砖阵与每四砖必掉能力胶囊 | [english-word-breaker](english-word-breaker/) |
| 🚀 雷霆战机 · 英语风暴 | 2D 弹幕射击 × 背单词/练语法，击毁携带正确答案的敌机 | [english-thunder-fighter](english-thunder-fighter/) |
| 🐍 贪吃蛇背单词 · WORD SNAKE | 贪吃蛇 × 拼单词/选词填空，按顺序吃字母拼出单词 | [english-word-snake](english-word-snake/) |
| 🐦 飞鸟背单词 · FLAPPY WORDS | Flappy Bird × 拼单词/闯关选择，扇翅膀穿越管道，收集字母气泡或穿过正确答案门洞 | [english-flappy-word](english-flappy-word/) |
| 🛼 遗迹词途 · 音速远征 | Three.js 线性 3D 跑道：完整钢琴曲、按拍跳闪、组合键、长条、40 连击胶囊；保留自由跑酷 | [english-temple-dash](english-temple-dash/) |
| 🎵 英语节奏大师 · WORD BEAT | 4/5/7 轨同步节拍音击，用判定与连击完成单词 | [english-word-beat](english-word-beat/) |

游戏提供键盘与触屏操作、音乐/音效和静音；共用词库从 `paul-learn-english` 导入并去重，现有初级 597、中级 790、高级 942 个单词。单词突击队的强度分为友好、标准、硬核，并从项目词库筛选适合战斗中收集的短词。音频来源与许可证见 [AUDIO-LICENSES.md](AUDIO-LICENSES.md)。

2026-09-06：新增 **键旅 / Typebound**，以英文打字施法、路线抉择与遗物成长组成三章九关，支持完整句子首领、静心练习与错词回练。使用原创森林环境、连续 Canvas 角色和轻量合成配乐。设计、操作及验证边界见 [键旅](english-typebound/README.md)。

2026-09-06：新增 **回响边界 / Echo Ring**，以简单向心射击与危险回弹为核心，使用轻量 Canvas 2D、连续波纹、穿行、擦弹与连击共鸣；不插入学习弹窗。设计与实机验收见 [回响边界](english-echo-ring/README.md)。

2026-09-08：**破晓疾驰 · Drift Rally** 更新竞速 / 道具双模式、三阶漂移小喷、独立氮气、自动油门与双视角；设计对照和真实输入验收见 [Drift Rally](docs/first-person/RALLY-QA.md)。

2026-09-06：新增两款第一人称游戏 **破晓疾驰 / 零界突围**，使用 Three.js、原创 Blender 模型和 imagegen 环境材质，支持键鼠与多指触屏；验收入口和素材说明见 [First Light](docs/first-person/README.md)。

2026-09-06：新增独立游戏 **月影忍途**，不替换原有游戏。设计边界、素材来源、操作和实机验收见 [月影忍途说明](english-moonblade/README.md)。

2026-09-05：单词突击队的引擎、交互、场景和音频重建，具体设计边界、复测方法与截图见 [重制验收记录](docs/ranger-dawn/README.md)。

## 目录结构

```
mini-games/
├── index.html                  # 合集首页
├── style.css
├── shared/                     # 共用 CC0 音频、播放器与 2329 词词库
├── scripts/                    # 词库导入脚本
├── english-typebound/          # 键旅 · 英文打字冒险
├── english-echo-ring/          # 回响边界 · 向心射击与波纹
├── english-apex-drive/         # 团团卡丁 · 漂移连喷 / 道具乱斗
├── english-signal-strike/      # 零界突围 · 第一人称射击
├── english-moonblade/          # 月影忍途 · 单人 2.5D 忍者闯关
├── english-word-ranger/        # 单词突击队
├── english-word-fury/          # 单词斗魂
├── english-word-bomber/        # 英语炸弹人
├── english-word-miner/         # 英语挖金子
├── english-word-breaker/       # 英语打砖块
├── english-temple-dash/        # 遗迹词途
├── english-thunder-fighter/    # 雷霆战机
├── english-word-snake/         # 贪吃蛇背单词
├── english-flappy-word/        # 飞鸟背单词
└── english-word-beat/          # 英语节奏大师
```

## 添加新游戏

1. 新建游戏文件夹（HTML/CSS/JS 相对路径引用，不依赖构建工具）
2. 在首页 `index.html` 的 `.grid` 中加一张卡片
3. 提交推送，GitHub Pages 自动部署

## 开发

在仓库目录运行静态服务器：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

访问 `http://127.0.0.1:4173/`。单词突击队使用原生 ES Modules，不能直接以 `file://` 双击运行，无需安装 npm 依赖。

```sh
node --test english-word-ranger/tests/engine.test.mjs
node english-word-ranger/tests/playthrough.mjs 0 1 2 3 6 9
RANGER_TEST_WIDTH=540 node english-word-ranger/tests/playthrough.mjs
```

浏览器检查入口：`english-word-ranger/tests/ui.html`（正式页面输入与资源释放）和 `english-word-ranger/tests/playback.html`（正常输入实时回放、暂停、单步）。后者不是正式游戏的自动游玩模式。检查结束后关闭测试标签页并停止服务器。其余旧游戏仍保留各自的 `?selftest` / `?fuzz` 参数，本轮未重新验收。
