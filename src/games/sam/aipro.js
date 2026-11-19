// Bộ não máy mức PRO + quyết định báo Sâm.
//
// Nguyên tắc: chỉ dùng thông tin công khai — bài trên tay của chính máy, các lá đã ra (bài trên bàn,
// bài đã đánh của mọi nhà), số lá còn lại của từng nhà, ai đã bỏ lượt, ai báo Sâm. KHÔNG đọc bài kín.
//
// Cách nghĩ (mô phỏng Monte Carlo):
//   1. Các lá chưa thấy = 52 − bài mình − bài đã ra. Chia ngẫu nhiên các lá đó cho các nhà theo đúng số lá họ đang cầm
//      (phần dư coi như bài không chia).
//   2. Với mỗi nước có thể đi, đánh thử nước đó rồi cho cả bàn đánh tiếp tới hết ván bằng lối đánh nhanh.
//   3. Lặp lại nhiều lần (tới khi hết thời gian cho phép), tính tiền thắng/thua trung bình của từng nước,
//      chọn nước lợi nhất. Cùng một lần chia giả định được dùng cho mọi nước để so sánh công bằng.
const R = require('./rules');
const AI = require('./ai');
const { P, TWO, beats } = R;

const natToRank = v => (v === 1 || v === 14 ? 11 : v === 2 ? 12 : v - 3);
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

/* ---------- bộ bài theo vector đếm hạng (nhanh, không phân chất — Sâm không phân chất) ---------- */
// trả về các bộ {t, n, k, ranks, each}; k so sánh giống rules.classify
function gen(c, withPairs3) {
  const out = [];
  for (let p = 0; p < 13; p++) {
    const x = c[p];
    if (!x) continue;
    out.push({ t: 'single', n: 1, k: p, ranks: [p], each: 1 });
    if (x >= 2) out.push({ t: 'pair', n: 2, k: p, ranks: [p], each: 2 });
    if (x >= 3) out.push({ t: 'triple', n: 3, k: p, ranks: [p], each: 3 });
    if (x >= 4) out.push({ t: 'quad', n: 4, k: p, ranks: [p], each: 4 });
  }
  for (let s = 1; s <= 12; s++) {
    if (!c[natToRank(s)]) continue;
    const run = [];
    for (let v = s; v <= 14 && c[natToRank(v)] >= 1; v++) {
      if (v === 14 && s === 1) break;
      run.push(natToRank(v));
      if (run.length >= 3) out.push({ t: 'straight', n: run.length, k: v, ranks: run.slice(), each: 1 });
    }
    if (withPairs3 && s <= 12 && c[natToRank(s)] >= 2 && c[natToRank(s + 1)] >= 2 && c[natToRank(s + 2)] >= 2 && s + 2 <= 14) {
      out.push({ t: 'pairs3', n: 6, k: s + 2, ranks: [natToRank(s), natToRank(s + 1), natToRank(s + 2)], each: 2 });
    }
  }
  return out;
}
const sizeOf = c => { let s = 0; for (let p = 0; p < 13; p++) s += c[p]; return s; };
const take = (c, cb) => { for (const p of cb.ranks) c[p] -= cb.each; };
const put = (c, cb) => { for (const p of cb.ranks) c[p] += cb.each; };
const hasTwo = cb => cb.ranks.includes(TWO);
// sau khi đánh, phần còn lại không được toàn là 2
function leavesOnlyTwos(c, cb) {
  take(c, cb);
  const rest = sizeOf(c), bad = rest > 0 && c[TWO] === rest;
  put(c, cb);
  return bad;
}

