/* Sâm Dứa 2.0 — client */
'use strict';
const $ = id => document.getElementById(id);
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['♠', '♣', '♦', '♥'];
const AVATARS = ['😎', '🤠', '🥸', '😈', '🤡', '👻', '🤖', '👽', '🐯', '🐵', '🐷', '🦊', '🐸', '🐼', '🦁', '🐙'];
const SLOTS = { 1: ['tc'], 2: ['tl', 'tr'], 3: ['bl', 'tl', 'tr'], 4: ['bl', 'tl', 'tr', 'br'] };
const PAN = { tl: -0.6, bl: -0.6, tr: 0.6, br: 0.6, tc: 0, me: 0 };

/* ================= lưu cục bộ ================= */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } },
};
let token = store.get('sam_token');
if (!token || token.length < 16) {
  token = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  store.set('sam_token', token);
}
const DEFAULT_SETTINGS = { mute: false, master: 80, music: 30, sfx: 85, voice: false, ambient: true, spatial: true, vibrate: true, reduce: false, perf: false };
let settings = Object.assign({}, DEFAULT_SETTINGS, store.json('sam_settings', {}));
let myAv = store.get('sam_av') || AVATARS[Math.floor(Math.random() * AVATARS.length)];

/* ================= tiện ích DOM ================= */
function h(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
const sc = n => (n > 0 ? '+' : '') + n;
function toast(t, ms = 2300) {
  const e = $('toast'); e.textContent = t; e.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), ms);
}
function confirmBox(text) {
  return new Promise(res => {
    $('confirmText').textContent = text; $('confirm').classList.add('on');
    const done = v => { $('confirm').classList.remove('on'); res(v); };
    $('confirmYes').onclick = () => done(true); $('confirmNo').onclick = () => done(false);
  });
}
function vibrate(p) { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ================= lá bài ================= */
function cardEl(c, size) {
  const d = h('div', 'card' + (size ? ' ' + size : ''));
  if (c < 0) { d.classList.add('back'); return d; }
  const s = c & 3;
  if (s >= 2) d.classList.add('r');
  const a = h('div', 'a', RANKS[c >> 2]); a.appendChild(h('span', '', SUITS[s]));
  d.append(a, h('div', 'b', SUITS[s]));
  return d;
}
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

/* ================= điều hướng ================= */
let current = 'sHome';
function show(id) {
  current = id;
  if (id !== 'sGame') { $('resultOv').classList.remove('on'); const pk = document.querySelector('.peek'); if (pk) pk.remove(); }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id !== 'sReplay') Replay.stop();
}
function backToBase() { if (S && room) showRoomScreen(); else show('sHome'); }
document.querySelectorAll('[data-back]').forEach(b => (b.onclick = backToBase));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  const g = b.dataset.go;
  if (g === 'settings') openSettings();
  else if (g === 'history') openHistory();
  else if (g === 'stats') openStats();
  else if (g === 'rules') show('sRules');
});

/* ================= API & mạng ================= */
async function api(a, extra = {}) {
  try {
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ a, token }, extra)) });
    return await r.json();
  } catch (e) { return { err: 'Không kết nối được máy chủ' }; }
}

