const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/rules');
const { cards } = require('./helpers');

const cl = s => R.classify(cards(s));
const beats = (a, b, o) => R.beats(cl(a), cl(b), o);

test('nhận diện bộ cơ bản', () => {
  assert.deepStrictEqual(cl('7s'), { t: 'single', n: 1, k: 4 });
  assert.strictEqual(cl('7s 7h').t, 'pair');
  assert.strictEqual(cl('7s 7h 7d').t, 'triple');
  assert.strictEqual(cl('7s 7h 7d 7c').t, 'quad');
  assert.strictEqual(cl('7s 8h'), null);
  assert.strictEqual(cl('3s 4h 6d'), null);
});

test('sảnh: A-2-3 thấp nhất, Q-K-A cao nhất, không có K-A-2', () => {
  assert.deepStrictEqual(cl('As 2h 3d'), { t: 'straight', n: 3, k: 3 });
  assert.deepStrictEqual(cl('2s 3h 4d'), { t: 'straight', n: 3, k: 4 });
  assert.deepStrictEqual(cl('Qs Kh Ad'), { t: 'straight', n: 3, k: 14 });
  assert.strictEqual(cl('Ks Ah 2d'), null);
  assert.ok(beats('Qs Kh Ad', 'Js Qh Kd'));
  assert.ok(!beats('As 2h 3d', '2s 3h 4d'));
  assert.ok(!beats('3s 4h 5d 6c', '3h 4d 5c'), 'khác số lá không chặn được');
});

test('ba đôi thông: nhận diện', () => {
  assert.deepStrictEqual(cl('5s 5h 6s 6h 7s 7h'), { t: 'pairs3', n: 6, k: 7 });
  assert.deepStrictEqual(cl('As Ah 2s 2h 3s 3h'), { t: 'pairs3', n: 6, k: 3 }, 'A-2-3 hợp lệ');
  assert.deepStrictEqual(cl('Qs Qh Ks Kh As Ah'), { t: 'pairs3', n: 6, k: 14 }, 'Q-K-A hợp lệ');
  assert.strictEqual(cl('Ks Kh As Ah 2s 2h'), null, 'K-A-2 không hợp lệ');
  assert.strictEqual(cl('5s 5h 6s 6h 8s 8h'), null, 'không liên tiếp');
  assert.strictEqual(cl('5s 5h 5d 6s 7s 7h'), null, 'không đúng mỗi hạng 2 lá');
  assert.strictEqual(cl('5s 5h 6s 6h'), null, 'hai đôi thông không phải bộ');
});

test('ba đôi thông chặt 2, chặt đè bằng ba đôi thông lớn hơn, bằng nhau không đè', () => {
  assert.ok(beats('5s 5h 6s 6h 7s 7h', '2d'));
  assert.ok(beats('As Ah 2s 2h 3s 3h', '2d'), 'A-2-3 cũng chặt được 2');
  assert.ok(beats('8s 8h 9s 9h 10s 10h', '5s 5h 6s 6h 7s 7h'));
  assert.ok(!beats('5d 5c 6d 6c 7d 7c', '5s 5h 6s 6h 7s 7h'), 'bằng nhau không chặt đè');
  assert.ok(beats('5s 5h 6s 6h 7s 7h', 'As Ah 2s 2h 3s 3h'), 'A-2-3 là nhỏ nhất');
  assert.ok(!beats('5s 5h 6s 6h 7s 7h', 'Ad'), 'không chặt rác thường');
  assert.ok(!beats('5s 5h 6s 6h 7s 7h', '2d 2c'), 'không chặt đôi 2');
});

test('tứ quý chặt 2 và tứ quý lớn chặt đè tứ quý nhỏ; chặt chéo tắt mặc định', () => {
  assert.ok(beats('7s 7h 7d 7c', '2h'));
  assert.ok(beats('9s 9h 9d 9c', '7s 7h 7d 7c'));
  assert.ok(!beats('7s 7h 7d 7c', '9s 9h 9d 9c'));
  assert.ok(!beats('9s 9h 9d 9c', '5s 5h 6s 6h 7s 7h'), 'tứ quý không đè ba đôi thông (chưa xác nhận)');
  assert.ok(!beats('5s 5h 6s 6h 7s 7h', '9s 9h 9d 9c'));
  assert.ok(beats('9s 9h 9d 9c', '5s 5h 6s 6h 7s 7h', { crossChop: true }), 'bật cấu hình chặt chéo');
});

test('chopKind', () => {
  assert.strictEqual(R.chopKind(cl('7s 7h 7d 7c'), cl('2h'), false), 'chat2');
  assert.strictEqual(R.chopKind(cl('8s 8h 9s 9h 10s 10h'), cl('5s 5h 6s 6h 7s 7h'), true), 'chatde');
  assert.strictEqual(R.chopKind(cl('9s 9h 9d 9c'), cl('7s 7h 7d 7c'), false), null, 'tứ quý đè tứ quý không phải chuỗi chặt nếu bộ dưới không phải chặt');
  assert.strictEqual(R.chopKind(cl('8s 8h'), cl('7s 7h'), false), null);
});

test('checkPlay: cấm 2 về cuối, báo 1 phải đánh lá to nhất, phải chặn được', () => {
  const g = { hands: [cards('2s 5h'), cards('9d')], passed: [false, false], table: null };
  assert.strictEqual(R.checkPlay(g, 0, cards('5h')), 'Không được để 2 về cuối');
  assert.strictEqual(R.checkPlay(g, 0, cards('2s')).t, 'single');
  const g2 = { hands: [cards('5h 9s Kd'), cards('9d')], passed: [false, false], table: null };
  assert.strictEqual(R.checkPlay(g2, 0, cards('5h')), 'Nhà dưới báo 1: phải đánh lá to nhất');
  assert.strictEqual(R.checkPlay(g2, 0, cards('Kd')).t, 'single');
  const g3 = { hands: [cards('5h 6h 9s'), cards('9d 3c')], passed: [false, false], table: { combo: cl('8c'), by: 1 } };
  assert.strictEqual(R.checkPlay(g3, 0, cards('5h')), 'Không chặn được bài trên bàn');
  assert.strictEqual(R.checkPlay(g3, 0, cards('9s')).k, 6);
  assert.strictEqual(R.checkPlay(g3, 0, cards('9d')), 'Bài không hợp lệ', 'không được đánh bài người khác');
  assert.strictEqual(R.checkPlay(g3, 0, [cards('9s')[0], cards('9s')[0]]), 'Bài không hợp lệ', 'lá trùng');
  assert.strictEqual(R.checkPlay(g3, 0, ['x']), 'Bài không hợp lệ');
});

test('ăn trắng', () => {
  assert.strictEqual(R.instantWin(cards('2s 2h 2d 2c 3s 5h 7d 9c Js Kh')), 'Tứ quý 2');
  assert.strictEqual(R.instantWin(cards('3s 4h 5d 6c 7s 8h 9d 10c Js Qh')), 'Sảnh rồng');
  assert.strictEqual(R.instantWin(cards('3d 5h 7d 9h Jd Kh Ad 2h 4d 6h')), 'Đồng màu');
  assert.strictEqual(R.instantWin(cards('3s 3h 5d 5c 7s 7h 9d 9c Js Jh')), '5 đôi');
  assert.strictEqual(R.instantWin(cards('3s 3h 4d 4c 5s 6h 7d 8c Js Kh')), null);
});