/* ---------- lối đánh dùng trong mô phỏng: giữ cấu trúc tay bài như người chơi khá ---------- */
// số nước tối thiểu để đánh hết (không tính ba đôi thông), có bộ nhớ đệm dùng chung
const MM = new Map();
function mm(c) {
  let key = '';
  for (let p = 0; p < 13; p++) key += c[p];
  const hit = MM.get(key);
  if (hit !== undefined) return hit;
  let first = 0; while (first < 13 && !c[first]) first++;
  let best = 0;
  if (first < 13) {
    best = 99;
    for (const cb of gen(c, false)) {
      if (!cb.ranks.includes(first)) continue;
      take(c, cb); const v = 1 + mm(c); put(c, cb);
      if (v < best) best = v;
    }
  }
  if (MM.size > 300000) MM.clear();
  MM.set(key, best);
  return best;
}
function restMoves(c, cb) { take(c, cb); const v = mm(c); put(c, cb); return v; }
function leadPick(c, nextHasOne) {
  const all = gen(c, false).filter(cb => !leavesOnlyTwos(c, cb));
  if (!all.length) return null;
  const total = sizeOf(c);
  const fin = all.find(cb => cb.ranks.length * cb.each === total);
  if (fin) return fin;
  let best = null, bs = Infinity;
  for (const cb of all) {
    const low = cb.t === 'straight' ? cb.ranks[0] : cb.k;
    const s = restMoves(c, cb) * 100 + (hasTwo(cb) ? 60 : 0) + (cb.t === 'quad' ? 80 : 0)
      + (cb.t === 'single' && nextHasOne ? 200 : 0) + low - cb.n * 3;
    if (s < bs) { bs = s; best = cb; }
  }
  if (best.t === 'single' && nextHasOne) {
    // nhà dưới báo 1: đánh lẻ thì phải đánh lá to nhất
    let p = 12; while (p >= 0 && !c[p]) p--;
    return { t: 'single', n: 1, k: p, ranks: [p], each: 1 };
  }
  return best;
}
function respondPick(c, table, urgent, rnd) {
  const base = mm(c), total = sizeOf(c);
  let keep = null, ks = Infinity, any = null, as = Infinity;
  for (const cb of gen(c, true)) {
    if (!beats(cb, table) || leavesOnlyTwos(c, cb)) continue;
    const bomb = cb.t === 'quad' || cb.t === 'pairs3';
    if (bomb && R.isTwo(table)) return cb;                       // có bom thì chặt 2
    if (cb.ranks.length * cb.each === total) return cb;            // đánh là hết bài
    const rm = restMoves(c, cb), two = hasTwo(cb);
    const s = rm * 100 + cb.k + (two ? 30 : 0) + (bomb ? 60 : 0);
    if (s < as) { as = s; any = cb; }
    if (rm < base && (!two || urgent || base <= 3) && (!bomb || urgent) && s < ks) { ks = s; keep = cb; }
  }
  if (keep) return rnd() < 0.05 ? null : keep;
  return urgent ? any : null;
}

/* ---------- mô phỏng một ván tới hết ---------- */
// st: {hands:[counts], played:[bool], table:{cb,by}|null, passed:[], turn, samBy, money:[]}
function nextSeat(st, i) {
  const n = st.hands.length;
  let j = (i + 1) % n;
  while (st.passed[j] && j !== i) j = (j + 1) % n;
  return j;
}
const PTS = { sam: 20, cong: 15, chat: 10 };
function finish(st, w, kind) {
  const n = st.hands.length, m = st.money;
  if (kind === 'chan') { m[st.samBy] -= PTS.sam * (n - 1); m[w] += PTS.sam * (n - 1); return; }
  for (let i = 0; i < n; i++) {
    if (i === w) continue;
    const pay = kind === 'sam' ? PTS.sam : !st.played[i] ? PTS.cong : sizeOf(st.hands[i]);
    m[i] -= pay; m[w] += pay;
  }
}
// đánh bộ cb của ghế i; trả về true nếu ván kết thúc
function applyPlay(st, i, cb) {
  const prev = st.table;
  if (prev && R.isTwo(prev.cb) && (cb.t === 'quad' || cb.t === 'pairs3')) { st.money[prev.by] -= PTS.chat; st.money[i] += PTS.chat; }
  take(st.hands[i], cb);
  st.played[i] = true;
  st.table = { cb, by: i };
  if (st.samBy !== null && i !== st.samBy) { finish(st, i, 'chan'); return true; }
  if (sizeOf(st.hands[i]) === 0) { finish(st, i, st.samBy === i ? 'sam' : 'thuong'); return true; }
  st.turn = nextSeat(st, i);
  if (st.turn === i) { st.table = null; st.passed.fill(false); }
  return false;
}
function applyPass(st, i) {
  st.passed[i] = true;
  const nx = nextSeat(st, i);
  if (st.table && nx === st.table.by) { st.turn = st.table.by; st.table = null; st.passed.fill(false); }
  else st.turn = nx;
}
function playout(st, rnd) {
  const n = st.hands.length;
  for (let step = 0; step < 300; step++) {
    const i = st.turn, c = st.hands[i];
    if (!st.table) {
      const nx = nextSeat(st, i);
      const cb = leadPick(c, nx !== i && sizeOf(st.hands[nx]) === 1);
      if (!cb) { applyPass(st, i); continue; }
      if (applyPlay(st, i, cb)) return;
    } else {
      let urgent = st.samBy !== null && st.samBy !== i;
      if (!urgent) for (let j = 0; j < n; j++) if (j !== i && sizeOf(st.hands[j]) <= 2) { urgent = true; break; }
      const cb = respondPick(c, st.table.cb, urgent, rnd);
      if (cb) { if (applyPlay(st, i, cb)) return; } else applyPass(st, i);
    }
  }
}

