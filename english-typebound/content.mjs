export const CHAPTERS = [
  {
    name: "雾林来信",
    en: "THE LETTERWOOD",
    color: "#a9dac6",
    story: "旧书页在雾中醒来。用完整的单词，点亮通往遗迹的路。",
  },
  {
    name: "潮汐藏书",
    en: "THE TIDAL ARCHIVE",
    color: "#b6c8f0",
    story: "书岛漂浮在潮汐之上，小书灵想听听海的故事。沿着发光的石桥，把遗忘的句子重新连接。",
  },
  {
    name: "曙光书塔",
    en: "THE SUNRISE OBSERVATORY",
    color: "#efc486",
    story: "穿过云海，晨光落进书塔。守门者藏起了最后一行字：写完它，让新的故事醒来。",
  },
];

// Original short passages; no excerpts from copyrighted books or songs.
export const PASSAGES = [
  {
    en: "a small bird finds a warm home in the old tree",
    zh: "一只小鸟在老树上找到了温暖的家。",
    level: "easy",
  },
  {
    en: "we walk by the river and watch the stars at night",
    zh: "我们沿河散步，在夜晚仰望星星。",
    level: "easy",
  },
  {
    en: "open the book and let a new story take you home",
    zh: "打开书，让一个新故事带你回家。",
    level: "easy",
  },
  {
    en: "the little fox can find its way through the dark forest",
    zh: "小狐狸能找到穿过黑暗森林的路。",
    level: "easy",
  },
  {
    en: "every quiet morning gives us another chance to begin again",
    zh: "每个安静的清晨，都给我们重新开始的机会。",
    level: "medium",
  },
  {
    en: "follow the silver river until the distant mountains turn golden",
    zh: "沿着银色河流前行，直到远山染上金色。",
    level: "medium",
  },
  {
    en: "courage is taking another step even when the path feels uncertain",
    zh: "勇气，是在前路不确定时依然再走一步。",
    level: "medium",
  },
  {
    en: "a forgotten letter carries the promise of an unexpected adventure",
    zh: "一封遗忘的信，预示着一段意想不到的冒险。",
    level: "medium",
  },
  {
    en: "curiosity transforms unfamiliar landscapes into opportunities for discovery",
    zh: "好奇心将陌生的风景变成探索的机会。",
    level: "hard",
  },
  {
    en: "beyond the ancient observatory a constellation illuminates the silent wilderness",
    zh: "古老天文台之外，一片星群照亮寂静的荒野。",
    level: "hard",
  },
  {
    en: "patience and persistence gradually turn uncertainty into understanding",
    zh: "耐心与坚持，逐渐将不确定转化为理解。",
    level: "hard",
  },
  {
    en: "the mysterious manuscript reveals a remarkable connection between distant civilizations",
    zh: "神秘手稿揭示了遥远文明间非凡的联系。",
    level: "hard",
  },
];

// Sentence-specific senses, inflections and function words supplement the project dictionary.
export const PASSAGE_GLOSS = {
  a: "一个；一只（不定冠词）",
  an: "一个（用于元音音素前）",
  the: "这／那（定冠词）",
  finds: "找到（find 的第三人称单数）",
  we: "我们",
  by: "在……旁边",
  stars: "星星（复数）",
  you: "你；你们",
  fox: "狐狸",
  can: "能够",
  its: "它的",
  gives: "给予（give 的第三人称单数）",
  another: "另一个；再一次",
  chance: "机会",
  to: "到；用于动词不定式",
  until: "直到",
  distant: "遥远的",
  mountains: "群山",
  is: "是（be 的第三人称单数）",
  taking: "迈出；采取（take 的 -ing 形式）",
  feels: "感觉（feel 的第三人称单数）",
  uncertain: "不确定的",
  forgotten: "被遗忘的",
  carries: "携带；承载",
  of: "……的",
  unexpected: "意想不到的",
  curiosity: "好奇心",
  transforms: "使转变",
  unfamiliar: "陌生的；不熟悉的",
  landscapes: "风景；景观",
  opportunities: "机会（复数）",
  beyond: "在……之外",
  observatory: "天文台",
  constellation: "星座；星群",
  illuminates: "照亮",
  persistence: "坚持不懈",
  uncertainty: "不确定性",
  understanding: "理解",
  reveals: "揭示",
  remarkable: "非凡的；引人注目的",
  connection: "联系；连接",
  civilizations: "文明（复数）",
  open: "打开（书）",
  take: "带领；带……去",
  in: "在……里",
  turn: "变成；转变为",
  silver: "银色的",
  golden: "金色的",
  letter: "信；信件",
  promise: "预示；希望",
  even: "即使；甚至",
  for: "为了；用于",
  into: "进入；变成",
};

