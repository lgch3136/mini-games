# 全部 15 款游戏：流畅度与呈现修整

2026-09-30 · 基于 `7a65387` · 包含同日 Word Ranger 操作修复 · 部署前验证记录

这轮覆盖仓库全部 15 款正式入口，保留已有游戏机制和最近的美术。采用适合当前静态站点的 Canvas 缓存、固定步进、Three.js 实例化局部上传、复用呈现数据、Web Animations API、transform 动效和有界 WebAudio 生命周期。没有新增运行依赖，也没有为了技术名词重写引擎。

## 每款改动

| 游戏 | 流畅度 / 可靠性改动 | 呈现与操作反馈 |
| --- | --- | --- |
| Typebound 键旅 | 脉冲波形只计算一遍供三层描边复用；刻度合并为一条路径；重复尺寸事件不清空画布 | 稳定 HUD 数字与轻量焦点/按压反馈 |
| Echo Ring 回响边界 | 大屏背缓冲上限；粒子阻尼每步统一计算；死亡余波按固定时间步更新 | 能量条改 transform，选中态与减少动态效果支持 |
| Apex Drive 团团卡丁 | 小地图路线按赛道缓存；复用动态特效容器 | 小喷就绪层次、无强制重排的技巧提示 |
| Signal Strike 零界突围 | 复用粒子/轨迹/掉落物列表，只上传实际实例范围 | 明确低弹药提示与稳定读数 |
| Moonblade 月影忍途 | 复用绘制快照与近邻灯光选择，保留现有骨骼和动作 | 低生命反馈、稳定计分与分段进度 |
| Word Ranger 单词突击队 | 帧间输入缓冲、下落与低顶碰撞修复；缓存大气渐变；无排序阴影落点查询；背缓冲上限 | 蹲射瞄准修正、下落音效、明确选中态 |
| Word Fury 单词斗魂 | 用轻量呈现快照替代战斗状态深拷贝 | 安静的最后 15 秒提醒、无强制重排的连击反馈 |
| Word Bomber 英语炸弹人 | 静态地图缓存并在地形变化时失效，修复中断输入 | 稳定 HUD 数字、触屏按压与焦点反馈 |
| Word Miner 英语挖金子 | 缓存矿洞背景；倒计时仅在显示值变化时更新；1.4M 像素预算 | 稳定倒计时与交互层次 |
| Word Breaker 英语打砖块 | 挡板加宽效果按游戏时钟过期，暂停与重开不受旧定时器影响；触屏按下即瞄准 | 缓存竞技场、按下即瞄准、清晰触屏反馈 |
| Thunder Fighter 雷霆战机 | 复用大尺寸辉光缓存、移除逐帧布局读取；有界共享 GPU 特效 | 清晰交互反馈、减少动态效果支持 |
| Word Snake 字母花园 | 蛇身包裹绘制改坐标平移，避免九份逐点拷贝 | 保留连续轨迹与无缝边缘，稳定 HUD / 按压反馈 |
| Flappy Words 飞鸟背单词 | 固定步进处理零间隔帧与高刷新；页面失焦暂停；提示到期更新；重复 resize 不重置画布 | 无强制重排的连击动效与及时加载画面 |
| Temple Dash 遗迹词途 | 实例池只上传活动部分，复用 Euler/Color，避免重复 resize | 轻量按压与焦点层次，保留节奏判定 |
| Word Beat 英语节奏大师 | 缓存音轨色表/词条，游标与二分检索限制音符扫描范围 | 多触点/键盘释放更稳，保留长音尾与计时判定 |

## 共享层

- WebGL 粒子顶点存储一次分配，以 `bufferSubData` 更新活动部分；粒子线性压缩替代逐个 splice；每帧统一采样特效时间
- 音效最多 24 个同时合成音源，结束或静音立即断开节点；隐藏页面暂停声音
- 芯片配乐停止时释放活动节点，取消旧胜利音乐的结束回调；主线程长暂停后不追赶播放陈旧音符
- 合集页面异步解码封面，收敛悬浮材质，增加触屏与减少动态效果处理；没有新增模糊/辉光叠层

## 验证与限制

完整测试结果、可复现度量和运行指令在 [VALIDATION.md](VALIDATION.md)。

云浏览器打开本地服务返回 `net::ERR_BLOCKED_BY_CLIENT`，未绕过该限制。当前证据是 Node 测试、实际生产函数的 DOM/Canvas/WebGL fixture、模拟输入和代码检查；不等同于真实 GPU、音频设备、手机或人类试玩。没有本轮的实机截图、FPS 或“所有设备稳定 60/120 帧”声明。

后续仍需在可访问本地站点的浏览器复测视觉/声音，尤其是高刷新显示器、低端手机、横竖屏切换、暂停恢复和长时间游玩。

## 技术依据（已查阅官方文档）

- [MDN：Canvas 优化，缓存重复绘制内容](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN：requestAnimationFrame 与时间戳](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN：bufferSubData 更新既有缓冲](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bufferSubData)
- [MDN：AudioNode.disconnect](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect) 与 [ended 事件](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/ended_event)
- [MDN：动画性能与属性成本](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)
- [MDN：prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

- [Three.js：BufferAttribute 更新范围与动态用法](https://threejs.org/docs/pages/BufferAttribute.html)
