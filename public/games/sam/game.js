/* Game Sâm Lốc — phần riêng của game phía trình duyệt: lá bài, bàn chơi, bài trên tay, kết quả, sự kiện & âm thanh ván,
   quản lý bàn (bộ bài, đổi chỗ), thống kê bàn, xem lại. Dùng các hàm nền tảng trong core/app.js. */
'use strict';
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['♠', '♣', '♦', '♥'];
const SLOTS = { 1: ['tc'], 2: ['tl', 'tr'], 3: ['bl', 'tl', 'tr'], 4: ['bl', 'tl', 'tr', 'br'] };
const PAN = { tl: -0.6, bl: -0.6, tr: 0.6, br: 0.6, tc: 0, me: 0 };

/* ================= lá bài ================= */
function cardEl(c, size) {
  const d = h('div', 'card' + (size ? ' ' + size : ''));
  if (c < 0) { d.classList.add('back'); return d; }
  const s = c & 3, r = RANKS[c >> 2];
  if (s >= 2) d.classList.add('r');
  if (r === 'J' || r === 'Q' || r === 'K') { d.classList.add('court'); d.dataset.k = r + 'SCDH'[s]; }   // bộ bài ảnh: J Q K lấy hình theo data-k
  else if (r === 'A') d.classList.add('ace');
  const a = h('div', 'a', r); a.appendChild(h('span', '', SUITS[s]));
  const a2 = h('div', 'a a2', r); a2.appendChild(h('span', '', SUITS[s]));   // chỉ số góc dưới, lộn ngược như bài thật
  const b = h('div', 'b');
  if (d.classList.contains('court')) { b.append(h('i', 'cl', r), h('i', 'cs', SUITS[s])); }
  else b.textContent = SUITS[s];
  d.append(a, b, a2);
  return d;
}
// độ nghiêng cố định theo lá (bài ném xuống bàn không thẳng hàng tăm tắp)
const cardTilt = c => (((c * 37) % 9) - 4) * 0.9;
// nhận diện bộ (chỉ để gợi ý trên giao diện; server mới là người quyết định)
const nat = p => (p <= 10 ? p + 3 : p === 11 ? 1 : 2);
const isRun = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
function runTop(vals) {
  const ns = vals.slice().sort((a, b) => a - b);
  if (isRun(ns)) return ns[ns.length - 1];
  if (ns[0] === 1) { const hi = ns.slice(1).concat(14).sort((a, b) => a - b); if (isRun(hi)) return 14; }
  return null;
}
function classify(cs) {
  const n = cs.length; if (!n) return null;
  const ps = cs.map(c => c >> 2);
  if (ps.every(p => p === ps[0])) { const t = [null, 'single', 'pair', 'triple', 'quad'][n]; return t ? { t, n, k: ps[0] } : null; }
  if (n < 3) return null;
  const cnt = {}; ps.forEach(p => (cnt[p] = (cnt[p] || 0) + 1));
  const ranks = Object.keys(cnt).map(Number);
  if (n === 6 && ranks.length === 3 && ranks.every(p => cnt[p] === 2)) { const t = runTop(ranks.map(nat)); return t !== null ? { t: 'pairs3', n, k: t } : null; }
  if (ranks.length !== n) return null;
  const t = runTop(ps.map(nat)); return t !== null ? { t: 'straight', n, k: t } : null;
}
function beats(a, b) {
  if ((a.t === 'quad' || a.t === 'pairs3') && b.t === 'single' && b.k === 12) return true;
  return a.t === b.t && a.n === b.n && a.k > b.k;
}
function displayOrder(cards) {
  const cs = cards.slice().sort((a, b) => a - b);
  const cb = classify(cs);
  if (!cb || (cb.t !== 'straight' && cb.t !== 'pairs3')) return cs;
  const val = c => { const v = nat(c >> 2); return v === 1 && cb.k === 14 ? 14 : v; };
  return cs.sort((a, b) => val(a) - val(b) || a - b);
}
function comboName(cb, cards) {
  if (!cb) return '';
  const r = RANKS[cards[0] >> 2];
  return { single: 'Rác ' + r, pair: 'Đôi ' + r, triple: 'Sám ' + r, quad: 'Tứ quý ' + r, straight: 'Sảnh ' + cb.n + ' lá', pairs3: 'Ba đôi thông' }[cb.t];
}

/* ================= nhận trạng thái ================= */
let lastGameId = null, dealAnim = false, lastTrickSig = '', resultHidden = {}, taunts = {}, sugCards = null, sugReason = '';
let timerBase = { at: 0, left: 0, total: 1, frozen: true };
let warnedTurn = -1;

GAMES.sam = { name: 'Sâm Lốc', onState: (s, evs, first) => onState(s, evs, first), leave: () => sel.clear() };
function onState(s, evs, first) {
  const prev = S;
  S = s;
  if (S.gameId !== lastGameId) {
    dealAnim = !!lastGameId || (S.phase === 'sam');
    lastGameId = S.gameId; sel.clear(); sugCards = null;
  }
  if (!prev || prev.turnId !== S.turnId) { sugCards = null; sugReason = ''; }
  timerBase = S.timer ? { at: performance.now(), left: S.timer.left, total: S.timer.total || 1, frozen: !!S.timer.frozen } : { at: 0, left: 0, total: 1, frozen: true };
  const away = ['sHistory', 'sStats', 'sReplay', 'sRules'].includes(current) || (current === 'sCreate' && editMode);
  if (!away) showRoomScreen();
  if (!first) handleEvents(evs);
  document.body.dataset.deck = S.deck ? S.deck.style : 0;
  preloadDeck(S.deck ? S.deck.style : 0);
  render();
  onChatState(first);
  checkRequests();
  if ($('rsSheet').classList.contains('on')) renderRstats();
  const meP = S.players[S.you];
  if (meP && !isSpec() && meP.lose >= (S.swapNeed || 10) && !first && store.get('sam_swaphint', '') !== S.code + meP.lose) {
    store.set('sam_swaphint', S.code + meP.lose);
    toast(`😵 Thua ${meP.lose} ván liền — mở ⋯ để xin đổi chỗ giải đen`, 4000);
  }
  if ($('hostSheet').classList.contains('on') && !$('hostBody').querySelector('.hp .btn.gold')) renderHostSheet();
  Sound.music(!!S && S.phase !== 'lobby');
}

/* ================= render ================= */
function render() {
  if (!S) return;
  if (S.phase === 'lobby') return renderLobby();
  renderGame();
}

function renderLobby() {
  const isHost = S.you === S.host;
  $('lbCode').textContent = S.code;
  const box = $('lbPlayers'); box.textContent = '';
  S.players.forEach((p, i) => {
    const it = h('div', 'pitem');
    const pa = h('div', 'pa', p.av);
    pa.append(h('i', 'dot ' + (p.bot || p.online ? (p.afk ? 'afk' : 'on') : '')));
    it.append(pa, h('span', 'nm', p.name));
    if (i === S.host) it.append(h('span', 'tg g', 'Chủ phòng'));
    if (i === S.you) it.append(h('span', 'tg', 'Bạn'));
    if (p.bot) it.append(h('span', 'tg', 'Máy'));
    if (p.score) it.append(h('span', 'tg', sc(p.score)));
    if (p.lose >= 3) it.append(h('span', 'tg o', '🥶 thua ' + p.lose));
    if (isHost && i !== S.you) {
      if (!p.bot) { const c = h('button', 'x', '👑'); c.title = 'Chuyển chủ phòng'; c.onclick = async () => { if (await confirmBox(`Chuyển quyền chủ phòng cho ${p.name}?`)) act('transferHost', { idx: i }); }; it.append(c); }
      const x = h('button', 'x', '✕'); x.onclick = () => act('kick', { idx: i }); it.append(x);
    }
    box.append(it);
  });
  $('lbRules').textContent = '';
  $('lbRules').append(...rulesSummary(S.settings));
  (S.spectators || []).forEach(sp => {
    const it = h('div', 'pitem');
    const pa = h('div', 'pa', sp.av); pa.append(h('i', 'dot ' + (sp.online ? 'on' : '')));
    it.append(pa, h('span', 'nm', sp.name), h('span', 'tg', '👀 Đang xem'));
    box.append(it);
  });
  $('hostCtl').classList.toggle('hide', !isHost);
  $('btStart').classList.toggle('hide', !isHost);
  $('lbWait').classList.toggle('hide', isHost);
  $('btSitLobby').classList.toggle('hide', !isSpec() || S.players.length >= 5);
  setupSwapButton($('btSwapLobby'));
  $('btStart').disabled = S.players.length < 2;
  $('btBot').disabled = S.players.length >= 5;
}
function rulesSummary(st) {
  const p = st.points, out = [];
  const add = (k, v) => { out.push(h('span', '', k + ': ')); out.push(h('b', '', v)); out.push(h('span', '', ' · ')); };
  add('Lượt', st.turnMs / 1000 + 's');
  add('Gợi ý AI', st.ai ? 'bật' : 'tắt');
  add('Tạm dừng', st.pauseLimitMs ? st.pauseLimitMs / 60000 + ' phút/ván' : 'không giới hạn');
  add('Chặt 2', p.chat);
  add('Chặt đè', 'x' + p.chatDeMult + (p.chainMode === 'all' ? ' (mọi tầng)' : ''));
  add('Sâm', p.sam);
  add('Cóng', p.cong);
  add('Thối 2', p.thoi2 ? p.thoi2 + '/lá' : 'không');
  out.pop();
  return out;
}