let room = null;   // mã phòng đang ở
let S = null;      // trạng thái mới nhất từ server
const Net = {
  ws: null, want: false, tries: 0, pend: new Map(), fresh: true, seq: 0, netTimer: null,
  open(code) { room = code; this.want = true; this.tries = 0; this.connect(); },
  connect() {
    if (!this.want) return;
    if (this.ws) { try { this.ws.close(); } catch (e) {} }
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    this.ws = ws; this.fresh = true;
    clearTimeout(this.netTimer);
    this.netTimer = setTimeout(() => { if (this.ws !== ws || ws.readyState !== 1) $('netbar').classList.add('on'); }, 900);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token, room }));
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'state') {
        this.tries = 0; $('netbar').classList.remove('on'); clearTimeout(this.netTimer);
        const first = this.fresh; this.fresh = false;
        onState(m.s, m.ev || [], first);
      } else if (m.t === 'ack') {
        const p = this.pend.get(m.cid); if (p) { this.pend.delete(m.cid); clearTimeout(p.to); p.res(m); }
      } else if (m.t === 'gone') {
        this.want = false; leftRoom('Bạn không còn ở trong phòng này');
      } else if (m.t === 'retry') {
        try { ws.close(); } catch (x) {}
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const [cid, p] of this.pend) { clearTimeout(p.to); p.res({ err: 'Mất kết nối, thử lại' }); }
      this.pend.clear();
      if (!this.want) return;
      $('netbar').classList.add('on');
      const wait = Math.min(8000, 500 * Math.pow(2, this.tries++));
      setTimeout(() => this.connect(), wait);
    };
  },
  close() { this.want = false; if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) {} } $('netbar').classList.remove('on'); },
  act(a, data = {}) {
    return new Promise(res => {
      if (!this.ws || this.ws.readyState !== 1) return res({ err: 'Đang mất kết nối' });
      const cid = 'c' + Date.now().toString(36) + (++this.seq);
      const to = setTimeout(() => { this.pend.delete(cid); res({ err: 'Máy chủ không phản hồi' }); }, 8000);
      this.pend.set(cid, { res, to });
      this.ws.send(JSON.stringify(Object.assign({ t: 'act', a, cid }, data)));
    });
  },
};
async function act(a, data) {
  const r = await Net.act(a, data);
  if (r.err) toast(r.err);
  return r;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Net.want && (!Net.ws || Net.ws.readyState > 1)) { Net.tries = 0; Net.connect(); }
});
// báo hoạt động (phát hiện AFK)
let lastActiveSent = 0;
function markActive() {
  Sound.unlock();
  if (!Net.ws || Net.ws.readyState !== 1) return;
  const now = Date.now();
  if (now - lastActiveSent < 8000) return;
  lastActiveSent = now;
  Net.ws.send(JSON.stringify({ t: 'act', a: 'active' }));
}
document.addEventListener('pointerdown', markActive, { passive: true });
document.addEventListener('keydown', markActive);

/* ================= trang chủ ================= */
$('inName').value = store.get('sam_name', '');
const qRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
$('inCode').value = qRoom;
(function avatarPicker() {
  const box = $('avpick');
  AVATARS.forEach(a => {
    const b = h('button', a === myAv ? 'on' : '', a);
    b.onclick = () => { myAv = a; store.set('sam_av', a); box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); Sound.play('select'); };
    box.append(b);
  });
})();
function myName() {
  const n = $('inName').value.trim();
  if (!n) { toast('Nhập tên đã nhé'); $('inName').focus(); return null; }
  store.set('sam_name', n); return n;
}
$('btGoCreate').onclick = () => { if (!myName()) return; openCreate(null); };
$('btJoin').onclick = async () => {
  const n = myName(); if (!n) return;
  const c = $('inCode').value.trim().toUpperCase();
  if (c.length !== 4) return toast('Mã phòng gồm 4 ký tự');
  const j = await api('join', { room: c, name: n, av: myAv });
  if (j.err) return toast(j.err);
  enterRoom(j.code);
};

/* ================= tạo phòng / cài đặt phòng ================= */
const PT_KEYS = { chat: [0, 200, 5], chatDeMult: [1, 5, 1], sam: [0, 200, 5], trang: [0, 200, 5], cong: [0, 100, 1], thoi2: [0, 50, 1] };
let formPts = { sam: 20, trang: 20, cong: 15, chat: 10, chatDeMult: 2, thoi2: 0 };
let editMode = false;
function segVal(id) { return $(id).dataset.v; }
function setSeg(id, v) { const e = $(id); e.dataset.v = String(v); e.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }
document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !seg.contains(b)) return;
  setSeg(seg.id, b.dataset.v); Sound.play('select');
  if (seg.id === 'rpSpeed') Replay.speed = +b.dataset.v;
}));
function renderSteps() {
  document.querySelectorAll('.step').forEach(st => {
    const k = st.dataset.k, [lo, hi, d] = PT_KEYS[k];
    st.textContent = '';
    const m = h('button', '', '−'), v = h('span', '', formPts[k]), p = h('button', '', '+');
    m.onclick = () => { formPts[k] = Math.max(lo, formPts[k] - d); v.textContent = formPts[k]; };
    p.onclick = () => { formPts[k] = Math.min(hi, formPts[k] + d); v.textContent = formPts[k]; };
    st.append(m, v, p);
  });
}
function openCreate(cur) {
  editMode = !!cur;
  const s = cur || store.json('sam_room_defaults', null) || {};
  $('fAi').checked = s.ai !== undefined ? s.ai : true;
  setSeg('fTurn', s.turnMs || 30000);
  setSeg('fPause', s.pauseLimitMs !== undefined ? s.pauseLimitMs : 600000);
  setSeg('fReplay', s.replayPolicy || 'all');
  formPts = Object.assign({ sam: 20, trang: 20, cong: 15, chat: 10, chatDeMult: 2, thoi2: 0 }, s.points || {});
  setSeg('fChain', (s.points && s.points.chainMode) || 'last');
  renderSteps();
  $('createTitle').textContent = editMode ? 'Cài đặt phòng' : 'Tạo phòng';
  $('btCreate').textContent = editMode ? 'Lưu cài đặt' : 'Tạo phòng';
  show('sCreate');
}
function formSettings() {
  return {
    ai: $('fAi').checked, turnMs: +segVal('fTurn'), pauseLimitMs: +segVal('fPause'), replayPolicy: segVal('fReplay'),
    points: Object.assign({}, formPts, { chainMode: segVal('fChain') }),
  };
}
$('btCreate').onclick = async () => {
  const s = formSettings();
  store.set('sam_room_defaults', JSON.stringify(s));
  if (editMode) {
    const r = await act('settings', { settings: s });
    if (!r.err) { toast('Đã lưu cài đặt phòng'); showRoomScreen(); }
    return;
  }
  const n = myName(); if (!n) return show('sHome');
  const j = await api('create', { name: n, av: myAv, settings: s });
  if (j.err) return toast(j.err);
  enterRoom(j.code);
};

