# 深度移动游戏质量迭代

基于 2026-09-30 已发布的 `61ba37d`，本轮在 **15 款游戏**中改造真实玩法循环、难度公平性、学习/技巧反馈及移动布局。保留静态网页架构，没有擅自改成原生应用或提交 App Store。

## 从哪里看

- [验收门槛与逐款基线](QUALITY-GATES.md)
- [5 款轻街机：生成器、控制与成长](arcade.md)
- [5 款动作竞速：警告、训练与战斗回报](action.md)
- [5 款学习节奏：有终点的练习与计时反馈](learning.md)
- [实际 Blender / Godot 产物与可复现来源](ART.md)
- [浏览器验收工作台](../../tests/mobile-quality-browser.html)：390×844、320×568、844×390、桌面视口

## 额外共享修复

- 合集增加按玩法/投入方式筛选、名字搜索、最近打开的游戏；存储被禁用也能使用
- 搜索支持全角英文、多个关键词；没有结果时可一步清空筛选
- 手机触控控件尺寸、菜单安全区与缩放得到逐组修整，实际设备仍要核验
- Apex/Strike 修复 BFCache 在 `pagehide` 先于 `visibilitychange` 时恢复到静止“playing”的路径：返回后明确暂停，松开残留输入，重新布局；不会自动发声或推进世界
- 四枚 Blender 原创奖励奖章和 Godot 实际生成的出场曲线，按真实成绩显示；无新增运行引擎下载
- 炸弹人/矿工/打砖块有三张原创 Blender 场景插画，另外三张既有封面压缩传输；封面不冒充真实游戏截图
- 检查本地资源和模块引用，依赖更新会传播版本标记，避免新页面混用旧模拟模块

## 复现

```sh
node --test tests/*.test.mjs english-word-ranger/tests/*.test.mjs
node scripts/check-mobile-assets.mjs
node english-word-ranger/tests/playthrough.mjs 0 1 2 3 4 5
RANGER_TEST_WIDTH=540 node english-word-ranger/tests/playthrough.mjs 0 1 2 3 4 5
python3 -m http.server 4173 --bind 127.0.0.1
```

资源工具见 ART.md。截图工作台支持 `?game=english-word-miner&size=390x844` 等明确游戏/视口参数。

## 状态和边界

这是本地实现与可复现行为验证记录。**尚未取得这轮全部改后画面的浏览器验收，更没有 iPhone / Safari 实机验收，因此不声明所有游戏已经达到原生 iOS 成品水准。**

本环境 shell Chromium 在 socket 创建阶段被权限阻止，支持的云浏览器 localhost 被 `ERR_BLOCKED_BY_CLIENT` 拒绝。没有修改安全配置或绕过限制。独立公开预览须用户授权；正式入口不得由此轮本地改动自动覆盖。

现有线上手机宽度 iframe 已用于检查基线，能实际看到菜单/Canvas；改后的逐款开始、交互、暂停、失败、重试、旋转与成绩画面仍需在可访问预览中复核。WebGL 不可用时现在提供明确错误与返回入口，不能以错误页替代 3D 游戏验证。

最终测试快照见 VALIDATION.md；测试证明逻辑行为，不等同于真实设备帧率、触感、音频听感、电池或温度。
