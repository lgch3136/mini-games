# 🎮 英语小游戏合集（English Mini-Games）

边玩边学的网页小游戏合集，全部为纯静态页面，部署于 GitHub Pages：

🔗 在线游玩：https://lgch3136.github.io/mini-games/

## 游戏列表

| 游戏 | 玩法 | 入口 |
| --- | --- | --- |
| 🚀 雷霆战机 · 英语风暴 | 2D 弹幕射击 × 背单词/练语法，击毁携带正确答案的敌机 | [english-thunder-fighter](english-thunder-fighter/) |
| 🐍 贪吃蛇背单词 · WORD SNAKE | 贪吃蛇 × 拼单词/选词填空，按顺序吃字母拼出单词 | [english-word-snake](english-word-snake/) |
| 🐦 飞鸟背单词 · FLAPPY WORDS | Flappy Bird × 拼单词/闯关选择，扇翅膀穿越管道，收集字母气泡或穿过正确答案门洞 | [english-flappy-word](english-flappy-word/) |

三款游戏均支持：初中高三档难度、键盘 + 触屏操作、音效、最高分记录（localStorage）。

## 目录结构

```
mini-games/
├── index.html                  # 合集首页
├── style.css
├── english-thunder-fighter/    # 雷霆战机（自包含：index.html + css + js + assets）
├── english-word-snake/         # 贪吃蛇背单词（同上）
└── english-flappy-word/        # 飞鸟背单词（同上）
```

## 添加新游戏

1. 新建一个自包含的文件夹（HTML/CSS/JS 相对路径引用，不依赖构建工具）
2. 在首页 `index.html` 的 `.cards` 中加一张卡片
3. 提交推送，GitHub Pages 自动部署

## 开发

本地直接双击各游戏的 `index.html` 即可游玩；`?selftest` / `?fuzz` URL 参数可触发内置自检与模糊测试（供无头浏览器测试使用）。
