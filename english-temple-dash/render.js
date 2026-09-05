import {
  BIOMES,
  ROUTES,
  SECTOR_LENGTH,
  SIGHT,
  biomeAt,
  projection,
  lerp,
  clamp,
} from "./engine.mjs?v=20260905-wind";
const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.sky = new Image();
    this.cave = new Image();
    this.stone = new Image();
    this.sky.src = new URL("assets/wind-valley.webp", import.meta.url).href;
    this.cave.src = new URL("assets/wind-cavern.webp", import.meta.url).href;
    this.stone.src = new URL("assets/wind-stone.webp", import.meta.url).href;
    this.width = 1000;
    this.height = 720;
    this.lastFrame = 0;
  }
  async load() {
    await Promise.all([
      this.sky.decode().catch(() => {}),
      this.cave.decode().catch(() => {}),
      this.stone.decode().catch(() => {}),
    ]);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.width = (720 * r.width) / r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.project = projection(this.width, 720);
  }
  path(points, fill, stroke = null, line = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = line;
      c.stroke();
    }
  }
  line(points, color, width = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
  }
  rect(x, y, w, h, color, r = 0) {
    const c = this.ctx;
    c.fillStyle = color;
    if (r) {
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    } else c.fillRect(x, y, w, h);
  }
  oval(x, y, rx, ry, color) {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
    c.fillStyle = color;
    c.fill();
  }
  text(value, x, y, size, color, weight = 600) {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = `${weight} ${size}px "Avenir Next","PingFang SC",system-ui`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(value, x, y);
  }
  quad(l, r, zFar, zNear) {
    const a = this.project(l, zFar),
      b = this.project(r, zFar),
      c = this.project(r, zNear),
      d = this.project(l, zNear);
    return [
      [a.x, a.y],
      [b.x, b.y],
      [c.x, c.y],
      [d.x, d.y],
    ];
  }
  render(world, alpha = 1) {
    const c = this.ctx,
      W = this.width,
      H = 720;
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    this.distance = lerp(world.previousDistance, world.distance, alpha);
    this.time = world.time;
    this.world = world;
    this.alpha = alpha;
    this.biome = biomeAt(this.distance);
    this.background();
    this.road();
    this.scenery();
    const objects = [];
    for (const row of world.rows)
      if (row.z - this.distance < SIGHT && row.z - this.distance > -27)
        objects.push({ z: row.z - this.distance, row });
    const letters = world.items
      .filter(
        (i) => i.type === "letter" && !i.taken && i.z >= this.distance - 3,
      )
      .sort((a, b) => a.z - b.z);
    const nextLetter = letters[0]?.id;
    for (const item of world.items)
      if (
        !item.taken &&
        item.z - this.distance < SIGHT &&
        item.z - this.distance > -10
      )
        objects.push({ z: item.z - this.distance, item, nextLetter });
    objects.push({ z: 0, player: true });
    objects.sort((a, b) => b.z - a.z);
    for (const obj of objects) {
      c.save();
      c.globalAlpha =
        clamp((SIGHT - obj.z) / 20, 0, 1) * clamp((obj.z + 27) / 12, 0, 1);
      if (obj.player) this.player();
      else if (obj.row) this.row(obj.row, obj.z);
      else this.item(obj.item, obj.z, obj.item.id === obj.nextLetter);
      c.restore();
    }
    for (const p of world.particles) {
      const q = this.project(p.x, p.z, p.h);
      c.globalAlpha = clamp(p.life * 2, 0, 1);
      this.oval(q.x, q.y, 2.6 * q.scale, 2.6 * q.scale, p.color);
    }
    c.globalAlpha = 1;
    // Subtle vignette keeps the action area readable without dark lane borders.
    const shade = c.createLinearGradient(0, H * 0.88, 0, H);
    shade.addColorStop(0, "#143a4400");
    shade.addColorStop(1, "#143a4440");
    this.rect(0, H * 0.88, W, H * 0.12, shade);
    this.lastFrame++;
  }
  background() {
    const c = this.ctx,
      W = this.width,
      H = 720;
    this.rect(0, 0, W, H, "#bdd2ca");
    if (this.sky.complete && this.sky.naturalWidth) {
      const scale = Math.max(
          W / this.sky.naturalWidth,
          H / this.sky.naturalHeight,
        ),
        sw = W / scale,
        sh = H / scale;
      const sx = (this.sky.naturalWidth - sw) / 2;
      c.drawImage(this.sky, sx, 0, sw, sh, 0, 0, W, H);
    }
    const position = this.distance % (SECTOR_LENGTH * 3);
    const mine =
      clamp((position - 920) / 60, 0, 1) * clamp((1440 - position) / 60, 0, 1);
    if (mine > 0 && this.cave.complete && this.cave.naturalWidth) {
      const scale = Math.max(
        W / this.cave.naturalWidth,
        H / this.cave.naturalHeight,
      );
      const sw = W / scale,
        sh = H / scale;
      c.globalAlpha = mine;
      c.drawImage(
        this.cave,
        (this.cave.naturalWidth - sw) / 2,
        0,
        sw,
        sh,
        0,
        0,
        W,
        H,
      );
      c.globalAlpha = 1;
    }
    const valley = c.createLinearGradient(0, H * 0.46, 0, H);
    valley.addColorStop(0, "#3b747300");
    valley.addColorStop(
      1,
      `rgb(${Math.round(lerp(63, 23, mine))},${Math.round(lerp(129, 60, mine))},${Math.round(lerp(140, 79, mine))})`,
    );
    this.rect(0, H * 0.46, W, H * 0.54, valley);
  }
  road() {
    const c = this.ctx,
      base = Math.floor((this.distance - 66) / 6) * 6;
    for (let abs = base + SIGHT + 78; abs >= base; abs -= 6) {
      const zn = abs - this.distance,
        zf = zn + 6;
      if (zn > SIGHT || zf < -62) continue;
      const bio = BIOMES[biomeAt(abs)],
        mode = bio.mode;
      const far = Math.min(SIGHT, zf),
        near = Math.max(-62, zn);
      const pts = this.quad(-1.5, 1.5, far, near),
        ys = this.project(0, far).y,
        ye = this.project(0, near).y;
      this.path(pts, bio.stone);
      if (mode !== "bridge" && this.stone.complete && this.stone.naturalWidth) {
        c.save();
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
        c.closePath();
        c.clip();
        const sourceY =
          ((((Math.floor(abs / 6) % 8) + 8) % 8) * this.stone.naturalHeight) /
          8;
        c.globalAlpha = mode === "cart" ? 0.13 : 0.6;
        c.drawImage(
          this.stone,
          0,
          sourceY,
          this.stone.naturalWidth,
          this.stone.naturalHeight / 8,
          pts[3][0],
          ys,
          pts[2][0] - pts[3][0],
          ye - ys + 0.6,
        );
        c.globalAlpha = 1;
        c.restore();
      }
      if (mode === "bridge") {
        const p = this.project(0, near);
        this.line([pts[3], pts[2]], "#4d504e", 1.2 * p.scale);
        for (const lane of [-0.95, 0, 0.95]) {
          const q = this.project(lane, near + 0.7);
          this.line(
            [
              [q.x - 9 * p.scale, q.y],
              [q.x + 17 * p.scale, q.y],
            ],
            "#d5b89355",
            p.scale,
          );
        }
      } else if (mode === "cart") {
        this.line([pts[3], pts[2]], "#465e6466", 1);
        // Gauge comes from the cart's 38 px wheel spacing, not lane width.
        const gauge = 19 / ((this.project(0, 0).half * 2) / 3);
        for (const lane of [-1, 0, 1]) {
          const tie = this.project(lane, near);
          this.line(
            [
              [tie.x - 27 * tie.scale, tie.y],
              [tie.x + 27 * tie.scale, tie.y],
            ],
            "#635b50",
            3 * tie.scale,
          );
          for (const side of [-gauge, gauge]) {
            const a = this.project(lane + side, far),
              b = this.project(lane + side, near);
            this.line(
              [
                [a.x, a.y],
                [b.x, b.y],
              ],
              "#32484d",
              3 * Math.max(0.2, b.scale),
            );
            this.line(
              [
                [a.x, a.y - 1],
                [b.x, b.y - 1],
              ],
              "#c3c8ac",
              Math.max(0.4, b.scale),
            );
          }
        }
      }
      for (const side of [-1, 1]) {
        this.path(this.quad(side * 1.5, side * 1.59, far, near), bio.edge);
        const a = this.project(side * 1.6, far),
          b = this.project(side * 1.6, near);
        this.line(
          [
            [a.x, a.y],
            [b.x, b.y],
          ],
          "#38595e",
          Math.max(0.5, b.scale * 1.5),
        );
      }
      // World-anchored seams: no opaque central strip and no giant dark shoulders.
      for (const l of [-0.5, 0.5]) {
        const a = this.project(l, far),
          b = this.project(l, near);
        this.line(
          [
            [a.x, a.y],
            [b.x, b.y],
          ],
          "#e8dfb24d",
          Math.max(0.4, b.scale * 0.8),
        );
      }
      const fog = clamp(zn / SIGHT, 0, 1) ** 4;
      if (fog > 0) {
        c.globalAlpha = fog * 0.8;
        this.path(pts, this.biome === 2 ? "#668c8c" : "#cad9c0");
        c.globalAlpha = 1;
      }
    }
    // Soft haze hides the finite draw distance, not a black vanishing-point cap.
    const h = 720 * 0.255,
      g = c.createLinearGradient(0, h - 7, 0, h + 30);
    g.addColorStop(0, this.biome === 2 ? "#668c8c00" : "#cad9c000");
    g.addColorStop(0.5, this.biome === 2 ? "#668c8c88" : "#cad9c088");
    g.addColorStop(1, "#cad9c000");
    this.rect(this.width * 0.35, h - 7, this.width * 0.3, 37, g);
  }
  scenery() {
    const base = Math.floor(this.distance / 24) * 24 - 48;
    for (let i = 8; i >= 0; i--) {
      const abs = base + i * 24,
        z = abs - this.distance;
      if (z < -49 || z > SIGHT) continue;
      const bio = BIOMES[biomeAt(abs)];
      for (const side of [-1, 1]) {
        const q = this.project(side * 1.53, z),
          s = q.scale;
        const x = q.x,
          y = q.y;
        if (bio.mode === "cart") {
          this.line(
            [
              [x, y],
              [x - side * 4 * s, y - 125 * s],
              [x - side * 11 * s, y - 137 * s],
            ],
            "#254451",
            13 * s,
          );
          this.line(
            [
              [x - side * 2 * s, y],
              [x - side * 6 * s, y - 125 * s],
              [x - side * 12 * s, y - 136 * s],
            ],
            "#779789",
            7 * s,
          );
          this.rect(x - 5 * s, y - 90 * s, 10 * s, 15 * s, "#f0c276", 2 * s);
          this.oval(x, y - 82 * s, 9 * s, 12 * s, "#eebc5d20");
        } else {
          this.rect(
            x - 10 * s,
            y - 55 * s,
            20 * s,
            57 * s,
            bio.mode === "bridge" ? "#75614f" : "#8a9d81",
            2 * s,
          );
          this.rect(x - 13 * s, y - 58 * s, 26 * s, 8 * s, bio.edge, 2 * s);
          this.rect(x - 7 * s, y - 43 * s, 5 * s, 32 * s, "#d7d0a388", 1 * s);
          if (bio.mode === "bridge" && i < 8) {
            const n = this.project(side * 1.53, z + 24);
            this.line(
              [
                [x, y - 35 * s],
                [(x + n.x) / 2, (y + n.y) / 2 - 20 * s],
                [n.x, n.y - 35 * n.scale],
              ],
              "#c7b084",
              2.4 * s,
            );
          }
          if (i % 2) {
            this.line(
              [
                [x, y - 50 * s],
                [x + side * 13 * s, y - 67 * s],
              ],
              "#798962",
              2 * s,
            );
            for (let k = 0; k < 4; k++)
              this.oval(
                x + side * (5 + k * 4) * s,
                y - (55 + k * 3) * s,
                5 * s,
                2 * s,
                "#729775",
              );
          }
        }
      }
    }
  }
  block(lane, z, height, width = 0.83, material = "stone") {
    const c = this.ctx,
      front = this.project(lane, z),
      back = this.project(lane, z + 2.3),
      s = front.scale;
    const laneWidth = (front.half * 2) / 3,
      w = (laneWidth * width) / 2,
      h = height * 720 * 0.052 * s;
    const bw = (((back.half * 2) / 3) * width) / 2;
    const isWood = material === "wood";
    const gradient = c.createLinearGradient(
      front.x - w,
      front.y - h,
      front.x + w,
      front.y,
    );
    gradient.addColorStop(0, isWood ? "#ba8557" : "#739b98");
    gradient.addColorStop(1, isWood ? "#775544" : "#345e69");
    this.path(
      [
        [front.x - w, front.y],
        [front.x - w, front.y - h],
        [front.x + w, front.y - h],
        [front.x + w, front.y],
      ],
      gradient,
      "#435e58",
      1.4 * s,
    );
    this.path(
      [
        [front.x - w, front.y - h],
        [back.x - bw, back.y - h * 0.96],
        [back.x + bw, back.y - h * 0.96],
        [front.x + w, front.y - h],
      ],
      isWood ? "#dfb179" : "#b2c8b6",
      "#607567",
      s,
    );
    this.path(
      [
        [front.x + w, front.y],
        [back.x + bw, back.y],
        [back.x + bw, back.y - h * 0.96],
        [front.x + w, front.y - h],
      ],
      isWood ? "#80644f" : "#345363",
    );
    this.line(
      [
        [front.x - w + 4 * s, front.y - h + 5 * s],
        [front.x + w - 4 * s, front.y - h + 5 * s],
      ],
      "#f8e4b499",
      1.5 * s,
    );
    if (isWood) {
      for (let k = 0; k < 3; k++)
        this.line(
          [
            [front.x - w + 8 * s, front.y - h * (0.3 + k * 0.2)],
            [front.x + w - 8 * s, front.y - h * (0.35 + k * 0.2)],
          ],
          "#684f4566",
          1.2 * s,
        );
    } else {
      this.line(
        [
          [front.x - w * 0.5, front.y - h * 0.75],
          [front.x - w * 0.15, front.y - h * 0.66],
          [front.x - w * 0.3, front.y - h * 0.4],
        ],
        "#596f5f80",
        1.5 * s,
      );
      this.rect(
        front.x - 7 * s,
        front.y - h * 0.62,
        14 * s,
        17 * s,
        "#e5cc8988",
        2 * s,
      );
    }
    return front;
  }
  row(row, z) {
    const c = this.ctx;
    if (row.kind === "fork") {
      this.fork(z);
      return;
    }
    for (const lane of [-1, 0, 1]) {
      const kind = row.layout[lane + 1];
      if (kind === ".") continue;
      const q = this.project(lane, z),
        s = q.scale;
      if (kind === "O") {
        const pts = this.quad(
          lane - 0.49,
          lane + 0.49,
          z + row.length / 2,
          z - row.length / 2,
        );
        this.path(pts, "#244c5b");
        this.line([pts[0], pts[1]], "#5b7061", 4 * s);
        this.line([pts[3], pts[2]], "#f0cf8d", 3 * s);
        this.line(
          [
            [pts[3][0] + 4 * s, pts[3][1] + 2 * s],
            [pts[2][0] - 4 * s, pts[2][1] + 2 * s],
          ],
          "#4e634e",
          3 * s,
        );
        for (const side of [-1, 1]) {
          const p = this.project(lane + side * 0.36, z + row.length / 2 + 0.8);
          this.path(
            [
              [p.x - 4 * s, p.y],
              [p.x + 4 * s, p.y],
              [p.x, p.y - 5 * s],
            ],
            "#f7ce7b",
          );
        }
        continue;
      }
      this.oval(q.x, q.y + 3 * s, q.half * 0.2, 4 * s, "#38544f26");
      if (kind === "#") this.block(lane, z, 2.8, 0.82, "stone");
      if (kind === "J") {
        this.block(lane, z, 0.94, 0.9, "wood");
        for (const side of [-1, 1]) {
          const x = q.x + side * q.half * 0.235;
          this.rect(x - 3 * s, q.y - 40 * s, 6 * s, 40 * s, "#9d7c56", 2 * s);
          this.rect(x - 5 * s, q.y - 40 * s, 10 * s, 7 * s, "#f0cc82", 2 * s);
        }
        this.path(
          [
            [q.x - 6 * s, q.y - 23 * s],
            [q.x, q.y - 28 * s],
            [q.x + 6 * s, q.y - 23 * s],
          ],
          null,
          "#f6dfae",
          2 * s,
        );
      }
      if (kind === "S") {
        const hw = q.half * 0.31,
          top = q.y - 116 * s,
          bottom = q.y - 44 * s;
        for (const side of [-1, 1]) {
          this.rect(
            q.x + side * hw - 5 * s,
            top,
            10 * s,
            q.y - top,
            "#677a69",
            2 * s,
          );
          this.rect(
            q.x + side * hw - 6 * s,
            top - 3 * s,
            12 * s,
            6 * s,
            "#dfc991",
            1 * s,
          );
        }
        const beam = c.createLinearGradient(0, top, 0, bottom);
        beam.addColorStop(0, "#b28059");
        beam.addColorStop(1, "#735449");
        this.rect(
          q.x - hw - 3 * s,
          top,
          hw * 2 + 6 * s,
          bottom - top,
          beam,
          3 * s,
        );
        this.rect(q.x - hw, top + 5 * s, hw * 2, 4 * s, "#efe0ad");
        for (let i = -1; i <= 1; i++) {
          this.path(
            [
              [q.x + i * hw * 0.52 - 5 * s, bottom - 13 * s],
              [q.x + i * hw * 0.52, bottom - 8 * s],
              [q.x + i * hw * 0.52 + 5 * s, bottom - 13 * s],
            ],
            null,
            "#f9deb0",
            2 * s,
          );
        }
        this.line(
          [
            [q.x - hw, bottom],
            [q.x + hw, bottom],
          ],
          "#493e3566",
          1.4 * s,
        );
      }
    }
  }
  fork(z) {
    const c = this.ctx;
    for (const lane of [-1, 0, 1]) {
      const q = this.project(lane, z),
        s = q.scale,
        r = ROUTES[lane + 1];
      c.globalAlpha = clamp(s * 1.6, 0, 1);
      this.rect(
        q.x - 36 * s,
        q.y - 102 * s,
        72 * s,
        46 * s,
        "#24444fdd",
        5 * s,
      );
      this.rect(q.x - 36 * s, q.y - 102 * s, 72 * s, 3 * s, r.color, 1 * s);
      this.text(r.name, q.x, q.y - 79 * s, 14 * s, r.color);
      this.line(
        [
          [q.x, q.y - 55 * s],
          [q.x, q.y - 5 * s],
        ],
        "#bfd0ab",
        2 * s,
      );
      this.path(
        [
          [q.x - 10 * s, q.y - 13 * s],
          [q.x, q.y - 7 * s],
          [q.x + 10 * s, q.y - 13 * s],
        ],
        null,
        r.color,
        2 * s,
      );
      c.globalAlpha = 1;
    }
  }
  item(item, z, next) {
    const q = this.project(item.lane, z, item.h),
      s = q.scale,
      c = this.ctx;
    const bob = Math.sin(this.time * 3 + item.id) * 2 * s,
      y = q.y + bob;
    if (item.type === "coin") {
      const pulse = 0.73 + Math.sin(this.time * 3 + item.id * 0.15) * 0.2;
      this.oval(q.x, y, 7 * s * pulse, 8 * s, "#8f764c");
      this.oval(q.x - 1 * s, y - 1 * s, 5.5 * s * pulse, 7 * s, "#f2d18a");
      this.line(
        [
          [q.x - 1 * s, y - 4 * s],
          [q.x - 1 * s, y + 3 * s],
        ],
        "#fff1b6",
        s,
      );
    } else {
      c.save();
      c.translate(q.x, y);
      c.rotate(Math.sin(this.time * 2 + item.id) * 0.035);
      const col =
        item.type === "letter"
          ? "#c7efdf"
          : item.type === "shield"
            ? "#efce8b"
            : "#a4dbea";
      this.rect(-17 * s, -22 * s, 34 * s, 40 * s, "#2a5a6299", 5 * s);
      this.rect(-15 * s, -21 * s, 30 * s, 35 * s, col, 4 * s);
      this.rect(-12 * s, -18 * s, 24 * s, 29 * s, "#38626a", 3 * s);
      this.text(
        item.type === "letter"
          ? next
            ? this.world.word.en[this.world.word.progress]
            : "✧"
          : item.type === "shield"
            ? "◇"
            : "∩",
        0,
        -2 * s,
        23 * s,
        col,
        800,
      );
      if (next && s > 0.65) {
        this.text("词印", 0, 29 * s, 10 * s, "#eff1cb");
      }
      c.restore();
    }
  }
  limb(points, width, color, highlight) {
    this.line(points, "#243f49", width + 3);
    this.line(points, color, width);
    if (highlight)
      this.line(
        points.map(([x, y]) => [x - 1.2, y - 1.2]),
        highlight,
        width * 0.24,
      );
  }
  player() {
    const w = this.world,
      p = w.player,
      c = this.ctx;
    const x = lerp(p.px, p.x, this.alpha),
      height = lerp(p.ph, p.h, this.alpha),
      ground = this.project(x, 0),
      q = this.project(x, 0, height);
    const sliding = lerp(p.previousPose, p.pose, this.alpha),
      gait = lerp(p.previousGait, p.gait, this.alpha);
    const lean = clamp((p.x - p.px) / 0.0083, -7, 7) * 0.012;
    const mode = BIOMES[this.biome].mode;
    const sectorPos = this.distance % SECTOR_LENGTH;
    const cart =
      mode === "cart"
        ? clamp(sectorPos / 12, 0, 1) *
          clamp((SECTOR_LENGTH - sectorPos) / 12, 0, 1)
        : 0;
    this.oval(ground.x, ground.y + 2, 19 + height * 2, 4.2, "#3e574e40");
    if (w.flow > 0 || w.shield) {
      const color = w.flow > 0 ? "#ffe1a988" : "#b3ecec88";
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(q.x, q.y - 42, 31, 55, 0, 0, TAU);
      c.stroke();
    }
    c.save();
    c.translate(q.x, q.y);
    c.rotate(lean + (p.stumble > 0 ? Math.sin(p.stumble * 24) * 0.08 : 0));
    // Rear view: scarf/backpack/back of hair; no side-facing facial sprite.
    const bob =
      height > 0 || sliding > 0.2 ? 0 : Math.cos(gait * 2) * 1.4 * (1 - cart);
    const pelvisY = -34 + sliding * 22 + bob - cart * 17;
    const torsoY = -66 + sliding * 37 + bob - cart * 17 + cart * sliding * 13;
    if (cart > 0) {
      c.globalAlpha = cart;
      const handle = -55 + sliding * 30;
      this.line(
        [
          [-23, -28],
          [-23, handle],
          [23, handle],
          [23, -28],
        ],
        "#b9c7ab",
        3,
      );
      c.globalAlpha = 1;
    }
    const legs = [];
    for (const side of [-1, 1]) {
      const phase = gait + (side === 1 ? Math.PI : 0),
        swing = Math.sin(phase);
      let footY = height > 0 ? -14 - side * 3 : Math.min(0, swing) * 13;
      let footX = side * 9 + Math.sin(phase) * 2;
      let kneeY = pelvisY + 19 + Math.cos(phase) * 3;
      if (sliding > 0.1) {
        footY = lerp(footY, -1 - side * 3, sliding);
        footX = lerp(footX, side * 16, sliding);
        kneeY = lerp(kneeY, -9, sliding);
      }
      footY = lerp(footY, -18, cart);
      footX = lerp(footX, side * 10, cart);
      kneeY = lerp(kneeY, -29, cart);
      legs.push({ side, swing: swing * (1 - cart), footY, footX, kneeY });
    }
    legs.sort((a, b) => a.swing - b.swing);
    for (const l of legs) {
      this.limb(
        [
          [l.side * 8, pelvisY],
          [l.side * 11, l.kneeY],
          [l.footX, l.footY - 5],
        ],
        8,
        l.swing < 0 ? "#4f6266" : "#657679",
        "#91a197",
      );
      this.rect(l.footX - 5, l.footY - 7, 10, 10, "#5a4c43", 3);
      this.rect(l.footX - 5, l.footY + 1, 10, 3, "#d1b48b", 1);
      if (l.swing < -0.2 && height === 0 && !sliding)
        this.rect(l.footX - 3, l.footY - 4, 6, 5, "#bc9465", 1);
    }
    for (const side of [-1, 1]) {
      const phase = gait + (side === 1 ? Math.PI : 0);
      const handY = lerp(
        height > 0 ? torsoY - 7 : torsoY + 20 + Math.sin(phase) * 9,
        -55 + sliding * 30,
        cart,
      );
      const handX = side * (height > 0 ? 27 : 22) - lean * 14;
      this.limb(
        [
          [side * 15, torsoY + 3],
          [side * 23, torsoY + 12],
          [handX, handY],
        ],
        7,
        "#ba986a",
        "#e7c891",
      );
      this.oval(handX, handY + 1, 4, 4, "#e1bb89");
    }
    const jacket = c.createLinearGradient(-17, torsoY, 17, pelvisY);
    jacket.addColorStop(
      0,
      p.inv > 0 && Math.floor(this.time * 15) % 2 ? "#d8e5c7" : "#76a8a0",
    );
    jacket.addColorStop(1, "#3e777c");
    this.path(
      [
        [-14, torsoY],
        [-18, torsoY + 12],
        [-12, pelvisY + 2],
        [12, pelvisY + 2],
        [18, torsoY + 12],
        [14, torsoY],
      ],
      jacket,
      "#2b4d52",
      2,
    );
    this.line(
      [
        [-11, torsoY + 1],
        [-9, pelvisY],
      ],
      "#dfc796",
      3,
    );
    this.line(
      [
        [11, torsoY + 1],
        [9, pelvisY],
      ],
      "#dfc796",
      3,
    );
    this.rect(-10, torsoY + 9, 20, 24, "#8c7652", 5);
    this.rect(-9, torsoY + 8, 18, 9, "#cfb179", 3);
    this.rect(-3, torsoY + 17, 6, 7, "#efcf91", 1);
    this.line(
      [
        [-6, torsoY + 29],
        [6, torsoY + 29],
      ],
      "#bda579",
      1,
    );
    const headY = torsoY - 13 + sliding * 23;
    this.oval(0, headY, 12, 13, "#8a5c42");
    this.path(
      [
        [-12, headY - 4],
        [-7, headY - 14],
        [0, headY - 16],
        [8, headY - 12],
        [13, headY - 2],
        [7, headY + 4],
        [-6, headY + 3],
      ],
      "#785039",
      "#263e43",
      1.7,
    );
    this.line(
      [
        [-5, headY - 10],
        [3, headY - 12],
        [8, headY - 7],
      ],
      "#b5875b",
      2.2,
    );
    this.rect(-11, headY + 5, 22, 5, "#e4b85d", 2);
    const flutter = Math.sin(this.time * 12) * 3;
    this.path(
      [
        [8, headY + 5],
        [20 + flutter, headY + 13],
        [28 + flutter, headY + 5],
        [21, headY + 21],
        [9, headY + 10],
      ],
      "#e7b469",
      "#ad8051",
      0.8,
    );
    if (cart > 0) {
      c.globalAlpha = cart;
      this.oval(-19, 2, 7, 7, "#253f47");
      this.oval(19, 2, 7, 7, "#253f47");
      this.oval(-19, 2, 3, 3, "#c6c5a1");
      this.oval(19, 2, 3, 3, "#c6c5a1");
      this.path(
        [
          [-27, -28],
          [27, -28],
          [23, 0],
          [-23, 0],
        ],
        "#718b86",
        "#273f4b",
        2.3,
      );
      this.rect(-28, -29, 56, 7, "#d2c39a", 2);
      this.rect(-18, -16, 36, 10, "#415f66", 2);
      this.rect(-4, -14, 8, 6, "#f0c46c", 1);
      for (const side of [-1, 1]) this.oval(side * 21, -20, 2, 2, "#e0cca0");
    }
    c.restore();
    if (w.flow > 0) {
      for (let i = 0; i < 3; i++) {
        const yy = ground.y + 8 + i * 8;
        this.line(
          [
            [ground.x - 10 - i * 3, yy],
            [ground.x - 13 - i * 3, yy + 5],
          ],
          "#f0cb7866",
          1.2,
        );
        this.line(
          [
            [ground.x + 10 + i * 3, yy],
            [ground.x + 13 + i * 3, yy + 5],
          ],
          "#f0cb7866",
          1.2,
        );
      }
    }
  }
}
