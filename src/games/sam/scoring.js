// Module tính tiền/điểm. Tách riêng khỏi engine để chỉnh luật tiền mà không đụng luật bài.
// Mọi khoản đều là một "bút toán" {kind, from, to, amount, label}; điểm của ván = tổng bút toán.
const { P, TWO } = require('./rules');

const DEFAULT_POINTS = Object.freeze({
  sam: 20,        // báo Sâm thành công: ăn mỗi nhà; bị chặn: đền (số nhà - 1) × sam
  trang: 20,      // ăn trắng: mỗi nhà
  cong: 15,       // cóng (chưa đánh được lá nào)
  chat: 10,       // chặt 2 (tứ quý hoặc ba đôi thông)
  chatDeMult: 2,  // hệ số khi bị chặt đè
  thoi2: 0,       // phạt thêm mỗi lá 2 còn trên tay khi thua (0 = như luật cũ: 2 tính như 1 lá thường)
  chainMode: 'last', // 'last': chỉ người chặt đè cuối ăn của người bị đè; 'all': mọi mắt xích đều trả
});

const clampInt = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);

function normalizePoints(p = {}) {
  const d = DEFAULT_POINTS;
  return {
    sam: clampInt(p.sam, 0, 1000, d.sam),
    trang: clampInt(p.trang, 0, 1000, d.trang),
    cong: clampInt(p.cong, 0, 1000, d.cong),
    chat: clampInt(p.chat, 0, 1000, d.chat),
    chatDeMult: clampInt(p.chatDeMult, 1, 10, d.chatDeMult),
    thoi2: clampInt(p.thoi2, 0, 100, d.thoi2),
    chainMode: p.chainMode === 'all' ? 'all' : 'last',
  };
}

/**
 * Chuỗi chặt: {twoBy, choppers: [ghế chặt lần 1, ghế chặt đè lần 2, ...]}.
 * Quy tắc đã thống nhất:
 *  - Chặt 2 một lần: người đánh 2 trả `chat` cho người chặt.
 *  - Có chặt đè: người đánh 2 ban đầu không mất gì; khoản chặt của người bị đè nhân hệ số.
 *    Mắt xích thứ j (j ≥ 1) có giá trị chat × mult^j, do người bị đè trả cho người đè.
 *  - chainMode 'last' (mặc định): chỉ mắt xích cuối được thanh toán (mỗi lần đè xoá khoản trước).
 *    chainMode 'all': mọi mắt xích từ lần đè đầu tiên đều thanh toán.
 */
function chopEntries(chain, pts) {
  if (!chain || !chain.choppers.length) return [];
  const ch = chain.choppers, n = ch.length;
  if (n === 1) {
    return [{ kind: 'chat2', from: chain.twoBy, to: ch[0], amount: pts.chat, label: 'Chặt 2' }];
  }
  const link = j => ({
    kind: 'chatde', from: ch[j - 1], to: ch[j], amount: pts.chat * Math.pow(pts.chatDeMult, j),
    label: `Chặt đè x${Math.pow(pts.chatDeMult, j)}`,
  });
  if (pts.chainMode === 'all') return ch.slice(1).map((_, k) => link(k + 1));
  return [link(n - 1)];
}

/**
 * Bút toán cuối ván.
 * res.type: thuong | sam | chan | trang; res.winner; samBy; hands; played (đã đánh lá nào chưa)
 */
function endEntries(res, g, pts) {
  const n = g.hands.length, w = res.winner, out = [];
  if (res.type === 'chan') {
    out.push({ kind: 'den_sam', from: g.samBy, to: w, amount: pts.sam * (n - 1), label: 'Đền Sâm' });
    return out;
  }
  for (let i = 0; i < n; i++) {
    if (i === w) continue;
    if (res.type === 'sam') out.push({ kind: 'sam', from: i, to: w, amount: pts.sam, label: 'Sâm thành công' });
    else if (res.type === 'trang') out.push({ kind: 'trang', from: i, to: w, amount: pts.trang, label: 'Ăn trắng' });
    else {
      if (!g.played[i]) out.push({ kind: 'cong', from: i, to: w, amount: pts.cong, label: 'Cóng' });
      else if (g.hands[i].length) out.push({ kind: 'la', from: i, to: w, amount: g.hands[i].length, label: `Còn ${g.hands[i].length} lá` });
      const twos = g.hands[i].filter(c => P(c) === TWO).length;
      if (twos && pts.thoi2) out.push({ kind: 'thoi2', from: i, to: w, amount: twos * pts.thoi2, label: `Thối ${twos} lá 2` });
    }
  }
  return out;
}

function deltasOf(entries, n) {
  const d = Array(n).fill(0);
  for (const e of entries) { d[e.from] -= e.amount; d[e.to] += e.amount; }
  return d;
}

module.exports = { DEFAULT_POINTS, normalizePoints, chopEntries, endEntries, deltasOf };
