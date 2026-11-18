// Test đầu-cuối: chạy server thật (tiến trình riêng), client WebSocket thật, lưu trữ thật.
// Postgres: đặt TEST_DATABASE_URL (database sẽ bị xoá sạch bảng). Không có thì dùng file JSON tạm.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..', '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const PG = process.env.TEST_DATABASE_URL || '';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'samdua-e2e-'));
const ENV = Object.assign({}, process.env, {
  PORT: String(PORT), DATABASE_URL: PG, DATA_DIR, BOT_MS: '60', TURN_MS: '15000', SAM_MS: '1500', REVEAL_MS: '400',
  HOST_GRACE_MS: '1500', AFK_MS: '60000',
});
let srv = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startServer() {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => process.env.E2E_VERBOSE && process.stdout.write(d));
  srv.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) return r.json(); } catch (e) {}
    await sleep(100);
  }
  throw new Error('server không lên');
}
async function stopServer(sig = 'SIGTERM') {
  if (!srv) return;
  const p = new Promise(r => srv.once('exit', r));
  srv.kill(sig);
  await p;
  srv = null;
}
async function api(body) {
  const r = await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

class Client {
  constructor(token, name) { this.token = token; this.name = name; this.S = null; this.events = []; this.pend = new Map(); this.n = 0; this.waiters = []; this.uid = Math.random().toString(36).slice(2, 8); }
  connect(room) {
    this.room = room;
    return new Promise((res, rej) => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
      this.ws = ws;
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: this.token, room })));
      ws.on('message', b => {
        const m = JSON.parse(b);
        if (m.t === 'state') { this.S = m.s; this.events.push(...(m.ev || [])); res(); this.waiters = this.waiters.filter(w => !w()); }
        if (m.t === 'ack') { const p = this.pend.get(m.cid); if (p) { this.pend.delete(m.cid); p(m); } }
        if (m.t === 'gone') { this.gone = true; res(); }
      });
      ws.on('error', rej);
    });
  }
  act(a, data = {}, cid) {
    cid = cid || this.name + '-' + this.uid + '-' + (++this.n);
    return new Promise(res => { this.pend.set(cid, res); this.ws.send(JSON.stringify(Object.assign({ t: 'act', a, cid }, data))); });
  }
  until(pred, ms = 8000) {
    if (this.S && pred(this.S)) return Promise.resolve(this.S);
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error(this.name + ' timeout chờ trạng thái; phase=' + (this.S && this.S.phase))), ms);
      this.waiters.push(() => { if (this.S && pred(this.S)) { clearTimeout(to); res(this.S); return true; } return false; });
    });
  }
  close() { return new Promise(r => { if (!this.ws || this.ws.readyState > 1) return r(); this.ws.once('close', r); this.ws.close(); }); }
}

// Mỗi client tự chơi bằng gợi ý AI khi tới lượt
async function playUntilOver(clients, onStep) {
  for (let guard = 0; guard < 600; guard++) {
    const S = clients[0].S;
    if (S.phase === 'over') return S;
    for (const c of clients) {
      const s = c.S;
      if (s.phase === 'sam' && s.samPending) await c.act('sam', { yes: false });
      if (s.phase === 'play' && s.turn === s.you && !s.pause) {
        const r = await c.act('suggest');
        if (r.suggest && r.suggest.cards) await c.act('play', { cards: r.suggest.cards, v: s.turnId });
        else await c.act('pass', { v: s.turnId });
        if (onStep) await onStep();
      }
    }
    await sleep(40);
  }
  throw new Error('ván không kết thúc');
}

test.before(async () => {
  if (PG) {
    const { Client: PgClient } = require('pg');
    const c = new PgClient({ connectionString: PG });
    await c.connect();
    await c.query('DROP TABLE IF EXISTS game_events, games, rooms, room_events, sessions, users, schema_migrations CASCADE');
    await c.end();
  }
  const h = await startServer();
  assert.strictEqual(h.storage, PG ? 'postgres' : 'file');
});
test.after(async () => { await stopServer(); });

const A = 'e2e-token-AAAAAAAAAAAAAA', B = 'e2e-token-BBBBBBBBBBBBBB', X = 'e2e-token-XXXXXXXXXXXXXX';
let room, gameId1;

test('tạo phòng, vào phòng, token giả không vào được', async () => {
  const r = await api({ a: 'create', token: A, name: 'An', av: '🐸', settings: { replayPolicy: 'own', pauseLimitMs: 0 } });
  assert.ok(r.code);
  room = r.code;
  assert.ok((await api({ a: 'join', token: B, name: 'Bình', av: '🐼', room })).code);
  const x = new Client(X, 'x');
  await x.connect(room);
  assert.ok(x.gone, 'token không có trong phòng bị từ chối');
  await x.close();
});