const isSpec = () => !!S && S.role === 'spec';
const persp = () => (S && S.you >= 0 ? S.you : 0);   // người xem nhìn bàn từ ghế 0

/* ---------- bàn chơi (dùng chung cho chơi thật và xem lại) ---------- */
function slotsFor(n, you) {
  const map = {}; map[you] = 'me';
  const sl = SLOTS[n - 1] || [];
  for (let k = 1; k < n; k++) map[(you + k) % n] = sl[k - 1];
  return map;
}
function rot(i, k) { return (((i * 37 + k * 53) % 9) - 4) * 0.9 + 'deg'; }

function grpEl(g, size, i, k) {
  const e = h('div', 'grp' + (g.chop ? ' chop' : ''));
  e.style.setProperty('--rot', rot(i, k));
  displayOrder(g.cards).forEach(c => e.append(cardEl(c, size)));
  e.title = g.label || '';
  return e;
}

function renderTable(box, vm) {
  box.textContent = '';
  box.classList.toggle('reveal', !!vm.reveal);
  box.append(h('div', 'felt'));
  const n = vm.players.length, map = slotsFor(n, vm.you);
  vm.players.forEach((p, i) => {
    const slot = map[i];
    if (!slot) return;
    // khu bài đã đánh của từng người (giữ tới hết ván)
    const pile = h('div', 'pile pile-' + slot);
    (vm.piles[i] || []).forEach((g, k) => pile.append(grpEl(g, 'm', i, k)));
    box.append(pile);
    // ghế
    const seat = h('div', 'seat slot-' + slot);
    seat.dataset.seat = i;
    if (vm.turn === i) seat.classList.add('turn');
    if (vm.warn && vm.turn === i) seat.classList.add('warn');
    if (vm.winner === i) seat.classList.add('winner');
    if (!p.online && !p.bot) seat.classList.add('off');
    const ring = h('div', 'ring'); ring.append(h('div', 'av', p.av));
    if (vm.showCounts) ring.append(h('div', 'cnt', p.count));
    if (vm.host === i) ring.append(h('div', 'crown', '👑'));
    const plate = h('div', 'plate');
    plate.append(h('div', 'nm', i === vm.you && vm.meLabel ? vm.meLabel : p.name), h('div', 'sc', sc(p.score) + ' đ'));
    seat.append(ring, plate);
    const bd = h('div', 'badges');
    if (vm.samBy === i) bd.append(h('span', 'bd sam', 'BÁO SÂM'));
    if (vm.showCounts && p.count === 1 && vm.phase === 'play') bd.append(h('span', 'bd one', 'BÁO 1'));
    if (p.passed) bd.append(h('span', 'bd pass', 'PASS'));
    if (p.auto) bd.append(h('span', 'bd auto', 'MÁY ĐÁNH THAY'));
    else if (!p.bot && !p.online) bd.append(h('span', 'bd off', 'MẤT KẾT NỐI'));
    else if (p.afk) bd.append(h('span', 'bd afk', 'AFK'));
    if (bd.childNodes.length) seat.append(bd);
    if (vm.openHands && vm.openHands[i] && i !== vm.you) {
      const oh = h('div', 'openhand');
      vm.openHands[i].forEach(c => oh.append(cardEl(c, 'm')));
      seat.append(oh);
    }
    const tb = vm.taunts && vm.taunts[i];
    if (tb) seat.append(h('div', 'bub' + (tb.chat ? ' chat' : ''), tb.text));
    box.append(seat);
  });
  // giữa bàn: vòng hiện tại — mọi bộ trong vòng đều thấy, bộ mới nhất nổi bật
  const center = h('div', 'center');
  const trick = h('div', 'trick');
  const plays = vm.trick || [];
  const sig = plays.map(p => p.cards.join('.')).join('|');
  plays.forEach((pl, k) => {
    const age = plays.length - 1 - k;
    const e = h('div', 'play' + (age === 0 ? ' new' : ' old') + (pl.chop ? ' chop' : ''));
    if (age === 0 && vm.freshSig !== undefined && vm.freshSig !== sig) e.classList.add('fresh');
    const cs = h('div', 'cs');
    const ov = pl.cards.length > 6 ? -40 : pl.cards.length > 3 ? -34 : -26;
    cs.style.setProperty('--ov', ov + 'px');
    displayOrder(pl.cards).forEach(c => { const ce = cardEl(c, age === 0 ? '' : 's'); ce.style.setProperty('--tilt', cardTilt(c) + 'deg'); cs.append(ce); });
    const who = h('div', 'who', (vm.players[pl.by] ? vm.players[pl.by].name : '') + ' · ' + (pl.label || ''));
    if (pl.chop) who.append(h('span', 'ct', pl.chop === 'chat2' ? 'CHẶT' : 'ĐÈ x' + (pl.mult || 2)));
    e.append(cs);
    if (age === 0) e.append(who);
    const dx = -age * 18, dy = -age * 14, sc2 = 1;
    e.style.transform = `translate(${dx}px,${dy}px) scale(${sc2})`;
    e.style.zIndex = 10 - age;
    e.style.opacity = age ? Math.max(0.8, 1 - age * 0.05) : 1;
    trick.append(e);
  });
  if (!plays.length && vm.centerHint) {
    const hi = h('div', '');
    hi.append(h('div', 'hint', vm.centerHint));
    if (vm.centerSub) hi.append(h('div', 'sub', vm.centerSub));
    trick.append(hi);
  }
  center.append(trick);
  if (vm.chain) center.append(h('div', 'chainbox', vm.chain));
  if (vm.log) center.append(h('div', 'logline', vm.log));
  box.append(center);
  return sig;
}

function gameVM() {
  const n = S.players.length;
  const timerFrac = timerFraction();
  let centerHint = '', centerSub = '';
  if (S.phase === 'sam') { centerHint = 'Có ai báo Sâm không?'; centerSub = 'Báo Sâm = đánh hết bài mà không ai chặn được'; }
  else if (S.phase === 'play' && !S.table) centerHint = S.turn === S.you ? 'Bạn cầm cái — đánh gì cũng được' : 'Vòng mới';
  if (isSpec() && S.phase === 'sam') { centerHint = 'Đang chờ báo Sâm…'; centerSub = ''; }
  let chain = '';
  if (S.chain) chain = S.chain.choppers.length > 1 ? `Chặt đè x${Math.pow(S.settings.points.chatDeMult, S.chain.choppers.length - 1)}` : 'Chặt 2';
  return {
    you: persp(), host: S.host, phase: S.phase, players: S.players, piles: S.piles, trick: S.trick, turn: S.turn,
    samBy: S.samBy, showCounts: S.phase !== 'over', reveal: S.phase === 'reveal', winner: S.reveal ? S.reveal.winner : -1,
    warn: S.turn >= 0 && timerFrac.left <= 5000 && !timerFrac.frozen, log: S.log, centerHint, centerSub, chain,
    taunts: activeTaunts(), freshSig: lastTrickSig,
    meLabel: isSpec() ? null : S.samBy === S.you ? 'Bạn báo Sâm' : S.turn === S.you ? 'Đến lượt bạn' : null,
    openHands: S.phase === 'over' && S.result ? S.result.rows.map(r => r.hand) : null,
  };
}
function activeTaunts() {
  const out = {}, now = Date.now();
  for (const k in taunts) if (taunts[k].until > now) out[k] = taunts[k];
  return out;
}

