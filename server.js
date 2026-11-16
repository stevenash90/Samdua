// Sâm Lốc online — server Node.js thuần, không cần thư viện ngoài.
// Chạy: node server.js  (mặc định cổng 3000, đổi bằng biến môi trường PORT)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const TURN_MS = +process.env.TURN_MS || 30000; // thời gian mỗi lượt
const SAM_MS = +process.env.SAM_MS || 12000;   // thời gian báo Sâm
const BOT_MS = +process.env.BOT_MS || 1100;    // máy "suy nghĩ"
const AWAY_MS = +process.env.AWAY_MS || 4000;  // người mất kết nối: đánh hộ sau 4s
const MAX_PLAYERS = 5, HAND = 10;
const PT_SAM = 20, PT_TRANG = 20, PT_CONG = 15, PT_CHAT = 10;

const rooms = new Map();

/* ---------- Luật bài ---------- */
// id lá bài 0..51: hạng = id>>2 (0='3' ... 10='K', 11='A', 12='2'), chất = id&3 (♠ ♣ ♦ ♥)
const P = c => c >> 2;
const nat = p => (p <= 10 ? p + 3 : p === 11 ? 1 : 2); // giá trị tự nhiên để xếp sảnh: A=1, 2=2, 3..K
const isRun = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);

function classify(cs) {
  const n = cs.length;
  if (!n) return null;
  const ps = cs.map(P);
  if (ps.every(p => p === ps[0])) {
    const t = [null, 'single', 'pair', 'triple', 'quad'][n];
    return t ? { t, n, k: ps[0] } : null;
  }
  if (n < 3) return null;
  const ns = ps.map(nat).sort((a, b) => a - b);
  if (isRun(ns)) return { t: 'straight', n, k: ns[n - 1] };          // A-2-3, 2-3-4, ...
  if (ns[0] === 1) {                                                  // ...Q-K-A (A cao)
    const hi = ns.slice(1).concat(14);
    if (isRun(hi)) return { t: 'straight', n, k: 14 };
  }
  return null;
}

function beats(a, b) {
  if (a.t === 'quad' && b.t === 'single' && b.k === 12) return true; // tứ quý chặt 2
  return a.t === b.t && a.n === b.n && a.k > b.k;
}

function nextSeat(g, i) {
  const n = g.hands.length;
  let j = (i + 1) % n;
  while (g.passed[j] && j !== i) j = (j + 1) % n;
  return j;
}

// Trả về combo nếu hợp lệ, hoặc chuỗi báo lỗi
function checkPlay(g, i, cards) {
  const hand = g.hands[i];
  if (!Array.isArray(cards) || !cards.length || new Set(cards).size !== cards.length ||
      !cards.every(c => hand.includes(c))) return 'Bài không hợp lệ';
  const cb = classify(cards);
  if (!cb) return 'Bộ bài không hợp lệ';
  if (g.table && !beats(cb, g.table.combo)) return 'Không chặn được bài trên bàn';
  const rest = hand.filter(c => !cards.includes(c));
  if (rest.length && rest.every(c => P(c) === 12)) return 'Không được để 2 về cuối';
  if (cb.t === 'single') {
    const nx = nextSeat(g, i);
    if (nx !== i && g.hands[nx].length === 1 && hand.some(c => P(c) > cb.k))
      return 'Nhà dưới báo 1: phải đánh lá to nhất';
  }
  return cb;
}

function instantWin(hand) {
  const cnt = {};
  hand.forEach(c => (cnt[P(c)] = (cnt[P(c)] || 0) + 1));
  if (cnt[12] === 4) return 'Tứ quý 2';
  const st = classify(hand);
  if (st && st.t === 'straight') return 'Sảnh rồng';
  if (hand.every(c => (c & 3) >= 2) || hand.every(c => (c & 3) < 2)) return 'Đồng màu';
  if (Object.values(cnt).reduce((s, v) => s + (v >> 1), 0) >= 5) return '5 đôi';
  return null;
}