test('chơi trọn ván qua WebSocket; lệnh lặp cid không xử lý 2 lần; người không phải chủ phòng không pause được', async () => {
  const a = new Client(A, 'a'), b = new Client(B, 'b');
  await a.connect(room); await b.connect(room);
  assert.strictEqual(a.S.you, 0); assert.strictEqual(b.S.you, 1);
  assert.strictEqual((await a.act('addBot')).err, undefined);
  assert.match((await b.act('start')).err, /Chỉ chủ phòng/);
  await a.act('start');
  await a.until(s => s.phase === 'sam' || s.phase === 'play' || s.phase === 'reveal' || s.phase === 'over');
  assert.ok(Array.isArray(a.S.hand));
  assert.ok(!b.events.some(e => e.type === 'deal' && e.hands), 'không gửi bài kín qua sự kiện');
  if (a.S.phase === 'sam') {
    assert.match((await b.act('pause')).err, /Chỉ chủ phòng/);
    await a.act('sam', { yes: false }, 'dup-1');
    const again = await a.act('sam', { yes: false }, 'dup-1');
    assert.ok(again.dup, 'cid lặp trả về kết quả cũ');
  }
  const S = await playUntilOver([a, b]);
  assert.strictEqual(S.phase, 'over');
  assert.ok(S.result && S.result.rows.length === 3);
  assert.strictEqual(S.result.rows.reduce((s, r) => s + r.delta, 0), 0);
  assert.ok(a.events.some(e => e.type === 'end'));
  const reveal = a.events.filter(e => e.type === 'result');
  assert.strictEqual(reveal.length, 1);
  gameId1 = S.gameId;
  await a.close(); await b.close();
});

test('xem lại: chỉ người trong ván; chính sách "bài mình" che bài người khác; lịch sử & thống kê', async () => {
  await sleep(200);
  const ra = await api({ a: 'replay', token: A, game: gameId1 });
  assert.ok(ra.replay, JSON.stringify(ra));
  const deal = ra.replay.events.find(e => e.type === 'deal');
  assert.ok(deal.hands[0].every(c => c >= 0), 'thấy bài mình');
  assert.ok(deal.hands[1].every(c => c === -1), 'không thấy bài người khác');
  assert.ok(ra.replay.events.some(e => e.type === 'end'));
  const seqs = ra.replay.events.map(e => e.seq);
  assert.deepStrictEqual(seqs, seqs.slice().sort((x, y) => x - y));
  assert.strictEqual(new Set(seqs).size, seqs.length);
  const rx = await api({ a: 'replay', token: X, game: gameId1 });
  assert.match(rx.err, /không có trong ván/);
  const h = await api({ a: 'history', token: A });
  assert.strictEqual(h.games.length, 1);
  const st = await api({ a: 'stats', token: B });
  assert.strictEqual(st.stats.games, 1);
});

test('mất kết nối giữa lượt: không tự bỏ lượt; chủ phòng mất kết nối thì chuyển quyền', async () => {
  const a = new Client(A, 'a'), b = new Client(B, 'b');
  await a.connect(room); await b.connect(room);
  assert.strictEqual((await a.act('start')).err, undefined);
  await a.until(s => s.gameNo === 2);
  if (a.S.phase === 'sam') { await a.act('sam', { yes: false }); await b.act('sam', { yes: false }); }
  await a.until(s => s.phase !== 'sam');
  if (a.S.phase !== 'play') return; // ăn trắng: bỏ qua
  // chờ tới lượt của B
  for (let i = 0; i < 200 && !(b.S.phase === 'play' && b.S.turn === 1); i++) {
    if (a.S.turn === 0) { const r = await a.act('suggest'); if (r.suggest.cards) await a.act('play', { cards: r.suggest.cards, v: a.S.turnId }); else await a.act('pass', { v: a.S.turnId }); }
    await sleep(30);
  }
  if (b.S.phase !== 'play') return;
  const turnId = b.S.turnId;
  await b.close();
  await a.until(s => s.wait && s.wait.idx === 1);
  assert.ok(a.S.timer.frozen, 'đồng hồ đóng băng');
  await sleep(600);
  assert.strictEqual(a.S.turnId, turnId, 'không tự bỏ lượt');
  await b.connect(room);
  await b.until(s => !s.wait);
  assert.ok(b.S.timer.left >= 9000, 'còn ít nhất ~10 giây');
  // chủ phòng (A) rớt mạng quá thời gian chờ → B thành chủ phòng
  await a.close();
  await b.until(s => s.host === 1, 6000);
  assert.strictEqual(b.S.host, 1);
  assert.ok(b.S.hostLog.some(x => x.reason === 'host_offline'));
  await b.close();
});

