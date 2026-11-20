// Tài khoản thành viên: đăng ký, đăng nhập, phiên đăng nhập.
// Mật khẩu băm bằng scrypt (salt ngẫu nhiên); phiên là chuỗi ngẫu nhiên 32 byte, DB chỉ lưu SHA-256 của nó.
const crypto = require('crypto');

const SESSION_DAYS = 180;
const USER_RE = /^[a-z0-9_.]{3,20}$/;

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const userPid = id => 'u_' + id;

function scrypt(pw, salt) {
  return new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [kind, saltHex, keyHex] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'));
  const want = Buffer.from(keyHex, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

function validUsername(u) {
  u = String(u || '').trim().toLowerCase();
  return USER_RE.test(u) ? u : null;
}
function validPassword(p) {
  p = String(p || '');
  return p.length >= 6 && p.length <= 100 ? p : null;
}

const GENDERS = ['nam', 'nu'];
const cleanGender = g => (GENDERS.includes(g) ? g : null);
const publicUser = u => u && {
  id: u.id, username: u.username, name: u.name, av: u.av, gender: u.gender || 'nam', settings: u.settings || null,
  google: !!u.googleSub, email: u.email || null, hasPassword: !!u.passHash, pid: userPid(u.id),
};

/* ---------- Google Sign-In: kiểm tra ID token (JWT RS256) bằng khoá công khai của Google ---------- */
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
function b64url(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function makeGoogleVerifier(clientId, fetchCerts) {
  let cache = { at: 0, keys: [] };
  const getKeys = async force => {
    if (!force && Date.now() - cache.at < 3600e3 && cache.keys.length) return cache.keys;
    const j = await fetchCerts();
    cache = { at: Date.now(), keys: j.keys || [] };
    return cache.keys;
  };
  return async function verify(idToken) {
    if (!clientId) throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID');
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) throw new Error('Token không hợp lệ');
    const header = JSON.parse(b64url(parts[0]).toString());
    const payload = JSON.parse(b64url(parts[1]).toString());
    if (header.alg !== 'RS256') throw new Error('Thuật toán không hợp lệ');
    let jwk = (await getKeys()).find(k => k.kid === header.kid);
    if (!jwk) jwk = (await getKeys(true)).find(k => k.kid === header.kid);
    if (!jwk) throw new Error('Không tìm thấy khoá');
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, b64url(parts[2]));
    if (!ok) throw new Error('Chữ ký không hợp lệ');
    const now = Date.now() / 1000;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('iss không hợp lệ');
    if (payload.aud !== clientId) throw new Error('aud không hợp lệ');
    if (!(payload.exp > now - 60)) throw new Error('Token đã hết hạn');
    if (!payload.sub) throw new Error('Thiếu sub');
    return payload;
  };
}

function createAccounts(store, opts = {}) {
  const verifyGoogle = makeGoogleVerifier(opts.googleClientId,
    opts.fetchCerts || (() => fetch(GOOGLE_CERTS).then(r => r.json())));
  async function newSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await store.createSession(sha(token), userId, Date.now() + SESSION_DAYS * 864e5);
    return token;
  }
  return {
    async register({ username, password, name, av, gender }) {
      const u = validUsername(username);
      if (!u) return { err: 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ thường không dấu, số, dấu _ hoặc .' };
      const pw = validPassword(password);
      if (!pw) return { err: 'Mật khẩu ít nhất 6 ký tự' };
      const user = { id: crypto.randomBytes(8).toString('hex'), username: u, name: name || u, av: av || '🙂', gender: cleanGender(gender) || 'nam', passHash: await hashPassword(pw) };
      if (!(await store.createUser(user))) return { err: 'Tên đăng nhập đã có người dùng' };
      return { user: publicUser(user), session: await newSession(user.id) };
    },
    async login({ username, password }) {
      const u = validUsername(username);
      const user = u && (await store.userByName(u));
      // luôn băm để không lộ thời gian phản hồi khi tên không tồn tại
      const ok = await checkPassword(String(password || ''), user && user.passHash ? user.passHash : 'scrypt$00$00');
      if (!user || !ok) return { err: 'Sai tên đăng nhập hoặc mật khẩu' };
      return { user: publicUser(user), session: await newSession(user.id) };
    },
    /** Đăng ký / đăng nhập bằng Google: chưa có tài khoản thì tạo mới (created: true), có rồi thì đăng nhập. */
    async google({ credential, name, av, gender }) {
      let p;
      try { p = await verifyGoogle(credential); } catch (e) { return { err: 'Đăng nhập Google thất bại: ' + e.message }; }
      let user = await store.userByGoogle(p.sub), created = false;
      if (!user) {
        const base = (String(p.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'user').slice(0, 14).padEnd(3, '0');
        for (let k = 0; k < 5 && !user; k++) {
          const cand = { id: crypto.randomBytes(8).toString('hex'), username: base + crypto.randomInt(1000, 9999), name: String(name || p.name || base).replace(/\s+/g, ' ').trim().slice(0, 16) || base,
            av: av || '🙂', gender: cleanGender(gender) || 'nam', googleSub: p.sub, email: p.email || null };
          if (await store.createUser(cand)) { user = cand; created = true; }
          else if ((user = await store.userByGoogle(p.sub))) break;   // bấm 2 lần cùng lúc: tài khoản vừa được tạo
        }
        if (!user) return { err: 'Không tạo được tài khoản, thử lại' };
      }
      return { user: publicUser(user), session: await newSession(user.id), created };
    },
    /** Liên kết Google vào tài khoản đang đăng nhập (tài khoản tạo bằng tên + mật khẩu). */
    async linkGoogle(userId, credential) {
      let p;
      try { p = await verifyGoogle(credential); } catch (e) { return { err: 'Liên kết Google thất bại: ' + e.message }; }
      const user = await store.userById(userId);
      if (!user) return { err: 'Tài khoản không tồn tại' };
      if (user.googleSub === p.sub) return { user: publicUser(user) };
      if (user.googleSub) return { err: 'Tài khoản đã liên kết với một Google khác' };
      const other = await store.userByGoogle(p.sub);
      if (other) return { err: 'Google này đã gắn với tài khoản khác (' + other.name + '). Đăng xuất rồi bấm "Đăng nhập bằng Google" để vào tài khoản đó' };
      if (!(await store.linkGoogle(userId, p.sub, p.email || null))) return { err: 'Google này đã gắn với tài khoản khác' };
      return { user: publicUser(await store.userById(userId)) };
    },
    async logout(session) { if (session) await store.deleteSession(sha(session)); return {}; },
    /** Phiên hợp lệ → người dùng; ngược lại null. */
    async resolve(session) {
      if (!session || typeof session !== 'string' || session.length !== 64) return null;
      const id = await store.sessionUser(sha(session));
      return id ? publicUser(await store.userById(id)) : null;
    },
    async update(userId, f) {
      const clean = {};
      if (f.name) clean.name = String(f.name).replace(/\s+/g, ' ').trim().slice(0, 16);
      if (f.av) clean.av = Array.from(String(f.av)).slice(0, 4).join('');
      if (cleanGender(f.gender)) clean.gender = f.gender;
      if (f.settings && typeof f.settings === 'object' && JSON.stringify(f.settings).length < 4000) clean.settings = f.settings;
      await store.updateUser(userId, clean);
      return publicUser(await store.userById(userId));
    },
    /** Đổi mật khẩu; tài khoản Google chưa có mật khẩu thì đặt mới không cần mật khẩu cũ. */
    async changePassword(userId, oldPw, newPw) {
      const user = await store.userById(userId);
      if (!user) return { err: 'Tài khoản không tồn tại' };
      if (user.passHash && !(await checkPassword(String(oldPw || ''), user.passHash))) return { err: 'Mật khẩu hiện tại không đúng' };
      const pw = validPassword(newPw);
      if (!pw) return { err: 'Mật khẩu mới ít nhất 6 ký tự' };
      await store.updateUser(userId, { passHash: await hashPassword(pw) });
      return {};
    },
  };
}

module.exports = { createAccounts, userPid, hashPassword, checkPassword, validUsername, makeGoogleVerifier };