function renderGame() {
  $('gCode').textContent = S.code;
  $('gNo').textContent = S.gameNo ? 'Ván ' + S.gameNo : '';
  const isHost = S.you === S.host;
  const canPause = isHost && (S.phase === 'sam' || S.phase === 'play');
  $('btPause').classList.toggle('hide', !canPause);
  $('btPause').textContent = S.pause ? '▶' : '⏸';
  const ns = (S.spectators || []).length;
  $('gSpec').textContent = '👀 ' + ns; $('gSpec').classList.toggle('hide', !ns);
  const box = $('table');
  lastTrickSig = renderTable(box, gameVM());
  // lớp tạm dừng
  if (S.pause) {
    const ov = h('div', 'pauseov');
    ov.append(h('div', 'pi', '⏸'), h('h3', '', 'Ván đang tạm dừng'));
    const who = S.pause.kind === 'system' ? 'Máy chủ vừa khởi động lại — chờ mọi người vào lại' : `${S.pause.by >= 0 && S.players[S.pause.by] ? S.players[S.pause.by].name : 'Chủ phòng'} tạm dừng`;
    ov.append(h('p', '', who));
    const el = h('p', 'pz', ''); el.dataset.since = String(performance.now() - S.pause.elapsed); ov.append(el);
    if (S.pause.limit && S.pause.kind !== 'system') ov.append(h('p', '', `Hạn mức tạm dừng của ván: ${fmtTime(S.pause.limit)} (đã dùng ${fmtTime(S.pause.used)})`));
    if (isHost) { const b = h('button', 'btn gold', '▶ Tiếp tục'); b.onclick = () => act('resume'); ov.append(b); }
    else ov.append(h('p', '', 'Chỉ chủ phòng mới tiếp tục được'));
    box.append(ov);
  } else if (S.wait && S.phase === 'play') {
    const p = S.players[S.wait.idx];
    const wb = h('div', 'waitbar');
    const sp = h('span', '', `Đang chờ ${p.name} kết nối lại…`); sp.dataset.since = String(performance.now() - S.wait.elapsed); sp.className = 'wz';
    wb.append(sp);
    if (isHost) {
      const b1 = h('button', 'btn slim', '⏸'); b1.onclick = () => act('pause');
      const b2 = h('button', 'btn slim', '🤖 Đánh thay'); b2.onclick = () => act('autoplay', { idx: S.wait.idx });
      wb.append(b1, b2);
    }
    box.append(wb);
  }
  renderHand();
  renderActs();
  renderResult();
  renderAfk();
}

