const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/rules');
const A = require('../src/aipro');

const shuffle = (a, r = Math.random) => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
const fresh = hands => ({ hands, table: null, trick: [], piles: hands.map(() => []), passed: hands.map(() => false), played: hands.map(() => false), samBy: null, turn: 0 });

test('máy Pro: nước đi luôn hợp lệ, cầm cái thì không bỏ lượt', () => {
  for (let t = 0; t < 40; t++) {
    const d = shuffle([...Array(52).keys()]);
    const hands = [0, 1, 2, 3].map(i => d.slice(i * 10, i * 10 + 3 + (t % 8)).sort((a, b) => a - b));
    const g = fresh(hands);
    if (t % 2) g.table = { combo: R.classify([d[45]]), by: 1, cards: [d[45]] };
    const s = A.decide(g, 0, { budgetMs: 3, maxSamples: 15, seed: t + 1 });
    if (s.pass) assert.ok(g.table, 'cầm cái không được bỏ lượt');
    else assert.strictEqual(typeof R.checkPlay(g, 0, s.cards), 'object', 'nước đi phải hợp lệ: ' + s.cards);
  }
});

test('máy Pro không nhìn trộm: bài kín của đối thủ khác nhau → cùng một quyết định', () => {
  const d = shuffle([...Array(52).keys()]);
  const mine = d.slice(0, 10).sort((a, b) => a - b);
  const rest = d.slice(10);
  const pick = () => {
    const r = shuffle(rest);
    return A.decide(fresh([mine, r.slice(0, 10), r.slice(10, 20), r.slice(20, 30)]), 0, { budgetMs: 1000, maxSamples: 40, seed: 99 });
  };
  const a = pick(), b = pick(), c = pick();
  assert.deepStrictEqual(a.cards || 'pass', b.cards || 'pass');
  assert.deepStrictEqual(a.cards || 'pass', c.cards || 'pass');
});

test('báo Sâm có tính toán: tay chắc ăn thì báo, tay thường thì không', () => {
  // AAAA 2222 KK: không ai chặn nổi
  assert.ok(A.wantSam([44, 45, 46, 47, 48, 49, 50, 51, 40, 41], 4).yes);
  // lá rời rạc, thấp
  assert.ok(!A.wantSam([0, 5, 10, 15, 20, 26, 30, 37, 41, 46], 4).yes);
  // tỉ lệ báo trên tay ngẫu nhiên phải rất thấp (thực tế ~0,5–1%)
  let yes = 0;
  for (let k = 0; k < 150; k++) if (A.wantSam(shuffle([...Array(52).keys()]).slice(0, 10), 4, 'pro').yes) yes++;
  assert.ok(yes <= 8, `báo Sâm quá nhiều: ${yes}/150`);
});

test('máy Amateur: luôn hợp lệ', () => {
  for (let t = 0; t < 60; t++) {
    const d = shuffle([...Array(52).keys()]);
    const g = fresh([d.slice(0, 8).sort((a, b) => a - b), d.slice(10, 18), d.slice(20, 28)]);
    if (t % 3 === 0) g.table = { combo: R.classify([d[40]]), by: 1, cards: [d[40]] };
    const s = A.amateur(g, 0);
    if (!s.pass) assert.strictEqual(typeof R.checkPlay(g, 0, s.cards), 'object');
  }
});
