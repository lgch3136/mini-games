# 🎮 英语小游戏合集（English Mini-Games）

边玩边学的网页小游戏合集，全部为纯静态页面，部署于 GitHub Pages：

🔗 在线游玩：https://lgch3136.github.io/mini-games/

## 游戏列表

| 游戏 | 玩法 | 入口 |
| --- | --- | --- |
| 单词突击队 · WORD RANGER | 原创无限横版跑跳射击 × 拼单词，动态地形、天气、敌群与区域守卫循环升级 | [english-word-ranger](english-word-ranger/) |
| 💣 英语炸弹人 · WORD BOMBER | 炸砖、躲敌、按序收集字母并开启传送门，无限轮次与道具成长 | [english-word-bomber](english-word-bomber/) |
| ⛏️ 英语挖金子 · WORD MINER | 摆动抓钩按序收字母，兼有石头、炸弹、钻石与限时挑战 | [english-word-miner](english-word-miner/) |
| 🧱 英语打砖块 · WORD BREAKER | 控制挡板弹球破砖，按序收字母，四种砖阵与每四砖必掉能力胶囊 | [english-word-breaker](english-word-breaker/) |
| 🚀 雷霆战机 · 英语风暴 | 2D 弹幕射击 × 背单词/练语法，击毁携带正确答案的敌机 | [english-thunder-fighter](english-thunder-fighter/) |
| 🐍 贪吃蛇背单词 · WORD SNAKE | 贪吃蛇 × 拼单词/选词填空，按顺序吃字母拼出单词 | [english-word-snake](english-word-snake/) |
| 🐦 飞鸟背单词 · FLAPPY WORDS | Flappy Bird × 拼单词/闯关选择，扇翅膀穿越管道，收集字母气泡或穿过正确答案门洞 | [english-flappy-word](english-flappy-word/) |
| 🏃 遗迹词途 · TEMPLE DASH | 三线无限跑酷，直线预判换道，十二种机关编排与四座遗迹轮换 | [english-temple-dash](english-temple-dash/) |
| 🎵 英语节奏大师 · WORD BEAT | 4/5/7 轨同步节拍音击，用判定与连击完成单词 | [english-word-beat](english-word-beat/) |

九款游戏均支持初中高三档难度、键盘与触屏操作、音乐/音效和静音；共用词库从 `paul-learn-english` 导入并去重，现有初级 597、中级 790、高级 942 个单词。音频来源与许可证见 [AUDIO-LICENSES.md](AUDIO-LICENSES.md)。

## 目录结构

```
mini-games/
├── index.html                  # 合集首页
├── style.css
├── shared/                     # 共用 CC0 音频、播放器与 2329 词词库
├── scripts/                    # 词库导入脚本
├── english-word-ranger/        # 单词突击队
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

本地直接双击各游戏的 `index.html` 即可游玩；`?selftest` / `?fuzz` URL 参数可触发内置自检与模糊测试（供无头浏览器测试使用）。