/* ---------- thông tin công khai ---------- */
function playedCards(g) {
  const out = [];
  for (const pile of g.piles || []) for (const pl of pile) out.push(...pl.cards);
  for (const pl of g.trick || []) out.push(...pl.cards);
  return out;
}
function countsOf(cards) { const c = new Int8Array(13); for (const x of cards) c[P(x)]++; return c; }
// trình sinh số ngẫu nhiên nhanh, có hạt giống
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function sampleHands(pool, sizes, me, rnd) {
  const a = pool.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const t = a[k]; a[k] = a[j]; a[j] = t; }
  let off = 0;
  return sizes.map((sz, j) => { if (j === me) return null; const h = countsOf(a.slice(off, off + sz)); off += sz; return h; });
}

/* ---------- chọn nước đi (PRO) ---------- */
function candidates(g, i) {
  const hand = g.hands[i], seen = new Set(), out = [];
  for (const rc of AI.rankCombos(AI.countOf(hand))) {
    const cards = AI.toCards(hand, rc);
    const cb = R.checkPlay(g, i, cards);
    if (typeof cb !== 'object') continue;
    const key = cb.t + cb.n + ':' + cb.k + ':' + rc.ranks.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const rest = hand.filter(c => !cards.includes(c));
    out.push({ cards, cb: { t: cb.t, n: cb.n, k: cb.k, ranks: rc.ranks, each: rc.each }, moves: rest.length ? AI.minMoves(AI.countOf(rest)) : 0 });
  }
  return out;
}

function decide(g, i, opt = {}) {
  const budget = opt.budgetMs || 90, maxSamples = opt.maxSamples || 400;
  let cands = candidates(g, i);
  if (!cands.length) return g.table ? { pass: true, reason: 'Không có bộ nào chặn được' } : AI.suggest(g, i);
  const fin = cands.find(o => o.moves === 0);
  if (fin) return { cards: fin.cards, reason: 'Đánh bộ này là hết bài' };
  // gọn danh sách: các nước ít phá bài nhất + nước gợi ý của lối đánh thường
  const base = AI.suggest(g, i);
  cands.sort((a, b) => a.moves - b.moves || a.cb.k - b.cb.k);
  const top = cands.slice(0, 8);
  if (base.cards) {
    const key = base.cards.slice().sort((a, b) => a - b).join();
    const o = cands.find(x => x.cards.slice().sort((a, b) => a - b).join() === key);
    if (o && !top.includes(o)) top.push(o);
  }
  cands = top;
  const moves = cands.map(o => ({ o, pass: false }));
  if (g.table) moves.push({ o: null, pass: true });
  if (moves.length === 1) return moves[0].pass ? { pass: true, reason: 'Không có nước khác' } : { cards: moves[0].o.cards, reason: 'Nước duy nhất' };

  const n = g.hands.length;
  const known = new Set(g.hands[i].concat(playedCards(g)));
  const pool = []; for (let c = 0; c < 52; c++) if (!known.has(c)) pool.push(c);
  const sizes = g.hands.map(h => h.length);
  const sum = moves.map(() => 0);
  const rnd = rng(opt.seed || (Date.now() ^ (i * 7919)));
  const t0 = nowMs();
  let samples = 0;
  while (samples < maxSamples && (samples < 12 || nowMs() - t0 < budget)) {
    const others = sampleHands(pool, sizes, i, rnd);
    const seed = Math.floor(rnd() * 1e9);
    moves.forEach((mv, k) => {
      const hands = others.map((h, j) => (j === i ? countsOf(g.hands[i]) : Int8Array.from(h)));
      const st = {
        hands, played: g.played.slice(), passed: g.passed.slice(), samBy: g.samBy, turn: i, money: Array(n).fill(0),
        table: g.table ? { cb: g.table.combo, by: g.table.by } : null,
      };
      const r2 = rng(seed);
      let over = false;
      if (mv.pass) applyPass(st, i); else over = applyPlay(st, i, mv.o.cb);
      if (!over) playout(st, r2);
      sum[k] += st.money[i];
    });
    samples++;
  }
  let bk = 0;
  for (let k = 1; k < moves.length; k++) if (sum[k] > sum[bk]) bk = k;
  const ev = (sum[bk] / samples).toFixed(1);
  if (moves[bk].pass) return { pass: true, reason: `Tính ${samples} khả năng: bỏ lượt lợi hơn (kỳ vọng ${ev})`, samples };
  return { cards: moves[bk].o.cards, reason: `Tính ${samples} khả năng: nước này lợi nhất (kỳ vọng ${ev})`, samples };
}

