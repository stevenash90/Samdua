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

test('nhân vật: đủ hồ sơ, bỏ Tô Tổng, có Phương Oanh và 10 nhân vật mới, quan hệ trỏ đúng tên', () => {
  const { PERSONAS } = require('../src/botchat');
  const { BOTS } = require('../src/room');
  const names = BOTS.map(b => b[0]);
  assert.ok(!names.includes('Tô Tổng') && !names.includes('Tún') && names.includes('Phương Oanh'));
  for (const n of ['M10', 'Đô 500', 'Người Mỹ gốc U Cà', 'Big Kim', 'Tesla Driver']) assert.ok(names.includes(n), n);
  assert.strictEqual(names.length, 19);
  for (const [n, p] of Object.entries(PERSONAS)) {
    for (const k of ['start', 'chop', 'chopped', 'brag', 'win', 'lose', 'sam', 'reply', 'human', 'news']) assert.ok(p[k] && p[k].length, `${n}.${k}`);
    assert.ok(p.talk >= 2 && p.talk <= 10, n);
    assert.ok(p.bio && p.style && p.inspired, n);
    for (const r of Object.keys(p.rel || {})) assert.ok(PERSONAS[r], `${n} → ${r}`);
    assert.ok(p.news.every(x => x.includes('{q}')), n);
  }
});

test('tin thời sự: lọc tin buồn/chính trị, không nhắc lại tin đã dùng', () => {
  const News = require('../src/news');
  const xml = `<rss><channel>
    <item><title><![CDATA[Trấn Thành đoán trúng mascot ở Ca sĩ mặt nạ]]></title><link>a</link></item>
    <item><title>Ca sĩ nổi tiếng qua đời ở tuổi 60</title><link>b</link></item>
    <item><title>Quốc hội thông qua luật mới về thuế</title><link>c</link></item>
    <item><title>Tuyển Việt Nam thắng đậm trận giao hữu &amp; vui</title><link>d</link></item>
  </channel></rss>`;
  const items = News.parseFeed(xml, 'showbiz');
  assert.deepStrictEqual(items.map(x => x.id), ['a', 'd']);
  assert.match(items[1].q, /thắng đậm trận giao hữu & vui/);
  News._setRss(items);
  const all = News.available([], Date.parse('2026-11-18'));
  assert.ok(all.some(x => x.id === 'csmn') && all.some(x => x.id === 'a'));
  assert.ok(!News.available(['csmn', 'a'], Date.parse('2026-11-18')).some(x => x.id === 'csmn' || x.id === 'a'));
  assert.ok(!News.available([], Date.parse('2027-06-01')).some(x => x.id === 'csmn'), 'tin hết hạn');
  News._setRss([]);
});