/* ---------- bài trên tay ---------- */
const sel = new Set();
let drag = null;
function renderHand() {
  const hd = $('hand'); hd.textContent = '';
  const hand = S.hand || [];
  [...sel].forEach(c => { if (!hand.includes(c)) sel.delete(c); });
  const W = Math.min(hd.parentElement.clientWidth - 26, 760);   // chừa mép cho bài xếp quạt
  const cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 58;
  const m = hand.length;
  const step = m > 1 ? Math.min(cw + 4, (W - cw) / (m - 1)) : 0;
  hd.style.width = (m ? cw + step * (m - 1) : 0) + 'px';
  hand.forEach((c, k) => {
    const d = cardEl(c);
    d.style.left = (k * step) + 'px';
    // xếp hình quạt nhẹ như cầm bài thật
    const t = m > 1 ? (k - (m - 1) / 2) / ((m - 1) / 2) : 0;
    d.style.setProperty('--rot', (t * 5).toFixed(2) + 'deg');
    d.style.setProperty('--arc', (t * t * 9).toFixed(1) + 'px');
    d.dataset.c = c;
    if (sel.has(c)) d.classList.add('sel');
    if (sugCards && sugCards.includes(c)) d.classList.add('sug');
    if (dealAnim) { d.classList.add('deal'); d.style.animationDelay = (k * 60) + 'ms'; d.style.setProperty('--dx', ((m / 2 - k) * step) + 'px'); }
    hd.append(d);
  });
  dealAnim = false;
  updateHint();
}
function toggleCard(c, on) {
  const want = on !== undefined ? on : !sel.has(c);
  if (want) sel.add(c); else sel.delete(c);
  const d = $('hand').querySelector(`[data-c="${c}"]`);
  if (d) d.classList.toggle('sel', want);
}
// chạm để chọn, vuốt ngang để chọn nhiều lá
$('hand').addEventListener('pointerdown', e => {
  const d = e.target.closest('.card'); if (!d) return;
  const c = +d.dataset.c;
  const on = !sel.has(c);
  drag = { on, seen: new Set([c]) };
  toggleCard(c, on); Sound.play('select'); updateHint(); updateActs();
});
$('hand').addEventListener('pointermove', e => {
  if (!drag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const d = el && el.closest && el.closest('#hand .card'); if (!d) return;
  const c = +d.dataset.c;
  if (drag.seen.has(c)) return;
  drag.seen.add(c); toggleCard(c, drag.on); Sound.play('select'); updateHint(); updateActs();
});
window.addEventListener('pointerup', () => (drag = null));
window.addEventListener('pointercancel', () => (drag = null));

function updateHint() {
  const el = $('hintLine');
  el.className = 'hint-line';
  if (!S || S.phase !== 'play') { el.textContent = ''; return; }
  if (sugReason && !sel.size) { el.textContent = '💡 ' + sugReason; el.classList.add('ai'); return; }
  const cs = [...sel].sort((a, b) => a - b);
  if (!cs.length) { el.textContent = S.turn === S.you ? (S.table ? 'Chọn bài để chặn, hoặc bỏ lượt' : 'Chọn bài để đánh') : ''; return; }
  const cb = classify(cs);
  if (!cb) { el.textContent = 'Không phải bộ hợp lệ'; el.classList.add('bad'); return; }
  const name = comboName(cb, cs);
  if (S.table) {
    const tb = classify(S.table.cards);
    if (tb && beats(cb, tb)) { el.textContent = name + ' · chặn được ✓'; el.classList.add('ok'); }
    else { el.textContent = name + ' · không chặn được'; el.classList.add('bad'); }
  } else { el.textContent = name; el.classList.add('ok'); }
  if (sugReason && sugCards && cs.join() === sugCards.slice().sort((a, b) => a - b).join()) { el.textContent = '💡 ' + name + ' — ' + sugReason; el.className = 'hint-line ai'; }
}

/* ---------- nút hành động ---------- */
function sitButton(cls) {
  const b = h('button', 'btn ' + (cls || 'gold'), '🪑 Vào chơi');
  b.onclick = async () => {
    const j = await api('join', { room: S.code, name: store.get('sam_name', 'Khách'), av: myAv });
    if (j.err) toast(j.err); else { store.set('sam_role', 'player'); toast('Đã vào bàn'); }
  };
  return b;
}
function renderActs() {
  const ac = $('acts'); ac.textContent = '';
  const paused = !!S.pause;
  if (isSpec()) {
    ac.append(h('div', 'spec-note', '👀 Bạn đang xem ván'));
    if ((S.phase === 'over' || S.phase === 'lobby') && S.players.length < 5) ac.append(sitButton());
    return;
  }
  if (S.phase === 'sam') {
    if (S.samPending && !paused) {
      const no = h('button', 'btn', 'Không báo'), yes = h('button', 'btn red', 'Báo Sâm!');
      no.onclick = () => act('sam', { yes: false });
      yes.onclick = async () => { if (await confirmBox('Báo Sâm: phải đánh hết bài mà không ai chặn được. Bị bắt là đền cả làng. Chắc chắn?')) act('sam', { yes: true }); };
      ac.append(no, yes);
    } else ac.append(h('div', 'note', paused ? 'Ván đang tạm dừng' : 'Chờ các nhà khác báo Sâm…'));
  } else if (S.phase === 'play') {
    const myTurn = S.turn === S.you && !paused;
    if (S.settings.ai) {
      const sg = h('button', 'btn sugg', '💡'); sg.title = 'Gợi ý';
      sg.disabled = !myTurn;
      sg.onclick = async () => {
        const r = await act('suggest');
        if (r.suggest) {
          sugReason = r.suggest.reason || '';
          sel.clear();
          if (r.suggest.cards) { sugCards = r.suggest.cards; r.suggest.cards.forEach(c => sel.add(c)); }
          else { sugCards = null; sugReason = 'Nên bỏ lượt — ' + sugReason; }
          renderHand(); updateActs();
        }
      };
      ac.append(sg);
    }
    const ps = h('button', 'btn red', 'Bỏ lượt'); ps.id = 'btPass';
    const pl = h('button', 'btn green', 'Đánh bài'); pl.id = 'btPlay';
    ps.onclick = async () => { ps.disabled = true; const r = await act('pass', { v: S.turnId }); if (r.err) updateActs(); };
    pl.onclick = async () => {
      if (!sel.size) return;
      pl.disabled = true;
      const r = await act('play', { cards: [...sel], v: S.turnId });
      if (!r.err) { sel.clear(); sugCards = null; sugReason = ''; } else updateActs();
    };
    ac.append(ps, pl);
    updateActs();
  } else if (S.phase === 'reveal') {
    ac.append(h('div', 'note', 'Hết ván! Đang mở bài…'));
  } else if (S.phase === 'over') {
    const b = h('button', 'btn gold', 'Xem kết quả'); b.onclick = () => { delete resultHidden[S.gameId]; renderResult(); };
    ac.append(b);
  }
}
function updateActs() {
  if (!S) return;
  const myTurn = S.phase === 'play' && S.turn === S.you && !S.pause;
  const pl = $('btPlay'), ps = $('btPass');
  if (pl) pl.disabled = !myTurn || !sel.size;
  if (ps) ps.disabled = !myTurn || !S.table;
}

/* ---------- AFK ---------- */
function renderAfk() {
  let el = document.querySelector('.afkbar');
  const me = S.players[S.you];
  const afk = me && me.afk && (S.phase === 'sam' || S.phase === 'play');
  if (afk && !el) {
    el = h('div', 'afkbar', 'Bạn có đó không? Chạm để tiếp tục');
    el.onclick = () => { lastActiveSent = 0; markActive(); el.remove(); };
    document.body.append(el);
    Sound.play('notify');
    vibrate([80, 60, 80]);
  } else if (!afk && el) el.remove();
}

/* ---------- kết quả ---------- */
function renderResult() {
  const ov = $('resultOv');
  const old = document.querySelector('.peek'); if (old) old.remove();
  if (current !== 'sGame') return;
  if (!(S && S.phase === 'over' && S.result)) { ov.classList.remove('on'); return; }
  if (resultHidden[S.gameId]) {
    ov.classList.remove('on');
    const pk = h('button', 'btn gold peek', '🧾 Kết quả'); pk.onclick = () => { delete resultHidden[S.gameId]; renderResult(); };
    document.body.append(pk);
    return;
  }
  const isHost = S.you === S.host;
  const box = $('resultPanel');
  fillResult(box, S.result, S.you, names(S.players), {
    replay: isSpec() ? null : () => openReplay(S.gameId),
    swap: true,
    hide: () => { resultHidden[S.gameId] = 1; renderResult(); },
    again: isHost ? () => act('start') : null,
    leave: leaveRoom,
    waitText: isHost ? '' : isSpec() ? 'Bạn đang xem. Bấm "Vào chơi" nếu còn chỗ.' : 'Chờ chủ phòng chia ván mới…',
    sit: isSpec() && S.players.length < 5,
    canAgain: S.players.length >= 2,
  });
  ov.classList.add('on');
}
function names(players) { return players.map(p => p.name); }

function fillResult(box, r, you, nameList, ctl) {
  box.textContent = '';
  box.append(h('h2', '', r.title));
  const mine = r.rows[you];
  if (mine) {
    const d = h('div', 'me-out ' + (mine.delta > 0 ? 'p' : mine.delta < 0 ? 'n' : ''), sc(mine.delta));
    box.append(d);
  }
  if (r.lastCards && r.lastCards.length) {
    const lc = h('div', 'lastc');
    lc.append(h('span', '', r.type === 'trang' ? 'Bài ăn trắng:' : 'Bộ cuối:'));
    const cs = h('div', 'cs'); (r.type === 'trang' ? r.lastCards : displayOrder(r.lastCards)).forEach(c => cs.append(cardEl(c, 's'))); lc.append(cs);
    if (r.lastLabel) lc.append(h('b', '', r.lastLabel));
    box.append(lc);
  }
  r.rows.forEach((row, i) => {
    const e = h('div', 'rrow' + (i === r.winner ? ' win' : ''));
    e.append(h('div', 'ra', i === r.winner ? '🏆' : row.av || ''), h('div', 'nm', row.name + (i === you ? ' (bạn)' : '')));
    e.append(h('div', 'd ' + (row.delta > 0 ? 'p' : row.delta < 0 ? 'n' : ''), sc(row.delta)));
    e.append(h('div', 'tot', row.total !== undefined ? '= ' + row.total : ''));
    const cs = h('div', 'cs');
    if (i === r.winner && !row.hand.length) cs.append(h('span', '', 'Hết bài'));
    else if (row.hand.length) { const hc = h('div', 'hcards'); row.hand.forEach(c => hc.append(cardEl(c, 'm'))); cs.append(hc); }
    if (row.cong) cs.append(h('span', 'tg r', 'Cóng'));
    const t2 = (r.entries || []).find(x => x.kind === 'thoi2' && x.from === i);
    if (t2) cs.append(h('span', 'tg o', 'Thối 2 (−' + t2.amount + ')'));
    if (r.samBy === i) cs.append(h('span', 'tg g', r.type === 'sam' ? 'Sâm ✓' : 'Sâm ✗'));
    if (cs.childNodes.length) e.append(cs);
    box.append(e);
  });
  if (r.entries && r.entries.length) {
    const lg = h('details', 'ledger');
    lg.open = r.entries.length <= 6;
    lg.append(h('summary', '', 'Chi tiết tính tiền'));
    r.entries.forEach(en => {
      const d = h('div', '');
      d.append(h('span', '', `${en.label}: ${r.rows[en.from] ? r.rows[en.from].name : '?'} → ${r.rows[en.to] ? r.rows[en.to].name : '?'}`), h('b', '', String(en.amount)));
      lg.append(d);
    });
    box.append(lg);
  }
  const bt = h('div', 'btns');
  if (ctl.replay) { const b = h('button', 'btn', '▶ Xem lại'); b.onclick = ctl.replay; bt.append(b); }
  if (ctl.hide) { const b = h('button', 'btn', '👀 Xem bàn'); b.onclick = ctl.hide; bt.append(b); }
  if (ctl.leave) { const b = h('button', 'btn', 'Rời phòng'); b.onclick = ctl.leave; bt.append(b); }
  if (ctl.again) { const b = h('button', 'btn gold', 'Ván mới'); b.disabled = !ctl.canAgain; b.onclick = ctl.again; bt.append(b); }
  if (ctl.close) { const b = h('button', 'btn gold', 'Đóng'); b.onclick = ctl.close; bt.append(b); }
  if (ctl.sit) bt.append(sitButton());
  box.append(bt);
  if (ctl.swap) { const sb = h('button', 'btn'); sb.style.width = '100%'; sb.style.marginTop = '8px'; setupSwapButton(sb); box.append(sb); }
  if (ctl.waitText) box.append(h('p', 'muted center', ctl.waitText));
}

function confetti() {
  if (settings.reduce || settings.perf) return;
  const c = h('div', 'confetti');
  const colors = ['#f3c45a', '#3fcf87', '#e0414e', '#7fd1ff', '#fff'];
  for (let i = 0; i < 70; i++) {
    const p = h('i', '');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
    p.style.animationDelay = Math.random() * 0.6 + 's';
    c.append(p);
  }
  document.body.append(c);
  setTimeout(() => c.remove(), 4500);
}

/* ---------- sự kiện: âm thanh, banner, rung ---------- */
function seatPan(i) {
  if (!S) return 0;
  const slot = slotsFor(S.players.length, persp())[i];
  return settings.spatial ? (PAN[slot] || 0) : 0;
}
function banner(text, cls = 'red', sub) {
  const layer = $('bannerLayer');
  const b = h('div', 'banner ' + cls, text);
  if (sub) b.append(h('small', '', sub));
  layer.textContent = ''; layer.append(b);
  setTimeout(() => b.remove(), 1700);
}
function shakeTable() {
  if (settings.reduce) return;
  const t = $('table'); t.classList.remove('shake', 'flash'); void t.offsetWidth; t.classList.add('shake', 'flash');
}
function nameOf(i) { return S && S.players[i] ? S.players[i].name : ''; }

const genderOf = i => (S && S.players[i] ? S.players[i].gender : 'nam');
/* Giọng đọc: 2 bộ thu sẵn (Nữ 'f', Nam 'm').
 * - Câu gắn với một người chơi (ra bài, chặt, báo/bắt Sâm…): nếu bật "Thoại người chơi" thì đọc bằng giọng theo giới tính người đó.
 * - Còn lại (đến lượt, còn 5 giây, mời người tiếp theo…) hoặc khi tắt thoại người chơi: MC đọc, giọng MC chọn trong cài đặt.
 * Bộ nào thiếu câu thì dùng bộ kia. */
const mcPack = () => (settings.mcGender === 'nam' ? 'm' : 'f');
function voiceLine(key, actor, pri, opt = {}) {
  const gOf = opt.genderOf || genderOf, panOf = opt.pan || seatPan;
  if (actor !== undefined && actor !== null && actor >= 0 && settings.pvoice) {
    const pk = gOf(actor) === 'nu' ? 'f' : 'm';
    if (Sound.line(pk, key, 'player', pri + 1, panOf(actor))) return;
    // câu riêng của người chơi (xin đổi chỗ, đồng ý…) chỉ có một bộ giọng thì dùng bộ đó
    if (opt.anyPack && Sound.line(pk === 'f' ? 'm' : 'f', key, 'player', pri + 1, panOf(actor))) return;
    if (key === 'play' || key === 'pass') return;   // không có câu theo giọng người này thì im, không để MC đọc thay
  }
  const pk = mcPack(), alt = pk === 'f' ? 'm' : 'f';
  Sound.line(Sound.has(pk, key) ? pk : alt, key, 'mc', pri, 0);
}
function handleEvents(evs) {
  for (const e of evs) {
    const pan = e.by !== undefined ? seatPan(e.by) : 0;
    switch (e.type) {
      case 'deal': Sound.play('shuffle'); setTimeout(() => Sound.play('deal'), 450); dealAnim = true; break;
      case 'samopen': Sound.play('phase'); break;
      case 'sam':
        Sound.play('bao_sam', { pan }); voiceLine('sam', e.by, 3);
        banner('BÁO SÂM!', 'gold', nameOf(e.by)); vibrate(120);
        break;
      case 'start':
        Sound.play('start');
        if (e.turn === S.you) { Sound.play('myturn'); voiceLine('invite', null, 3); vibrate(60); }
        else voiceLine('start', null, 2);
        break;
      case 'play':
        if (e.chop === 'chat2') { Sound.play('chop2', { pan }); voiceLine('chop1', e.by, 4); banner('CHẶT 2!', 'red', nameOf(e.by)); shakeTable(); vibrate([60, 40, 120]); }
        else if (e.chop === 'chatde') { Sound.play(e.depth >= 3 ? 'chopde2' : 'chopde', { pan }); voiceLine(e.depth >= 3 ? 'chopde2' : 'chopde', e.by, 5); banner('CHẶT ĐÈ x' + (e.mult || 2) + '!', 'red', nameOf(e.by)); shakeTable(); vibrate([60, 40, 60, 40, 160]); }
        else Sound.play(e.n >= 5 ? 'play_big' : 'play', { pan });
        if (!e.chop) voiceLine('play', e.by, 1);
        break;
      case 'pass': Sound.play('pass', { pan }); if (!e.auto) voiceLine('pass', e.by, 1); break;
      case 'round': Sound.play('collect'); if (e.leader !== S.you) voiceLine('next', null, 1); break;
      case 'turn':
        // tới lượt mình: cầm cái thì "Xin mời bạn…", phải chặn thì "Đến lượt bạn rồi"
        if (e.to === S.you) { Sound.play('myturn'); voiceLine(S.table ? 'turn' : 'invite', null, 2); vibrate(60); }
        else Sound.play('turn', { pan: seatPan(e.to) });
        break;
      case 'chopsettle': Sound.play('coins'); break;
      case 'taunt':
        taunts[e.by] = { text: e.text, until: Date.now() + 2600 };
        setTimeout(() => S && render(), 2650);
        break;
      case 'pause': Sound.play('pause'); banner('TẠM DỪNG', 'dark'); break;
      case 'resume': Sound.play('resume'); banner('TIẾP TỤC', 'gold'); break;
      case 'conn': Sound.play(e.online ? 'reconnect' : 'disconnect', { pan: seatPan(e.idx) }); break;
      case 'host': Sound.play('notify'); toast(`${e.name || ''} giờ là chủ phòng`); break;
      case 'settings': toast(e.ai ? 'Chủ phòng đã bật gợi ý AI' : 'Chủ phòng đã tắt gợi ý AI'); break;
      case 'deck': Sound.play('shuffle'); banner('BỘ BÀI MỚI 🃏', 'gold', S.deck ? S.deck.name : ''); break;
      case 'swap': Sound.play('collect'); banner('ĐỔI CHỖ 🔄', 'gold', 'Giải đen!'); break;
      case 'swapreq':
        taunts[e.from] = { text: e.text, until: Date.now() + 4000, chat: true }; setTimeout(() => S && render(), 4100);
        voiceLine('swapreq', e.from, 5, { anyPack: true });
        break;
      case 'swapans':
        taunts[e.by] = { text: e.text, until: Date.now() + 4000, chat: true }; setTimeout(() => S && render(), 4100);
        if (e.yes) { voiceLine('swapyes', e.by, 5, { anyPack: true }); if (e.from === S.you) toast('Đã đồng ý! Đổi chỗ từ ván sau'); }
        else { Sound.play('notify'); voiceLine('swapno', e.by, 5, { anyPack: true }); }
        break;
      case 'end': {
        Sound.play('end');
        if (e.kind === 'sam') { Sound.play('sam_win'); voiceLine('samwin', e.winner, 6); banner('SÂM THÀNH CÔNG!', 'gold', nameOf(e.winner)); }
        else if (e.kind === 'chan') {
          Sound.play('bat_sam'); banner('BẮT SÂM!', 'red', nameOf(e.winner));
          voiceLine('catch', e.winner, 6);
          const sb = e.samBy; setTimeout(() => voiceLine('samfail', sb, 7), 2400);
          if (e.samBy === S.you) setTimeout(() => Sound.play('sam_fail'), 700);
        }
        else if (e.kind === 'trang') { Sound.play('sam_win'); banner('ĂN TRẮNG!', 'gold', nameOf(e.winner)); }
        else banner('HẾT BÀI!', 'gold', nameOf(e.winner));
        break;
      }
      case 'result': {
        const r = S.result; if (!r) break;
        const me = r.rows[S.you];
        if (r.winner === S.you) { Sound.play('win'); confetti(); vibrate([80, 50, 80, 50, 200]); }
        else {
          Sound.play('lose');
          if (me && me.cong) setTimeout(() => Sound.play('cong'), 900);
          else if ((r.entries || []).some(x => x.kind === 'thoi2' && x.from === S.you)) setTimeout(() => Sound.play('thoi2'), 900);
        }
        break;
      }
    }
  }
}

/* ---------- đồng hồ lượt ---------- */
function timerFraction() {
  if (!S || !S.timer) return { p: 0, left: 99999, frozen: true };
  if (timerBase.frozen || S.pause) return { p: timerBase.left / timerBase.total, left: timerBase.left, frozen: true };
  const left = Math.max(0, timerBase.left - (performance.now() - timerBase.at));
  return { p: left / timerBase.total, left, frozen: false };
}
setInterval(() => {
  if (!S) return;
  const t = timerFraction();
  document.documentElement.style.setProperty('--p', Math.max(0, Math.min(1, t.p)).toFixed(3));
  if (S.phase === 'sam' && !S.pause) {
    const hl = $('hintLine'); hl.className = 'hint-line ai';
    hl.textContent = t.frozen ? '' : `Thời gian báo Sâm: ${Math.ceil(t.left / 1000)}s`;
  }
  if (S.phase === 'play' && S.turn >= 0) {
    const seat = document.querySelector('#table .seat.turn');
    if (seat) seat.classList.toggle('warn', !t.frozen && t.left <= 5000);
    if (S.turn === S.you && !t.frozen && t.left <= 5000 && t.left > 0 && warnedTurn !== S.turnId) {
      warnedTurn = S.turnId; Sound.play('warn5'); voiceLine('5s', null, 3); vibrate([40, 40, 40]);
    }
  }
  document.querySelectorAll('[data-since]').forEach(e => {
    const ms = performance.now() - +e.dataset.since;
    if (e.classList.contains('pz')) e.textContent = 'Đã dừng ' + fmtTime(ms);
    if (e.classList.contains('wz')) e.textContent = e.textContent.replace(/( \(\d+:\d+\))?$/, ' (' + fmtTime(ms) + ')');
  });
}, 200);

/* ---------- quản lý bàn (chủ phòng) ---------- */
document.querySelectorAll('.btMenu').forEach(b => (b.onclick = () => { renderHostSheet(); $('hostSheet').classList.add('on'); }));
$('btCloseHost').onclick = () => $('hostSheet').classList.remove('on');
$('btPause').onclick = () => act(S && S.pause ? 'resume' : 'pause');
// bộ bài có ảnh: tải trước để lật bài không bị trắng
const IMG_DECKS = { 0: 'hoang-cung', 1: 'sieu-anh-hung', 2: 'ai-cap', 3: 'la-ma' };
const deckLoaded = new Set();
function preloadDeck(style) {
  const dir = IMG_DECKS[style]; if (!dir || deckLoaded.has(dir)) return;
  deckLoaded.add(dir);
  ['back', 'JS', 'JC', 'JD', 'JH', 'QS', 'QC', 'QD', 'QH', 'KS', 'KC', 'KD', 'KH'].forEach(k => { const im = new Image(); im.src = `games/sam/decks/${dir}/${k}.webp`; });
}
function renderHostSheet() {
  const b = $('hostBody'); b.textContent = '';
  if (!S) return;
  const isHost = S.you === S.host;
  // bộ bài
  const dk = h('div', 'card-panel form');
  const dr = h('div', 'frow'); const dl = h('div', ''); dl.append(h('b', '', '🃏 Bộ bài: ' + (S.deck ? S.deck.name : '')), h('small', '', `Bộ thứ ${S.deck ? S.deck.no : 1} của phòng`)); dr.append(dl); dk.append(dr);
  if (!isSpec()) {
    const db = h('button', 'btn', isHost ? '🃏 Thay bộ bài mới' : '🃏 Đề nghị chủ phòng đổi bộ bài mới');
    if (S.deckReq && !isHost) { db.disabled = true; db.textContent = 'Đang chờ chủ phòng trả lời…'; }
    db.onclick = async () => { const r = await act('deckReq'); if (!r.err) { toast(isHost ? 'Đã thay bộ bài mới' : 'Đã gửi đề nghị tới chủ phòng'); renderHostSheet(); } };
    dk.append(db);
    if (isHost && S.deck && S.deck.list) {
      // chủ phòng chọn thẳng kiểu bộ bài
      const pk = h('div', 'deckpick');
      S.deck.list.forEach((nm, k) => {
        const it = h('button', 'dp' + (k === S.deck.style ? ' on' : ''));
        const bk = h('div', 'card back s'); bk.dataset.deckp = k;
        it.append(bk, h('small', '', nm));
        it.onclick = async () => { if (k === S.deck.style) return; const r = await act('deckReq', { style: k }); if (!r.err) { toast('Đã đổi sang bộ ' + nm); renderHostSheet(); } };
        pk.append(it);
      });
      dk.append(pk);
    }
    if (isHost && S.deckReq && S.players[S.deckReq.from]) {
      const q = h('div', 'frow'); q.append(h('span', '', `${S.players[S.deckReq.from].name} đề nghị đổi bộ bài`));
      const y = h('button', 'btn slim gold', 'Đổi'), n = h('button', 'btn slim', 'Không');
      y.onclick = () => act('deckAns', { yes: true }); n.onclick = () => act('deckAns', { yes: false });
      q.append(y, n); dk.append(q);
    }
  }
  b.append(dk);
  // xin đổi chỗ giải đen
  if (!isSpec()) { const sw0 = h('button', 'btn'); setupSwapButton(sw0); if (!sw0.hidden) b.append(sw0); }
  if (!isHost) {
    // người không phải chủ phòng: chỉ xem danh sách
    b.append(peopleList(false));
    return;
  }
  const panel = h('div', 'card-panel form');
  const aiRow = h('div', 'frow');
  const lab = h('div', ''); lab.append(h('b', '', 'Gợi ý AI cho cả phòng'));
  const sw = h('label', 'sw'); const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = S.settings.ai; inp.disabled = !isHost;
  inp.onchange = () => act('settings', { settings: { ai: inp.checked } });
  sw.append(inp, h('i', '')); aiRow.append(lab, sw); panel.append(aiRow);
  // độ khó của máy (đổi được cả giữa ván, áp dụng từ nước kế tiếp)
  const lvRow = h('div', 'frow');
  const lvLab = h('div', ''); lvLab.append(h('b', '', 'Độ khó của máy'), h('small', '', 'Pro tính xác suất, Amateur đánh cảm tính hơn'));
  const lvSeg = h('div', 'seg');
  [['amateur', 'Amateur'], ['pro', 'Pro']].forEach(([v, t]) => {
    const bt = h('button', (S.settings.botLevel || 'pro') === v ? 'on' : '', t);
    bt.onclick = async () => { lvSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === bt)); const r = await act('settings', { settings: { botLevel: v } }); if (!r.err) toast('Máy chơi mức ' + t); };
    lvSeg.append(bt);
  });
  lvRow.append(lvLab, lvSeg); panel.append(lvRow);
  const bcRow = h('div', 'frow');
  const bcLab = h('div', ''); bcLab.append(h('b', '', 'Máy nói chuyện trên chat'));
  const bcSw = h('label', 'sw'); const bcIn = document.createElement('input'); bcIn.type = 'checkbox'; bcIn.checked = S.settings.botChat !== false;
  bcIn.onchange = () => act('settings', { settings: { botChat: bcIn.checked } });
  bcSw.append(bcIn, h('i', '')); bcRow.append(bcLab, bcSw); panel.append(bcRow);
  const pvRow = h('div', 'frow');
  const pvLab = h('div', ''); pvLab.append(h('b', '', 'Phòng riêng tư'), h('small', '', 'Ẩn khỏi danh sách phòng ở trang chủ'));
  const pvSw = h('label', 'sw'); const pvIn = document.createElement('input'); pvIn.type = 'checkbox'; pvIn.checked = !!S.settings.private; pvIn.disabled = !isHost;
  pvIn.onchange = () => act('settings', { settings: { private: pvIn.checked } });
  pvSw.append(pvIn, h('i', '')); pvRow.append(pvLab, pvSw); panel.append(pvRow);
  const pr = h('div', 'frow');
  pr.append(h('b', '', 'Tạm dừng ván'), h('span', 'muted', S.settings.pauseLimitMs ? `đã dùng ${fmtTime(S.pauseUsed || 0)} / ${fmtTime(S.settings.pauseLimitMs)}` : `đã dùng ${fmtTime(S.pauseUsed || 0)} · không giới hạn`));
  panel.append(pr);
  if (isHost && (S.phase === 'sam' || S.phase === 'play')) {
    const pb = h('button', 'btn ' + (S.pause ? 'gold' : ''), S.pause ? '▶ Tiếp tục ván' : '⏸ Tạm dừng cả bàn');
    pb.onclick = () => act(S.pause ? 'resume' : 'pause');
    panel.append(pb);
  }
  b.append(panel);
  b.append(peopleList(true));
  if (S.hostLog && S.hostLog.length > 1) {
    const hl = h('div', 'card-panel');
    hl.append(h('b', '', 'Lịch sử chủ phòng'));
    S.hostLog.slice().reverse().forEach(x => {
      const why = { create: 'tạo phòng', manual: 'chuyển tay', host_offline: 'chủ cũ mất kết nối', host_left: 'chủ cũ rời phòng', no_host: 'không có chủ phòng' }[x.reason] || x.reason;
      hl.append(h('div', 'hp st', new Date(x.at).toLocaleTimeString('vi-VN') + ' · ' + why));
    });
    b.append(hl);
  }
}
function peopleList(isHost) {
  const pl = h('div', 'card-panel');
  S.players.forEach((p, i) => {
    const r = h('div', 'hp');
    r.append(h('span', '', p.av), h('span', 'nm', p.name + (i === S.host ? ' 👑' : '') + (i === S.you ? ' (bạn)' : '')));
    const st = p.bot ? 'Máy' : p.auto ? 'Máy đánh thay' : !p.online ? 'Mất kết nối' : p.afk ? 'AFK' : 'Online';
    r.append(h('span', 'st', st));
    if (isHost && i !== S.you && !p.bot) {
      const t = h('button', 'btn slim', '👑'); t.title = 'Chuyển chủ phòng';
      t.onclick = async () => { if (await confirmBox(`Chuyển quyền chủ phòng cho ${p.name}?`)) { act('transferHost', { idx: i }); $('hostSheet').classList.remove('on'); } };
      r.append(t);
      if (!p.online && !p.auto && (S.phase === 'sam' || S.phase === 'play')) {
        const a = h('button', 'btn slim', '🤖'); a.title = 'Cho máy đánh thay'; a.onclick = () => act('autoplay', { idx: i }); r.append(a);
      }
    }
    pl.append(r);
  });
  (S.spectators || []).forEach(sp => {
    const r = h('div', 'hp');
    r.append(h('span', '', sp.av), h('span', 'nm', sp.name), h('span', 'st', sp.online ? '👀 Đang xem' : '👀 Đã thoát'));
    pl.append(r);
  });
  return pl;
}

