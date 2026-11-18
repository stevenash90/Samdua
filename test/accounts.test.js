const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileStore } = require('../src/store');
const { createAccounts, makeGoogleVerifier } = require('../src/accounts');

async function mk(opts) {
  const st = new FileStore(fs.mkdtempSync(path.join(os.tmpdir(), 'acc-')), () => {});
  await st.init();
  return { st, acc: createAccounts(st, opts) };
}

test('đăng ký, đăng nhập, phiên, đăng xuất', async () => {
  const { acc } = await mk();
  assert.match((await acc.register({ username: 'ab', password: '123456' })).err, /3–20/);
  assert.match((await acc.register({ username: 'Steve', password: '123' })).err, /6 ký tự/);
  const r = await acc.register({ username: 'Steve', password: 'matkhau1', name: 'Steve', av: '🐸', gender: 'nam' });
  assert.ok(r.session && r.session.length === 64);
  assert.strictEqual(r.user.username, 'steve');
  assert.strictEqual(r.user.pid, 'u_' + r.user.id);
  assert.ok(!('passHash' in r.user), 'không trả mật khẩu băm ra ngoài');
  assert.match((await acc.register({ username: 'STEVE', password: 'abcdef' })).err, /đã có người dùng/);
  assert.match((await acc.login({ username: 'steve', password: 'sai-roi' })).err, /Sai/);
  assert.match((await acc.login({ username: 'khongco', password: 'abcdef' })).err, /Sai/);
  const l = await acc.login({ username: 'Steve', password: 'matkhau1' });
  assert.strictEqual((await acc.resolve(l.session)).id, r.user.id);
  assert.strictEqual(await acc.resolve('x'.repeat(64)), null);
  await acc.logout(l.session);
  assert.strictEqual(await acc.resolve(l.session), null);
  assert.ok(await acc.resolve(r.session), 'phiên khác vẫn còn');
});

test('hồ sơ: tên, avatar, giới tính, cấu hình giọng; đổi mật khẩu', async () => {
  const { acc } = await mk();
  const r = await acc.register({ username: 'linh', password: 'abcdef', gender: 'nu' });
  assert.strictEqual(r.user.gender, 'nu');
  const u = await acc.update(r.user.id, { name: '  Linh   Xinh  ', gender: 'hacker', settings: { voice: true, mcVol: 70 } });
  assert.strictEqual(u.name, 'Linh Xinh');
  assert.strictEqual(u.gender, 'nu', 'giới tính lạ bị bỏ qua');
  assert.deepStrictEqual(u.settings, { voice: true, mcVol: 70 });
  assert.match((await acc.changePassword(r.user.id, 'sai', 'moi12345')).err, /không đúng/);
  assert.deepStrictEqual(await acc.changePassword(r.user.id, 'abcdef', 'moi12345'), {});
  assert.ok((await acc.login({ username: 'linh', password: 'moi12345' })).session);
});

test('đăng nhập Google: kiểm tra chữ ký, aud, iss, hạn; lần đầu tự tạo tài khoản', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256' });
  const sign = (payload, key = privateKey, kid = 'k1') => {
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = enc({ alg: 'RS256', kid }) + '.' + enc(payload);
    return data + '.' + crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
  };
  const base = { iss: 'https://accounts.google.com', aud: 'cid.apps.googleusercontent.com', sub: '1234567890', email: 'dat.pham@gmail.com', name: 'Phạm Đạt', exp: Date.now() / 1000 + 600 };
  const { acc } = await mk({ googleClientId: base.aud, fetchCerts: async () => ({ keys: [jwk] }) });
  const r = await acc.google({ credential: sign(base) });
  assert.ok(r.session, JSON.stringify(r));
  assert.strictEqual(r.user.google, true);
  assert.strictEqual(r.user.name, 'Phạm Đạt');
  const r2 = await acc.google({ credential: sign(base) });
  assert.strictEqual(r2.user.id, r.user.id, 'lần sau vào đúng tài khoản cũ');
  assert.match((await acc.google({ credential: sign(Object.assign({}, base, { aud: 'khac' })) })).err, /aud/);
  assert.match((await acc.google({ credential: sign(Object.assign({}, base, { iss: 'evil.com' })) })).err, /iss/);
  assert.match((await acc.google({ credential: sign(Object.assign({}, base, { exp: 1 })) })).err, /hết hạn/);
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.match((await acc.google({ credential: sign(base, other) })).err, /Chữ ký/);
  assert.match((await acc.google({ credential: 'abc' })).err, /không hợp lệ/);
  const noCfg = makeGoogleVerifier('', async () => ({ keys: [] }));
  await assert.rejects(noCfg(sign(base)), /GOOGLE_CLIENT_ID/);
});

test('gộp ván đã chơi khi đăng ký (file store)', async () => {
  const { st } = await mk();
  await st._commit('ROOM', { code: 'ROOM' }, { gameStart: { id: 'g1', room: 'ROOM', no: 1, startedAt: 1, players: [{ pid: 'dev1' }, { pid: 'bot' }] }, events: [], gameEnd: { id: 'g1', endedAt: 2, result: {}, deltas: [5, -5] } });
  assert.strictEqual(await st.claimGames('dev1', 'u_abc'), 1);
  assert.strictEqual((await st.gamesFor('u_abc')).length, 1);
  assert.strictEqual((await st.gamesFor('dev1')).length, 0);
  assert.strictEqual(await st.claimGames('dev1', 'u_abc'), 0, 'chạy lại không nhân đôi');
});
