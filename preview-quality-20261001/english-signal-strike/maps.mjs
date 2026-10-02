// Authored layouts share the relay/checkpoint contract, not the same cover map.
export const MAPS = [
  {
    id: "harbor",
    name: "岸港接入",
    en: "HARBOR",
    brief: "偏置装卸湾 · 掩体绕近接入电源，或冒险远射断电，关闭压制炮的交叉火线。",
    wall: 0xced4cd,
    floor: 0xd3d7d5,
    fog: 0x9dafb6,
    accent: 0x74d9d5,
    zones: ["岸港接入", "冷却中庭", "零界核心"],
  },
  {
    id: "foundry",
    name: "赤铜铸造厂",
    en: "FOUNDRY",
    brief: "双廊断电 · 两侧断路器分别给哨兵护盾供电，先选一侧打开战线。",
    wall: 0xafa099,
    floor: 0x807c80,
    fog: 0x827c89,
    accent: 0xffb775,
    zones: ["卸料月台", "双廊炉心", "铸造控制室"],
  },
  {
    id: "canal",
    name: "潮汐泵站",
    en: "TIDAL STATION",
    brief: "排水换路 · 绕主管推进；启动泵站后，中间横越闸板降下，低路连通。",
    wall: 0xafcac7,
    floor: 0xa3b9c3,
    fog: 0xa0c4d0,
    accent: 0x69e5d2,
    zones: ["海堤入口", "交错泵房", "潮汐调度台"],
  },
  {
    id: "hangar",
    name: "星图机库",
    en: "STAR HANGAR",
    brief: "维护核心 · 绕维护架到核心侧面，等它蓄力结束后命中开放处。",
    wall: 0xa5afc9,
    floor: 0x787e98,
    fog: 0x838dac,
    accent: 0xbca9ff,
    zones: ["维修泊位", "星图阵列", "发射控制塔"],
  },
];

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}
// [x, local z, half width, half depth, height, material]
export function coverPlan(id, zone) {
  const mirror = id === "harbor" ? 1 : zone % 2 ? -1 : 1;
  const plans = {
    harbor: [
      [-7,-10,4,2.8,1.6,"loading-platform"],
      [-2,-21,3,1.1,2.3,"cover"],
      [5,-24,3,2,1.3,"perch"],
      [-8,-35,2.2,1.6,1.5,"crate"],
      [5,-18,.7,.7,9.8,"pier"],
      [5,-18,1,1,.55,"pier-base"],
    ],
    foundry: [
      [0, -19, 4.4, 5.2, 5.4, "building"],
      [-9, -12, 2, 1.4, 1.4, "cover"],
      [9, -27, 2, 2, 2.5, "crate"],
      [-9, -35, 2.2, 1.3, 1.6, "cover"],
      [3, -36, 2, 1.4, 1.1, "cover"],
    ],
    canal: [
      [-8.4,-11,3.4,1,2.4,"cross-feed"],
      [-5,-11,.95,.95,5,"feed-riser"],
      [0,-19,.95,.95,5,"feed-riser"],
      [0, -18, 1.3, 5, 2.6, "conduit"],
      [0, -35, 1.3, 5, 2.6, "conduit"],
      [-9, -11, 2.3, 1.2, 1.2, "cover"],
      [9, -25, 2.2, 1.4, 1.2, "cover"],
      [-9, -34, 2, 1.3, 1.2, "cover"],
      [12,-32,5.8,4.5,7.2,"building"],
    ],
    hangar: [
      [-3,-19,2.7,5.2,.55,"service-deck"],
      [-3,-22.6,1.35,.9,2.25,"shuttle-rear"],
      [-3,-19.1,1.82,2.6,2.6,"shuttle-body"],
      [-3,-15.85,1.2,.65,1.9,"shuttle-nose"],
      [11.8,-27,2.2,4.6,1.35,"cover"],
      [-11,-37,3.5,3,2.0,"crate"],
      [12, -37, 1.3, 2.3, 2, "cover"],
      [0, -7, 1.4, 1.4, 1.1, "cover"],
    ],
  };
  return (plans[id] || []).map(([x, z, hx, hz, h, kind]) => [
    x * mirror,
    z,
    hx,
    hz,
    h,
    kind,
  ]);
}
export function enemyPlan(id, zone) {
  const plans = {
    harbor: [
      [-5, -24, "spider"],
      [6, -13, "drone"],
      [5, -24, "sentry", 1.95],
      [-4, -38, "spider"],
      [0, -43, "drone"],
    ],
    foundry: [
      [-9, -23, "spider"],
      [9, -16, "drone"],
      [-12, -39, "sentry"],
      [10, -38, "spider"],
      [0, -32, "drone"],
      [11, -43, "sentry"],
    ],
    canal: [
      [-11, -23, "sentry"],
      [10, -12, "drone"],
      [10, -39, "sentry"],
      [-6, -28, "spider"],
      [-11, -43, "drone"],
      [4, -32, "spider"],
    ],
    hangar: [
      [7, -15, "spider"],
      [-7, -24, "spider"],
      [9, -33, "drone"],
      [0, -34, "sentry"],
      [2, -38, "spider"],
      [0, -19, "drone"],
    ],
  };
  const mirror = id !== "harbor" && zone % 2 ? -1 : 1;
  const spots = (plans[id] || plans.harbor).map(([x, z, kind, y]) => [
    x * mirror,
    z - zone * 52,
    kind,
    y,
  ]);
  if (zone === 2)
    spots.push([id === "harbor" ? 0 : 5, -zone * 52 - 43, "boss"]);
  return spots;
}

export function gatePlan(map,zone){return map==='harbor'?{x:zone%2?7:-7,half:4}:{x:0,half:6.5};}

export function supplyPlan(map,zone){const x={harbor:-7.8,foundry:-6.3,canal:-7.5,hangar:7.8}[map];return {x,y:.3,z:-zone*52-6.5};}
