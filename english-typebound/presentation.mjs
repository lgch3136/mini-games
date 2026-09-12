// Presentation has its own clock; it never writes combat state or typing scores.
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const ease = (t) => 1 - (1 - clamp(t)) ** 3;
export const CHAPTER_ART = [
  {
    id: "letterwood",
    name: "雾林来信",
    file: "letterwood-story.webp",
    ink: "#123f45",
    sky: "#a9dbbc",
    light: "#ffdf94",
    magic: "#68ead6",
    accent: "#ff977e",
  },
  {
    id: "tide",
    name: "潮汐藏书馆",
    file: "tide-library-story.webp",
    ink: "#263e70",
    sky: "#a9bcdf",
    light: "#ffd8af",
    magic: "#84e4ff",
    accent: "#e7a3ed",
  },
  {
    id: "sunrise",
    name: "曙光书塔",
    file: "sunrise-observatory-story.webp",
    ink: "#653d5a",
    sky: "#f6c6a3",
    light: "#ffe5a0",
    magic: "#ffbc84",
    accent: "#b6a7ff",
  },
];
export const FLIGHT = { letter: 0.19, word: 0.3, hostile: 0.22 };
export function flightPoint(p, t) {
  const u = clamp(t / p.life);
  return {
    x: p.x0 + (p.x1 - p.x0) * u,
    y: p.y0 + (p.y1 - p.y0) * u + Math.sin(u * Math.PI) * p.bend,
  };
}
export function flowLevel(combo) {
  return Math.min(2, Math.floor(Math.max(0, combo) / 3));
}
// Match the same nested body/book transforms as the drawing rig. Spell origins
// follow the hand even during entry and recoil, rather than firing from empty air.
export function rigAnchors(w, h, s, pose, time, reduced = false) {
  const breathe = reduced ? 0 : Math.sin(time * 2.8) * 1.15;
  const bx = 39 + pose.cast * 12,
    by = -43 - pose.cast * 20;
  const cos = Math.cos(pose.lean),
    sin = Math.sin(pose.lean);
  return {
    book: {
      x: w * 0.24 + (pose.heroX + bx * cos - by * sin) * s,
      y: h * 0.86 + (-32 + breathe + bx * sin + by * cos) * s,
    },
    hero: { x: w * 0.24 + pose.heroX * s, y: h * 0.86 - 74 * s },
    enemy: {
      x: w * 0.77 + pose.enemyX * s,
      y:
        h * 0.86 +
        ((reduced ? 0 : Math.sin(time * 2.4) * 4) - pose.death * 30 - 74) * s,
    },
  };
}

// Closed-form critically damped spring: continuous at every frame rate, no Euler jitter.
export function springStep(p, dt, frequency = 16) {
  const c = p.v + frequency * p.x,
    decay = Math.exp(-frequency * dt);
  p.x = (p.x + c * dt) * decay;
  p.v = (p.v - frequency * c * dt) * decay;
}
export class StoryMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.time = 0;
    this.entry = 0;
    this.castAge = 9;
    this.castPower = 0;
    this.letterAge = 9;
    this.guardAge = 9;
    this.attackAge = 9;
    this.victoryAge = -1;
    this.flow = 0;
    this.combo = 0;
    this.bloom = 0;
    this.hero = { x: 0, v: 0 };
    this.enemy = { x: 0, v: 0 };
    this.pending = [];
    this.impacts = [];
    this.flash = 0;
    this.hurt = 0;
    this.counters = { letters: 0, spells: 0, impacts: 0, words: 0, guards: 0 };
  }
  event(e) {
    if (e.type === "enter") {
      this.entry = 0;
      return;
    }
    if (e.type === "letter" && e.fresh) {
      this.letterAge = 0;
      this.counters.letters++;
      this.queue("letter", FLIGHT.letter, 0.18, e);
    }
    if (e.type === "word") {
      this.castAge = 0;
      this.castPower = e.clean ? 1 : 0.65;
      this.combo = e.combo || 0;
      this.flow = flowLevel(this.combo);
      this.counters.words++;
      this.counters.spells++;
      this.queue("word", FLIGHT.word, this.castPower, e);
    }
    if (e.type === "wrong") {
      this.combo = 0;
      this.flow = 0;
    }
    if (e.type === "guard") {
      this.guardAge = 0;
      this.counters.guards++;
    }
    if (e.type === "hurt") {
      this.attackAge = 0;
      this.queue("hurt", FLIGHT.hostile, e.damage > 0 ? 1 : 0.3, e);
    }
    if (e.type === "victory") this.victoryAge = 0;
  }
  queue(kind, delay, power, detail = {}) {
    this.pending.push({ kind, at: this.time + delay, power, detail });
    if (this.pending.length > 64) this.pending.shift();
  }
  advance(dt) {
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    this.entry += dt;
    this.castAge += dt;
    this.letterAge += dt;
    this.guardAge += dt;
    this.attackAge += dt;
    if (this.victoryAge >= 0) this.victoryAge += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    springStep(this.hero, dt);
    springStep(this.enemy, dt);
    this.bloom +=
      ((this.victoryAge >= FLIGHT.word ? 1 : this.flow / 2) - this.bloom) *
      (1 - Math.exp(-dt * 3));
    let write = 0;
    for (const hit of this.pending) {
      if (this.time + 1e-9 < hit.at) {
        this.pending[write++] = hit;
        continue;
      }
      if (hit.kind === "hurt") {
        this.hero.v -= 155 * hit.power;
        this.hurt = 0.25;
      } else {
        this.enemy.v += (hit.kind === "word" ? 240 : 23) * hit.power;
        this.flash = hit.kind === "word" ? 0.22 : 0.06;
      }
      this.counters.impacts++;
      this.impacts.push(hit);
    }
    this.pending.length = write;
    if (this.impacts.length > 64)
      this.impacts.splice(0, this.impacts.length - 64);
  }
  drain() {
    return this.impacts.splice(0);
  }
  pose(reduced = false) {
    const cast =
      Math.sin(clamp(this.castAge / 0.42) * Math.PI) * this.castPower;
    const entering = 1 - ease(this.entry / 0.8);
    const attack = Math.sin(clamp(this.attackAge / 0.42) * Math.PI);
    const death =
      this.victoryAge < 0 ? 0 : ease((this.victoryAge - FLIGHT.word) / 0.7);
    return {
      heroX: reduced ? 0 : -95 * entering + this.hero.x + cast * 7,
      enemyX: reduced ? 0 : 100 * entering + this.enemy.x - attack * 32,
      cast: reduced ? cast * 0.25 : cast,
      stride: reduced ? 0 : Math.sin(this.entry * 23) * entering,
      lean: reduced ? 0 : cast * 0.085 - this.hero.x * 0.006,
      death,
      flash: clamp(this.flash / 0.22),
      entering,
    };
  }
  snapshot() {
    return {
      ...this.counters,
      pending: this.pending.length,
      flow: this.flow,
      combo: this.combo,
      bloom: this.bloom,
      ...this.pose(),
    };
  }
}
