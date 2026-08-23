'use strict';

/* ============================================================
 * ChipMusic v2 — FC风格芯片音乐引擎 · 音轨器架构
 *
 * 学经典游戏的做法: 曲子 = pattern(小节片段) + order(排列顺序)
 * 正是 Konami/Capcom 作曲家的谱曲方式。每首曲 40~90 秒完整结构:
 * 前奏 → A段 → A' → B段 → 回旋。循环的是整个 order, 不是2小节。
 * ============================================================ */
(function () {
  const NOTE_OFFSET = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const noteHz = (name) => {
    if (!name) return 0;
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE_OFFSET[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
  };
  /* 简写: "E4:2" = E4 持续2步; 数组内 null = 延音/休止由前值决定
   * 展开器把 [ 'E4:3', null, 'G4', ... ] 变成逐步序列 */

  function expand(row) {
    // row: 字符串数组, 'X:n' 表示持续n步, 其后自动补null
    const out = [];
    for (const tok of row) {
      if (tok == null) { out.push(null); continue; }
      const m = /^([A-G]#?\d)(?::(\d+))?$/.exec(tok);
      if (!m) { out.push(null); continue; }
      out.push(m[1]);
      for (let i = 1; i < Number(m[2] || 1); i++) out.push(null); // null=延音
    }
    return out;
  }

  /* ================= 曲库: 每首 = patterns + order =================
   * 一个 pattern = 32步(2小节4/4)。lead/harmony/bass/drums 同步长。
   * drums: K底鼓 S军鼓 h闭镲 o开镲 . 休止
   * ================================================================ */

  const SONGS = {};

  /* ---------- 单词突击队·丛林行动曲 (~64秒) ----------
   * Em 调。Intro(4) A(8) A'(8) B(8) A''(8) 尾奏回Intro变体(4) = 40小节
   */
  SONGS['ranger-stage'] = (() => {
    const P = {};
    // 主A段: 明快进行曲动机
    P.a1 = {
      lead: expand(['E4:2', 'B4', 'E5:2', 'D5', 'B4', 'G4:2', 'B4', 'D5:2', 'B4', 'G4', 'A4:2', 'E5', 'D5:2', 'B4', 'G4', 'E4:2', 'G4', 'A4:2', 'B4', null, null, null, null, null]),
      harmony: expand(['B3:2', 'E4', 'G4:2', 'F#4', 'E4', 'B3:2', 'D4', 'G4:2', 'F#4', 'D4', 'C4:2', 'A4', 'G4:2', 'F#4', 'E4', 'B3:2', 'E4', 'F#4:2', 'G4', null, null, null, null, null]),
      bass: expand(['E2:2', 'B2', 'E3:2', 'B2', 'C3:2', 'G2', 'C3:2', 'G2', 'A2:2', 'E3', 'A2:2', 'E3', 'B2:2', 'F#2', 'B2:2', 'B2', null, null, null, null, null, null, null, null]),
      drums: ['K', '.', '.', '.', 'S', '.', '.', '.', 'K', '.', '.', '.', 'S', '.', 'h', '.',
              'K', '.', '.', '.', 'S', '.', '.', 'h', 'K', '.', '.', '.', 'S', '.', '.', '.'],
    };
    P.a2 = JSON.parse(JSON.stringify(P.a1)); // 同结构, 后面微调结尾
    P.a2.lead = expand(['E4:2', 'B4', 'E5:2', 'D5', 'B4', 'G4:2', 'B4', 'D5:2', 'B4', 'G4', 'A4:2', 'C5', 'B4:2', 'G4', 'E5', 'D5:2', 'B4', 'G4:2', 'E4', null, null, null, null, null]);
    P.a2.harmony = expand(['B3:2', 'E4', 'G4:2', 'F#4', 'E4', 'B3:2', 'D4', 'G4:2', 'F#4', 'D4', 'E4:2', 'A4', 'G4:2', 'E4', 'B4', 'A4:2', 'G4', 'E4:2', 'B3', null, null, null, null, null]);
    // B段: 上扬对答 (C大调离调感), 制造对比
    P.b1 = {
      lead: expand(['C5:2', 'B4', 'C5:2', 'E5', 'D5:2', 'C5', 'B4:2', 'G4', 'A4:2', 'B4', 'C5:2', 'D5', 'E5:3', null, 'D5:2', 'B4', 'G4:2', 'A4', 'B4:2', null, null]),
      harmony: expand(['G4:2', 'G4', 'A4:2', 'C5', 'B4:2', 'A4', 'G4:2', 'E4', 'F4:2', 'G4', 'A4:2', 'B4', 'C5:3', null, 'B4:2', 'G4', 'D4:2', 'F4', 'G4:2', null, null]),
      bass: expand(['C2:2', 'G2', 'C3:2', 'G2', 'G1:2', 'D2', 'G2:2', 'D2', 'F2:2', 'C3', 'F2:2', 'C3', 'G2:2', 'D3', 'G2:2', 'G2', null, null, null, null, null, null, null, null]),
      drums: ['K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', 'h', '.',
              'K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', 'h', 'S', '.', '.', '.'],
    };
    // Intro: 鼓+贝斯铺垫, 引出主题
    P.intro = {
      lead: expand([null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]),
      harmony: expand([null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]),
      bass: expand(['E2:4', 'E2', 'B2:4', 'C3', 'A2:4', 'A2', 'B2:4', 'B2', null, null, null, null, null, null, null, null, null, null, null, null]),
      drums: ['K', '.', '.', '.', '.', '.', 'h', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              'K', '.', '.', '.', '.', '.', 'h', '.', 'S', '.', 'h', '.', 'S', '.', '.', '.'],
    };
    return {
      tempo: 112,
      patterns: P,
      order: ['intro', 'a1', 'a2', 'b1', 'a1', 'a2', 'b1', 'a2', 'b1', 'a1', 'a2', 'b1', 'a1', 'a2'],  // ~29s @150bpm x3循环=86s
    };
  })();

  /* ---------- Boss战·钢铁咆哮 (~48秒) ---------- */
  SONGS['ranger-boss'] = (() => {
    const P = {};
    P.v1 = {
      lead: expand(['E4', 'F4', 'E4', 'B3:2', 'E4', 'G4', 'F4', 'E4', 'F4', 'A4', 'B4', 'A4:2', 'F4', 'E4',
                    'D4', 'E4', 'F4', 'G4', 'A4:2', 'B4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4:4']),
      harmony: expand(['B3', 'C4', 'B3', 'G3:2', 'B3', 'E4', 'D4', 'C4', 'D4', 'F4', 'G4', 'F4:2', 'D4', 'C4',
                       'A3', 'B3', 'C4', 'D4', 'E4:2', 'G4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4:4']),
      bass: expand(['E2', 'E2', 'E3', 'E2', 'D2', 'D2', 'D3', 'D2', 'C2', 'C2', 'C3', 'C2', 'B1', 'B1', 'B2', 'B1', 'A1', 'A1', 'A2', 'A1', 'G1', 'G1', 'G2', 'G1', 'B1', 'B1', 'B2', 'B1', 'E2:4']),
      drums: ['K', '.', '.', 'K', '.', '.', 'S', '.', 'K', '.', '.', '.', '.', '.', 'S', '.',
              'K', '.', '.', 'K', '.', '.', 'S', '.', 'KK', '.', '.', 'S', '.', '.', '.', '.'],
    };
    // 变奏: 旋律翻高八度片段+切分
    P.v2 = {
      lead: expand(['E5', 'F5', 'E5', 'B4:2', 'E5', 'G5', 'F5', 'E5', null, 'A4', 'B4', 'C5:2', 'B4', 'A4',
                    'G4', 'A4', 'B4', 'C5', 'D5:2', 'E5', 'F5', 'E5', 'D5', 'C5', 'B4', 'E5:4']),
      harmony: expand(['G4', 'A4', 'G4', 'E4:2', 'G4', 'B4', 'A4', 'G4', null, 'C5', 'D5', 'E5:2', 'D5', 'C5',
                       'B4', 'C5', 'D5', 'E5', 'F5:2', 'G5', 'A5', 'G5', 'F5', 'E5', 'D5', 'G5:4']),
      bass: expand(['E2', 'E2', 'E3', 'E2', 'C2', 'C2', 'C3', 'C2', 'A1', 'A1', 'A2', 'A1', 'F2', 'F2', 'F3', 'F2', 'G1', 'G1', 'G2', 'G1', 'B1', 'B1', 'B2', 'B1', 'E2', 'E2', 'E3', 'E2', 'E2:4']),
      drums: ['K', '.', '.', 'K', '.', 'h', 'S', '.', 'K', '.', '.', 'K', '.', '.', 'S', 'o',
              'K', '.', '.', 'K', '.', 'h', 'S', '.', 'K', '.', 'S', '.', 'S', '.', '.', '.'],
    };
    return { tempo: 128, patterns: P, order: ['v1', 'v2', 'v1', 'v2', 'v1', 'v2', 'v1', 'v2', 'v1', 'v2', 'v1', 'v2', 'v1', 'v2', 'v1', 'v2'] };  // ~45s
  })();

  /* ---------- 雷霆战机·星际巡航 (~72秒) ---------- */
  SONGS['thunder-stage'] = (() => {
    const P = {};
    // Am 琶音冷冽主题
    P.s1 = {
      lead: expand(['A4', 'C5', 'E5', 'A5:2', 'G5', 'E5', 'F5:2', 'A4', 'C5', 'F5:2', 'E5', 'C5', 'D5', 'F4', 'A4', 'D5:2', 'E5', 'D5', 'C5:2', 'E4', 'G4', 'C5:2', 'B4', 'G4', null, null]),
      harmony: expand(['A3', 'E4', 'A4', 'C5:2', 'B4', 'A4', 'C4:2', 'F4', 'A4', 'C5:2', 'B4', 'A4', 'A3', 'D4', 'F4', 'A4:2', 'C5', 'A4', 'G4:2', 'C5', 'E5', 'G5:2', 'F5', 'E5', null, null]),
      bass: expand(['A1:4', 'A2', 'A1:4', 'A2', 'F1:4', 'F2', 'F1:4', 'F2', 'D1:4', 'D2', 'D1:4', 'D2', 'C2:2']),
      drums: ['K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              'K', '.', '.', 'h', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', 'h', '.'],
    };
    // 副歌: 上五度爆发
    P.s2 = {
      lead: expand(['E5', 'G5', 'C6:2', 'B5', 'G5', 'A5:2', 'E5', 'C5', 'F5', 'A5', 'C6:2', 'B5', 'A5', 'G5:2', 'D6', 'C6', 'B5', 'A5', 'G5:2', 'E5', 'G5', 'A5:4', null, null]),
      harmony: expand(['C5', 'E5', 'G5:2', 'F5', 'E5', 'F5:2', 'C5', 'A4', 'D5', 'F5', 'A5:2', 'G5', 'F5', 'E5:2', 'B5', 'A5', 'G5', 'F5', 'E5:2', 'C5', 'E5', 'F5:4', null, null]),
      bass: expand(['C2:4', 'C3', 'C2:4', 'C3', 'F2:4', 'F3', 'F2:4', 'F3', 'G1:4', 'G2', 'G1:4', 'G2', 'A1:2']),
      drums: ['K', '.', '.', '.', 'h', '.', '.', '.', 'S', '.', '.', '.', 'h', '.', '.', '.',
              'K', '.', '.', '.', 'h', '.', '.', '.', 'S', '.', 'K', '.', 'S', '.', '.', '.'],
    };
    // Bridge: 半空拍紧张段
    P.sb = {
      lead: expand(['A4:2', null, 'E5:2', null, 'D5:2', null, 'C5:2', null, 'B4:2', null, 'F5:2', null, 'E5:4', null, null, null, null, null, null, null, null, null, null]),
      harmony: expand(['C4:2', null, 'A4:2', null, 'G4:2', null, 'E4:2', null, 'G4:2', null, 'D5:2', null, 'C5:4', null, null, null, null, null, null, null, null, null, null]),
      bass: expand(['A1:8', 'F1:8', 'D1:8', 'E2:8']),
      drums: ['K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              '.', '.', 'h', '.', '.', '.', '.', '.', 'S', '.', '.', '.', 'o', '.', '.', '.'],
    };
    return { tempo: 118, patterns: P, order: ['s1', 's1', 's2', 'sb', 's2', 's1', 's1', 's2', 'sb', 's2', 's1', 's2', 'sb', 's2'] };  // ~74s
  })();

  /* ---------- 贪吃蛇·霓虹隧道 (~60秒) ---------- */
  SONGS['snake-loop'] = (() => {
    const P = {};
    // C 宫五声俏皮主题
    P.n1 = {
      lead: expand(['C5:2', 'D5', 'E5:2', 'G5', 'E5:2', 'D5', 'C5:2', 'A4', 'C5', 'D5:2', null, 'E5:2', 'G5', 'A5:2', 'C6', 'A5:2', 'G5', 'E5:2', 'D5', 'E5', 'C5:3']),
      harmony: expand(['E4:2', 'G4', 'C5:2', 'E5', 'C5:2', 'G4', 'E4:2', 'C4', 'E4', 'G4:2', null, 'C5:2', 'E5', 'G5:2', 'C6', 'G5:2', 'E5', 'C5:2', 'G4', 'C5', 'E5:3']),
      bass: expand(['C2:2', 'G2', 'C3:2', 'G2', 'A1:2', 'E2', 'A2:2', 'E2', 'F1:2', 'C2', 'F2:2', 'C2', 'G1:2', 'D2', 'G2:2', 'C2', null, null, null, null, null, null, null, null]),
      drums: ['K', '.', '.', '.', '.', '.', 'h', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              'K', '.', '.', '.', '.', '.', 'h', '.', 'S', '.', '.', 'h', '.', '.', '.', '.'],
    };
    // 变奏: 切分跳弓
    P.n2 = {
      lead: expand(['G4', 'C5', 'E5', 'G5', 'E5', 'C5', 'A4', 'C5', 'D5', null, 'E5', null, 'G5', null, null, null, 'A4', 'C5', 'F5', 'A5', 'F5', 'C5', 'G4', 'C5', 'E5', null, 'D5', null, 'C5:4']),
      harmony: expand(['E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4', 'G4', 'A4', null, 'C5', null, 'E5', null, null, null, 'F4', 'A4', 'C5', 'F5', 'C5', 'A4', 'E4', 'G4', 'C5', null, 'B4', null, 'C5:4']),
      bass: expand(['C2', 'C2', 'G2', 'C3', 'A1', 'A1', 'E2', 'A2', 'F1', 'F1', 'C2', 'F2', 'G1', 'G1', 'D2', 'G2', 'C2', 'C2', 'G2', 'C3', 'A1', 'A1', 'E2', 'A2', 'F1', 'F1', 'G1', 'G1', 'C2:4']),
      drums: ['K', '.', 'h', '.', '.', '.', 'h', '.', 'S', '.', '.', '.', '.', '.', 'h', '.',
              'K', '.', 'h', '.', '.', '.', 'h', '.', 'S', '.', '.', '.', 'S', '.', '.', '.'],
    };
    return { tempo: 108, patterns: P, order: ['n1', 'n2', 'n1', 'n2', 'n1', 'n2', 'n1', 'n2', 'n1', 'n2', 'n1', 'n2'] };  // ~62s
  })();

  /* ---------- 飞鸟·晨风翱翔 (~56秒) ---------- */
  SONGS['flappy-loop'] = (() => {
    const P = {};
    P.f1 = {
      lead: expand(['G4:2', 'C5', 'E5:2', 'D5', 'C5:2', 'D5', 'E5:2', 'G5', 'E5', 'D5', 'A4:2', 'D5', 'F5:2', 'E5', 'D5:2', 'E5', 'D5:2', 'C5', 'D5', 'E5', 'G4:2', 'C5', 'E5']),
      harmony: expand(['E4:2', 'G4', 'C5:2', 'B4', 'G4:2', 'B4', 'C5:2', 'E5', 'C5', 'B4', 'F4:2', 'A4', 'D5:2', 'C5', 'A4:2', 'C5', 'B4:2', 'G4', 'A4', 'B4', 'E4:2', 'G4', 'C5']),
      bass: expand(['C2:4', 'G2', 'C2:4', 'G2', 'F1:4', 'C2', 'G1:4', 'G2', 'C2:4', 'G2', 'A1:4', 'E2', 'F1:2']),
      drums: ['K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              'K', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', 'h', '.'],
    };
    P.f2 = {
      lead: expand(['E5:2', 'D5', 'C5:2', 'D5', 'E5:2', 'G5', 'A5:2', 'G5', 'E5', 'D5', 'C5:2', 'E5', 'D5:2', 'C5', 'A4:2', 'C5', 'D5:4', null, 'E5', 'G5', 'C6:2']),
      harmony: expand(['C5:2', 'B4', 'G4:2', 'B4', 'C5:2', 'E5', 'F5:2', 'E5', 'C5', 'B4', 'A4:2', 'C5', 'B4:2', 'A4', 'F4:2', 'A4', 'B4:4', null, 'C5', 'E5', 'G5:2']),
      bass: expand(['A1:4', 'E2', 'F1:4', 'C2', 'C2:4', 'G2', 'G1:4', 'G2', 'C2:4', 'E2', 'F1:4', 'G1', 'C2:2']),
      drums: ['K', '.', '.', '.', 'h', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.',
              'K', '.', '.', '.', 'h', '.', '.', '.', 'S', '.', '.', '.', 'h', '.', '.', '.'],
    };
    return { tempo: 104, patterns: P, order: ['f1', 'f2', 'f1', 'f2', 'f1', 'f2', 'f1', 'f2', 'f1', 'f2', 'f1', 'f2', 'f1', 'f2'] };  // ~60s
  })();

  /* ---------- 神庙跑酷·遗迹狂奔 (~58秒) ---------- */
  SONGS['temple-loop'] = (() => {
    const P = {};
    // Dm 密集鼓点推进
    P.t1 = {
      lead: expand(['D4', 'D4', 'F4:2', 'A4', 'G4:2', 'F4', 'E4', 'E4', 'G4:2', 'B4', 'A4:2', 'G4', 'F4', 'F4', 'A4:2', 'C5', 'B4:2', 'A4', 'G4', 'F4', 'E4', 'D4:4', null]),
      harmony: expand(['A3', 'A3', 'D4:2', 'F4', 'E4:2', 'D4', 'C4', 'C4', 'E4:2', 'G4', 'F4:2', 'E4', 'D4', 'D4', 'F4:2', 'A4', 'G4:2', 'F4', 'E4', 'D4', 'C4', 'B3:4', null]),
      bass: expand(['D2', 'D2', 'D2', 'D3', 'C2', 'C2', 'C2', 'C3', 'B1', 'B1', 'B1', 'B2', 'F2', 'F2', 'F2', 'F3', 'G2', 'G2', 'G2', 'G3', 'A2', 'A2', 'A2', 'A2', null, null, null, null, null, null, null, null]),
      drums: ['K', '.', '.', '.', 'S', '.', '.', '.', 'K', '.', '.', '.', 'S', '.', '.', '.',
              'K', '.', 'h', '.', 'S', '.', '.', '.', 'K', '.', '.', 'h', 'S', '.', '.', '.'],
    };
    // 副歌: 八度跳跃冲刺
    P.t2 = {
      lead: expand(['D5', 'A4', 'D5', 'F5', 'E5', 'A4', 'E5', 'G5', 'F5', 'C5', 'F5', 'A5', 'G5', 'D5', 'G5', 'B5', 'A5', 'E5', 'A5', 'C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5:4', null, null, null]),
      harmony: expand(['A4', 'F4', 'A4', 'D5', 'C5', 'A4', 'C5', 'E5', 'D5', 'A4', 'D5', 'F5', 'E5', 'B4', 'E5', 'G5', 'C5', 'A4', 'C5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'D5:4', null, null, null]),
      bass: expand(['D2', 'D3', 'D2', 'D3', 'A2', 'A3', 'A2', 'A3', 'F2', 'F3', 'F2', 'F3', 'G2', 'G3', 'G2', 'G3', 'C3', 'C3', 'C3', 'C3', 'D2:4', 'D2', 'D2', null, null, null, null, null, null]),
      drums: ['K', '.', '.', 'K', '.', '.', 'S', '.', 'K', '.', '.', '.', 'S', '.', '.', '.',
              'K', '.', '.', 'K', '.', 'h', 'S', '.', 'K', '.', 'S', '.', 'S', '.', 'h', 'o'],
    };
    return { tempo: 122, patterns: P, order: ['t1', 't1', 't2', 't1', 't2', 't1', 't2', 't1', 't2', 't1', 't2', 't1', 't2', 't1', 't2'] };  // ~58s
  })();

  /* ---------- 通用胜利调 (短, 不循环) ---------- */
  SONGS['victory'] = {
    tempo: 150, noLoop: true,
    patterns: {
      v: {
        lead: expand(['C5:2', 'E5:2', 'G5:2', 'C6:4', 'B5', 'G5', 'E5:2', 'G5:4', null, null, null, null, null, null, null, null, null, null, null, null, null, null]),
        harmony: expand(['E4:2', 'G4:2', 'C5:2', 'E5:4', 'D5', 'B4', 'C5:2', 'E5:4', null, null, null, null, null, null, null, null, null, null, null, null, null, null]),
        bass: expand(['C2:4', 'G2:4', 'F2:4', 'C2:4']),
        drums: ['K', '.', 'S', '.', 'K', '.', 'S', 'K', 'S', '.', 'K', 'K', 'S', '.', 'h', 'o'],
      },
    },
    order: ['v', 'v'],
  };

  /* ================= 引擎核心 ================= */
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let currentName = null;
  let schedulerTimer = null;
  let songState = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.5;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6;
      masterGain.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  let _pulseWaves = {};
  function getPulseWave(duty) {
    const key = String(duty);
    if (_pulseWaves[key]) return _pulseWaves[key];
    const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * (1 - Math.cos(i * Math.PI));
    }
    _pulseWaves[key] = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    return _pulseWaves[key];
  }

  function playPulse(freq, t, dur, vol, duty) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    try { osc.setPeriodicWave(getPulseWave(duty == null ? .25 : duty)); }
    catch (e) { osc.type = 'square'; }
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0008, vol * .28), t + dur * .82);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + .02);
  }

  function playTriangle(freq, t, dur, vol) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * .8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + .02);
  }

  function playDrum(kind, t, vol) {
    if (!kind || kind === '.') return;
    // 复合token: 'Kh'=同时底鼓+闭镲, 'KK'=双底鼓, 'SSS'=滚奏军鼓
    if (kind.length > 1 && !'Ko'.includes(kind)) {
      for (const ch of kind) playDrum(ch, t, ch === 'S' ? vol * .55 : vol);
      return;
    }
    if (kind === 'K') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + .11);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.001, t + .13);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + .15);
      return;
    }
    if (!playDrum._noise) {
      const len = ctx.sampleRate * .3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      playDrum._noise = buf;
    }
    const src = ctx.createBufferSource(); src.buffer = playDrum._noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 'S') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = .8; }
    else if (kind === 'o') { f.type = 'highpass'; f.frequency.value = 5200; }
    else { f.type = 'highpass'; f.frequency.value = 6500; }
    const dur = kind === 'S' ? .09 : kind === 'o' ? .16 : .04;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(t, Math.random() * .1); src.stop(t + dur + .01);
  }

  const LOOKAHEAD = .18;
  const TICK = 40;

  function scheduleStep(song, stepIdx, t) {
    const stepDur = 60 / song.tempo / 4;
    const names = song.order;
    const patName = names[Math.floor(stepIdx / 32) % names.length];
    const pat = song.patterns[patName];
    const local = stepIdx % 32;
    const L = pat._L || (pat._L = expand(pat.lead));
    const H = pat._H || (pat._H = expand(pat.harmony));
    const B = pat._B || (pat._B = expand(pat.bass));
    const D = pat._D || (pat._D = pat.drums);
    const ln = L[local], hn = H[local], bn = B[local], dn = D[local % D.length];
    // 延音符: null 表示不触发新音(前面的音还在响)
    if (ln) playPulse(noteHz(ln), t, stepDur * 1.05, .11);
    if (hn) playPulse(noteHz(hn), t, stepDur * .95, .065, .125);
    if (bn) playTriangle(noteHz(bn), t, stepDur * 1.9, .22);
    if (dn && dn !== '.') playDrum(dn, t, dn.startsWith('S') ? .12 : dn.includes('S') ? .09 : dn === 'K' ? .20 : .045);
  }

  function totalSteps(song) { return song.order.length * 32; }

  function schedulerTick() {
    if (!songState) return;
    const now = ctx.currentTime;
    while (songState.nextTime < now + LOOKAHEAD) {
      scheduleStep(songState.song, songState.step, songState.nextTime);
      songState.nextTime += 60 / songState.song.tempo / 4;
      songState.step++;
      if (songState.song.noLoop && songState.step >= totalSteps(songState.song)) {
        const stopAt = songState.nextTime;
        setTimeout(() => api.stop(), Math.max(0, (stopAt - now) * 1000 + 400));
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        return;
      }
    }
  }

  const api = {
    get playing() { return currentName; },
    unlock() { ensureCtx(); },
    play(name) {
      const song = SONGS[name];
      if (!song || !ensureCtx()) return;
      if (currentName === name && schedulerTimer) return;
      this.stop();
      currentName = name;
      songState = { song, step: 0, nextTime: ctx.currentTime + .06 };
      schedulerTimer = setInterval(schedulerTick, TICK);
    },
    stop() {
      if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
      songState = null; currentName = null;
    },
    setMuted(value) {
      muted = Boolean(value);
      if (masterGain) masterGain.gain.value = muted ? 0 : .5;
    },
    get muted() { return muted; },
    songs: Object.keys(SONGS),
    durationOf(name) {
      const s = SONGS[name];
      return s ? Math.round(totalSteps(s) * (60 / s.tempo / 4)) : 0;
    },
  };

  window.ChipMusic = api;
  window.addEventListener('pointerdown', () => api.unlock(), { passive: true });
  window.addEventListener('keydown', () => api.unlock(), { passive: true });
}());