test('khởi động lại server giữa ván: không mất dữ liệu, ván tự tạm dừng, tiếp tục đúng lượt, không tính tiền 2 lần', async () => {
  const a = new Client(A, 'a'), b = new Client(B, 'b');
  await a.connect(room); await b.connect(room);
  const host = b.S.host === 1 ? b : a;
  await b.until(s => s.phase !== 'reveal');
  await sleep(100);
  if (b.S.phase === 'over' || b.S.phase === 'lobby') {
    const r = await host.act('start');
    assert.ok(!r.err, 'start: ' + r.err + ' host=' + b.S.host + ' phase=' + b.S.phase);
  }
  await a.until(s => s.phase !== 'over' && s.phase !== 'lobby');
  if (a.S.phase === 'sam') { await a.act('sam', { yes: false }); await b.act('sam', { yes: false }); }
  await a.until(s => s.phase === 'play' || s.phase === 'over');
  if (a.S.phase !== 'play') return;
  if (a.S.pause) await host.act('resume');
  // đánh vài nước
  for (let k = 0; k < 4; k++) {
    for (const c of [a, b]) if (c.S.phase === 'play' && c.S.turn === c.S.you && !c.S.pause) {
      const r = await c.act('suggest'); if (r.suggest.cards) await c.act('play', { cards: r.suggest.cards, v: c.S.turnId }); else await c.act('pass', { v: c.S.turnId });
    }
    await sleep(150);
  }
  if (a.S.phase !== 'play') return;
  const before = { hand: a.S.hand.slice(), turn: a.S.turn, turnId: a.S.turnId, scores: a.S.players.map(p => p.score), piles: JSON.stringify(a.S.piles) };
  await a.close(); await b.close();
  await sleep(300);
  await stopServer('SIGKILL');   // mô phỏng sập máy chủ
  const h = await startServer();
  assert.strictEqual(h.rooms >= 1, true);
  const a2 = new Client(A, 'a2'), b2 = new Client(B, 'b2');
  await a2.connect(room); await b2.connect(room);
  assert.ok(!a2.gone, 'token cũ vẫn vào lại được sau restart');
  assert.deepStrictEqual(a2.S.hand, before.hand, 'giữ nguyên bài trên tay');
  assert.strictEqual(a2.S.turn, before.turn);
  assert.strictEqual(a2.S.turnId, before.turnId);
  assert.deepStrictEqual(a2.S.players.map(p => p.score), before.scores);
  assert.deepStrictEqual(a2.S.piles, JSON.parse(before.piles), 'bài đã đánh còn trên bàn');
  assert.ok(a2.S.pause && a2.S.pause.kind === 'system', 'ván tự tạm dừng sau restart');
  const host2 = a2.S.host === 0 ? a2 : b2;
  const other = host2 === a2 ? b2 : a2;
  assert.match((await other.act('resume')).err, /Chỉ chủ phòng/);
  assert.match((await other.act('play', { cards: other.S.hand.slice(0, 1), v: other.S.turnId })).err || 'x', /tạm dừng|Chưa đến lượt/);
  await host2.act('resume');
  await a2.until(s => !s.pause);
  const S = await playUntilOver([a2, b2]);
  const total = S.players.reduce((s, p) => s + p.score, 0);
  assert.strictEqual(total, 0, 'tổng điểm vẫn bằng 0');
  await sleep(200);
  // điểm trong phòng = tổng deltas của các ván đã lưu (không ván nào bị tính 2 lần)
  const hist = await api({ a: 'history', token: A });
  const sumA = hist.games.reduce((s, g) => s + g.delta, 0);
  assert.strictEqual(sumA, S.players[0].score);
  const ids = hist.games.map(g => g.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  await a2.close(); await b2.close();
});

test('người xem: vào giữa ván, không nhận bài kín, chat được, không thao tác được', async () => {
  const S = 'e2e-token-SSSSSSSSSSSSSS';
  const a = new Client(A, 'a');
  await a.connect(room);
  const host = a.S.host === 0 ? a : null;
  if (host && (a.S.phase === 'over' || a.S.phase === 'lobby')) await a.act('start');
  if (a.S.phase !== 'lobby' && a.S.phase !== 'over') {
    const j = await api({ a: 'join', token: S, name: 'Hóng', room });
    assert.ok(j.canWatch, 'đang chơi thì được mời vào xem');
  }
  const w = await api({ a: 'watch', token: S, name: 'Hóng', av: '👀', room });
  assert.ok(w.code);
  const s = new Client(S, 's');
  await s.connect(room);
  assert.strictEqual(s.S.role, 'spec');
  assert.deepStrictEqual(s.S.hand, []);
  assert.strictEqual(s.S.you, -1);
  assert.ok(s.events.every(e => !e.hands));
  assert.match((await s.act('play', { cards: [0] })).err, /Người xem/);
  assert.strictEqual((await s.act('chat', { text: 'hóng ván' })).err, undefined);
  await a.until(st => st.chat.some(m => m.kind === 'spec' && m.text === 'hóng ván'));
  const r = await api({ a: 'replay', token: S, game: gameId1 });
  assert.match(r.err, /không có trong ván/);
  await s.act('leave');
  await a.until(st => !st.spectators.length);
  await s.close(); await a.close();
});

test('tài khoản: đăng ký, chơi ở máy 1, đăng nhập máy 2 thấy lịch sử và vào lại đúng ghế', async () => {
  const D1 = 'e2e-device-ONE-11111111', D2 = 'e2e-device-TWO-22222222';
  const reg = await api({ a: 'register', token: D1, username: 'e2e_user', password: 'matkhau123', name: 'Thành viên', gender: 'nu', claim: true });
  assert.ok(reg.session, JSON.stringify(reg));
  assert.strictEqual((await api({ a: 'register', token: D1, username: 'E2E_USER', password: 'xxxxxx' })).err.includes('đã có'), true);
  const me = await api({ a: 'me', token: D1, session: reg.session });
  assert.strictEqual(me.user.gender, 'nu');
  const c = await api({ a: 'create', token: D1, session: reg.session });
  const p1 = new Client(D1, 'm1');
  await p1.connect(c.code);
  assert.strictEqual(p1.S.players[0].name, 'Thành viên', 'tên lấy từ tài khoản');
  assert.strictEqual(p1.S.players[0].gender, 'nu');
  assert.strictEqual(p1.S.players[0].member, true);
  await p1.act('addBot');
  await p1.act('start');
  await p1.until(s => s.gameNo === 1);
  const S = await playUntilOver([p1]);
  assert.strictEqual(S.phase, 'over');
  await sleep(300);
  // máy 2: đăng nhập cùng tài khoản
  const lg = await api({ a: 'login', token: D2, username: 'e2e_user', password: 'matkhau123' });
  assert.ok(lg.session);
  const h = await api({ a: 'history', token: D2, session: lg.session });
  assert.strictEqual(h.games.length, 1, 'lịch sử theo tài khoản, không theo máy');
  const st = await api({ a: 'stats', token: D2, session: lg.session });
  assert.strictEqual(st.stats.games, 1);
  const rp = await api({ a: 'replay', token: D2, session: lg.session, game: h.games[0].id });
  assert.ok(rp.replay);
  // khách trên máy 2 (không đăng nhập) thì không thấy
  assert.strictEqual((await api({ a: 'history', token: D2 })).games.length, 0);
  // vào lại phòng từ máy 2: nhận lại đúng ghế cũ
  const j = await api({ a: 'join', token: D2, session: lg.session, room: c.code });
  assert.strictEqual(j.code, c.code);
  const p2 = new Client(D2, 'm2');
  await p2.connect(c.code);
  assert.strictEqual(p2.S.you, 0);
  assert.strictEqual(p2.S.players.length, 2, 'không tạo ghế mới');
  // cập nhật hồ sơ + cấu hình giọng
  const pr = await api({ a: 'profile', token: D2, session: lg.session, settings: { voice: true, mcVol: 40 }, gender: 'nam' });
  assert.deepStrictEqual(pr.user.settings, { voice: true, mcVol: 40 });
  assert.strictEqual(pr.user.gender, 'nam');
  await api({ a: 'logout', token: D2, session: lg.session });
  assert.strictEqual((await api({ a: 'me', token: D2, session: lg.session })).user, null);
  await p1.close(); await p2.close();
});

test('health check', async () => {
  const h = await (await fetch(BASE + '/health')).json();
  assert.strictEqual(h.ok, true);
  assert.strictEqual(h.db, 'ok');
});
