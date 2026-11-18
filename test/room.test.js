const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/config');
const { Room } = require('../src/room');
const { cards } = require('./helpers');

function mkStore() {
  const st = { commits: [], events: [], games: {}, roomEvents: [] };
  st.commit = (code, snap, { events, gameStart, gameEnd }) => {
    st.commits.push(snap);
    if (gameStart) st.games[gameStart.id] = { start: gameStart, end: null };
    st.events.push(...events);
    if (gameEnd) st.games[gameEnd.id].end = gameEnd;
  };
  st.roomEvent = (code, type, data) => st.roomEvents.push({ type, data });
  return st;
}

function setup(t, n, hands, opts = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const store = mkStore();
  const sent = [];
  const deps = { store, send: r => sent.push(r.outbox.slice()), deal: () => hands.map(cards), firstLead: opts.lead || 0 };
  const room = new Room('TEST', deps);
  const tokens = [];
  for (let i = 0; i < n; i++) {
    const tok = 'token-player-' + i;
    tokens.push(tok);
    const p = room.addHuman(tok, 'P' + i, '🙂');
    room.connect(p.pid);
  }
  const pid = i => room.players[i].pid;
  const act = (i, msg) => { const r = room.handle(pid(i), msg); room.commit(); return r; };
  return { room, store, sent, pid, act, tokens };
}
const tick = (t, ms) => t.mock.timers.tick(ms);
const sum = a => a.reduce((x, y) => x + y, 0);

const H3 = [
  '2s 4c 8d 9s Jc Qd Kh 3h 3d 10c',      // P0: có lá 2
  '5s 5h 6s 6h 7s 7h 9h Jh Kc Ac',       // P1: ba đôi thông 5-6-7
  '8s 8h 9c 9d 10s 10h 4d Js Qh Ks',     // P2: ba đôi thông 8-9-10
];

test('chặt 2 bằng ba đôi thông rồi bị chặt đè: chỉ người đè ăn x2, người đánh 2 không mất, ghi đúng 1 lần', t => {
  const { room, act, store } = setup(t, 3, H3);
  assert.strictEqual(act(0, { a: 'start' }).err, undefined);
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  assert.strictEqual(room.phase, 'play');
  assert.strictEqual(room.g.turn, 0);
  const v = () => room.g.turnId;
  assert.deepStrictEqual(act(0, { a: 'play', cards: cards('2s'), v: v(), cid: 'a1' }), {});
  // gửi lặp cùng cid: không xử lý lại
  assert.ok(act(0, { a: 'play', cards: cards('2s'), v: v(), cid: 'a1' }).dup);
  assert.deepStrictEqual(act(1, { a: 'play', cards: cards('5s 5h 6s 6h 7s 7h'), v: v() }), {});
  assert.strictEqual(room.g.table.chop, true);
  assert.deepStrictEqual(act(2, { a: 'play', cards: cards('8s 8h 9c 9d 10s 10h'), v: v() }), {});
  assert.deepStrictEqual(room.g.chain.choppers, [1, 2]);
  // bằng nhau / nhỏ hơn không chặn được
  act(0, { a: 'pass', v: v() });
  act(1, { a: 'pass', v: v() });
  assert.strictEqual(room.g.table, null, 'hết vòng');
  assert.deepStrictEqual(room.g.ledger.map(e => [e.kind, e.from, e.to, e.amount]), [['chatde', 1, 2, 20]]);
  // bài đã đánh vẫn nằm trên bàn
  assert.strictEqual(room.g.piles[0].length, 1);
  assert.strictEqual(room.g.piles[1].length, 1);
  assert.strictEqual(room.g.piles[2].length, 1);
  // commit nhiều lần không ghi lại
  room.commit(); room.commit();
  assert.strictEqual(room.g.ledger.length, 1);
  const types = store.events.map(e => e.type);
  assert.ok(types.includes('play') && types.includes('pass') && types.includes('chopsettle'));
  const seqs = store.events.map(e => e.seq);
  assert.strictEqual(new Set(seqs).size, seqs.length, 'seq không trùng');
});