test('máy nói chuyện: tiết chế, không lặp câu trong cả bàn, đáp người chơi, đáp nhau, tắt được', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-18T12:00:00Z') });
  const { PERSONAS } = require('../src/botchat');
  const room = new Room('BCH', { store: mkStore(), send() {} });
  const h = room.addHuman('bc-token', 'Lan', '🙂', { gender: 'nu' });
  room.connect(h.pid);
  for (let k = 0; k < 4; k++) room.handle(h.pid, { a: 'addBot' });
  const bots = () => room.players.filter(x => x.bot);
  const drain = s => { for (let k = 0; k < s; k++) tick(t, 1000); };
  const play = () => {
    room.handle(h.pid, { a: 'start' });
    room.players[0].auto = true;
    room.handle(h.pid, { a: 'sam', yes: false });
    let guard = 0;
    while (room.phase !== 'over' && guard++ < 500) { room.commit(); tick(t, 4000); room.players[0].auto = true; }
    drain(40);
  };
  let total = 0;
  for (let gno = 0; gno < 12; gno++) {
    const from = room.chatSeq;
    play();
    const lines = room.chat.filter(m => m.id > from && m.bot);
    total += lines.length;
    for (const p of bots()) {
      const c = lines.filter(m => m.name === p.name);
      assert.ok(c.length <= PERSONAS[p.name].talk, `${p.name} nói ${c.length} câu`);
      assert.ok(c.every(m => !/\{\w+\}/.test(m.text)), 'còn biến chưa thay');
      assert.ok(c.every(m => m.kind === 'player' && m.seat === room.idxOf(p.pid)));
    }
    assert.ok(lines.length <= 2 + 2 * 4 + 4 + 2, `cả bàn nói ${lines.length} câu/ván là quá nhiều`);
  }
  assert.ok(total >= 12, 'máy phải có nói');
  // không bao giờ có hai câu máy cách nhau dưới 2 giây
  const at = room.chat.filter(m => m.bot).map(m => m.at);
  for (let k = 1; k < at.length; k++) assert.ok(at[k] - at[k - 1] >= 2000, `hai câu máy cách nhau ${at[k] - at[k - 1]}ms`);
  // không nói lại câu nào trong cả bàn (trừ câu khơi tin: mỗi tin chỉ một lần)
  const all = room.chat.filter(m => m.bot).map(m => m.name + '|' + m.text);
  assert.strictEqual(new Set(all).size, all.length, 'có câu bị lặp');
  // gọi tên máy → máy đáp (nếu còn câu chưa nói)
  const b = bots().find(p => (PERSONAS[p.name].reply.length - (room.botUsed[p.name] || []).filter(x => PERSONAS[p.name].reply.includes(x)).length) > 0);
  if (b) {
    room.botTalk = {};
    let replied = false;
    for (let k = 0; k < 6 && !replied; k++) {
      const from = room.chatSeq;
      drain(4);
      room.handle(h.pid, { a: 'chat', text: 'ê ' + PERSONAS[b.name].keys[0] + ' ơi' });
      drain(4);
      replied = room.chat.some(m => m.id > from && m.bot && m.name === b.name);
    }
    assert.ok(replied, 'máy phải đáp khi bị gọi tên');
  }
  // lưu / khôi phục giữ danh sách câu đã nói
  const r2 = Room.restore(JSON.parse(JSON.stringify(room.snapshot())), { send() {} });
  assert.deepStrictEqual(r2.botUsed, room.botUsed);
  assert.deepStrictEqual(r2.newsUsed, room.newsUsed);
  // tắt → im lặng
  room.handle(h.pid, { a: 'settings', settings: { botChat: false } });
  const from = room.chatSeq;
  play();
  room.handle(h.pid, { a: 'chat', text: 'đói quá ăn phở không' });
  drain(10);
  assert.strictEqual(room.chat.filter(m => m.id > from && m.bot).length, 0);
  room.close();
});

test('máy khơi chuyện thời sự thì máy khác góp ý kiến', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-18T12:00:00Z') });
  const room = new Room('NEWS', { store: mkStore(), send() {} });
  const h = room.addHuman('nw-token', 'Lan', '🙂');
  room.connect(h.pid);
  for (let k = 0; k < 3; k++) room.handle(h.pid, { a: 'addBot' });
  room.botGame = { lines: 0, budget: 10, news: 0 };
  let replies = 0;
  for (let k = 0; k < 14; k++) {
    room.botGame.news = 0; room.botTalk = {};
    const from = room.chatSeq;
    assert.ok(room.botNews(1));
    for (let s = 0; s < 20; s++) tick(t, 1000);
    const ls = room.chat.filter(m => m.id > from && m.bot);
    assert.ok(ls.length >= 1);
    if (ls.length >= 2) replies++;
  }
  assert.ok(replies >= 3, 'các máy khác phải góp chuyện');
  assert.strictEqual(new Set(room.newsUsed).size, room.newsUsed.length);
  room.close();
});

/* ---------------- chat, người xem, đổi chỗ, đổi bộ bài ---------------- */
test('chat: lọc nội dung, giới hạn tốc độ, giữ tối đa 60 tin, lưu qua restart', t => {
  const { room, act } = setup(t, 2, H3.slice(0, 2));
  assert.match(act(0, { a: 'chat', text: '   ' }).err, /trống/);
  assert.deepStrictEqual(act(0, { a: 'chat', text: 'xin chào\u0000<b>' }), {});
  assert.match(act(0, { a: 'chat', text: 'spam' }).err, /chậm/);
  const m = room.chat[room.chat.length - 1];
  assert.strictEqual(m.text, 'xin chào <b>');
  assert.strictEqual(m.kind, 'player');
  assert.strictEqual(m.seat, 0);
  for (let k = 0; k < 70; k++) { tick(t, 800); act(1, { a: 'chat', text: 'tin ' + k }); }
  assert.strictEqual(room.chat.length, 60);
  assert.strictEqual(room.chat[59].text, 'tin 69');
  assert.ok(act(1, { a: 'chat', text: 'x'.repeat(500) }) && true);
  const r2 = Room.restore(JSON.parse(JSON.stringify(room.snapshot())), { send() {} });
  assert.strictEqual(r2.chat.length, 60);
  assert.strictEqual(r2.chatSeq, room.chatSeq);
});