/* ---------- thống kê bàn ---------- */
document.querySelectorAll('.btRstats').forEach(b => (b.onclick = () => { renderRstats(); $('rsSheet').classList.add('on'); }));
$('btCloseRs').onclick = () => $('rsSheet').classList.remove('on');
function streakBadge(st) {
  if (!st || !st.streak) return h('span', 'streak-b z', 'chưa có');
  return st.streak > 0 ? h('span', 'streak-b g', `🟢 xanh ${st.streak}`) : h('span', 'streak-b r', `🔴 đỏ ${-st.streak}`);
}
function renderRstats() {
  const b = $('rsBody'); b.textContent = '';
  if (!S) return;
  const rows = S.players.map((p, i) => ({ p, i, st: (S.rstats || [])[i] }));
  const played = rows.filter(r => r.st && r.st.games);
  if (!played.length) { b.append(h('div', 'empty', 'Chưa có ván nào kết thúc. Đánh xong ván đầu là có số liệu.')); return; }
  const top = (f, cmp = (a, b) => b - a) => played.slice().sort((a, b) => cmp(f(a), f(b)))[0];
  const hl = h('div', 'rs-hl');
  const card = (label, r, val) => { const d = h('div', ''); d.append(h('small', '', label), h('b', '', r ? `${r.p.av} ${r.p.name}` : '—')); if (r) d.append(h('em', '', val)); hl.append(d); };
  const w = top(r => r.st.wins); card('🏆 Thắng nhiều nhất', w, `${w.st.wins} ván`);
  const l = top(r => r.st.losses); card('💸 Thua nhiều nhất', l, `${l.st.losses} ván`);
  const g = top(r => r.st.streak); card('🔥 Đang xanh nhất', g.st.streak > 0 ? g : null, g.st.streak > 0 ? `thắng ${g.st.streak} ván liền` : '');
  const rd = top(r => -r.st.streak); card('🥶 Đang đỏ nhất', rd.st.streak < 0 ? rd : null, rd.st.streak < 0 ? `thua ${-rd.st.streak} ván liền` : '');
  const ch = top(r => r.st.chops); card('🪓 Vua chặt', ch.st.chops ? ch : null, ch.st.chops ? `${ch.st.chops} lần` : '');
  const pt = top(r => r.st.points); card('💰 Lãi nhiều nhất', pt, sc(pt.st.points) + ' đ');
  b.append(hl);
  rows.sort((a, b2) => ((b2.st && b2.st.points) || 0) - ((a.st && a.st.points) || 0)).forEach(({ p, i, st }) => {
    const c = h('div', 'rs-p');
    const hd = h('div', 'hd');
    hd.append(h('span', '', p.av), h('span', 'nm', p.name + (i === S.you ? ' (bạn)' : '')), streakBadge(st));
    const pts = st ? st.points : 0;
    hd.append(h('span', 'pt ' + (pts > 0 ? 'p' : pts < 0 ? 'n' : ''), sc(pts)));
    c.append(hd);
    if (st && st.games) {
      const rate = Math.round((st.wins / st.games) * 100);
      const bar = h('div', 'rs-bar'); const fill = h('i', ''); fill.style.width = rate + '%'; bar.append(fill); c.append(bar);
      const gr = h('div', 'rs-grid');
      const cell = (k, v) => { const d = h('div', ''); d.append(h('small', '', k), h('b', '', String(v))); gr.append(d); };
      cell('Ván', st.games); cell('Thắng', `${st.wins} · ${rate}%`); cell('Thua', `${st.losses} · ${100 - rate}%`); cell('Báo Sâm', `${st.samWins}/${st.samCalls}`);
      cell('Bắt Sâm', st.samCaught); cell('Chặt', st.chops); cell('Bị chặt', st.chopped); cell('Cóng', st.cong);
      cell('Xanh dài nhất', st.bestWin); cell('Đỏ dài nhất', st.bestLose); cell('Ván ngon', sc(st.best)); cell('Ván đen', sc(st.worst));
      c.append(gr);
    } else c.append(h('p', 'muted', 'Chưa chơi ván nào ở bàn này'));
    b.append(c);
  });
  b.append(h('p', 'muted center', 'Tính từ khi bàn này bắt đầu. Lịch sử lâu dài xem ở mục Thống kê của tài khoản.'));
}

