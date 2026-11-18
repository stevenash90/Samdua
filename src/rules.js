// Luật bài Sâm Lốc. Thuần hàm, không phụ thuộc trạng thái phòng.
//
// Lá bài: số 0..51. Hạng = id >> 2 (0 = '3' ... 10 = 'K', 11 = 'A', 12 = '2').
// Chất = id & 3 (0 ♠, 1 ♣, 2 ♦, 3 ♥). Sâm không phân chất.
const config = require('./config');

const RANK_NAMES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['♠', '♣', '♦', '♥'];
const TWO = 12;

const P = c => c >> 2;
// Giá trị tự nhiên dùng để xếp sảnh / đôi thông: A = 1, 2 = 2, 3..K = 3..13. A còn đứng cuối = 14.
const nat = p => (p <= 10 ? p + 3 : p === 11 ? 1 : 2);
const isRun = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
const cardName = c => RANK_NAMES[P(c)] + SUITS[c & 3];

// Trả về top của dãy liên tiếp (A thấp hoặc A cao), hoặc null.
function runTop(vals) {
  const ns = vals.slice().sort((a, b) => a - b);
  if (isRun(ns)) return ns[ns.length - 1];
  if (ns[0] === 1) {
    const hi = ns.slice(1).concat(14).sort((a, b) => a - b);
    if (isRun(hi)) return 14;
  }
  return null;
}

/**
 * Nhận diện bộ bài.
 * t: single | pair | triple | quad | straight | pairs3 (ba đôi thông)
 * n: số lá, k: sức mạnh để so (cùng loại, cùng số lá mới so được)
 */
function classify(cs) {
  const n = cs.length;
  if (!n) return null;
  const ps = cs.map(P);
  if (ps.every(p => p === ps[0])) {
    const t = [null, 'single', 'pair', 'triple', 'quad'][n];
    return t ? { t, n, k: ps[0] } : null;
  }
  if (n < 3) return null;
  const cnt = {};
  ps.forEach(p => (cnt[p] = (cnt[p] || 0) + 1));
  const ranks = Object.keys(cnt).map(Number);
  // Ba đôi thông: đúng 6 lá, 3 hạng liên tiếp, mỗi hạng đúng 2 lá. A-2-3 hợp lệ, Q-K-A hợp lệ, K-A-2 không.
  if (n === 6 && ranks.length === 3 && ranks.every(p => cnt[p] === 2)) {
    const top = runTop(ranks.map(nat));
    if (top !== null) return { t: 'pairs3', n, k: top };
    return null;
  }
  if (ranks.length !== n) return null;
  const top = runTop(ps.map(nat));
  return top !== null ? { t: 'straight', n, k: top } : null;
}

const CHOP_TYPES = ['quad', 'pairs3'];
const isTwo = cb => cb && cb.t === 'single' && cb.k === TWO;
const isChopType = cb => cb && CHOP_TYPES.includes(cb.t);

/** a chặn được b? */
function beats(a, b, opts = {}) {
  const cross = opts.crossChop !== undefined ? opts.crossChop : config.CROSS_CHOP;
  if (isChopType(a) && isTwo(b)) return true;                      // tứ quý / ba đôi thông chặt 2
  if (a.t === b.t && a.n === b.n) return a.k > b.k;                  // cùng loại: to hơn mới chặn, bằng nhau không chặn
  if (cross && isChopType(a) && isChopType(b)) return a.t === 'quad'; // (tắt mặc định) tứ quý đè ba đôi thông
  return false;
}

/** Bộ a có phải là "chặt" khi đánh lên b không (chặt 2 hoặc chặt đè một bộ chặt). */
function chopKind(a, b, tableIsChop) {
  if (!b || !isChopType(a)) return null;
  if (isTwo(b)) return 'chat2';
  if (tableIsChop && isChopType(b)) return 'chatde';
  return null;
}

const LABELS = {
  single: 'Rác', pair: 'Đôi', triple: 'Sám', quad: 'Tứ quý', straight: 'Sảnh', pairs3: 'Ba đôi thông',
};
function comboLabel(cb) {
  if (!cb) return '';
  if (cb.t === 'straight') return `Sảnh ${cb.n} lá`;
  return LABELS[cb.t];
}

function nextSeat(g, i) {
  const n = g.hands.length;
  let j = (i + 1) % n;
  while (g.passed[j] && j !== i) j = (j + 1) % n;
  return j;
}

/**
 * Kiểm tra nước đánh của ghế i trên trạng thái ván g ({hands, table, passed}).
 * Trả về combo nếu hợp lệ, hoặc chuỗi báo lỗi.
 */
function checkPlay(g, i, cards, opts) {
  const hand = g.hands[i];
  if (!Array.isArray(cards) || !cards.length || cards.some(c => !Number.isInteger(c)) ||
      new Set(cards).size !== cards.length || !cards.every(c => hand.includes(c))) return 'Bài không hợp lệ';
  const cb = classify(cards);
  if (!cb) return 'Bộ bài không hợp lệ';
  if (g.table && !beats(cb, g.table.combo, opts)) return 'Không chặn được bài trên bàn';
  const rest = hand.filter(c => !cards.includes(c));
  if (rest.length && rest.every(c => P(c) === TWO)) return 'Không được để 2 về cuối';
  if (cb.t === 'single') {
    const nx = nextSeat(g, i);
    if (nx !== i && g.hands[nx].length === 1 && hand.some(c => P(c) > cb.k))
      return 'Nhà dưới báo 1: phải đánh lá to nhất';
  }
  return cb;
}

/** Ăn trắng ngay khi chia bài. */
function instantWin(hand) {
  const cnt = {};
  hand.forEach(c => (cnt[P(c)] = (cnt[P(c)] || 0) + 1));
  if (cnt[TWO] === 4) return 'Tứ quý 2';
  const st = classify(hand);
  if (st && st.t === 'straight') return 'Sảnh rồng';
  if (hand.every(c => (c & 3) >= 2) || hand.every(c => (c & 3) < 2)) return 'Đồng màu';
  if (Object.values(cnt).reduce((s, v) => s + (v >> 1), 0) >= 5) return '5 đôi';
  return null;
}

module.exports = {
  RANK_NAMES, SUITS, TWO, P, nat, cardName, classify, beats, chopKind, isTwo, isChopType,
  comboLabel, nextSeat, checkPlay, instantWin,
};
