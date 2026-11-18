// Tiện ích dựng bài cho test: '3s', '10h', 'Ad', '2c' (s ♠, c ♣, d ♦, h ♥)
const { RANK_NAMES } = require('../src/rules');
const SUIT = { s: 0, c: 1, d: 2, h: 3 };

function card(str) {
  const m = /^(10|[2-9JQKA])([scdh])$/i.exec(str.trim());
  if (!m) throw new Error('bad card ' + str);
  const r = RANK_NAMES.indexOf(m[1].toUpperCase());
  return r * 4 + SUIT[m[2].toLowerCase()];
}
const cards = s => s.trim().split(/\s+/).map(card);

module.exports = { card, cards };