/* ---------- xin đổi chỗ giải đen ---------- */
function setupSwapButton(btn) {
  const me = S && S.players[S.you];
  btn.hidden = true; btn.classList.add('hide');
  if (!me || isSpec() || S.players.length < 2) return;
  const plan = S.swapPlan, mine = plan && (plan.a === S.you || plan.b === S.you);
  if ((me.lose || 0) < (S.swapNeed || 10) && !mine) return;
  btn.hidden = false; btn.classList.remove('hide');
  btn.className = 'btn swap-btn';
  if (mine) {
    const other = S.players[plan.a === S.you ? plan.b : plan.a];
    btn.textContent = `✅ Sẽ đổi chỗ với ${other ? other.name : ''} từ ván sau`;
    btn.disabled = true;
  } else {
    btn.textContent = S.swap && S.swap.from === S.you ? '⏳ Đang chờ đồng ý đổi chỗ…' : `😵 Thua ${me.lose} ván liền — Xin đổi chỗ giải đen`;
    btn.disabled = !!S.swap || !!plan;
  }
  btn.onclick = () => openSwapPicker();
}
function openSwapPicker() {
  const b = $('hostBody'); b.textContent = '';
  b.append(h('p', 'muted', 'Chọn người muốn đổi chỗ. Máy luôn đồng ý; người thì có 30 giây để trả lời. Đồng ý thì đổi chỗ từ ván sau.'));
  const pl = h('div', 'card-panel');
  S.players.forEach((p, i) => {
    if (i === S.you) return;
    const r = h('div', 'hp');
    r.append(h('span', '', p.av), h('span', 'nm', p.name + (p.bot ? ' (máy)' : '')));
    const go = h('button', 'btn slim gold', 'Đổi chỗ');
    go.onclick = async () => { const res = await act('swapReq', { idx: i }); if (!res.err) { $('hostSheet').classList.remove('on'); toast(p.bot ? `${p.name} đồng ý — đổi chỗ từ ván sau` : `Đã gửi lời xin đổi chỗ tới ${p.name}`); } };
    r.append(go); pl.append(r);
  });
  b.append(pl);
  $('hostSheet').classList.add('on');
}