/* ================= vào / rời phòng ================= */
function enterRoom(code) {
  store.set('sam_room', code);
  history.replaceState(null, '', '?room=' + code);
  Sound.unlock();
  Net.open(code);
}
function leftRoom(msg) {
  Net.close(); room = null; S = null; sel.clear();
  store.set('sam_room', '');
  history.replaceState(null, '', location.pathname);
  $('resultOv').classList.remove('on');
  Sound.music(false);
  closeSheets();
  if (msg) toast(msg);
  show('sHome');
}
async function leaveRoom() {
  const inGame = S && (S.phase === 'sam' || S.phase === 'play');
  if (inGame && !(await confirmBox('Rời phòng giữa ván? Máy sẽ đánh thay bạn tới hết ván.'))) return;
  await Net.act('leave');
  leftRoom();
}
$('btLobbyLeave').onclick = leaveRoom;
$('btGameLeave').onclick = leaveRoom;
$('btBot').onclick = () => act('addBot');
$('btStart').onclick = () => act('start');
$('btEditRoom').onclick = () => S && openCreate(S.settings);
$('btCopy').onclick = async () => {
  const url = location.origin + location.pathname + '?room=' + room;
  try { await navigator.clipboard.writeText(url); toast('Đã sao chép link mời'); }
  catch (e) { const i = $('lnk'); i.classList.remove('hide'); i.value = url; i.select(); }
};

function showRoomScreen() {
  if (!S) return show('sHome');
  if (S.phase === 'lobby') show('sLobby'); else show('sGame');
}

/* ================= nhận trạng thái ================= */
let lastGameId = null, dealAnim = false, lastTrickSig = '', resultHidden = {}, taunts = {}, sugCards = null, sugReason = '';
let timerBase = { at: 0, left: 0, total: 1, frozen: true };
let warnedTurn = -1;

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
  render();
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
    if (isHost && i !== S.you) {
      if (!p.bot) { const c = h('button', 'x', '👑'); c.title = 'Chuyển chủ phòng'; c.onclick = async () => { if (await confirmBox(`Chuyển quyền chủ phòng cho ${p.name}?`)) act('transferHost', { idx: i }); }; it.append(c); }
      const x = h('button', 'x', '✕'); x.onclick = () => act('kick', { idx: i }); it.append(x);
    }
    box.append(it);
  });
  $('lbRules').textContent = '';
  $('lbRules').append(...rulesSummary(S.settings));
  $('hostCtl').classList.toggle('hide', !isHost);
  $('btStart').classList.toggle('hide', !isHost);
  $('lbWait').classList.toggle('hide', isHost);
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
    if (tb) seat.append(h('div', 'bub', tb));
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
    displayOrder(pl.cards).forEach(c => cs.append(cardEl(c, age === 0 ? '' : 's')));
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
  let chain = '';
  if (S.chain) chain = S.chain.choppers.length > 1 ? `Chặt đè x${Math.pow(S.settings.points.chatDeMult, S.chain.choppers.length - 1)}` : 'Chặt 2';
  return {
    you: S.you, host: S.host, phase: S.phase, players: S.players, piles: S.piles, trick: S.trick, turn: S.turn,
    samBy: S.samBy, showCounts: S.phase !== 'over', reveal: S.phase === 'reveal', winner: S.reveal ? S.reveal.winner : -1,
    warn: S.turn >= 0 && timerFrac.left <= 5000 && !timerFrac.frozen, log: S.log, centerHint, centerSub, chain,
    taunts: activeTaunts(), freshSig: lastTrickSig,
    meLabel: S.samBy === S.you ? 'Bạn báo Sâm' : S.turn === S.you ? 'Đến lượt bạn' : null,
    openHands: S.phase === 'over' && S.result ? S.result.rows.map(r => r.hand) : null,
  };
}
function activeTaunts() {
  const out = {}, now = Date.now();
  for (const k in taunts) if (taunts[k].until > now) out[k] = taunts[k].text;
  return out;
}

