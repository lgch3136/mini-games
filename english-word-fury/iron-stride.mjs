export const ironStrideCells={
  "stepPlant": [
    13,
    3,
    142,
    180,
    -58.45,
    -144.9,
    231.0,
    292.6
  ],
  "stepPass": [
    197,
    3,
    109,
    180,
    -36.4,
    -141.05,
    172.9,
    285.6
  ],
  "stepReach": [
    338,
    5,
    164,
    175,
    -63.7,
    -143.15,
    270.2,
    289.1
  ],
  "stepGather": [
    544,
    3,
    87,
    180,
    -23.45,
    -147.0,
    142.8,
    295.4
  ],
  "jabSet": [
    16,
    189,
    136,
    180,
    -66.5,
    -145.25,
    221.2,
    292.6
  ],
  "jabLead": [
    181,
    189,
    141,
    180,
    -64.4,
    -144.2,
    226.8,
    290.5
  ],
  "jabReach": [
    338,
    193,
    164,
    172,
    -75.95,
    -145.25,
    278.6,
    292.6
  ],
  "jabFold": [
    517,
    189,
    141,
    180,
    -70.7,
    -144.55,
    228.2,
    291.2
  ]
};
export const ironStrideRoles={
  "walkForward/0": "stepPlant",
  "walkForward/3": "stepPass",
  "walkForward/6": "stepReach",
  "walkForward/9": "stepGather",
  "walkBack/0": "stepPlant",
  "walkBack/3": "stepGather",
  "walkBack/6": "stepReach",
  "walkBack/9": "stepPass",
  "jab/load": "jabSet",
  "jab/commit": "jabLead",
  "jab/active": "jabReach",
  "jab/return": "jabFold",
  "jab/settle": "jabSet"
};
