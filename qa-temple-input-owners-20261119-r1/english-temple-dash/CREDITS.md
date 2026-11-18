# 音速远征 · 资源与玩法参考

## 实时 3D

场景、轮滑角色、骨骼动作、机关和节拍标记是本项目程序生成的原创几何体。采用统一的正交相机、物理尺度、光照和深度测试。当前绘制不使用原先的合成背景贴图；菜单截图必须来自真实游戏，不以概念画代替实机。

Three.js 0.185.1 按固定版本存放在 `../shared/vendor/three-0.185.1/`，MIT 许可原文随包提供。发布时不依赖外部 CDN。

## 音乐

三个公版作品沿用本仓库 `english-word-beat` 已整理的音符数据，提取到 `tracks.mjs`，保留双手的音高、和弦、起拍和时值。当前是适合匀速跑道的定速钢琴改编，不宣称还原现场演奏的自由速度、踏板或力度处理。基础速度分别为 120 / 132 / 145 BPM；速度设置同步改变音乐事件间隔和场景移动速度，不改变音高。

- Mozart, K.331 第三乐章《土耳其进行曲》：[公版乐谱来源](https://beatnoteplay.com/sheet-music/sonate-opus-kv-331-rondo-alla-turca-mozart/)。本作采用 120 BPM，与来源页面默认演奏速度不同。
- Mozart, K.545 第一乐章：[公版乐谱来源](https://beatnoteplay.com/sheet-music/sonata-no-16-k545-1st-movement-mozart/)。本作 132 BPM。
- Bach, BWV 847 前奏曲：[公版乐谱来源](https://beatnoteplay.com/sheet-music/prelude-bwv-847-bach/)。本作 145 BPM，尾段保持定速。

钢琴采样：**Salamander Grand Piano，Alexander Holm，CC BY 3.0**。由 [Tonejs/audio 的 Salamander 分发](https://github.com/Tonejs/audio/tree/master/salamander) 提供 C3 / C4 / C5 / C6 四个 MP3 单音。文件未改动；演奏时按音高移调并施加包络。

许可：[Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)。原始采样说明见该目录 README；感谢 Alexander Holm 的开放授权。

自由跑酷保留本项目原创 112 BPM 合成配乐；两种模式不会叠加播放。

## 玩法研究边界

参考 [R2Beat 官方玩法介绍](https://r2beat.pmang.jp/notices/8) 的轮滑、音乐节奏、障碍避让组合。没有搬运 QQ 音速 / R2Beat 的角色、商业音乐、地图、代码或品牌视觉。

本作判定窗为自行设定的 Perfect ±55 ms、Great ±105 ms、Good ±165 ms，组合输入相隔不超过 80 ms。40 连击保护胶囊与能量爆发是本作规则，不能当作原作参数的考据结论。爆发只增加得分，不突然改变用户要求的线性跑速。
