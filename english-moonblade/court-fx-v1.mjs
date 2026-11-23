import { drawGuardianTell, drawTempleWave } from "./temple-cues.mjs";
import { clamp, lerp } from "./world.mjs?v=20261124-temple-sweep1";
export function drawCourtFx(world, dt, alpha) {
    const c = this.ctx,
      unit = this.h / this.viewHeight;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Scenery already cleared the shared surface before the actors were drawn.
    if (this.detail && !this.reduced) {
      c.strokeStyle = "rgba(173,205,235,.12)";
      c.lineWidth = 0.75;
      if (world.stage === 0) {
        c.beginPath();
        for (let i = 0; i < 38; i++) {
          const x =
              ((((i * 0.618 - this.elapsed * 0.065) % 1) + 1) % 1) * this.w,
            y = ((i * 0.373 + this.elapsed * 0.7) % 1) * this.h;
          c.moveTo(x, y);
          c.lineTo(x - 3, y + 13);
        }
        c.stroke();
      }
    }
    // The ribbon is made from actual blade endpoints after the model's pose
    // and 3D turn, rather than an unrelated circle painted ahead of the player.
    for (const [id, a] of this.actors) {
      if (!a.root.visible || a.trail.length < 2) continue;
      const hero = id === "hero";
      c.save();
      c.globalCompositeOperation = "lighter";
      const outer = a.trail.map((n) => this.screen(n.tip.x, n.tip.y, n.tip.z));
      const inner = a.trail.map((n) => this.screen(
        n.base.x * 0.46 + n.tip.x * 0.54, n.base.y * 0.46 + n.tip.y * 0.54, n.base.z * 0.46 + n.tip.z * 0.54));
      const curve = (points) => {
        for (let i = 1; i < points.length - 1; i++)
          c.quadraticCurveTo(...points[i], (points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2);
        c.lineTo(...points.at(-1));
      };
      const end = outer.at(-1), begin = outer[0];
      const gradient = c.createLinearGradient(begin[0], begin[1], end[0] + 0.01, end[1] + 0.01);
      gradient.addColorStop(0, hero ? "rgba(72,164,192,0)" : "rgba(202,119,88,0)");
      gradient.addColorStop(0.5, hero ? "rgba(116,229,242,.3)" : "rgba(246,158,97,.2)");
      gradient.addColorStop(1, hero ? "rgba(223,255,255,.66)" : "rgba(255,203,132,.4)");
      c.globalAlpha = (this.reduced || !this.detail ? 0.4 : 0.9) * clamp(1 - a.trail.at(-1).age / 0.1, 0, 1);
      c.fillStyle = gradient;
      c.beginPath(); c.moveTo(...begin); curve(outer);
      inner.reverse(); c.lineTo(...inner[0]); curve(inner); c.closePath(); c.fill();
      c.strokeStyle = hero ? "#e6ffff" : "#f3c699"; c.lineWidth = Math.max(0.8, unit * 0.027);
      c.beginPath(); c.moveTo(...begin); curve(outer); c.stroke();
      c.restore();
    }
    for (const e of world.enemies) {
      if (e.dead || Math.abs(e.x - this.cx) > 14) continue;
      const ex = lerp(e.px, e.x, alpha),
        ey = lerp(e.py, e.y, alpha),
        [x, y] = this.screen(ex, ey + e.h + 0.3);
      if (e.kind === "bat") {
        const [bx, by] = this.screen(ex, ey);
        c.save();
        c.translate(bx, by);
        const wing = Math.sin(this.elapsed * 18 + e.id) * 0.4;
        c.fillStyle = "#272c44";
        c.strokeStyle = "#bc6980";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-unit * 0.6, -unit * wing);
        c.quadraticCurveTo(-unit * 0.28, unit * 0.26, 0, unit * 0.18);
        c.quadraticCurveTo(unit * 0.28, unit * 0.26, unit * 0.6, -unit * wing);
        c.lineTo(unit * 0.18, unit * 0.04);
        c.lineTo(0, -unit * 0.2);
        c.lineTo(-unit * 0.18, unit * 0.04);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = "#ffc18b";
        c.fillRect(-4, -2, 3, 2);
        c.fillRect(2, -2, 3, 2);
        c.restore();
      }
      if (e.state === "tell" && e.kind === "boss") {
        drawGuardianTell(c, x, this.screen(ex, ey)[1], unit, e);
      } else if (e.state === "tell") {
        c.fillStyle = "#ffb18a";
        c.font = `700 ${Math.max(12, unit * 0.4)}px system-ui`;
        c.textAlign = "center";
        c.fillText("!", x, y);
        c.strokeStyle = "rgba(255,111,98,.75)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y - unit * 0.13, unit * 0.33, 0, Math.PI * 2);
        c.stroke();
      }
      if (e.hp < e.maxHp && e.kind !== "boss") {
        c.fillStyle = "#10202be0";
        c.fillRect(x - unit * 0.45, y - 6, unit * 0.9, 3);
        c.fillStyle = "#e7b580";
        c.fillRect(x - unit * 0.45, y - 6, (unit * 0.9 * e.hp) / e.maxHp, 3);
      }
    }
    for (const s of world.projectiles) {
      const [x, y] = this.screen(lerp(s.px, s.x, alpha), s.y);
      if (s.kind === "templeWave") {
        drawTempleWave(c, x, y, unit, s.vx);
        continue;
      }
      const [tx, ty] = this.screen(lerp(s.px, s.x, alpha) - s.vx * 0.025, s.y);
      c.strokeStyle =
        s.owner === "player" ? "rgba(169,226,247,.42)" : "rgba(255,153,110,.5)";
      c.lineWidth = unit * 0.045;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(x, y);
      c.stroke();
      c.save();
      c.translate(x, y);
      c.rotate(s.owner === "player" ? this.elapsed * 24 : 0);
      if (this.detail && !this.reduced) {
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.28;
        c.drawImage(this.glowImage, -unit * 0.42, -unit * 0.42, unit * 0.84, unit * 0.84); c.restore();
      }
      c.fillStyle = s.owner === "player" ? "#d5eced" : "#ff9678";
      if (s.owner === "player") {
        for (let i = 0; i < 4; i++) {
          c.rotate(Math.PI / 2);
          c.beginPath();
          c.moveTo(0, -unit * 0.3);
          c.lineTo(unit * 0.1, unit * 0.07);
          c.lineTo(-unit * 0.07, unit * 0.1);
          c.fill();
        }
      } else {
        c.fillRect(-unit * 0.4, -2, unit * 0.8, 4);
      }
      c.restore();
    }
    this.feedback.draw(c, this.project, unit, this.glowImage, this.reduced || !this.detail);
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < e.life);
  }