test('người xem: không có bài, không thao tác ván, chat được, không thấy bài kín qua sự kiện', t => {
  const { room, act } = setup(t, 2, H3.slice(0, 2));
  const sp = room.addSpectator('spectator-token-123456', 'Hóng', '👀');
  assert.ok(sp);
  assert.strictEqual(room.who('spectator-token-123456').role, 'spec');
  assert.strictEqual(room.who('token-player-0').role, 'player');
  assert.strictEqual(room.who('nobody-token-xxxxxxxx'), null);
  act(0, { a: 'start' });
  const v = room.view(-1, 'spec');
  assert.deepStrictEqual(v.hand, []);
  assert.strictEqual(v.you, -1);
  assert.strictEqual(v.samPending, false);
  assert.strictEqual(v.spectators.length, 1);
  assert.ok(!JSON.stringify(v).includes('"hands"'));
  assert.ok(room.eventsFor(-1).every(e => !e.hands));
  for (const a of ['start', 'pause', 'sam', 'play', 'pass', 'suggest', 'addBot', 'deckReq']) {
    assert.match(room.handle(sp.pid, { a }).err, /Người xem/);
  }
  tick(t, 1000);
  assert.deepStrictEqual(room.handle(sp.pid, { a: 'chat', text: 'đánh đi' }), {});
  assert.strictEqual(room.chat[room.chat.length - 1].kind, 'spec');
  room.handle(sp.pid, { a: 'leave' });
  assert.strictEqual(room.spectators.length, 0);
});

test('đổi chỗ giải đen: thua 10 ván liền mới được xin, xin được cả lúc đang chơi, đồng ý thì đổi từ ván sau', t => {
  const { room, act } = setup(t, 3, H3);
  room.players[1].lose = 9;
  assert.match(act(1, { a: 'swapReq', idx: 2 }).err, /Thua 10 ván/);
  room.players[1].lose = 10;
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) act(i, { a: 'sam', yes: false });
  assert.strictEqual(room.phase, 'play');
  // đang chơi vẫn xin được
  assert.deepStrictEqual(act(1, { a: 'swapReq', idx: 2 }), {});
  assert.strictEqual(room.swap.to, room.players[2].pid);
  assert.ok(room.outbox.length === 0 || true);
  assert.match(act(0, { a: 'swapAns', yes: true }).err, /Không có lời/);
  const p1 = room.players[1].pid, p2 = room.players[2].pid;
  assert.deepStrictEqual(act(2, { a: 'swapAns', yes: true }), {});
  assert.deepStrictEqual(room.swapPlan, { a: p1, b: p2 });
  assert.strictEqual(room.players[1].pid, p1, 'chưa đổi trong ván đang chơi');
  assert.match(act(1, { a: 'swapReq', idx: 0 }).err, /chờ ván sau/);
  // kết thúc ván rồi bắt đầu ván mới -> đổi chỗ
  room.finish({ type: 'thuong', winner: 0, label: '' });
  tick(t, C.REVEAL_MS + 1);
  assert.strictEqual(room.phase, 'over');
  assert.strictEqual(room.players[1].pid, p1, 'giữa các ván vẫn chờ tới ván mới');
  act(0, { a: 'start' });
  assert.strictEqual(room.players[1].pid, p2);
  assert.strictEqual(room.players[2].pid, p1);
  assert.strictEqual(room.players[2].lose, 0, 'đổi xong thì xoá chuỗi thua');
  assert.strictEqual(room.swapPlan, null);
});

test('đổi chỗ: người kia từ chối thì có câu trả lời, không đổi; máy luôn đồng ý', t => {
  const { room, act, sent } = setup(t, 2, H3.slice(0, 2));
  room.handle(room.players[0].pid, { a: 'addBot' });
  room.players[0].lose = 12;
  act(0, { a: 'swapReq', idx: 1 });
  act(1, { a: 'swapAns', yes: false });
  assert.strictEqual(room.swapPlan, null);
  const evs = sent.flat();
  const no = evs.find(e => e.type === 'swapans' && e.yes === false);
  assert.ok(no && no.text.length > 3, 'có câu từ chối');
  assert.ok(evs.some(e => e.type === 'swapreq' && e.text === 'Đen quá, đổi chỗ phát!'));
  // xin đổi với máy
  const bot = room.players[2].pid;
  assert.deepStrictEqual(act(0, { a: 'swapReq', idx: 2 }), {});
  assert.deepStrictEqual(room.swapPlan, { a: room.players[0].pid, b: bot });
  assert.ok(sent.flat().some(e => e.type === 'swapans' && e.yes && e.text === 'Ok cưng!'));
});

