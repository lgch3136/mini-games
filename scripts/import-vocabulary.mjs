import fs from 'node:fs';
import path from 'node:path';

const sourceDir = process.argv[2];
if (!sourceDir || !fs.existsSync(sourceDir)) {
  throw new Error('usage: node scripts/import-vocabulary.mjs /path/to/data/vocabulary');
}

const rank = { easy: 0, medium: 1, hard: 2 };
const words = new Map();

function levelFor(file, item) {
  const match = file.match(/(?:^g|grade-)(\d+)/i);
  const grade = Number(item.grade || (match && match[1]) || 0);
  if (/adult/i.test(file) || grade >= 10) return 'hard';
  if (grade >= 7) return 'medium';
  return grade ? 'easy' : 'medium';
}

for (const file of fs.readdirSync(sourceDir).filter((name) => name.endsWith('.json')).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
  for (const item of data.vocabulary || []) {
    const en = String(item.word || '').trim().toLowerCase();
    const zh = String(item.meaning || '').trim();
    if (!/^[a-z]{2,16}$/.test(en) || !zh) continue;
    const level = levelFor(file, item);
    const current = words.get(en);
    if (!current || rank[level] < rank[current.level]) words.set(en, { en, zh, level });
  }
}

const bank = { easy: [], medium: [], hard: [] };
for (const { en, zh, level } of [...words.values()].sort((a, b) => a.en.localeCompare(b.en))) {
  bank[level].push({ en, zh });
}
for (const level of Object.keys(bank)) {
  if (bank[level].length < 100) throw new Error(`too few ${level} words: ${bank[level].length}`);
}

const output = `'use strict';\n\n// Generated from paul-learn-english/data/vocabulary.\nwindow.PROJECT_VOCAB = ${JSON.stringify(bank)};\n`;
fs.writeFileSync(new URL('../shared/vocabulary.js', import.meta.url), output);
console.log(Object.fromEntries(Object.entries(bank).map(([level, list]) => [level, list.length])));