/* ---------- Máy ---------- */
function genCombos(hand) {
  const by = {};
  hand.forEach(c => (by[P(c)] = by[P(c)] || []).push(c));
  const out = [];
  for (const p in by) for (let n = 1; n <= by[p].length; n++) out.push(by[p].slice(0, n));
  const av = [];
  for (const p in by) av[nat(+p)] = by[p][0];
  if (av[1] !== undefined) av[14] = av[1];
  for (let s = 1; s <= 12; s++) {
    const run = [];
    for (let v = s; v <= 14 && av[v] !== undefined; v++) {
      run.push(av[v]);
      if (run.length >= 3 && new Set(run).size === run.length) out.push(run.slice());
    }
  }
  return out;
}

function botChoose(g, i) {
  const legal = [];
  for (const cards of genCombos(g.hands[i])) {
    const cb = checkPlay(g, i, cards);
    if (typeof cb === 'object') legal.push({ cards, cb });
  }
  if (!legal.length) return null;
  if (g.table) {
    legal.sort((a, b) => (a.cb.t === 'quad') - (b.cb.t === 'quad') || a.cb.k - b.cb.k);
    return legal[0].cards;
  }
  const w = x => {
    if (x.cb.t === 'quad') return 20;
    if (x.cb.t === 'straight') return 0;
    return ({ triple: 1, pair: 2, single: 3 })[x.cb.t] + (x.cb.k === 12 ? 10 : 0);
  };
  legal.sort((a, b) => w(a) - w(b) || b.cb.n - a.cb.n || a.cb.k - b.cb.k);
  return legal[0].cards;
}

/* ---------- Phòng & ván ---------- */
const rid = () => crypto.randomBytes(12).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Khách';
const hostIdx = r => r.players.findIndex(p => !p.bot);

function mkPlayer(name, token, bot) {
  return { name, token, bot: !!bot, score: 0, conn: new Set() };
}

function startGame(r) {
  const n = r.players.length;
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = crypto.randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const hands = r.players.map((_, i) => deck.slice(i * HAND, (i + 1) * HAND).sort((a, b) => a - b));
  let lead = r.players.indexOf(r.lastWinner);
  if (lead < 0) lead = crypto.randomInt(n);
  r.g = {
    hands, table: null, turn: lead, lead, samBy: null,
    passed: Array(n).fill(false), played: Array(n).fill(false), delta: Array(n).fill(0),
    samAns: r.players.map(p => (p.bot ? false : null)),
  };
  r.result = null;
  r.log = 'Chia bài xong';
  for (let k = 0; k < n; k++) {
    const i = (lead + k) % n, label = instantWin(hands[i]);
    if (label) return finish(r, { type: 'trang', winner: i, label });
  }
  r.phase = 'sam';
  setTimer(r, SAM_MS, () => beginPlay(r));
  broadcast(r);
}

function beginPlay(r) {
  const g = r.g;
  r.phase = 'play';
  if (g.samBy !== null) g.turn = g.samBy;
  r.log = g.samBy !== null ? `${r.players[g.samBy].name} báo Sâm!` : `${r.players[g.turn].name} đánh trước`;
  scheduleTurn(r);
}

function setTimer(r, ms, fn) {
  clearTimeout(r.timer);
  r.deadline = Date.now() + ms;
  r.timer = setTimeout(fn, ms);
}

function scheduleTurn(r) {
  const p = r.players[r.g.turn];
  const ms = p.bot ? BOT_MS : p.conn.size ? TURN_MS : AWAY_MS;
  setTimer(r, ms, () => autoMove(r));
  broadcast(r);
}

function autoMove(r) {
  if (r.phase !== 'play') return;
  const g = r.g, i = g.turn, p = r.players[i];
  if (!p.bot && g.table) return doPass(r, i);          // hết giờ: bỏ lượt
  const cards = botChoose(g, i);
  if (cards) doPlay(r, i, cards, checkPlay(g, i, cards));
  else doPass(r, i);
}

function doPlay(r, i, cards, cb) {
  const g = r.g, me = r.players[i];
  g.hands[i] = g.hands[i].filter(c => !cards.includes(c));
  g.played[i] = true;
  r.log = `${me.name} đánh`;
  if (g.table && cb.t === 'quad' && g.table.combo.t === 'single' && g.table.combo.k === 12) {
    g.delta[i] += PT_CHAT; g.delta[g.table.by] -= PT_CHAT;
    r.log = `${me.name} chặt 2 của ${r.players[g.table.by].name} (+${PT_CHAT})`;
  }
  g.table = { cards, by: i, combo: cb };
  if (g.samBy !== null && i !== g.samBy) return finish(r, { type: 'chan', winner: i });
  if (!g.hands[i].length) return finish(r, { type: g.samBy === i ? 'sam' : 'thuong', winner: i });
  advance(r, i);
}