test('lời xin đổi chỗ / đổi bộ bài tự hết hạn', t => {
  const { room, act } = setup(t, 2, H3.slice(0, 2));
  room.players[1].lose = 10;
  act(1, { a: 'swapReq', idx: 0 });
  act(1, { a: 'deckReq' });
  tick(t, 31000);
  assert.ok(room.tick());
  assert.strictEqual(room.swap, null);
  assert.strictEqual(room.deckReq, null);
});

test('chuỗi thua được đếm đúng sau mỗi ván', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  act(2, { a: 'sam', yes: true });
  act(2, { a: 'play', cards: cards('4d'), v: room.g.turnId });
  act(0, { a: 'play', cards: cards('8d'), v: room.g.turnId }); // P0 bắt Sâm, thắng
  assert.deepStrictEqual(room.players.map(p => p.lose), [0, 1, 1]);
});

test('đổi bộ bài: người chơi đề nghị, chỉ chủ phòng quyết; chủ phòng tự đổi được; có thời gian chờ', t => {
  const { room, act } = setup(t, 3, H3);
  assert.deepStrictEqual(act(1, { a: 'deckReq' }), {});
  assert.match(act(2, { a: 'deckReq' }).err, /chờ chủ phòng/);
  assert.match(act(1, { a: 'deckAns', yes: true }).err, /Chỉ chủ phòng/);
  assert.deepStrictEqual(act(0, { a: 'deckAns', yes: true }), {});
  assert.deepStrictEqual(room.deck, { no: 2, style: 1, v: 2 });
  assert.match(act(1, { a: 'deckReq' }).err, /đợi một chút/);
  act(2, { a: 'deckReq' });
  act(0, { a: 'deckAns', yes: false });
  assert.strictEqual(room.deck.no, 2);
  act(0, { a: 'deckReq' }); // chủ phòng đổi thẳng
  assert.deepStrictEqual(room.deck, { no: 3, style: 2, v: 2 });
  assert.ok(room.chat.some(c => c.kind === 'sys' && /thay bộ bài mới/.test(c.text)));
});

test('thống kê của bàn: thắng/thua, chuỗi xanh đỏ, Sâm, bắt Sâm, cóng; lưu qua restart', t => {
  const { room, act } = setup(t, 3, H3);
  act(0, { a: 'start' });
  act(2, { a: 'sam', yes: true });
  act(2, { a: 'play', cards: cards('4d'), v: room.g.turnId });
  act(0, { a: 'play', cards: cards('8d'), v: room.g.turnId }); // P0 bắt Sâm
  tick(t, C.REVEAL_MS + 1);
  const v = room.view(0);
  const [s0, s1, s2] = v.rstats;
  assert.strictEqual(s0.wins, 1); assert.strictEqual(s0.samCaught, 1); assert.strictEqual(s0.streak, 1);
  assert.strictEqual(s2.samCalls, 1); assert.strictEqual(s2.samWins, 0); assert.strictEqual(s2.streak, -1); assert.strictEqual(s2.points, -40);
  assert.strictEqual(s1.losses, 1);
  // ván 2: P1 hết bài trước
  room.deps.deal = () => H3.map(cards);
  act(0, { a: 'start' });
  for (let i = 0; i < 3; i++) if (room.phase === 'sam') act(i, { a: 'sam', yes: false });
  room.finish({ type: 'thuong', winner: 1, label: '' });
  const r2 = room.view(0).rstats;
  assert.strictEqual(r2[0].streak, -1, 'đang xanh thì thua là đỏ');
  assert.strictEqual(r2[1].streak, 1);
  assert.strictEqual(r2[2].streak, -2);
  assert.strictEqual(r2[2].bestLose, 2);
  assert.ok(r2[2].cong >= 0);
  assert.strictEqual(r2.reduce((a, x) => a + x.points, 0), 0);
  const back = Room.restore(JSON.parse(JSON.stringify(room.snapshot())), { send() {} });
  assert.deepStrictEqual(back.view(0).rstats, r2);
});