/* ---------- hỏi đáp (lời xin đổi chỗ, đề nghị đổi bài) ---------- */
const asked = new Set();
function ask(key, icon, text, yes, no, onYes, onNo) {
  if (asked.has(key)) return;
  asked.add(key);
  $('askIcon').textContent = icon; $('askText').textContent = text;
  $('askYes').textContent = yes; $('askNo').textContent = no;
  $('ask').classList.add('on');
  Sound.play('notify'); vibrate([60, 40, 60]);
  const done = f => { $('ask').classList.remove('on'); f(); };
  $('askYes').onclick = () => done(onYes);
  $('askNo').onclick = () => done(onNo);
}
function checkRequests() {
  if (!S || isSpec()) return;
  if (S.swap && S.swap.to === S.you && S.players[S.swap.from]) {
    const p = S.players[S.swap.from];
    ask('swap' + S.swap.at, '🔄', `${p.name}: "Đen quá, đổi chỗ phát!" — thua ${p.lose} ván liền, xin đổi chỗ với bạn từ ván sau. Đồng ý không?`, 'Ok cưng', 'Không đổi',
      () => act('swapAns', { yes: true }), () => act('swapAns', { yes: false }));
  } else if (S.deckReq && S.you === S.host && S.players[S.deckReq.from]) {
    ask('deck' + S.deckReq.at, '🃏', `${S.players[S.deckReq.from].name} đề nghị đổi bộ bài mới.`, 'Đổi bộ mới', 'Giữ bộ cũ',
      () => act('deckAns', { yes: true }), () => act('deckAns', { yes: false }));
  } else if ($('ask').classList.contains('on') && !S.swap && !S.deckReq) $('ask').classList.remove('on');
}

