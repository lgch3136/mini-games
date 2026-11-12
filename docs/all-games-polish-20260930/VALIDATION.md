# 验证记录

运行环境：本次云工作区 Node.js v24.19.0；不是真实 GPU 性能测试。

## 最终检查

- 全仓与 Ranger：`node --test tests/*.test.mjs english-word-ranger/tests/*.test.mjs`，**469 / 469 通过**
- 新全游戏测试：街机组 25、动作竞速组 13、节奏学习组 12、共享/Echo/Ranger 渲染组 9，合计 59
- 原有五款街机 `?selftest` 用三个固定随机种子在 Node DOM/Canvas fixture 中执行；Word Beat 40 个内置谱面检查通过
- Ranger 标准生命值正常输入模拟通关 **14 / 14**：960 世界宽度行动 0/1/2/3/4/5/6/9；540 宽度行动 0/1/2/3/4/5
- 16 个 HTML 入口（15 款游戏 + 合集）与 192 个本地 HTML/module 资源引用检查通过
- 所有改动 JavaScript 的 `node --check` 及 `git diff --check` 通过
- 完整测试日志随交付包提供

## 可复现的工作量减少

以下来自实际生产函数的 Node/Three.js/Canvas fixture，表示计算与更新次数，不是 FPS 或 GPU 驱动测量。

| 对象 / 固定场景 | 原工作量 | 本轮工作量 | 复现入口 |
| --- | --- | --- | --- |
| Typebound 一帧脉冲轨 | 273 波形采样、24 描边调用 | 91 采样、4 描边调用 | journey-polish 测试 |
| Snake N 点蛇身包裹绘制 | 9N 临时点对象、45 临时数组 | 原轨迹 + Canvas 平移，不复制这些对象/数组 | journey-polish 测试 |
| Temple 64 实例容量、3 个活动 | 后续全容量上传 4,864 字节 | 活动范围 228 字节 | journey-polish 测试 |
| Word Beat 10,000 音符 | 逐帧全谱扫描 | 当前绘制候选 <40，含旧长音尾 | journey-polish 测试 |
| Word Beat 100 次未变 HUD | 重建词条节点 | 无新增词条节点替换 | journey-polish 测试 |
| Fury 144 次刷新 / 60 次模拟 | 288 次姿势端点求解 | 120，姿势插值结果相同 | adventure-polish 测试 |
| Apex 360 次 HUD 刷新 | 每次重走静态路线 | 按赛道构建一次缓存 | adventure-polish 测试 |
| Apex 96 火花容量、4 个活动 | 1,536 矩阵分量 | 64 分量 | adventure-polish 测试 |
| Thunder 连续 20 次画面绘制 | 重建大辉光渐变 | 无重复渐变构建 | arcade-polish 测试 |
| 5 款街机 144 次 RAF 回调 | 刷新相关边缘风险 | 恰好 60 次物理步；重复时间戳 0 步；长阻塞最多补 6 步 | arcade-polish 测试 |
| 共享 FX 连续 600 帧 | 每帧 bufferData 创建存储 | 1 次分配，600 次活动数据更新 | shared-polish 测试 |
| Echo 死亡余波 1 秒 | 固定每 RAF 推进一次，随刷新率变快 | 30/60/144 Hz 均推进 1 秒 | shared-polish 测试 |
| Echo / Ranger 4K、DPR 2 | DPR 上限 1.75 时约 25.4M 背缓冲像素 | ≤2.4M 像素，逻辑坐标不变 | shared-polish 测试 |
| 共享音效连续 1,000 次触发 | 无显式同时音源上限 | 同时最多 24，结束/静音断开 | shared-polish 测试 |

## 复测命令

```sh
node --test tests/*.test.mjs english-word-ranger/tests/*.test.mjs
node english-word-ranger/tests/playthrough.mjs 0 1 2 3 4 5 6 9
RANGER_TEST_WIDTH=540 node english-word-ranger/tests/playthrough.mjs 0 1 2 3 4 5
python3 -m http.server 4173 --bind 127.0.0.1
```

浏览器先打开合集，再进入每款游戏；保留已有 `tests/*-browser.html` 与游戏自己的 `?selftest` 页。Node fixture 会调用生产代码，但不会真实绘制、播放声音或替代这些浏览器验证。

## 尚未验证

本环境访问 localhost 被浏览器策略阻止；没有尝试绕过，没有真实浏览器截图。以下仍待可用浏览器或设备：

- 15 款的最终视觉布局、颜色和音频听感
- 真正 60/120/144 Hz 显示器上的帧时间与 GPU 开销
- 真实多触点、横竖屏、软键盘、屏幕阅读器、BFCache 返回
- 低端手机上的热量、电量、长期内存和性能

本轮保留近期美术与内容，重点是可回归的实现优化和轻量呈现修整，并不宣称完成全新美术重制。没有新增运行依赖。上述测试记录在部署前生成；发布状态以仓库 GitHub Pages 部署记录为准。