test('đánh khi không phải lượt, lượt cũ (v sai) bị từ chối', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  assert.match(act(1, { a: 'play', cards: cards('9h') }).err, /Chưa đến lượt/);
  assert.match(act(0, { a: 'play', cards: cards('3h'), v: room.g.turnId - 1 }).err, /Lượt đã thay đổi/);
  assert.match(act(0, { a: 'play', cards: cards('5s') }).err, /Bài không hợp lệ/, 'không đánh được bài của người khác');
});

test('chỉ chủ phòng pause/resume; pause đóng băng đồng hồ; resume khôi phục đúng thời gian còn lại', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  tick(t, 10000);
  assert.match(act(1, { a: 'pause' }).err, /Chỉ chủ phòng/);
  assert.deepStrictEqual(act(0, { a: 'pause' }), {});
  const left = room.g.timer.remaining;
  assert.strictEqual(left, C.TURN_MS - 10000);
  tick(t, 120000);
  assert.strictEqual(room.g.turn, 0, 'không tự qua lượt khi đang pause');
  assert.match(act(0, { a: 'play', cards: cards('3h'), v: room.g.turnId }).err, /tạm dừng/);
  assert.match(act(0, { a: 'pass', v: room.g.turnId }).err, /tạm dừng/);
  assert.deepStrictEqual(act(0, { a: 'resume' }), {});
  assert.strictEqual(room.g.timer.deadline - Date.now(), left);
  assert.strictEqual(room.g.pauseUsed, 120000);
  tick(t, left + 1);
  assert.notStrictEqual(room.g.turn, 0, 'hết giờ thì qua lượt như bình thường');
});

test('giới hạn tổng thời gian pause mỗi ván; phòng không giới hạn thì không tự tiếp tục', t => {
  const { room, act } = setup(t, 2, H3.slice(0, 2));
  room.settings.pauseLimitMs = 60000;
  act(0, { a: 'start' });
  act(0, { a: 'sam', yes: false }); act(1, { a: 'sam', yes: false });
  act(0, { a: 'pause' });
  tick(t, 60001);
  assert.strictEqual(room.g.pause, null, 'hết hạn mức thì tự tiếp tục');
  assert.match(act(0, { a: 'pause' }).err, /hết thời gian tạm dừng/);
  room.settings.pauseLimitMs = 0;
  assert.deepStrictEqual(act(0, { a: 'pause' }), {});
  tick(t, 3600e3);
  assert.ok(room.g.pause);
});

test('mất kết nối đúng lượt: không tự bỏ lượt; kết nối lại thì còn ít nhất 10 giây', t => {
  const { room, act, pid } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  tick(t, 25000);
  room.disconnect(pid(0));
  assert.ok(room.g.wait);
  tick(t, 600000);
  assert.strictEqual(room.g.turn, 0, 'vẫn chờ người mất kết nối');
  room.connect(pid(0));
  assert.strictEqual(room.g.wait, null);
  assert.strictEqual(room.g.timer.deadline - Date.now(), C.RECONNECT_MIN_MS);
});

test('chủ phòng cho máy đánh thay người mất kết nối', t => {
  const { room, act, pid } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  room.disconnect(pid(0));
  room.handle(pid(1), { a: 'transferHost', idx: 1 }); // không phải chủ phòng
  assert.strictEqual(room.hostIdx(), 0);
  // chủ phòng đang offline: chuyển quyền sau thời gian chờ
  tick(t, C.HOST_GRACE_MS + 1);
  assert.ok(room.tick());
  assert.strictEqual(room.hostIdx(), 1);
  assert.ok(room.hostLog.some(h => h.reason === 'host_offline'));
  assert.deepStrictEqual(act(1, { a: 'autoplay', idx: 0 }), {});
  tick(t, C.BOT_MS + 1);
  assert.notStrictEqual(room.g.turn, 0);
});

test('AFK được phát hiện sau 30 giây không tương tác, không loại người chơi', t => {
  const { room, act } = setup(t, 2, H3.slice(0, 2));
  act(0, { a: 'start' });
  tick(t, C.AFK_MS + 1);
  room.tick();
  assert.ok(room.players.every(p => room.isAfk(p)));
  act(1, { a: 'active' });
  assert.ok(!room.isAfk(room.players[1]));
  assert.strictEqual(room.players.length, 2);
});

