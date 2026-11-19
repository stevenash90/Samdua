// Gợi ý nước đi + bộ não của máy. Chỉ dùng thông tin công khai:
// bài trên tay của chính người chơi, bài đang trên bàn, số lá còn lại của các nhà, ai đã bỏ lượt, ai báo Sâm.
// Không bao giờ đọc bài kín của đối thủ.
const { P, TWO, checkPlay, classify } = require('./rules');

// giá trị tự nhiên -> hạng
const natToRank = v => (v === 1 || v === 14 ? 11 : v === 2 ? 12 : v - 3);

/** Các bộ bài (theo hạng) có thể tạo từ vector đếm hạng. */
function rankCombos(cnt, withPairs3 = true) {
  const out = [];
  for (let p = 0; p < 13; p++) {
    const c = cnt[p];
    if (!c) continue;
    out.push({ t: 'single', ranks: [p], each: 1 });
    if (c >= 2) out.push({ t: 'pair', ranks: [p], each: 2 });
    if (c >= 3) out.push({ t: 'triple', ranks: [p], each: 3 });
    if (c >= 4) out.push({ t: 'quad', ranks: [p], each: 4 });
  }
  const has = (v, k) => cnt[natToRank(v)] >= k;
  for (let s = 1; s <= 12; s++) {
    // sảnh
    const run = [];
    for (let v = s; v <= 14 && has(v, 1); v++) {
      if (v === 14 && s === 1) break; // không dùng A hai lần
      run.push(natToRank(v));
      if (run.length >= 3) out.push({ t: 'straight', ranks: run.slice(), each: 1 });
    }
    // ba đôi thông (s..s+2; s = 1 là A-2-3, s = 12 là Q-K-A) — chỉ dùng để chặt 2, không tính là một nước đi bình thường
    if (withPairs3 && has(s, 2) && has(s + 1, 2) && has(s + 2, 2)) {
      out.push({ t: 'pairs3', ranks: [natToRank(s), natToRank(s + 1), natToRank(s + 2)], each: 2 });
    }
  }
  return out;
}

function countOf(hand) {
  const cnt = Array(13).fill(0);
  hand.forEach(c => cnt[P(c)]++);
  return cnt;
}

/** Số nước tối thiểu để đánh hết (bỏ qua việc người khác chặn). */
function minMoves(cnt, memo = new Map()) {
  const key = cnt.join('');
  if (memo.has(key)) return memo.get(key);
  const first = cnt.findIndex(c => c > 0);
  if (first < 0) return 0;
  let best = Infinity;
  for (const cb of rankCombos(cnt, false)) {
    if (!cb.ranks.includes(first)) continue;
    const next = cnt.slice();
    cb.ranks.forEach(p => (next[p] -= cb.each));
    best = Math.min(best, 1 + minMoves(next, memo));
  }
  memo.set(key, best);
  return best;
}

/** Chuyển một bộ theo hạng thành các lá cụ thể (lấy lá có id nhỏ nhất). */
function toCards(hand, cb) {
  const pool = hand.slice().sort((a, b) => a - b), out = [];
  for (const p of cb.ranks) {
    let need = cb.each;
    for (const c of pool) if (need && P(c) === p && !out.includes(c)) { out.push(c); need--; }
  }
  return out;
}

/**
 * Gợi ý cho ghế i.
 * view: { hands: [own hand ở ghế i; các ghế khác chỉ cần .length], table, passed, samBy }
 * Trả về { cards } để đánh, hoặc { pass: true }, kèm reason.
 */
function suggest(view, i) {
  const hand = view.hands[i];
  const memo = new Map();
  const baseMoves = minMoves(countOf(hand), memo);
  const n = view.hands.length;
  const others = [];
  for (let k = 1; k < n; k++) others.push((i + k) % n);
  const danger = others.some(j => view.hands[j].length <= 2) || (view.samBy !== null && view.samBy !== undefined && view.samBy !== i);

  const options = [];
  for (const rc of rankCombos(countOf(hand))) {
    const cards = toCards(hand, rc);
    const cb = checkPlay(view, i, cards);
    if (typeof cb !== 'object') continue;
    const rest = hand.filter(c => !cards.includes(c));
    const moves = rest.length ? minMoves(countOf(rest), memo) : 0;
    const usesTwo = cards.some(c => P(c) === TWO);
    options.push({ cards, cb, moves, usesTwo, bomb: cb.t === 'quad' || cb.t === 'pairs3' });
  }
  if (!options.length) return { pass: true, reason: 'Không có bộ nào chặn được' };

  const finish = options.find(o => o.moves === 0);
  if (finish) return { cards: finish.cards, reason: 'Đánh bộ này là hết bài' };

  if (!view.table) {
    // Cầm cái: đánh bộ giữ được cấu trúc tay bài, ưu tiên bài thấp, nhiều lá.
    const nextLen = view.hands[others[0]] ? view.hands[others[0]].length : 99;
    const score = o => o.moves * 100 + (o.usesTwo ? 60 : 0) + (o.bomb ? 80 : 0)
      + (o.cb.t === 'single' && nextLen === 1 ? 200 : 0) + o.cb.k - o.cb.n * 3;
    options.sort((a, b) => score(a) - score(b));
    const o = options[0];
    return { cards: o.cards, reason: o.moves < baseMoves ? 'Đánh bộ thấp, giữ nguyên các bộ còn lại' : 'Đánh lá thấp để dọn bài' };
  }

  // Chặn bài
  const chop = options.find(o => o.bomb && view.table.combo.t === 'single' && view.table.combo.k === TWO);
  if (chop) return { cards: chop.cards, reason: 'Chặt 2 ăn tiền' };
  const keep = options.filter(o => o.moves < baseMoves && (!o.usesTwo || danger || baseMoves <= 3) && (!o.bomb || danger));
  const score = o => o.moves * 100 + o.cb.k + (o.usesTwo ? 30 : 0) + (o.bomb ? 60 : 0);
  if (keep.length) {
    keep.sort((a, b) => score(a) - score(b));
    return { cards: keep[0].cards, reason: 'Chặn bằng bộ nhỏ nhất, không phá bài' };
  }
  if (danger) {
    options.sort((a, b) => score(a) - score(b));
    return { cards: options[0].cards, reason: 'Có nhà sắp hết bài, nên chặn' };
  }
  return { pass: true, reason: 'Chặn sẽ phá bài, nên bỏ lượt' };
}

module.exports = { suggest, minMoves, countOf, rankCombos, toCards };
