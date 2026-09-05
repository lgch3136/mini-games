# 🎮 英语小游戏合集（English Mini-Games）

边玩边学的网页小游戏合集，全部为纯静态页面，部署于 GitHub Pages：

🔗 在线游玩：https://lgch3136.github.io/mini-games/

## 游戏列表

| 游戏 | 玩法 | 入口 |
| --- | --- | --- |
| 单词突击队 · WORD RANGER | 曙光行动重制：跑跳射击、实体掩体、移动平台、三条编排路线、部件首领战与连续远征，词核提供补给 | [english-word-ranger](english-word-ranger/) |
| 🥊 单词斗魂 · WORD FURY | 原创街机格斗 × 单词连击，含破招、投技、格挡破防、斗气必杀与动态场地 | [english-word-fury](english-word-fury/) |
| 💣 英语炸弹人 · WORD BOMBER | 炸砖、躲敌、按序收集字母并开启传送门，无限轮次与道具成长 | [english-word-bomber](english-word-bomber/) |
| ⛏️ 英语挖金子 · WORD MINER | 摆动抓钩按序收字母，兼有石头、炸弹、钻石与限时挑战 | [english-word-miner](english-word-miner/) |
| 🧱 英语打砖块 · WORD BREAKER | 控制挡板弹球破砖，按序收字母，四种砖阵与每四砖必掉能力胶囊 | [english-word-breaker](english-word-breaker/) |
| 🚀 雷霆战机 · 英语风暴 | 2D 弹幕射击 × 背单词/练语法，击毁携带正确答案的敌机 | [english-thunder-fighter](english-thunder-fighter/) |
| 🐍 贪吃蛇背单词 · WORD SNAKE | 贪吃蛇 × 拼单词/选词填空，按顺序吃字母拼出单词 | [english-word-snake](english-word-snake/) |
| 🐦 飞鸟背单词 · FLAPPY WORDS | Flappy Bird × 拼单词/闯关选择，扇翅膀穿越管道，收集字母气泡或穿过正确答案门洞 | [english-flappy-word](english-flappy-word/) |
| 🏃 遗迹词途 · 风行远征 | 全新连续跑酷：即时换道、六档匀速、跳滑连击，庭院/悬桥/矿车三种环境 | [english-temple-dash](english-temple-dash/) |
| 🎵 英语节奏大师 · WORD BEAT | 4/5/7 轨同步节拍音击，用判定与连击完成单词 | [english-word-beat](english-word-beat/) |

游戏提供键盘与触屏操作、音乐/音效和静音；共用词库从 `paul-learn-english` 导入并去重，现有初级 597、中级 790、高级 942 个单词。单词突击队的强度分为友好、标准、硬核，并从项目词库筛选适合战斗中收集的短词。音频来源与许可证见 [AUDIO-LICENSES.md](AUDIO-LICENSES.md)。

2026-09-05：本轮仅重建了 **单词突击队** 的引擎、交互、场景和音频，其他游戏保留原版本。具体设计边界、复测方法与截图见 [重制验收记录](docs/ranger-dawn/README.md)。

## 目录结构

```
mini-games/
├── index.html                  # 合集首页
├── style.css
├── shared/                     # 共用 CC0 音频、播放器与 2329 词词库
├── scripts/                    # 词库导入脚本
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