function doPass(r, i) {
  r.g.passed[i] = true;
  r.log = `${r.players[i].name} bỏ lượt`;
  advance(r, i);
}

function advance(r, i) {
  const g = r.g, j = nextSeat(g, i);
  if (j === g.table.by) { g.table = null; g.passed.fill(false); }
  g.turn = j;
  scheduleTurn(r);
}

function finish(r, res) {
  clearTimeout(r.timer);
  const g = r.g, n = r.players.length, w = res.winner, d = g.delta.slice();
  const pay = (from, pts) => { d[from] -= pts; d[w] += pts; };
  if (res.type === 'chan') pay(g.samBy, PT_SAM * (n - 1));
  else for (let i = 0; i < n; i++) {
    if (i === w) continue;
    if (res.type === 'sam') pay(i, PT_SAM);
    else if (res.type === 'trang') pay(i, PT_TRANG);
    else pay(i, g.played[i] ? g.hands[i].length : PT_CONG);
  }
  r.players.forEach((p, i) => (p.score += d[i]));
  const wn = r.players[w].name;
  const title = {
    thuong: `${wn} về nhất!`,
    sam: `${wn} báo Sâm thành công!`,
    chan: `${wn} chặn Sâm của ${g.samBy !== null ? r.players[g.samBy].name : ''}!`,
    trang: `${wn} ăn trắng — ${res.label}!`,
  }[res.type];
  r.result = {
    title, winner: w,
    rows: r.players.map((p, i) => ({
      name: p.name, delta: d[i], hand: g.hands[i],
      cong: res.type === 'thuong' && i !== w && !g.played[i],
    })),
  };
  r.lastWinner = r.players[w];
  r.phase = 'over';
  r.deadline = 0;
  broadcast(r);
}

/* ---------- Gửi trạng thái ---------- */
function view(r, i) {
  const g = r.g, inGame = r.phase === 'sam' || r.phase === 'play';
  return {
    code: r.code, phase: r.phase, you: i, host: hostIdx(r), log: r.log || '',
    left: r.deadline ? Math.max(0, r.deadline - Date.now()) : 0,
    players: r.players.map((p, k) => ({
      name: p.name, bot: p.bot, score: p.score, online: p.bot || p.conn.size > 0,
      count: inGame ? g.hands[k].length : 0,
      passed: inGame && g.passed[k],
    })),
    hand: inGame ? g.hands[i] : [],
    turn: r.phase === 'play' ? g.turn : -1,
    table: inGame && g.table ? { cards: g.table.cards, by: g.table.by } : null,
    samBy: inGame ? g.samBy : null,
    samPending: r.phase === 'sam' && g.samAns[i] === null,
    result: r.phase === 'over' ? r.result : null,
  };
}

function broadcast(r) {
  r.touched = Date.now();
  r.players.forEach((p, i) => {
    if (!p.conn.size) return;
    const msg = `data: ${JSON.stringify(view(r, i))}\n\n`;
    p.conn.forEach(res => res.write(msg));
  });
}

function dropPlayer(r, i) {
  const p = r.players[i];
  p.conn.forEach(res => { res.write('event: gone\ndata: {}\n\n'); res.end(); });
  p.conn.clear();
  if (r.phase === 'lobby' || r.phase === 'over') {
    r.players.splice(i, 1);
  } else {                       // đang chơi: máy đánh thay
    p.bot = true; p.token = null; p.name = (p.name + ' (máy)').slice(0, 22);
    if (r.g.samAns[i] === null) r.g.samAns[i] = false;
  }
  if (hostIdx(r) < 0) { clearTimeout(r.timer); rooms.delete(r.code); return; }
  if (r.phase === 'sam' && r.g.samAns.every(a => a !== null)) return beginPlay(r);
  if (r.phase === 'play' && r.g.turn === i) return scheduleTurn(r);
  broadcast(r);
}

