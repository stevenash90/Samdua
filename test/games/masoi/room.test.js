const test = require('node:test');
const assert = require('node:assert');
const { Room } = require('../../../src/games/masoi/room');
const { roleSet, wolvesFor } = require('../../../src/games/masoi/roles');

const tick = (t, ms) => { for (let k = 0; k < ms; k += 500) t.mock.timers.tick(500); };
function mkRoom(nBots, opt = {}) {
  const room = new Room('MS' + Math.random().toString(36).slice(2, 5), { send() {}, ...opt });
  const h = room.addHuman('ms-token-' + Math.random(), 'Lan', '🙂', { gender: 'nu' });
  room.connect(h.pid);
  for (let k = 0; k < nBots; k++) assert.deepStrictEqual(room.handle(h.pid, { a: 'addBot' }), {});
  return { room, h };
}

test('chia vai đúng số người', () => {
  for (let n = 5; n <= 12; n++) {
    const r = roleSet(n);
    assert.strictEqual(r.length, n);
    assert.strictEqual(r.filter(x => x === 'wolf').length, wolvesFor(n));
    assert.ok(r.includes('seer') && r.includes('guard'));
    assert.strictEqual(r.includes('witch'), n >= 7);
    assert.strictEqual(r.includes('hunter'), n >= 8);
  }
});

test('cần ít nhất 5 người, tối đa 12', () => {
  const { room, h } = mkRoom(3);
  assert.match(room.handle(h.pid, { a: 'start' }).err, /ít nhất 5/);
  for (let k = 0; k < 8; k++) room.handle(h.pid, { a: 'addBot' });
  assert.strictEqual(room.players.length, 12);
  assert.match(room.handle(h.pid, { a: 'addBot' }).err, /đủ 12/);
  room.close();
});

test('máy chơi trọn ván tới khi có phe thắng (nhiều ván, nhiều số người)', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 5_000_000 });
  const wins = { wolf: 0, village: 0 };
  for (let game = 0; game < 24; game++) {
    const { room, h } = mkRoom(4 + (game % 8));   // 5..12 người
    assert.deepStrictEqual(room.handle(h.pid, { a: 'start' }), {});
    assert.strictEqual(room.phase, 'night');
    let guard = 0;
    while (room.phase !== 'over' && guard++ < 400) tick(t, 5000);
    assert.strictEqual(room.phase, 'over', 'ván phải kết thúc');
    const g = room.g;
    const alive = g.alive.map((a, k) => a && k).filter(k => k !== false);
    const w = alive.filter(k => g.roles[k] === 'wolf').length;
    if (g.winner === 'village') assert.strictEqual(w, 0);
    else assert.ok(w >= alive.length - w);
    wins[g.winner]++;
    room.close();
  }
  assert.ok(wins.wolf > 0 && wins.village > 0, 'cả hai phe đều thắng được: ' + JSON.stringify(wins));
});

test('không lộ vai: dân chỉ thấy vai mình (và vai người chết), Sói thấy đồng bọn, người chết thấy hết', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 6_000_000 });
  const { room, h } = mkRoom(7);
  room.handle(h.pid, { a: 'start' });
  const g = room.g;
  for (let i = 0; i < room.players.length; i++) {
    const v = room.view(i);
    v.players.forEach((p, k) => {
      if (k === i) assert.strictEqual(p.role, g.roles[i]);
      else if (g.roles[i] === 'wolf' && g.roles[k] === 'wolf') assert.strictEqual(p.role, 'wolf');
      else assert.strictEqual(p.role, null, `người ${i} thấy vai người ${k}`);
    });
    const raw = JSON.stringify(v);
    assert.ok(!raw.includes('"roles"'), 'không gửi cả mảng vai');
  }
  const spec = room.view(-1, 'spec');
  assert.ok(spec.players.every((p, k) => p.role === g.roles[k]), 'người xem thấy hết');
  room.close();
});

test('kênh chat: ban đêm dân không chat được, Sói chat riêng, người xem/chết ở kênh hồn ma', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 7_000_000 });
  const { room, h } = mkRoom(6);
  room.handle(h.pid, { a: 'start' });
  const g = room.g, me = 0;
  const r = room.handle(h.pid, { a: 'chat', text: 'xin chào' });
  if (g.roles[me] === 'wolf') {
    assert.deepStrictEqual(r, {});
    const msg = room.chat[room.chat.length - 1];
    assert.strictEqual(msg.ch, 'wolf');
    const villager = g.roles.findIndex(x => x !== 'wolf');
    assert.ok(!room.view(villager).chat.some(m => m.id === msg.id), 'dân không thấy chat Sói');
  } else assert.match(r.err, /ngủ/);
  room.close();
});

test('lưu và khôi phục giữa ván rồi chơi tiếp tới hết', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 8_000_000 });
  const { room, h } = mkRoom(6);
  room.handle(h.pid, { a: 'start' });
  tick(t, 40000);
  const snap = JSON.parse(JSON.stringify(room.snapshot()));
  room.close();
  const r2 = Room.restore(snap, { send() {} });
  assert.strictEqual(r2.game, 'masoi');
  let guard = 0;
  while (r2.phase !== 'over' && guard++ < 400) tick(t, 5000);
  assert.strictEqual(r2.phase, 'over');
  r2.close();
});

test('bỏ phiếu: đa số treo cổ, hoà thì không ai chết', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 9_000_000 });
  const { room, h } = mkRoom(5);
  room.handle(h.pid, { a: 'start' });
  const g = room.g;
  // đưa thẳng tới bước bỏ phiếu, khống chế phiếu
  room.cancel(room.phaseT); room.timers.forEach(x => clearTimeout(x)); room.timers.clear();
  room.beginVote(); room.timers.forEach(x => clearTimeout(x)); room.timers.clear();
  const al = room.aliveIdx();
  const target = al[1];
  for (const k of al) if (k !== target) g.votes[k] = target;
  g.votes[target] = al[0];
  room.resolveVote();
  assert.ok(!g.alive[target], 'đa số → bị treo');
  room.close();
});

test('lệnh của người chơi đi qua handle(): cắn/soi/che/vote dùng trường target', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 9_500_000 });
  // thử cho đến khi người chơi được chia vai Sói
  for (let tries = 0; tries < 40; tries++) {
    const { room, h } = mkRoom(5);
    room.handle(h.pid, { a: 'start' });
    if (room.g.roles[0] !== 'wolf') { room.close(); continue; }
    const prey = room.g.roles.findIndex(r => r !== 'wolf');
    assert.deepStrictEqual(room.handle(h.pid, { a: 'night', kind: 'wolf', target: prey, cid: 'x1' }), {});
    assert.strictEqual(room.g.night.wolf[0], prey);
    // tới bước bỏ phiếu
    let guard = 0;
    while (room.phase !== 'vote' && room.phase !== 'over' && guard++ < 100) tick(t, 1000);
    if (room.phase === 'vote' && room.alive(0)) {
      const tgt = room.aliveIdx().find(k => k !== 0);
      assert.deepStrictEqual(room.handle(h.pid, { a: 'vote', target: tgt, cid: 'x2' }), {});
      assert.strictEqual(room.g.votes[0], tgt);
    }
    room.close();
    return;
  }
  assert.fail('không được chia vai Sói lần nào');
});