/* ---------- mức AMATEUR: lối đánh cũ + đôi khi sai ---------- */
function amateur(g, i, rnd = Math.random) {
  const s = AI.suggest(g, i);
  if (g.table && s.cards && rnd() < 0.15) {
    const danger = g.hands.some((h, j) => j !== i && h.length <= 2);
    if (!danger) return { pass: true, reason: 'Amateur: nhường' };
  }
  if (!g.table && s.cards && rnd() < 0.2) {
    const cs = candidates(g, i).filter(o => o.cb.t !== 'pairs3');
    if (cs.length > 1) { const o = cs[Math.floor(rnd() * Math.min(cs.length, 4))]; return { cards: o.cards, reason: 'Amateur: đánh theo cảm tính' }; }
  }
  return s;
}

/* ---------- báo Sâm có tính toán ---------- */
// Sâm thành công khi chia được tay bài thành các bộ mà không nhà nào chặn nổi (mình luôn cầm cái).
function oppPower(c) {
  const info = { single: -1, pair: -1, triple: -1, quad: -1, st: {}, chop: false };
  for (const cb of gen(c, true)) {
    if (cb.t === 'straight') { if ((info.st[cb.n] || 0) < cb.k) info.st[cb.n] = cb.k; }
    else if (cb.t === 'pairs3') info.chop = true;
    else if (cb.k > info[cb.t]) info[cb.t] = cb.k;
  }
  if (info.quad >= 0) info.chop = true;
  return info;
}
function safeCombo(cb, opps) {
  for (const o of opps) {
    if (cb.t === 'straight') { if ((o.st[cb.n] || 0) > cb.k) return false; }
    else if (o[cb.t] > cb.k) return false;
    if (cb.t === 'single' && cb.k === TWO && o.chop) return false;
  }
  return true;
}
function samable(c, opps) {
  const memo = new Map();
  const go = cc => {
    const tot = sizeOf(cc);
    if (!tot) return true;
    const key = cc.join(',');
    if (memo.has(key)) return memo.get(key);
    let first = 0; while (!cc[first]) first++;
    let ok = false;
    for (const cb of gen(cc, false)) {
      if (!cb.ranks.includes(first) || !safeCombo(cb, opps)) continue;
      // thứ tự đánh không quan trọng (bộ có 2 đánh trước là tránh được luật "không để 2 về cuối")
      take(cc, cb);
      ok = go(cc);
      put(cc, cb);
      if (ok) break;
    }
    memo.set(key, ok);
    return ok;
  };
  return go(Int8Array.from(c));
}
// xác suất báo Sâm thành công, ước lượng từ bài mình cầm (bài người khác chia ngẫu nhiên)
function samChance(hand, nPlayers, opt = {}) {
  const maxS = opt.samples || 300, budget = opt.budgetMs || 120, rnd = rng(opt.seed || Date.now());
  const mine = countsOf(hand), mineSet = new Set(hand);
  const pool = []; for (let c = 0; c < 52; c++) if (!mineSet.has(c)) pool.push(c);
  const sizes = Array(nPlayers).fill(hand.length);
  let ok = 0, s = 0;
  const t0 = nowMs();
  while (s < maxS && (s < 20 || nowMs() - t0 < budget)) {
    const opps = sampleHands(pool, sizes, 0, rnd).filter(Boolean).map(oppPower);
    if (samable(mine, opps)) ok++;
    s++;
  }
  return { p: ok / s, samples: s };
}
const SAM_THRESHOLD = { pro: 0.7, amateur: 0.8 };
function wantSam(hand, nPlayers, level = 'pro') {
  const r = samChance(hand, nPlayers, level === 'pro' ? { samples: 400, budgetMs: 150 } : { samples: 40, budgetMs: 40 });
  return Object.assign(r, { yes: r.p >= SAM_THRESHOLD[level === 'pro' ? 'pro' : 'amateur'] });
}

module.exports = { decide, amateur, samChance, wantSam, samable, oppPower, gen, playedCards, SAM_THRESHOLD };