export const RELICS = [
  { id: "quill", icon: "✧", name: "银羽笔", desc: "所有书写伤害 +15%", max: 4 },
  {
    id: "hourglass",
    icon: "◷",
    name: "缓时砂",
    desc: "敌人蓄力时间 +15%",
    max: 3,
  },
  {
    id: "dew",
    icon: "❋",
    name: "晨露",
    desc: "每个无错单词回复 2 点生命",
    max: 3,
  },
  {
    id: "echo",
    icon: "∞",
    name: "回声页",
    desc: "每 3 个无错连词额外造成 12 点伤害",
    max: 3,
  },
  {
    id: "ward",
    icon: "◇",
    name: "守护墨",
    desc: "进入战斗时获得 15 点护盾",
    max: 3,
  },
  {
    id: "heart",
    icon: "♡",
    name: "长明灯",
    desc: "生命上限 +20，并回复 20 点",
    max: 3,
  },
  {
    id: "heal",
    icon: "✚",
    name: "温暖篝火",
    desc: "立即回复 35 点生命",
    max: 99,
  },
];

export const ENEMIES = {
  wisp: {
    name: "迷途书灵",
    en: "LOST WISP",
    detail: "打完整词，释放书页法术。",
    hp: 108,
    damage: 12,
    color: "#c9b5ef",
  },
  moth: {
    name: "食字夜蛾",
    en: "INK MOTH",
    detail: "无错单词会打断它的蓄力。",
    hp: 126,
    damage: 14,
    color: "#a6d7c8",
  },
  sentinel: {
    name: "镜页守卫",
    en: "MIRROR KEEPER",
    detail: "无错单词击碎镜甲，造成更高伤害。",
    hp: 144,
    damage: 16,
    color: "#e3b67a",
  },
  boss: {
    name: "噬句者",
    en: "THE UNWRITTEN",
    detail: "连成完整的句子，击破封印。半血后会加快蓄力。",
    hp: 280,
    damage: 17,
    color: "#dda4a7",
  },
};

export function makeLexicon(project = {}) {
  const out = {};
  for (const level of ["easy", "medium", "hard"]) {
    const seen = new Set();
    out[level] = (project[level] || [])
      .filter((v) => {
        if (!v || typeof v.en !== "string" || typeof v.zh !== "string")
          return false;
        const en = v.en.toLowerCase().trim();
        if (!/^[a-z]{2,20}$/.test(en) || seen.has(en)) return false;
        seen.add(en);
        return true;
      })
      .map((v) => ({ en: v.en.toLowerCase().trim(), zh: v.zh }));
  }
  return out;
}

export function safeReview(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter(
      (v) =>
        v &&
        /^[a-z]{1,20}$/.test(v.en) &&
        typeof v.zh === "string" &&
        !seen.has(v.en) &&
        seen.add(v.en),
    )
    .slice(0, 300)
    .map((v) => ({
      en: v.en,
      zh: v.zh.slice(0, 100),
      misses: Math.min(999, Math.max(1, Number(v.misses) || 1)),
      clean: Math.min(2, Math.max(0, Number(v.clean) || 0)),
    }));
}