/* ---------- API ---------- */
function handle(b) {
  const a = b.a, token = String(b.token || '');
  if (token.length < 8) return { err: 'Thiếu mã người chơi' };
  if (a === 'create') {
    const code = newCode();
    rooms.set(code, { code, players: [mkPlayer(cleanName(b.name), token)], phase: 'lobby', g: null, touched: Date.now() });
    return { code };
  }
  const r = rooms.get(String(b.room || '').toUpperCase());
  if (!r) return { err: 'Không tìm thấy phòng' };
  let i = r.players.findIndex(p => p.token === token);
  if (a === 'join') {
    if (i >= 0) return { code: r.code };
    if (r.phase !== 'lobby' && r.phase !== 'over') return { err: 'Phòng đang chơi dở, đợi hết ván rồi vào' };
    if (r.players.length >= MAX_PLAYERS) return { err: 'Phòng đã đủ 5 người' };
    r.players.push(mkPlayer(cleanName(b.name), token));
    broadcast(r);
    return { code: r.code };
  }
  if (i < 0) return { err: 'Bạn không ở trong phòng này' };
  const idle = r.phase === 'lobby' || r.phase === 'over', isHost = i === hostIdx(r), g = r.g;
  switch (a) {
    case 'leave': dropPlayer(r, i); return {};
    case 'addBot': {
      if (!isHost || !idle) return { err: 'Không thêm máy được lúc này' };
      if (r.players.length >= MAX_PLAYERS) return { err: 'Phòng đã đủ 5 người' };
      const used = r.players.map(p => p.name);
      const nm = ['Máy Tèo', 'Máy Tý', 'Máy Sửu', 'Máy Dần'].find(x => !used.includes(x)) || 'Máy';
      r.players.push(mkPlayer(nm, null, true));
      broadcast(r); return {};
    }
    case 'kick': {
      const k = b.idx | 0;
      if (!isHost || !idle || k === i || !r.players[k]) return { err: 'Không mời ra được' };
      dropPlayer(r, k); return {};
    }
    case 'start':
      if (!isHost || !idle) return { err: 'Chỉ chủ phòng mới bắt đầu được' };
      if (r.players.length < 2) return { err: 'Cần ít nhất 2 người' };
      startGame(r); return {};
    case 'sam':
      if (r.phase !== 'sam' || g.samAns[i] !== null) return { err: 'Hết lượt báo Sâm' };
      g.samAns[i] = !!b.yes;
      if (b.yes) { g.samBy = i; beginPlay(r); }
      else if (g.samAns.every(x => x !== null)) beginPlay(r);
      else broadcast(r);
      return {};
    case 'play': {
      if (r.phase !== 'play' || g.turn !== i) return { err: 'Chưa đến lượt bạn' };
      const cb = checkPlay(g, i, b.cards);
      if (typeof cb === 'string') return { err: cb };
      doPlay(r, i, b.cards, cb); return {};
    }
    case 'pass':
      if (r.phase !== 'play' || g.turn !== i) return { err: 'Chưa đến lượt bạn' };
      if (!g.table) return { err: 'Bạn đang cầm cái, phải đánh' };
      doPass(r, i); return {};
  }
  return { err: 'Lệnh không hợp lệ' };
}

/* ---------- HTTP ---------- */
const INDEX = path.join(__dirname, 'public', 'index.html');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/') {
    return fs.readFile(INDEX, (e, buf) => {
      if (e) { res.writeHead(500); return res.end('Thiếu public/index.html'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  }
  if (req.method === 'GET' && u.pathname === '/events') {
    const r = rooms.get((u.searchParams.get('room') || '').toUpperCase());
    const i = r ? r.players.findIndex(p => p.token && p.token === u.searchParams.get('token')) : -1;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    if (i < 0) { res.write('event: gone\ndata: {}\n\n'); return res.end(); }
    const p = r.players[i];
    p.conn.add(res);
    req.on('close', () => { p.conn.delete(res); if (rooms.get(r.code) === r) broadcast(r); });
    return broadcast(r);
  }
  if (req.method === 'POST' && u.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let out;
      try { out = handle(JSON.parse(body)); } catch (e) { out = { err: 'Yêu cầu lỗi' }; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
}).listen(PORT, () => console.log(`Sâm Lốc đang chạy: http://localhost:${PORT}`));

// Giữ kết nối SSE sống & dọn phòng bỏ hoang
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    r.players.forEach(p => p.conn.forEach(res => res.write(': ping\n\n')));
    if (now - r.touched > 2 * 3600e3) { clearTimeout(r.timer); rooms.delete(r.code); }
  }
}, 20000);
