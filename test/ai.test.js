const test = require('node:test');
const assert = require('node:assert');
const AI = require('../src/ai');
const R = require('../src/rules');
const { cards } = require('./helpers');

const view = (mine, others, table) => ({
  hands: [cards(mine), ...others.map(n => Array(n).fill(-1))],
  table: table ? { combo: R.classify(cards(table)), by: 1, cards: cards(table) } : null,
  passed: Array(others.length + 1).fill(false), samBy: null,
});

test('minMoves', () => {
  assert.strictEqual(AI.minMoves(AI.countOf(cards('3s 4h 5d 6c 7s'))), 1);
  assert.strictEqual(AI.minMoves(AI.countOf(cards('3s 3h 5d 5c 9s'))), 3);
  assert.strictEqual(AI.minMoves(AI.countOf(cards('5s 5h 6s 6h 7s 7h'))), 2, 'ba đôi thông không đánh tự do được: 2 sảnh 5-6-7');
});

test('cầm cái: đánh hết nếu được', () => {
  const s = AI.suggest(view('3s 4h 5d', [5, 5]), 0);
  assert.deepStrictEqual(s.cards.sort((a, b) => a - b), cards('3s 4h 5d').sort((a, b) => a - b));
});

test('cầm cái: không phá sảnh, đánh lá thấp ngoài bộ', () => {
  const s = AI.suggest(view('3s 6h 7d 8c 9s Kh', [5, 5]), 0);
  assert.ok(s.cards.length >= 1);
  const rest = cards('3s 6h 7d 8c 9s Kh').filter(c => !s.cards.includes(c));
  assert.ok(AI.minMoves(AI.countOf(rest)) <= 2);
});

test('chặn: chặt 2 khi có tứ quý', () => {
  const s = AI.suggest(view('7s 7h 7d 7c 9s', [5, 5], '2h'), 0);
  assert.deepStrictEqual(s.cards.sort((a, b) => a - b), cards('7s 7h 7d 7c').sort((a, b) => a - b));
});

test('gợi ý luôn hợp lệ hoặc bỏ lượt', () => {
  for (let t = 0; t < 300; t++) {
    const deck = Array.from({ length: 52 }, (_, i) => i).sort(() => Math.random() - 0.5);
    const mine = deck.slice(0, 1 + (t % 10));
    const v = { hands: [mine, Array(5).fill(-1)], table: null, passed: [false, false], samBy: null };
    if (t % 2) { const c = deck[20]; v.table = { combo: R.classify([c]), by: 1, cards: [c] }; }
    const s = AI.suggest(v, 0);
    if (s.pass) { assert.ok(v.table, 'cầm cái thì không được bỏ lượt'); continue; }
    assert.strictEqual(typeof R.checkPlay(v, 0, s.cards), 'object', JSON.stringify(s));
  }
});

test('AI không đọc bài kín: kết quả như nhau dù bài đối thủ khác nhau', () => {
  const mine = cards('5s 6h 9d 9c Kh');
  const a = AI.suggest({ hands: [mine, cards('3s 4s 5d'), cards('Ad 2d 2c')], table: null, passed: [false, false, false], samBy: null }, 0);
  const b = AI.suggest({ hands: [mine, cards('Qs Ks As'), cards('3d 3c 4c')], table: null, passed: [false, false, false], samBy: null }, 0);
  assert.deepStrictEqual(a, b);
});