/* ================= xem lại ================= */
const Replay = {
  data: null, steps: [], i: 0, playing: false, speed: 1, t: null,
  stop() { this.playing = false; clearTimeout(this.t); const b = $('rpPlay'); if (b) b.textContent = '▶'; },
};
function nextSeatLocal(st, i) {
  const n = st.hands.length; let j = (i + 1) % n;
  while (st.passed[j] && j !== i) j = (j + 1) % n;
  return j;
}
function replaySteps(rp) {
  const n = rp.players.length;
  let st = { hands: Array.from({ length: n }, () => []), piles: Array.from({ length: n }, () => []), trick: [], passed: Array(n).fill(false), samBy: null, turn: -1, paused: false, ended: null, log: '', table: null };
  const steps = [];
  const desc = e => {
    const nm = i => (rp.players[i] ? rp.players[i].name : '?');
    switch (e.type) {
      case 'deal': return 'Chia bài';
      case 'samopen': return 'Thời gian báo Sâm';
      case 'sam': return `${nm(e.by)} báo Sâm!`;
      case 'start': return `${nm(e.turn)} đánh trước`;
      case 'play': return `${nm(e.by)} ${e.chop === 'chat2' ? 'CHẶT 2' : e.chop === 'chatde' ? 'CHẶT ĐÈ x' + e.mult : 'đánh'} · ${e.label}${e.auto ? ' (tự động)' : ''}`;
      case 'pass': return `${nm(e.by)} bỏ lượt${e.auto ? ' (hết giờ)' : ''}`;
      case 'round': return `Hết vòng · ${nm(e.leader)} cầm cái`;
      case 'chopsettle': return e.entries.map(x => `${x.label}: ${nm(x.from)} → ${nm(x.to)} ${x.amount}`).join(' · ');
      case 'pause': return e.kind === 'system' ? 'Tạm dừng (máy chủ khởi động lại)' : `${nm(e.by)} tạm dừng`;
      case 'resume': return 'Tiếp tục';
      case 'host': return `${e.name} thành chủ phòng`;
      case 'end': return e.title;
      default: return e.type;
    }
  };
  for (const e of rp.events) {
    st = JSON.parse(JSON.stringify(st));
    switch (e.type) {
      case 'deal': st.hands = e.hands.map(x => x.slice()); st.turn = e.lead; break;
      case 'sam': st.samBy = e.by; st.turn = e.by; break;
      case 'start': st.turn = e.turn; break;
      case 'play': {
        const h2 = st.hands[e.by];
        e.cards.forEach(c => { let k = h2.indexOf(c); if (k < 0) k = h2.indexOf(-1); if (k >= 0) h2.splice(k, 1); });
        st.trick.push({ by: e.by, cards: e.cards, label: e.label, chop: e.chop, mult: e.mult });
        st.table = { by: e.by };
        st.turn = nextSeatLocal(st, e.by);
        break;
      }
      case 'pass': st.passed[e.by] = true; st.turn = nextSeatLocal(st, e.by); break;
      case 'round':
        st.trick.forEach(p => st.piles[p.by].push({ cards: p.cards, label: p.label, chop: p.chop }));
        st.trick = []; st.passed.fill(false); st.turn = e.leader; st.table = null; break;
      case 'pause': st.paused = true; break;
      case 'resume': st.paused = false; break;
      case 'end': st.ended = e; st.turn = -1; break;
    }
    st.log = desc(e);
    if (e.type === 'samopen' || e.type === 'chopsettle' && false) continue;
    steps.push({ st, ev: e });
  }
  return steps;
}
async function openReplay(id) {
  if (!id) return;
  Replay.stop();
  const j = await api('replay', { game: id });
  if (j.err) return toast(j.err);
  const rp = j.replay;
  Replay.data = rp; Replay.steps = replaySteps(rp); Replay.i = 0;
  $('rpTitle').textContent = `Xem lại · ván ${rp.no || ''} · ${rp.room}`;
  const rg = $('rpRange'); rg.max = Math.max(0, Replay.steps.length - 1); rg.value = 0;
  const mk = $('rpMarks'); mk.textContent = '';
  const N = Math.max(1, Replay.steps.length - 1);
  Replay.steps.forEach((s, k) => {
    const e = s.ev; let cls = null;
    if (e.type === 'play' && e.chop) cls = '';
    else if (e.type === 'sam' || e.type === 'end') cls = 'g';
    else if (e.type === 'pause' || e.type === 'resume') cls = 'b';
    if (cls === null) return;
    const i = h('i', cls); i.style.left = (k / N * 100) + '%'; mk.append(i);
  });
  $('resultOv').classList.remove('on');
  show('sReplay');
  renderReplay(false);
}
function renderReplay(withSound) {
  const rp = Replay.data, step = Replay.steps[Replay.i];
  if (!rp || !step) return;
  const st = step.st, n = rp.players.length;
  const showAll = rp.policy === 'all';
  const players = rp.players.map((p, i) => ({ name: p.name, av: p.av, bot: p.bot, online: true, count: st.hands[i].length, score: 0, passed: st.passed[i] }));
  const end = st.ended;
  if (end && end.deltas) end.deltas.forEach((d, i) => (players[i].score = d));
  renderTable($('rpTable'), {
    you: rp.seat, host: -1, phase: end ? 'over' : 'play', players, piles: st.piles, trick: st.trick, turn: st.turn,
    samBy: st.samBy, showCounts: true, reveal: !!end, winner: end ? end.winner : -1, log: '',
    centerHint: st.trick.length ? '' : (end ? end.title : step.ev.type === 'deal' ? 'Chia bài' : 'Vòng mới'),
    openHands: showAll ? st.hands : null, freshSig: withSound ? '' : undefined,
  });
  if (st.paused) { const ov = h('div', 'pauseov'); ov.append(h('div', 'pi', '⏸'), h('h3', '', 'Tạm dừng')); $('rpTable').append(ov); }
  $('rpEv').textContent = `${Replay.i + 1}/${Replay.steps.length} · ${st.log}`;
  const hd = $('rpHand'); hd.textContent = '';
  const mine = st.hands[rp.seat] || [];
  const W = Math.min(hd.parentElement.clientWidth - 8, 600), cw = 40, m = mine.length;
  const stp = m > 1 ? Math.min(cw + 4, (W - cw) / (m - 1)) : 0;
  hd.style.width = (m ? cw + stp * (m - 1) : 0) + 'px';
  mine.forEach((c, k) => { const d = cardEl(c, 's'); d.style.left = (k * stp) + 'px'; hd.append(d); });
  $('rpRange').value = Replay.i;
  if (withSound) replaySound(step.ev, rp);
}
function replaySound(e, rp) {
  const slot = slotsFor(rp.players.length, rp.seat);
  const pan = e.by !== undefined && settings.spatial ? PAN[slot[e.by]] || 0 : 0;
  const map = { deal: 'shuffle', sam: 'bao_sam', start: 'start', pass: 'pass', round: 'collect', chopsettle: 'coins', pause: 'pause', resume: 'resume', end: 'end' };
  if (e.type === 'play') Sound.play(e.chop === 'chat2' ? 'chop2' : e.chop === 'chatde' ? (e.depth >= 3 ? 'chopde2' : 'chopde') : e.n >= 5 ? 'play_big' : 'play', { pan });
  else if (map[e.type]) Sound.play(map[e.type], { pan });
  const ro = { genderOf: i => (rp.players[i] && rp.players[i].gender) || 'nam', pan: i => (settings.spatial ? PAN[slot[i]] || 0 : 0) };
  if (e.type === 'play' && e.chop) voiceLine(e.chop === 'chat2' ? 'chop1' : e.depth >= 3 ? 'chopde2' : 'chopde', e.by, 5, ro);
  else if (e.type === 'play') voiceLine('play', e.by, 1, ro);
  if (e.type === 'sam') voiceLine('sam', e.by, 3, ro);
  if (e.type === 'end' && e.kind === 'chan') voiceLine('catch', e.winner, 6, ro);
  if (e.type === 'end' && e.kind === 'sam') voiceLine('samwin', e.winner, 6, ro);
  if (e.type === 'play' && e.chop) { banner(e.chop === 'chat2' ? 'CHẶT 2!' : 'CHẶT ĐÈ x' + e.mult + '!', 'red', rp.players[e.by].name); }
  if (e.type === 'sam') banner('BÁO SÂM!', 'gold', rp.players[e.by].name);
  if (e.type === 'end') banner(e.kind === 'chan' ? 'BẮT SÂM!' : e.kind === 'sam' ? 'SÂM THÀNH CÔNG!' : e.kind === 'trang' ? 'ĂN TRẮNG!' : 'HẾT BÀI!', 'gold', rp.players[e.winner].name);
}
function rpGo(i, sound) { Replay.i = Math.max(0, Math.min(Replay.steps.length - 1, i)); renderReplay(sound); }
function rpTick() {
  if (!Replay.playing) return;
  if (Replay.i >= Replay.steps.length - 1) { Replay.stop(); return; }
  rpGo(Replay.i + 1, true);
  const e = Replay.steps[Replay.i].ev;
  const base = e.type === 'end' ? 2600 : e.type === 'deal' ? 1500 : e.type === 'play' && e.chop ? 1800 : e.type === 'round' ? 900 : 1100;
  Replay.t = setTimeout(rpTick, base / Replay.speed);
}
$('rpPlay').onclick = () => {
  Sound.unlock();
  if (Replay.playing) return Replay.stop();
  if (Replay.i >= Replay.steps.length - 1) rpGo(0, false);
  Replay.playing = true; $('rpPlay').textContent = '⏸';
  Replay.t = setTimeout(rpTick, 400 / Replay.speed);
};
$('rpPrev').onclick = () => { Replay.stop(); rpGo(Replay.i - 1, false); };
$('rpNext').onclick = () => { Replay.stop(); rpGo(Replay.i + 1, true); };
$('rpFirst').onclick = () => { Replay.stop(); rpGo(0, false); };
$('rpLast').onclick = () => { Replay.stop(); rpGo(Replay.steps.length - 1, false); };
$('rpRange').oninput = () => { Replay.stop(); rpGo(+$('rpRange').value, false); };
$('rpScore').onclick = () => {
  const rp = Replay.data; if (!rp || !rp.result) return;
  fillResult($('resultPanel'), rp.result, rp.seat, rp.players.map(p => p.name), { close: () => $('resultOv').classList.remove('on') });
  $('resultOv').classList.add('on');
};
