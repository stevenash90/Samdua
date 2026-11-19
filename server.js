// Sâm Dứa 2.0 — server: HTTP tĩnh + API + WebSocket realtime.
// Chạy: node server.js   (cổng lấy từ PORT, mặc định 3000)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const C = require('./src/config');
const { Room, pidOf, cleanName, cleanAv, normalizeSettings } = require('./src/room');
const { createStore } = require('./src/store');
const { createAccounts } = require('./src/accounts');
const VERSION = require('./package.json').version;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const store = createStore(C, log);
const accounts = createAccounts(store, { googleClientId: C.GOOGLE_CLIENT_ID });
const News = require('./src/news');
const NEWS_ON = process.env.BOT_NEWS !== '0';
if (NEWS_ON) News.start(log);   // tải tin lúc máy chủ thức dậy, rồi định kỳ
const rooms = new Map();
const started = Date.now();
let ready = false;

/* ---------------- phòng ---------------- */
function deps() {
  return { store, send: broadcast, log, onClose: r => { rooms.delete(r.code); store.deleteRoom(r.code); closeSockets(r); } };
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

/* ---------------- WebSocket ---------------- */
const sockets = new Map(); // room code -> Set(ws)

function sendJson(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function broadcast(room) {
  const set = sockets.get(room.code);
  if (!set) return;
  for (const ws of set) {
    const i = room.idxOf(ws.pid);
    if (i >= 0) { sendJson(ws, { t: 'state', v: VERSION, s: room.view(i), ev: room.eventsFor(i) }); continue; }
    if (room.specIdx(ws.pid) >= 0) { sendJson(ws, { t: 'state', v: VERSION, s: room.view(-1, 'spec'), ev: room.eventsFor(-1) }); continue; }
    sendJson(ws, { t: 'gone' }); ws.close();
  }
}
function closeSockets(room) {
  const set = sockets.get(room.code);
  if (!set) return;
  for (const ws of set) { sendJson(ws, { t: 'gone' }); ws.close(); }
  sockets.delete(room.code);
}

function onSocket(ws) {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', buf => {
    let m;
    try { m = JSON.parse(buf); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') return hello(ws, m);
    const room = ws.room && rooms.get(ws.room);
    if (!room || room.closed) return sendJson(ws, { t: 'gone' });
    if (m.t === 'act') {
      let res;
      try { res = room.handle(ws.pid, m); } catch (e) { log('handle error', room.code, e); res = { err: 'Lỗi máy chủ' }; }
      sendJson(ws, Object.assign({ t: 'ack', cid: m.cid || null }, res));
      if (room.closed) return;
      if (m.a === 'leave') { leaveSocket(ws, room); ws.room = null; }
      if (res.quiet) { if (room.tick()) room.publish(); return; }
      if (!res.err || res.dup) room.commit();
    }
  });
  ws.on('close', () => {
    const room = ws.room && rooms.get(ws.room);
    if (room) { leaveSocket(ws, room); room.disconnect(ws.pid); if (!room.closed) room.publish(); }
  });
}

function leaveSocket(ws, room) {
  const set = sockets.get(room.code);
  if (set) { set.delete(ws); if (!set.size) sockets.delete(room.code); }
}

function hello(ws, m) {
  if (!ready) return sendJson(ws, { t: 'retry' });
  const room = rooms.get(String(m.room || '').toUpperCase());
  if (!room || room.closed) return sendJson(ws, { t: 'gone' });
  const who = room.who(String(m.token || ''));
  if (!who) return sendJson(ws, { t: 'gone' });
  if (ws.room) { const old = rooms.get(ws.room); if (old) { leaveSocket(ws, old); old.disconnect(ws.pid); } }
  ws.room = room.code;
  ws.pid = who.pid;
  if (!sockets.has(room.code)) sockets.set(room.code, new Set());
  sockets.get(room.code).add(ws);
  room.connect(ws.pid);
  room.publish();
}

/* ---------------- API ---------------- */
const hits = new Map();
function limited(ip, n = 40) {
  const now = Date.now(), w = 60000;
  const h = hits.get(ip) || { at: now, n: 0 };
  if (now - h.at > w) { h.at = now; h.n = 0; }
  h.n++;
  hits.set(ip, h);
  return h.n > n;
}

async function api(b, ip) {
  const a = b.a, token = String(b.token || '');
  if (token.length < 16 || token.length > 100) return { err: 'Thiếu mã người chơi' };
  if (!ready) return { err: 'Máy chủ đang khởi động, thử lại sau vài giây' };
  if ((a === 'create' || a === 'join') && limited(ip)) return { err: 'Thao tác quá nhanh, đợi một chút' };
  if (NEWS_ON && (a === 'create' || a === 'join' || a === 'watch')) News.freshen(log);   // mở app: tin cũ quá 20 phút thì tải lại
  if (['register', 'login', 'google', 'password'].includes(a) && limited('acc:' + ip, 20)) return { err: 'Thử quá nhiều lần, đợi một phút' };
  if (a === 'config') return { googleClientId: C.GOOGLE_CLIENT_ID || null };
  if (a === 'rooms') {
    // phòng công khai đang có người: phòng còn ghế lên trước, rồi phòng đông người
    const list = [...rooms.values()].map(r => r.listing()).filter(Boolean)
      .sort((x, y) => (y.canJoin - x.canJoin) || (y.humans + y.spectators - x.humans - x.spectators))
      .slice(0, 30);
    return { rooms: list };
  }

  /* ---- tài khoản ---- */
  if (a === 'register' || a === 'login' || a === 'google') {
    const r = a === 'register' ? await accounts.register(b) : a === 'login' ? await accounts.login(b) : await accounts.google(b);
    if (r.err) return r;
    if (b.claim) r.claimed = await store.claimGames(pidOf(token), r.user.pid);   // gộp các ván đã chơi trên máy này
    return r;
  }
  const user = b.session ? await accounts.resolve(String(b.session)) : null;
  if (a === 'me') return user ? { user } : { user: null };
  if (a === 'logout') { await accounts.logout(String(b.session || '')); return {}; }
  if (a === 'profile') {
    if (!user) return { err: 'Bạn chưa đăng nhập' };
    return { user: await accounts.update(user.id, b) };
  }
  if (a === 'password') {
    if (!user) return { err: 'Bạn chưa đăng nhập' };
    return accounts.changePassword(user.id, b.old, b.new);
  }

  const pid = user ? user.pid : pidOf(token);
  const ident = { pid: user ? user.pid : undefined, gender: b.gender || (user && user.gender) };
  const nameOf = () => b.name || (user && user.name);
  const avOf = () => b.av || (user && user.av);
  if (a === 'create') {
    const code = newCode();
    const room = new Room(code, deps());
    room.settings = normalizeSettings(b.settings, room.settings);
    room.addHuman(token, nameOf(), avOf(), ident);
    rooms.set(code, room);
    room.commit();
    return { code };
  }
  if (a === 'join') {
    const room = rooms.get(String(b.room || '').toUpperCase());
    if (!room || room.closed) return { err: 'Không tìm thấy phòng' };
    // tài khoản đang ngồi trong phòng từ thiết bị khác: chuyển ghế sang thiết bị này
    if (user && room.auth(token) < 0 && room.players.some(p => p.pid === user.pid && !p.bot)) { room.rebind(user.pid, token); room.commit(); }
    const i = room.auth(token);
    if (i >= 0) {
      // vào lại: cập nhật tên/avatar nếu đang không chơi
      if (b.name && (room.phase === 'lobby' || room.phase === 'over')) {
        room.players[i].name = cleanName(b.name); room.players[i].av = cleanAv(b.av); room.commit();
      }
      return { code: room.code };
    }
    if (room.phase !== 'lobby' && room.phase !== 'over') return { err: 'Phòng đang chơi dở, đợi hết ván rồi vào', canWatch: true };
    if (room.players.length >= C.MAX_PLAYERS) return { err: 'Phòng đã đủ 5 người', canWatch: true };
    room.removeSpectator(pid, true);   // đang xem thì chuyển sang ngồi chơi
    room.removeSpectator(pidOf(token), true);
    room.addHuman(token, nameOf(), avOf(), ident);
    room.log = `${room.players[room.players.length - 1].name} vào phòng`;
    room.commit();
    return { code: room.code };
  }
  if (a === 'watch') {
    const room = rooms.get(String(b.room || '').toUpperCase());
    if (!room || room.closed) return { err: 'Không tìm thấy phòng' };
    if (user) room.rebind(user.pid, token);
    if (room.auth(token) >= 0) return { code: room.code };   // đã là người chơi
    if (!room.addSpectator(token, nameOf(), avOf(), ident)) return { err: 'Phòng đã đủ người xem' };
    room.commit();
    return { code: room.code, spectator: true };
  }
  if (a === 'history') {
    const games = await store.gamesFor(pid, 50);
    return { games: games.map(g => summarize(g, pid)) };
  }
  if (a === 'stats') {
    const games = await store.gamesFor(pid, 1000);
    return { stats: stats(games, pid) };
  }
  if (a === 'replay') {
    const g = await store.getGame(String(b.game || ''));
    if (!g || !g.endedAt) return { err: 'Không tìm thấy ván hoặc ván chưa kết thúc' };
    let seat = g.players.findIndex(p => p.pid === pid);
    if (seat < 0) seat = g.players.findIndex(p => p.pid === pidOf(token));
    if (seat < 0) return { err: 'Bạn không có trong ván này nên không xem lại được' };
    const policy = (g.settings && g.settings.replayPolicy) || 'all';
    const events = g.events.map(e => {
      if (e.type !== 'deal' || policy === 'all') return e;
      return Object.assign({}, e, { hands: e.hands.map((h, k) => (k === seat ? h : h.map(() => -1))) });
    });
    return {
      replay: {
        id: g.id, room: g.room, no: g.no, startedAt: g.startedAt, endedAt: g.endedAt, policy, seat,
        players: g.players.map(p => ({ name: p.name, av: p.av, bot: p.bot, gender: p.gender || 'nam' })), events, result: g.result,
        points: g.settings && g.settings.points,
      },
    };
  }
  return { err: 'Lệnh không hợp lệ' };
}

function summarize(g, pid) {
  const seat = g.players.findIndex(p => p.pid === pid);
  const r = g.result || {};
  return {
    id: g.id, room: g.room, no: g.no, endedAt: g.endedAt, title: r.title, type: r.type,
    win: r.winner === seat, delta: g.deltas ? g.deltas[seat] : 0,
    players: g.players.map(p => ({ name: p.name, av: p.av })), seat,
  };
}

function stats(games, pid) {
  const s = { games: 0, wins: 0, total: 0, best: 0, worst: 0, samCalls: 0, samWins: 0, samCaught: 0, chops: 0, chopped: 0, cong: 0, trang: 0, streak: 0, bestStreak: 0 };
  const chrono = games.slice().sort((a, b) => a.endedAt - b.endedAt);
  for (const g of chrono) {
    const seat = g.players.findIndex(p => p.pid === pid);
    const r = g.result || {}, d = g.deltas ? g.deltas[seat] : 0;
    s.games++;
    s.total += d;
    s.best = Math.max(s.best, d);
    s.worst = Math.min(s.worst, d);
    if (r.winner === seat) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); } else s.streak = 0;
    if (r.samBy === seat) { s.samCalls++; if (r.type === 'sam') s.samWins++; }
    if (r.type === 'chan' && r.winner === seat) s.samCaught++;
    if (r.type === 'trang' && r.winner === seat) s.trang++;
    for (const e of r.entries || []) {
      if ((e.kind === 'chat2' || e.kind === 'chatde') && e.to === seat) s.chops++;
      if ((e.kind === 'chat2' || e.kind === 'chatde') && e.from === seat) s.chopped++;
      if (e.kind === 'cong' && e.from === seat) s.cong++;
    }
  }
  return s;
}