function renderGame() {
  $('gCode').textContent = S.code;
  $('gNo').textContent = S.gameNo ? 'Ván ' + S.gameNo : '';
  const isHost = S.you === S.host;
  const canPause = isHost && (S.phase === 'sam' || S.phase === 'play');
  $('btPause').classList.toggle('hide', !canPause);
  $('btPause').textContent = S.pause ? '▶' : '⏸';
  $('btHost').classList.toggle('hide', !isHost);
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
  if ($('hostSheet').classList.contains('on')) renderHostSheet();
}

/* ---------- bài trên tay ---------- */
const sel = new Set();
let drag = null;
function renderHand() {
  const hd = $('hand'); hd.textContent = '';
  const hand = S.hand || [];
  [...sel].forEach(c => { if (!hand.includes(c)) sel.delete(c); });
  const W = Math.min(hd.parentElement.clientWidth - 8, 760);
  const cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 58;
  const m = hand.length;
  const step = m > 1 ? Math.min(cw + 4, (W - cw) / (m - 1)) : 0;
  hd.style.width = (m ? cw + step * (m - 1) : 0) + 'px';
  hand.forEach((c, k) => {
    const d = cardEl(c);
    d.style.left = (k * step) + 'px';
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
function renderActs() {
  const ac = $('acts'); ac.textContent = '';
  const paused = !!S.pause;
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
    replay: () => openReplay(S.gameId),
    hide: () => { resultHidden[S.gameId] = 1; renderResult(); },
    again: isHost ? () => act('start') : null,
    leave: leaveRoom,
    waitText: isHost ? '' : 'Chờ chủ phòng chia ván mới…',
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
  box.append(bt);
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
  const slot = slotsFor(S.players.length, S.you)[i];
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

function handleEvents(evs) {
  for (const e of evs) {
    const pan = e.by !== undefined ? seatPan(e.by) : 0;
    switch (e.type) {
      case 'deal': Sound.play('shuffle'); setTimeout(() => Sound.play('deal'), 450); dealAnim = true; break;
      case 'samopen': Sound.play('phase'); break;
      case 'sam':
        Sound.play('bao_sam', { pan }); Sound.voice('v_sam');
        banner('BÁO SÂM!', 'gold', nameOf(e.by)); vibrate(120);
        break;
      case 'start':
        Sound.play('start');
        if (e.turn === S.you) { Sound.play('myturn'); Sound.voice('v_turn'); vibrate(60); }
        break;
      case 'play':
        if (e.chop === 'chat2') { Sound.play('chop2', { pan }); Sound.voice('v_chat'); banner('CHẶT 2!', 'red', nameOf(e.by)); shakeTable(); vibrate([60, 40, 120]); }
        else if (e.chop === 'chatde') { Sound.play(e.depth >= 3 ? 'chopde2' : 'chopde', { pan }); Sound.voice('v_chat'); banner('CHẶT ĐÈ x' + (e.mult || 2) + '!', 'red', nameOf(e.by)); shakeTable(); vibrate([60, 40, 60, 40, 160]); }
        else Sound.play(e.n >= 5 ? 'play_big' : 'play', { pan });
        break;
      case 'pass': Sound.play('pass', { pan }); break;
      case 'round': Sound.play('collect'); break;
      case 'turn':
        if (e.to === S.you) { Sound.play('myturn'); Sound.voice('v_turn'); vibrate(60); }
        else Sound.play('turn', { pan: seatPan(e.to) });
        break;
      case 'chopsettle': Sound.play('coins'); break;
      case 'taunt':
        taunts[e.by] = { text: e.text, until: Date.now() + 2600 };
        Sound.voice('v_taunt' + e.k);
        setTimeout(() => S && render(), 2650);
        break;
      case 'pause': Sound.play('pause'); banner('TẠM DỪNG', 'dark'); break;
      case 'resume': Sound.play('resume'); banner('TIẾP TỤC', 'gold'); break;
      case 'conn': Sound.play(e.online ? 'reconnect' : 'disconnect', { pan: seatPan(e.idx) }); break;
      case 'host': Sound.play('notify'); toast(`${e.name || ''} giờ là chủ phòng`); break;
      case 'settings': toast(e.ai ? 'Chủ phòng đã bật gợi ý AI' : 'Chủ phòng đã tắt gợi ý AI'); break;
      case 'end': {
        Sound.play('end');
        if (e.kind === 'sam') { Sound.play('sam_win'); banner('SÂM THÀNH CÔNG!', 'gold', nameOf(e.winner)); }
        else if (e.kind === 'chan') { Sound.play('bat_sam'); banner('BẮT SÂM!', 'red', nameOf(e.winner)); if (e.samBy === S.you) setTimeout(() => Sound.play('sam_fail'), 700); }
        else if (e.kind === 'trang') { Sound.play('sam_win'); banner('ĂN TRẮNG!', 'gold', nameOf(e.winner)); }
        else banner('HẾT BÀI!', 'gold', nameOf(e.winner));
        break;
      }
      case 'result': {
        const r = S.result; if (!r) break;
        const me = r.rows[S.you];
        if (r.winner === S.you) { Sound.play('win'); Sound.voice('v_win'); confetti(); vibrate([80, 50, 80, 50, 200]); }
        else {
          Sound.play('lose'); Sound.voice('v_lose');
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
      warnedTurn = S.turnId; Sound.play('warn5'); Sound.voice('v_5s'); vibrate([40, 40, 40]);
    }
  }
  document.querySelectorAll('[data-since]').forEach(e => {
    const ms = performance.now() - +e.dataset.since;
    if (e.classList.contains('pz')) e.textContent = 'Đã dừng ' + fmtTime(ms);
    if (e.classList.contains('wz')) e.textContent = e.textContent.replace(/( \(\d+:\d+\))?$/, ' (' + fmtTime(ms) + ')');
  });
}, 200);

/* ---------- quản lý bàn (chủ phòng) ---------- */
$('btHost').onclick = () => { renderHostSheet(); $('hostSheet').classList.add('on'); };
$('btCloseHost').onclick = () => $('hostSheet').classList.remove('on');
$('btPause').onclick = () => act(S && S.pause ? 'resume' : 'pause');
function renderHostSheet() {
  const b = $('hostBody'); b.textContent = '';
  if (!S) return;
  const isHost = S.you === S.host;
  const panel = h('div', 'card-panel form');
  const aiRow = h('div', 'frow');
  const lab = h('div', ''); lab.append(h('b', '', 'Gợi ý AI cho cả phòng'));
  const sw = h('label', 'sw'); const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = S.settings.ai; inp.disabled = !isHost;
  inp.onchange = () => act('settings', { settings: { ai: inp.checked } });
  sw.append(inp, h('i', '')); aiRow.append(lab, sw); panel.append(aiRow);
  const pr = h('div', 'frow');
  pr.append(h('b', '', 'Tạm dừng ván'), h('span', 'muted', S.settings.pauseLimitMs ? `đã dùng ${fmtTime(S.pauseUsed || 0)} / ${fmtTime(S.settings.pauseLimitMs)}` : `đã dùng ${fmtTime(S.pauseUsed || 0)} · không giới hạn`));
  panel.append(pr);
  if (isHost && (S.phase === 'sam' || S.phase === 'play')) {
    const pb = h('button', 'btn ' + (S.pause ? 'gold' : ''), S.pause ? '▶ Tiếp tục ván' : '⏸ Tạm dừng cả bàn');
    pb.onclick = () => act(S.pause ? 'resume' : 'pause');
    panel.append(pb);
  }
  b.append(panel);
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
  b.append(pl);
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
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on')); }

/* ================= cài đặt ================= */
const ST_BIND = { stMute: 'mute', stVoice: 'voice', stAmbient: 'ambient', stSpatial: 'spatial', stVibrate: 'vibrate', stReduce: 'reduce', stPerf: 'perf' };
const ST_RANGE = { stMaster: 'master', stMusic: 'music', stSfx: 'sfx' };
function applySettings() {
  document.body.classList.toggle('reduce', !!settings.reduce);
  document.body.classList.toggle('perf', !!settings.perf);
  Sound.apply(settings);
  store.set('sam_settings', JSON.stringify(settings));
}
function openSettings() {
  for (const id in ST_BIND) $(id).checked = !!settings[ST_BIND[id]];
  for (const id in ST_RANGE) $(id).value = settings[ST_RANGE[id]];
  $('settingsSheet').classList.add('on');
}
for (const id in ST_BIND) $(id).onchange = () => { settings[ST_BIND[id]] = $(id).checked; applySettings(); if (id === 'stVoice' && settings.voice) Sound.voice('v_turn'); };
for (const id in ST_RANGE) $(id).oninput = () => { settings[ST_RANGE[id]] = +$(id).value; applySettings(); };
$(`stSfx`).onchange = () => Sound.play('play');
$('btCloseSettings').onclick = () => $('settingsSheet').classList.remove('on');
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) s.classList.remove('on'); }));

/* ================= lịch sử & thống kê ================= */
async function openHistory() {
  show('sHistory');
  const box = $('histList'); box.textContent = ''; box.append(h('div', 'empty', 'Đang tải…'));
  const j = await api('history');
  box.textContent = '';
  if (j.err) return box.append(h('div', 'empty', j.err));
  if (!j.games.length) return box.append(h('div', 'empty', 'Chưa có ván nào.\nChơi xong một ván là lịch sử hiện ở đây.'));
  j.games.forEach(g => {
    const it = h('button', 'hitem');
    it.append(h('div', 'av3', g.players.map(p => p.av).join('')));
    const ti = h('div', 'ti');
    ti.append(h('b', '', g.title || 'Ván ' + g.no));
    ti.append(h('small', '', `${new Date(g.endedAt).toLocaleString('vi-VN')} · phòng ${g.room}`));
    it.append(ti, h('div', 'dl ' + (g.delta > 0 ? 'p' : g.delta < 0 ? 'n' : ''), sc(g.delta)));
    it.onclick = () => openReplay(g.id);
    box.append(it);
  });
}
async function openStats() {
  show('sStats');
  const box = $('statsBox'); box.textContent = ''; box.append(h('div', 'empty', 'Đang tải…'));
  const j = await api('stats');
  box.textContent = '';
  if (j.err) return box.append(h('div', 'empty', j.err));
  const s = j.stats;
  if (!s.games) return box.append(h('div', 'empty', 'Chưa có số liệu. Chơi vài ván đã nhé!'));
  const grid = h('div', 'stats');
  const tile = (label, val, note, wide) => { const t = h('div', 'st-tile' + (wide ? ' wide' : '')); t.append(h('small', '', label), h('b', '', val)); if (note) t.append(h('em', '', note)); grid.append(t); };
  tile('Tổng điểm', sc(s.total), `qua ${s.games} ván`, true);
  tile('Thắng', `${s.wins}`, `${Math.round((s.wins / s.games) * 100)}% số ván`);
  tile('Chuỗi thắng dài nhất', `${s.bestStreak}`);
  tile('Ván ngon nhất', sc(s.best));
  tile('Ván đen nhất', sc(s.worst));
  tile('Báo Sâm', `${s.samWins}/${s.samCalls}`, 'thành công / lần báo');
  tile('Bắt Sâm', `${s.samCaught}`);
  tile('Chặt người khác', `${s.chops}`);
  tile('Bị chặt', `${s.chopped}`);
  tile('Cóng', `${s.cong}`);
  tile('Ăn trắng', `${s.trang}`);
  box.append(grid, h('p', 'muted center', 'Số liệu gắn với trình duyệt này.'));
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

/* ================= khởi động ================= */
applySettings();
window.addEventListener('resize', () => { if (S && current === 'sGame') { renderHand(); } });
(async function boot() {
  const c = qRoom || store.get('sam_room', ''), nm = store.get('sam_name', '');
  if (!c) return;
  if (!nm) { $('inCode').value = c; return; }   // người mới mở link mời: nhập tên rồi bấm Vào phòng
  const j = await api('join', { room: c, name: nm, av: myAv });
  if (j.code) enterRoom(j.code);
  else { if (qRoom) toast(j.err || 'Không vào được phòng'); store.set('sam_room', ''); history.replaceState(null, '', location.pathname); }
})();