test('gợi ý AI: chủ phòng tắt thì không dùng được; gợi ý không tự đánh', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  const r = act(0, { a: 'suggest' });
  assert.ok(r.suggest && r.suggest.cards);
  assert.strictEqual(room.g.turn, 0, 'không tự đánh');
  assert.match(act(1, { a: 'settings', settings: { ai: false } }).err, /Chỉ chủ phòng/);
  act(0, { a: 'settings', settings: { ai: false } });
  assert.match(act(0, { a: 'suggest' }).err, /tắt gợi ý/);
});

test('báo Sâm bị bắt: đền cả làng, có giai đoạn reveal trước kết quả', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  act(2, { a: 'sam', yes: true });
  assert.strictEqual(room.phase, 'play');
  assert.strictEqual(room.g.turn, 2);
  act(2, { a: 'play', cards: cards('4d'), v: room.g.turnId });
  act(0, { a: 'play', cards: cards('8d'), v: room.g.turnId });
  assert.strictEqual(room.phase, 'reveal');
  assert.strictEqual(room.result.type, 'chan');
  assert.deepStrictEqual(room.players.map(p => p.score), [40, 0, -40]);
  assert.deepStrictEqual(room.g.reveal.cards, cards('8d'));
  tick(t, C.REVEAL_MS - 10);
  assert.strictEqual(room.phase, 'reveal');
  tick(t, 20);
  assert.strictEqual(room.phase, 'over');
  assert.match(act(1, { a: 'start' }).err, /Chỉ chủ phòng/);
});

test('lưu và khôi phục giữa ván: tự tạm dừng, giữ nguyên bài, lượt và điểm', t => {
  const { room, act, tokens } = setup(t, 3, H3);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  act(0, { a: 'play', cards: cards('3h'), v: room.g.turnId });
  tick(t, 5000);
  const snap = JSON.parse(JSON.stringify(room.snapshot()));
  room.close();
  const r2 = Room.restore(snap, { store: mkStore(), send() {} });
  assert.strictEqual(r2.g.pause.kind, 'system');
  assert.strictEqual(r2.g.turn, 1);
  assert.deepStrictEqual(r2.g.hands, room.g.hands);
  assert.strictEqual(r2.g.timer.remaining, C.TURN_MS - 5000);
  assert.strictEqual(r2.auth(tokens[0]), 0, 'token cũ vẫn vào lại được');
  assert.strictEqual(r2.auth('token-gia-mao'), -1);
  r2.connect(r2.players[0].pid); r2.connect(r2.players[1].pid);
  assert.deepStrictEqual(r2.handle(r2.players[0].pid, { a: 'resume' }), {});
  assert.strictEqual(r2.g.timer.deadline - Date.now(), C.TURN_MS - 5000);
  assert.deepStrictEqual(r2.handle(r2.players[1].pid, { a: 'play', cards: cards('9h'), v: r2.g.turnId }), {});
  r2.close();
});

test('mô phỏng 300 ván toàn máy: không lỗi, tổng điểm bằng 0, mỗi ván kết thúc đúng 1 lần', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 5_000_000 });
  for (let n = 2; n <= 5; n++) {
    const ends = [];
    const store = mkStore();
    const room = new Room('SIM' + n, { store, send() {} });
    const h = room.addHuman('sim-token-' + n, 'Người', '🙂');
    room.connect(h.pid);
    room.players[0].auto = true;
    for (let k = 1; k < n; k++) room.handle(h.pid, { a: 'addBot' });
    for (let gno = 0; gno < 75; gno++) {
      room.handle(h.pid, { a: 'start' });
      room.players[0].auto = true;
      room.handle(h.pid, { a: 'sam', yes: false });
      let guard = 0;
      while (room.phase !== 'over' && guard++ < 500) { room.commit(); tick(t, 4000); room.players[0].auto = true; }
      assert.strictEqual(room.phase, 'over', 'ván phải kết thúc');
      ends.push(store.events.filter(e => e.type === 'end').length);
      assert.strictEqual(sum(room.players.map(p => p.score)), 0);
    }
    assert.deepStrictEqual(ends, ends.map((_, i) => i + 1));
    room.close();
  }
});
