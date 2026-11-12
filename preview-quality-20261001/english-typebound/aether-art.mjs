// Original, resolution-independent storybook rigs. Warm outlines and shared
// lighting keep the traveller, opponents and spelling garden in one world.
const TAU = Math.PI * 2;
export const PALETTES = [
  ['#173f43', '#5f9182', '#d8eaae'],
  ['#1d315d', '#697db6', '#d5eaff'],
  ['#55384e', '#b47772', '#ffe2ae'],
];
export function paintBackdrop(c, w, h, chapter) {
  const p = PALETTES[chapter];
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, p[1]); bg.addColorStop(1, p[0]);
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  // A real layered place remains available if image decoding/network fails.
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = [p[0] + '28', p[0] + '55', p[0] + '99'][layer];
    c.beginPath(); c.moveTo(0, h);
    for (let i = 0; i <= 12; i++) {
      const x = i / 12 * w, y = h * (.38 + layer * .16) + Math.sin(i * 1.4 + layer) * h * .09;
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.closePath(); c.fill();
  }
  c.fillStyle = p[2] + '45'; c.fillRect(0, h * .84, w, 2);
}
export function hero(x, y, s, g, p) {
  const c = this.ctx, t = this.reduced ? 0 : this.motion.time;
  const breathe = this.reduced ? 0 : Math.sin(t * 2.8) * 1.15;
  const color = g.mode !== 'journey' ? '#8cebdc' : ({ember:'#ffdc91', frost:'#a8d9ff', bloom:'#8cebdc'}[g.spell] || '#8cebdc');
  const stroke = '#173d43';
  c.save(); c.translate(x + p.heroX * s, y); c.scale(s, s);
  this.oval(1, 1, 32, 5, '#173d4359');
  // Boots stay planted; the cloak, arm and book react to accepted keys.
  this.shape('M-20 -29 L-8 -27 L-7 -5 Q-9 1 -28 -2 L-27 -8Z', '#59473f', stroke, 2);
  this.shape('M9 -29 L21 -28 L29 -7 Q32 -2 14 0 L9 -5Z', '#675044', stroke, 2);
  c.translate(0, -32 + breathe); c.rotate(p.lean);
  this.shape('M-23 -66 Q-38 -34 -35 0 Q-11 12 20 2 L31 -5 Q24 -45 18 -63Z', '#226c6d', stroke, 2.5);
  this.shape('M-19 -57 Q-27 -32 -19 3 Q-2 8 18 1 L17 -51Z', '#53a39a', null);
  this.shape('M-24 -61 L-8 -46 L19 -62 L22 -52 L-8 -37 L-28 -51Z', '#f1c877', stroke, 1.8);
  this.shape('M-9 -42 L-5 -21 L-15 -9 L-11 -36Z', '#df9c60', null);
  this.shape('M-26 -58 Q-36 -82 -16 -100 Q-1 -118 22 -102 Q38 -87 27 -62 L14 -54Z', '#23696f', stroke, 2.5);
  this.shape('M-15 -90 Q3 -105 20 -89 Q29 -69 12 -62 Q-12 -59 -17 -77Z', '#f6d7a0', stroke, 2);
  this.shape('M-18 -88 Q-1 -108 25 -89 L18 -79 Q9 -95 -3 -81Z', '#284c50', null);
  this.oval(6, -78, 2.2, 3.3, '#183941'); this.oval(19, -79, 2, 3.1, '#183941');
  this.oval(1, -70, 4, 2, '#de998c88');
  this.shape('M10 -69 Q14 -66 18 -70', null, '#955e51', 1.6);
  this.shape('M-25 -48 Q-37 -39 -27 -25 L-11 -34', '#337f7c', stroke, 2);
  // This transform is intentionally identical to presentation.rigAnchors().book.
  const bx = 39 + p.cast * 12, by = -43 - p.cast * 20;
  c.beginPath(); c.moveTo(16, -48); c.quadraticCurveTo(27, by + 4, bx - 6, by + 9);
  c.lineTo(bx - 8, by + 18); c.quadraticCurveTo(22, by + 21, 13, -31); c.closePath();
  c.fillStyle = '#3c9188'; c.fill(); c.strokeStyle = stroke; c.lineWidth = 2; c.stroke();
  this.oval(bx - 1, by + 10, 6, 5, '#f6d7a0', stroke, 1.5);
  c.save(); c.translate(bx, by); c.rotate(-.1 + p.cast * .08);
  this.glow(0, 0, 40, color, .3 + p.cast * .45);
  this.shape('M-23 -7 Q-12 -12 0 -4 Q12 -13 24 -7 L22 13 Q10 8 0 17 Q-12 10 -23 13Z', '#e5ba6e', stroke, 2);
  this.shape('M-21 -10 Q-10 -15 0 -7 Q11 -16 22 -10 L20 9 Q10 4 0 13 Q-10 6 -21 9Z', '#fff0c5', stroke, 1.2);
  this.shape('M0 -7 L0 13 M-17 -4 L-5 -1 M6 -2 L17 -5 M-17 1 L-6 4 M6 3 L17 0', null, '#7c947e', 1.1);
  if (g.cursor > 0) this.star(0, -13, 4 + p.cast * 5, color, t * .3);
  c.restore(); c.restore();
  if (g.mode === 'journey' && (g.shield > 0 || this.motion.guardAge < .6)) {
    this.oval(x + p.heroX * s, y - 65 * s, 48 * s, 72 * s, '#a9f8f01c', '#c6fff0cc', 2);
  }
}
export function enemy(x, y, s, g, p) {
  if (p.death >= 1) return;
  const c = this.ctx, e = g.enemy, t = this.reduced ? 0 : this.motion.time;
  const q = e.charge || 0, floating = e.kind === 'moth' || e.kind === 'wisp';
  const wobble = this.reduced ? 0 : Math.sin(t * 2.4) * (floating ? 5 : 1.2);
  const color = p.flash > .6 ? '#fff4d9' : ({wisp:'#ccb0de',moth:'#a7d9dc',sentinel:'#d9c293',boss:'#e9c291'}[e.kind] || '#ccb0de');
  c.save(); c.globalAlpha = 1 - p.death; c.translate(x + p.enemyX * s, y + (wobble - p.death * 30) * s);
  c.scale(s * (1 + p.flash * .08), s * (1 - p.flash * .07));
  const ink = '#34374d';
  this.oval(0, 1, e.kind === 'boss' ? 42 : 31, 5, '#233e4566');
  this.glow(0, -69, 75, '#dea9f0', .12 + q * .25);
  if (e.kind === 'moth') {
    const flap = this.reduced ? .8 : .76 + Math.sin(t * 5) * .13;
    c.save(); c.translate(0,-70); c.scale(flap,1);
    this.shape('M-7 -9 Q-65 -64 -65 -18 Q-64 20 -16 16 Q-46 39 -23 47 L-1 12 M7 -9 Q65 -64 65 -18 Q64 20 16 16 Q46 39 23 47 L1 12', color, ink, 2.5);
    this.shape('M-14 -5 L-48 -26 L-27 6Z M14 -5 L48 -26 L27 6Z', '#eaf4c8', ink, 1.2);
    this.oval(0, 3, 13, 31, '#5f8a97', ink, 2); this.oval(0,-21,19,17,'#d4edc5',ink,2);
    this.shape('M-8 -36 L-15 -49 M8 -36 L15 -49',null,ink,2);
    this.oval(-7,-23,2.5,4,ink);this.oval(7,-23,2.5,4,ink);c.restore();
  } else if (e.kind === 'sentinel') {
    this.shape('M-29 -26 L-9 -28 L-10 -3 L-32 -3Z M9 -28 L30 -26 L33 -3 L11 -3Z', '#697e76', ink,2.5);
    this.shape('M-30 -85 L27 -85 L36 -27 L-35 -25Z',color,ink,3);
    this.shape('M-19 -82 L17 -82 L22 -35 L-20 -34Z','#789e87',ink,1.8);
    this.shape('M-27 -90 L-20 -115 L19 -117 L31 -94 L24 -73 L-22 -73Z', '#dfd0a5',ink,2.5);
    this.shape('M-19 -91 L20 -91 L18 -82 L-17 -82Z','#304d4c',null);
    this.oval(-8,-87,3,2,'#ddf8b6');this.oval(9,-87,3,2,'#ddf8b6');
    this.shape('M-30 -73 L-44 -54 L-34 -29 L-26 -49 M29 -73 L43 -58 L36 -35',color,ink,5);
    this.star(0,-55,10,'#ffe7aa',.2);
  } else if (e.kind === 'boss') {
    this.shape('M-25 -21 L-30 -4 L-12 -4 M20 -22 L29 -4 L10 -4','#aa7858',ink,4);
    this.shape('M-36 -81 Q-59 -60 -43 -18 L-21 -35 M37 -82 Q59 -60 45 -17 L23 -34','#bf875e',ink,3);
    this.oval(0,-63,39,48,color,ink,3);
    this.shape('M-35 -82 L-38 -117 L-14 -104 Q1 -111 14 -104 L39 -117 L33 -83',color,ink,3);
    this.oval(-17,-83,18,22,'#fff1c9',ink,1.5);this.oval(17,-83,18,22,'#fff1c9',ink,1.5);
    this.oval(-16,-81,5,8,ink);this.oval(16,-81,5,8,ink);
    this.shape('M-8 -74 L0 -61 L8 -74Z','#d28d54',ink,1.4);
    this.shape('M-22 -38 Q0 -24 22 -38 M-18 -49 Q0 -36 18 -49',null,'#ab795b',2);
    this.shape('M-22 -117 L-26 -132 L-10 -124 L0 -140 L11 -124 L27 -133 L22 -117Z','#f4cf7b',ink,2);
  } else {
    this.shape('M-35 -49 Q-52 -104 -5 -113 Q37 -117 38 -77 Q39 -36 22 -14 L11 -24 L0 -12 L-11 -24 L-25 -13Z',color,ink,2.5);
    this.shape('M-24 -51 Q-40 -44 -50 -60 M29 -54 Q41 -62 46 -47',null,color,10);
    this.oval(-11,-77,5,8,ink); this.oval(14,-78,5,8,ink);
    this.oval(-12,-80,1.5,2,'#fff6da'); this.oval(13,-81,1.5,2,'#fff6da');
    this.shape('M-4 -58 Q4 -62 11 -57',null,ink,2);
    this.shape('M-19 -108 L-12 -126 L0 -114 L17 -123 L21 -105','#ead9aa',ink,2);
  }
  if (q > .05) {
    c.strokeStyle = q > .78 ? '#f07759' : '#ffdf94'; c.lineWidth = 3;
    c.beginPath(); c.arc(0,-69,70,-Math.PI/2,-Math.PI/2 + TAU*q); c.stroke();
  }
  c.restore();
}
export function companion(x,y,s) {
  const t = this.reduced ? 0 : this.motion.time;
  y += Math.sin(t*2)*3*s;
  this.glow(x,y,22*s,'#ffdc91',.35);
  this.oval(x,y,7*s,8*s,'#fff2b2','#756943',1);
  this.oval(x+2*s,y-1*s,1*s,1.5*s,'#35524f');
  this.oval(x-7*s,y-3*s,5*s,3*s,'#def5cd99');
}
export function practiceBook(x,y,s,g,p) {
  const c=this.ctx,t=this.reduced?0:this.motion.time;
  const bob=this.reduced?0:Math.sin(t*2)*3;
  c.save();c.translate(x,y);c.scale(s,s);
  this.oval(0,1,38,5,'#244b4666');
  // A wooden reading pedestal visibly collects the words you finish.
  this.shape('M-8 -62 L8 -62 L12 -4 L-13 -4Z','#b89368','#35554e',2);
  this.shape('M-29 -6 L27 -6 L34 1 L-34 1Z','#d1b57b','#35554e',2);
  c.translate(0,-74+bob-p.flash*6);
  this.glow(0,-5,75,'#ffdc91',.22+p.flash*.6);
  this.shape('M-44 -16 Q-22 -30 0 -13 Q23 -30 45 -16 L38 24 Q17 18 0 33 Q-19 20 -40 24Z','#bd9861','#35554e',2.5);
  this.shape('M-42 -21 Q-20 -36 0 -18 Q22 -35 43 -21 L36 17 Q18 9 0 26 Q-18 10 -37 17Z','#fff0c7','#35554e',2);
  this.shape('M0 -18 L0 26 M-32 -13 L-10 -7 M12 -8 L32 -15 M-31 -5 L-11 1 M11 0 L30 -7',null,'#8ba080',1.8);
  const progress=Math.min(1,g.stats.words/Math.max(1,g.focusGoal||g.reviewTarget||20));
  for(let i=0;i<5;i++)this.star(-24+i*12,-43,3.5,i<Math.ceil(progress*5)?'#fff4bf':'#e5d5a37a',.1);
  c.restore();
}