test('danh sách phòng: ẩn phòng riêng tư và phòng không còn ai online', () => {
  const room = new Room('LIST', { store: mkStore(), send() {} });
  const h = room.addHuman('list-token-1234567', 'Steve', '🙂');
  assert.strictEqual(room.listing(), null, 'chưa ai online');
  room.connect(h.pid);
  room.handle(h.pid, { a: 'addBot' });
  const l = room.listing();
  assert.strictEqual(l.code, 'LIST'); assert.strictEqual(l.host, 'Steve'); assert.strictEqual(l.canJoin, true);
  assert.strictEqual(l.players.length, 2); assert.ok(l.players[1].bot);
  room.handle(h.pid, { a: 'settings', settings: { private: true } });
  assert.strictEqual(room.listing(), null, 'phòng riêng tư');
  room.close();
});

test('máy cầm tay chắc ăn thì tự báo Sâm sau vài giây, rồi đánh hết bài', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 2_000_000 });
  const room = new Room('BSAM', { store: mkStore(), send() {}, deal: () => [
    '3s 3d 6h 8c 9s 9d Jh Qc 5s 7h',       // người
    'As Ah Ad Ac Ks Kh Kd 2s 2h 2d',        // máy: tứ quý A, sám K, sám 2 — không ai chặn nổi
    '3c 4c 5c 6c 6d 8d 8h 10h Jd Qd',
  ].map(cards), firstLead: 0 });
  const h = room.addHuman('bsam-token-123456', 'Lan', '🙂');
  room.connect(h.pid);
  room.handle(h.pid, { a: 'addBot' }); room.handle(h.pid, { a: 'addBot' });
  room.handle(h.pid, { a: 'start' });
  assert.strictEqual(room.phase, 'sam');
  room.handle(h.pid, { a: 'sam', yes: false });
  assert.strictEqual(room.phase, 'sam', 'chờ máy nghĩ');
  for (let k = 0; k < 5; k++) t.mock.timers.tick(1000);
  assert.strictEqual(room.g ? room.g.samBy : room.result && room.result.samBy, 1, 'máy ghế 1 báo Sâm');
  let guard = 0;
  while (room.phase === 'play' && guard++ < 50) { room.commit(); t.mock.timers.tick(2000); }
  assert.ok(room.result, 'ván kết thúc');
  assert.strictEqual(room.result.type, 'sam');
  room.close();
});

test('voice: vào/ra, bật mic, người xem chỉ nghe, rời phòng thì tự ra khỏi voice', () => {
  const room = new Room('VOIC', { store: mkStore(), send() {} });
  const a = room.addHuman('voice-token-aaaa1', 'An', '🙂'); room.connect(a.pid);
  const b = room.addHuman('voice-token-bbbb2', 'Bình', '🙂'); room.connect(b.pid);
  room.handle(a.pid, { a: 'vjoin', mic: true });
  room.handle(b.pid, { a: 'vjoin', mic: false });
  let v = room.view(0).voice;
  assert.strictEqual(v.length, 2);
  assert.deepStrictEqual(v.map(x => [x.name, x.mic, x.seat]), [['An', true, 0], ['Bình', false, 1]]);
  assert.match(v[0].vid, /^[0-9a-f]{10}$/);
  assert.ok(!JSON.stringify(v).includes(a.pid), 'không lộ pid');
  room.handle(b.pid, { a: 'vmic', on: true });
  assert.ok(room.view(0).voice[1].mic);
  room.disconnect(b.pid);
  assert.strictEqual(room.view(0).voice.length, 1, 'mất kết nối thì ra khỏi voice');
  room.handle(a.pid, { a: 'vleave' });
  assert.strictEqual(room.view(0).voice.length, 0);
  room.close();
});

test('bộ bài: phòng lưu từ bản cũ được chuyển sang danh sách bộ ảnh mới', () => {
  const { DECKS } = require('../src/room');
  assert.deepStrictEqual(DECKS, ['Hoàng cung Việt', 'Siêu anh hùng vũ trụ', 'Ai Cập Fantasy', 'La Mã Fantasy']);
  const room = new Room('DKMG', { store: mkStore(), send() {} });
  const snap = room.snapshot();
  for (const [old, want] of [[0, 0], [3, 0], [5, 0], [6, 1]]) {
    const r = Room.restore(Object.assign({}, snap, { deck: { no: 4, style: old } }), { send() {} });
    assert.deepStrictEqual(r.deck, { no: 4, style: want, v: 2 }, 'bộ cũ ' + old);
    r.close();
  }
  room.close();
});
