const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/scoring');
const { cards } = require('./helpers');

const pts = S.normalizePoints({});

test('chặt 2 một lần: người đánh 2 trả tiền chặt', () => {
  const e = S.chopEntries({ twoBy: 0, choppers: [1] }, pts);
  assert.deepStrictEqual(e, [{ kind: 'chat2', from: 0, to: 1, amount: 10, label: 'Chặt 2' }]);
});

test('chặt đè: người đánh 2 không mất, người bị đè trả x2', () => {
  const e = S.chopEntries({ twoBy: 0, choppers: [1, 2] }, pts);
  assert.deepStrictEqual(e.map(x => [x.from, x.to, x.amount]), [[1, 2, 20]]);
  assert.deepStrictEqual(S.deltasOf(e, 3), [0, -20, 20]);
});

test('chuỗi chặt đè nhiều tầng (mặc định chỉ mắt xích cuối)', () => {
  const e = S.chopEntries({ twoBy: 0, choppers: [1, 2, 3] }, pts);
  assert.deepStrictEqual(e.map(x => [x.from, x.to, x.amount]), [[2, 3, 40]]);
});

test('chuỗi chặt đè chế độ all', () => {
  const e = S.chopEntries({ twoBy: 0, choppers: [1, 2, 3] }, Object.assign({}, pts, { chainMode: 'all' }));
  assert.deepStrictEqual(e.map(x => [x.from, x.to, x.amount]), [[1, 2, 20], [2, 3, 40]]);
});

test('kết thúc thường: tính lá, cóng; thối 2 mặc định = 0 (như luật cũ)', () => {
  const g = { hands: [[], cards('3s 2h'), cards('3s 4s 5s 6s 7s 8s 9s 10s Js Qs')], played: [true, true, false], samBy: null };
  const e = S.endEntries({ type: 'thuong', winner: 0 }, g, pts);
  assert.deepStrictEqual(S.deltasOf(e, 3), [17, -2, -15]);
  const e2 = S.endEntries({ type: 'thuong', winner: 0 }, g, Object.assign({}, pts, { thoi2: 5 }));
  assert.deepStrictEqual(S.deltasOf(e2, 3), [22, -7, -15]);
  assert.ok(e2.some(x => x.kind === 'thoi2' && x.amount === 5));
});

test('Sâm thành công, bị bắt Sâm, ăn trắng', () => {
  const g = { hands: [[], [1], [2], [3]], played: [true, true, true, true], samBy: 0 };
  assert.deepStrictEqual(S.deltasOf(S.endEntries({ type: 'sam', winner: 0 }, g, pts), 4), [60, -20, -20, -20]);
  assert.deepStrictEqual(S.deltasOf(S.endEntries({ type: 'chan', winner: 2 }, g, pts), 4), [-60, 0, 60, 0]);
  assert.deepStrictEqual(S.deltasOf(S.endEntries({ type: 'trang', winner: 1 }, g, pts), 4), [-20, 60, -20, -20]);
});

test('tổng điểm luôn bằng 0', () => {
  for (let n = 2; n <= 5; n++) {
    const g = { hands: Array.from({ length: n }, (_, i) => cards('3s 4h 2d').slice(0, i % 3)), played: Array(n).fill(true), samBy: 0 };
    for (const type of ['thuong', 'sam', 'trang']) {
      const d = S.deltasOf(S.endEntries({ type, winner: 0 }, g, pts), n);
      assert.strictEqual(d.reduce((a, b) => a + b, 0), 0);
    }
  }
});

test('normalizePoints chặn giá trị xấu', () => {
  const p = S.normalizePoints({ chat: -5, sam: 'abc', chatDeMult: 99, chainMode: 'hack' });
  assert.strictEqual(p.chat, 0);
  assert.strictEqual(p.sam, 20);
  assert.strictEqual(p.chatDeMult, 10);
  assert.strictEqual(p.chainMode, 'last');
});