/* ---------------- HTTP ---------------- */
const PUB = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy'); }
    const ext = path.extname(file);
    const audio = ext === '.ogg' || ext === '.mp3';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': audio ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health' || u.pathname === '/healthz') {
    const body = {
      ok: ready && !(store.lastError && (!store.lastOk || store.lastError.at > store.lastOk)),
      version: VERSION, storage: store.kind, uptimeSec: Math.round((Date.now() - started) / 1000),
      news: News.status(), rooms: rooms.size, sockets: [...sockets.values()].reduce((s, x) => s + x.size, 0),
      lastStoreError: store.lastError,
    };
    store.ping().then(() => (body.db = 'ok'), e => { body.db = 'error: ' + e.message; body.ok = false; }).finally(() => {
      res.writeHead(body.ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    });
    return;
  }
  if (req.method === 'POST' && u.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      let out;
      try { out = await api(JSON.parse(body), req.socket.remoteAddress); }
      catch (e) { log('api error', e && e.message); out = { err: 'Yêu cầu lỗi' }; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, u.pathname);
  res.writeHead(405); res.end();
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', onSocket);

// heartbeat + chuyển chủ phòng + AFK + dọn phòng bỏ hoang
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 25000);
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.closed) continue;
    if (r.tick()) r.commit();
    const live = sockets.get(r.code);
    if ((!live || !live.size) && now - r.touched > C.ROOM_IDLE_MS) r.close();
  }
}, 2000);

/* ---------------- khởi động ---------------- */
async function boot() {
  await store.init();
  const snaps = await store.loadRooms();
  for (const s of snaps) {
    try {
      if (!s || s.v !== 2) continue;
      const r = Room.restore(s, deps());
      if (!r.humans().length) { store.deleteRoom(r.code); continue; }
      rooms.set(r.code, r);
    } catch (e) { log('restore failed', s && s.code, e.message); }
  }
  ready = true;
  log(`Sâm Dứa ${VERSION} | storage=${store.kind} | rooms restored=${rooms.size}`);
}

server.listen(C.PORT, () => log(`Đang chạy: http://localhost:${C.PORT}`));
boot().catch(e => { log('BOOT FAILED', e); process.exit(1); });

async function shutdown(sig) {
  log('shutdown', sig);
  for (const r of rooms.values()) if (!r.closed) { r.commit(); }
  try { await store.close(); } catch (e) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { server, rooms, store };
