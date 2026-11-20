/* Sâm Dứa — nền tảng phía trình duyệt (dùng chung mọi game): mạng, tài khoản, trang chủ, phòng, chat, cài đặt, lịch sử.
   Nạp theo thứ tự: core/audio.js → core/voice.js → core/app.js → games/<game>/game.js → core/boot.js.
   Các file là script thường (không module) dùng chung phạm vi toàn cục. */
'use strict';
const $ = id => document.getElementById(id);
// Các game đăng ký ở đây (public/games/<id>/game.js): GAMES[id] = { name, onState(s, evs, first), leave?() }
const GAMES = {};
const gameOf = s => GAMES[s && s.game] || GAMES.sam;
const GAME_NAMES = { sam: 'Sâm Lốc', masoi: 'Ma Sói' };
const APP_VERSION = '3.6.0';
function showUpdateBar() {
  if (document.querySelector('.update-bar')) return;
  const b = document.createElement('div'); b.className = 'update-bar';
  const t = document.createElement('span'); t.textContent = 'Đã có phiên bản mới của game';
  const r = document.createElement('button'); r.textContent = 'Tải lại'; r.onclick = () => location.reload();
  b.append(t, r); document.body.append(b);
}
const AVATARS = ['😎', '🤠', '🥸', '😈', '🤡', '👻', '🤖', '👽', '🐯', '🐵', '🐷', '🦊', '🐸', '🐼', '🦁', '🐙'];

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
const DEFAULT_SETTINGS = { mute: false, master: 80, music: 30, sfx: 85, voice: false, mcGender: 'nu', mcVol: 90, pvoice: false, maleVol: 85, femaleVol: 85, ambient: true, spatial: true, vibrate: true, reduce: false, perf: false, showPiles: false };
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

/* ================= điều hướng ================= */
let current = 'sHome';
function show(id) {
  const wasHome = current === 'sHome';
  current = id;
  if (id === 'sHome' && !wasHome && typeof loadRooms === 'function') setTimeout(loadRooms, 0);
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
    const sess = store.get('sam_session', '');
    const body = Object.assign({ a, token, gender: myGender() }, sess ? { session: sess } : {}, extra);
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
      if (m.v && m.v !== APP_VERSION) showUpdateBar();
      if (m.t === 'state') {
        this.tries = 0; $('netbar').classList.remove('on'); clearTimeout(this.netTimer);
        const first = this.fresh; this.fresh = false;
        gameOf(m.s).onState(m.s, m.ev || [], first);
        try { Voice.sync(S); } catch (x) { /* voice không được làm hỏng game */ }
      } else if (m.t === 'ack') {
        const p = this.pend.get(m.cid); if (p) { this.pend.delete(m.cid); clearTimeout(p.to); p.res(m); }
      } else if (m.t === 'gone') {
        this.want = false; leftRoom('Bạn không còn ở trong phòng này');
      } else if (m.t === 'vme') {
        Voice.setMe(m.vid);
      } else if (m.t === 'vsig') {
        Voice.onSignal(m.from, m.data);
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
      this.ws.send(JSON.stringify(Object.assign({}, data, { t: 'act', a, cid })));   // dữ liệu game không được ghi đè t/a/cid
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
// iOS chỉ cho mở âm thanh trong touchend/click (pointerdown chưa đủ ở một số bản)
document.addEventListener('touchend', () => Sound.unlock(), { passive: true });
document.addEventListener('click', () => Sound.unlock());

/* ================= trang chủ ================= */
$('inName').value = store.get('sam_name', '');
const qRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
$('inCode').value = qRoom;
(function avatarPicker() {
  const box = $('avpick');
  AVATARS.forEach(a => {
    const b = h('button', a === myAv ? 'on' : '', a);
    b.onclick = () => { myAv = a; store.set('sam_av', a); box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); Sound.play('select'); renderMe(); };
    box.append(b);
  });
})();
/* Thẻ "bạn là ai": đã có tên thì thu gọn thành 1 dòng, bấm Sửa để mở */
let meOpen = !store.get('sam_name', '');
function renderMe() {
  const nm = $('inName').value.trim();
  $('meAv').textContent = myAv || '🙂';
  $('meName').textContent = nm || 'Chưa đặt tên';
  $('meVoice').textContent = 'Giọng ' + (myGender() === 'nu' ? 'nữ' : 'nam');
  const open = meOpen || !nm;
  $('mePanel').classList.toggle('compact', !open);
  $('meSum').setAttribute('aria-expanded', String(open));
}
$('meSum').onclick = () => { meOpen = true; renderMe(); $('inName').focus(); };
$('inName').addEventListener('input', renderMe);
$('inName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (e.target.value.trim()) { store.set('sam_name', e.target.value.trim()); meOpen = false; renderMe(); e.target.blur(); } } });
/* ================= tài khoản thành viên ================= */
function myGender() { return (Account && Account.user && Account.user.gender) || store.get('sam_gender', 'nam'); }
const Account = {
  user: store.json('sam_user', null),
  cfg: null, syncT: null, mode: 'login',
  logged() { return !!(this.user && store.get('sam_session', '')); },
  set(user, session) {
    this.user = user;
    if (session !== undefined) store.set('sam_session', session || '');
    store.set('sam_user', user ? JSON.stringify(user) : '');
    if (user) {
      if (user.name) { $('inName').value = user.name; store.set('sam_name', user.name); }
      if (user.av) { myAv = user.av; store.set('sam_av', myAv); markAvatar(); }
      store.set('sam_gender', user.gender || 'nam');
    }
    setSeg('fGender', myGender());
    this.renderChip();
    if (typeof renderMe === 'function') renderMe();
  },
  renderChip() {
    const c = $('accChip'); c.textContent = '';
    if (this.logged()) { c.className = 'acc-chip'; c.append(h('span', 'ai', this.user.av || '🙂'), h('span', '', this.user.name + ' · Hồ sơ')); }
    else { c.className = 'acc-chip guest'; c.append(h('span', 'ai', '👤'), h('span', '', 'Khách · Đăng nhập / Đăng ký')); }
  },
  async refresh() {
    if (!store.get('sam_session', '')) return this.set(null);
    const j = await api('me');
    if (j.err) return;                         // mất mạng: giữ nguyên
    if (!j.user) { this.set(null, ''); return; }
    this.set(j.user);
    if (j.user.settings) { settings = Object.assign({}, DEFAULT_SETTINGS, j.user.settings); this._noSync = true; applySettings(); this._noSync = false; }
  },
  async loggedIn(j, verb) {
    this.set(j.user, j.session);
    if (j.user.settings) { settings = Object.assign({}, DEFAULT_SETTINGS, j.user.settings); this._noSync = true; applySettings(); this._noSync = false; }
    else this.syncSettings();
    $('accSheet').classList.remove('on');
    toast(`${verb} ${j.user.name}` + (j.claimed ? ` · đã gộp ${j.claimed} ván chơi trên máy này` : ''));
  },
  syncSettings() {
    if (this._noSync || !this.logged()) return;
    clearTimeout(this.syncT);
    this.syncT = setTimeout(() => api('profile', { settings }), 1500);   // lưu cấu hình âm thanh/giọng theo tài khoản
  },
  async save(f) {
    const j = await api('profile', f);
    if (j.err) return toast(j.err);
    this.set(j.user); toast('Đã lưu hồ sơ');
  },
  async logout() {
    await api('logout');
    this.set(null, '');
    toast('Đã đăng xuất. Bạn đang chơi với tư cách khách');
    this.open();
  },
  open() { this.render(); $('accSheet').classList.add('on'); },
  render() {
    const b = $('accBody'); b.textContent = '';
    $('accTitle').textContent = this.logged() ? 'Hồ sơ thành viên' : 'Tài khoản';
    if (this.logged()) return this.renderProfile(b);
    const tabs = h('div', 'acc-tabs');
    [['login', 'Đăng nhập'], ['register', 'Đăng ký']].forEach(([m, t]) => {
      const x = h('button', this.mode === m ? 'on' : '', t); x.onclick = () => { this.mode = m; this.render(); }; tabs.append(x);
    });
    b.append(tabs);
    const f = h('form', 'acc-form');
    const inp = (ph, type, val) => { const i = document.createElement('input'); i.placeholder = ph; i.type = type || 'text'; i.autocomplete = type === 'password' ? (this.mode === 'login' ? 'current-password' : 'new-password') : 'username'; if (val) i.value = val; f.append(i); return i; };
    const u = inp('Tên đăng nhập (chữ thường, số, _ .)');
    u.autocapitalize = 'none';
    const pw = inp('Mật khẩu (ít nhất 6 ký tự)', 'password');
    let nick = null;
    if (this.mode === 'register') nick = inp('Nickname hiển thị', 'text', $('inName').value.trim());
    const ckl = h('label', 'ck'); const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = true;
    ckl.append(ck, h('span', '', 'Gộp các ván đã chơi trên máy này vào tài khoản')); f.append(ckl);
    const go = h('button', 'btn gold big', this.mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'); go.type = 'submit'; f.append(go);
    f.onsubmit = async e => {
      e.preventDefault(); go.disabled = true;
      const body = { username: u.value.trim(), password: pw.value, claim: ck.checked };
      if (this.mode === 'register') Object.assign(body, { name: (nick.value.trim() || u.value.trim()), av: myAv, gender: myGender() });
      const j = await api(this.mode, body);
      go.disabled = false;
      if (j.err) return toast(j.err);
      this.loggedIn(j, this.mode === 'login' ? 'Chào mừng trở lại,' : 'Đã tạo tài khoản cho');
    };
    b.append(f);
    if (this.cfg && this.cfg.googleClientId) {
      const gwrap = h('div', 'acc-google');
      gwrap.append(h('div', 'acc-or', '— hoặc —'));
      const gb = h('div', 'gbtn'); gwrap.append(gb);
      gwrap.append(h('p', 'muted center', this.mode === 'register'
        ? 'Đăng ký bằng Google: không cần đặt tên đăng nhập hay mật khẩu. Đã có tài khoản Google ở đây thì vào thẳng.'
        : 'Lần đầu dùng Google sẽ tự tạo tài khoản mới.'));
      b.append(gwrap);
      this.google(gb, this.mode === 'register' ? 'signup_with' : 'signin_with', resp => this.googleAuth(resp, ck));
    }
    const guest = h('button', 'btn', 'Chơi tiếp với tư cách khách');
    guest.onclick = () => $('accSheet').classList.remove('on');
    b.append(guest, h('p', 'muted center', 'Khách vẫn chơi bình thường, nhưng lịch sử chỉ lưu trên máy này. Có tài khoản thì đăng nhập máy nào cũng thấy lịch sử, thống kê và cài đặt giọng đọc.'));
    const lg = h('p', 'legal'); lg.innerHTML = '<a href="/privacy.html" target="_blank">Quyền riêng tư</a> · <a href="/terms.html" target="_blank">Điều khoản</a>'; b.append(lg);
  },
  /** Vẽ nút Google (thư viện GSI nạp không đồng bộ). onCred nhận phản hồi của nút vẽ gần nhất. */
  google(el, text, onCred) {
    this._gCb = onCred;
    const init = (tries = 0) => {
      if (!el.isConnected) return;
      if (!window.google || !google.accounts || !google.accounts.id) {
        if (tries > 40) { el.textContent = 'Không tải được nút Google (kiểm tra mạng hoặc trình chặn quảng cáo)'; el.className = 'muted center'; return; }
        return setTimeout(() => init(tries + 1), 300);
      }
      if (this._gInit !== this.cfg.googleClientId) {
        google.accounts.id.initialize({ client_id: this.cfg.googleClientId, callback: resp => this._gCb && this._gCb(resp), ux_mode: 'popup' });
        this._gInit = this.cfg.googleClientId;
      }
      google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text, locale: 'vi', width: 280 });
    };
    init();
  },
  async googleAuth(resp, ck) {
    const j = await api('google', { credential: resp.credential, claim: ck ? ck.checked : true, av: myAv, gender: myGender(), name: $('inName').value.trim() || undefined });
    if (j.err) return toast(j.err);
    this.loggedIn(j, j.created ? 'Đã tạo tài khoản Google cho' : 'Chào mừng trở lại,');
  },
  renderProfile(b) {
    const u = this.user;
    const who = h('div', 'acc-who');
    const t = h('div', ''); t.append(h('b', '', u.name), h('small', '', u.google ? 'Google · ' + (u.email || '') : '@' + u.username));
    who.append(h('div', 'big', u.av || '🙂'), t);
    b.append(who);
    const f = h('div', 'card-panel form');
    const r1 = h('div', 'frow'); r1.append(h('b', '', 'Nickname'));
    const nick = document.createElement('input'); nick.value = u.name; nick.maxLength = 16; nick.style.width = '55%'; nick.className = 'cb-in';
    r1.append(nick); f.append(r1);
    const r2 = h('div', ''); r2.append(h('div', 'lbl', 'Avatar'));
    const grid = h('div', 'avpick'); let av = u.av;
    AVATARS.forEach(a => { const x = h('button', a === av ? 'on' : '', a); x.onclick = () => { av = a; grid.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); }; grid.append(x); });
    r2.append(grid); f.append(r2);
    const r3 = h('div', 'frow'); r3.append(h('b', '', 'Giới tính (giọng nói)'));
    const seg = h('div', 'seg'); let gd = u.gender || 'nam';
    [['nam', '👨 Nam'], ['nu', '👩 Nữ']].forEach(([v, tx]) => { const x = h('button', gd === v ? 'on' : '', tx); x.onclick = () => { gd = v; seg.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); }; seg.append(x); });
    r3.append(seg); f.append(r3);
    const sv = h('button', 'btn gold', 'Lưu hồ sơ');
    sv.onclick = () => this.save({ name: nick.value.trim(), av, gender: gd });
    f.append(sv);
    b.append(f);
    if (!u.google && this.cfg && this.cfg.googleClientId) {
      const gf = h('div', 'card-panel form');
      gf.append(h('b', '', 'Liên kết Google'), h('p', 'muted', 'Sau khi liên kết, đăng nhập được bằng Google hoặc tên + mật khẩu như cũ.'));
      const gb = h('div', 'gbtn'); gf.append(gb); b.append(gf);
      this.google(gb, 'continue_with', async resp => {
        const j = await api('googlelink', { credential: resp.credential });
        if (j.err) return toast(j.err);
        this.set(j.user); this.render(); toast('Đã liên kết Google ' + (j.user.email || ''));
      });
    }
    const pf = h('div', 'card-panel form');
    const setPw = u.hasPassword === false;
    pf.append(h('b', '', setPw ? 'Đặt mật khẩu' : 'Đổi mật khẩu'));
    if (setPw) pf.append(h('p', 'muted', 'Không bắt buộc. Có mật khẩu thì đăng nhập được bằng tên @' + u.username + ' khi không dùng Google.'));
    const o = document.createElement('input'); o.type = 'password'; o.placeholder = 'Mật khẩu hiện tại'; o.className = 'cb-in';
    const n = document.createElement('input'); n.type = 'password'; n.placeholder = 'Mật khẩu mới (ít nhất 6 ký tự)'; n.className = 'cb-in';
    const cb = h('button', 'btn', setPw ? 'Đặt mật khẩu' : 'Đổi mật khẩu');
    cb.onclick = async () => {
      const j = await api('password', { old: o.value, new: n.value });
      toast(j.err || (setPw ? 'Đã đặt mật khẩu' : 'Đã đổi mật khẩu'));
      if (!j.err) { o.value = n.value = ''; if (setPw) { this.user.hasPassword = true; this.set(this.user); this.render(); } }
    };
    if (!setPw) pf.append(o);
    pf.append(n, cb); b.append(pf);
    const nav = h('div', 'row');
    const hb = h('button', 'btn', '🕘 Lịch sử'); hb.onclick = () => { $('accSheet').classList.remove('on'); openHistory(); };
    const sb = h('button', 'btn', '📊 Thống kê'); sb.onclick = () => { $('accSheet').classList.remove('on'); openStats(); };
    nav.append(hb, sb); b.append(nav);
    const lo = h('button', 'btn red', 'Đăng xuất'); lo.onclick = () => this.logout(); b.append(lo);
  },
};
$('accChip').onclick = () => Account.open();
$('btCloseAcc').onclick = () => $('accSheet').classList.remove('on');
function markAvatar() { $('avpick').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.textContent === myAv)); }
document.getElementById('fGender').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  store.set('sam_gender', b.dataset.v);
  if (Account.logged()) Account.save({ gender: b.dataset.v });
  setTimeout(renderMe, 0);
});

function myName() {
  let n = $('inName').value.trim();
  if (!n && Account.logged()) n = Account.user.name;
  if (!n) { toast('Nhập tên đã nhé'); meOpen = true; renderMe(); $('inName').focus(); return null; }
  if (Account.logged() && n !== Account.user.name) Account.save({ name: n });
  store.set('sam_name', n); return n;
}
function closeMe() { if (meOpen && $('inName').value.trim()) { meOpen = false; renderMe(); } }
document.querySelectorAll('#gTiles .gtile').forEach(t => t.onclick = () => {
  if (!myName()) return;
  closeMe();
  store.set('sam_game', t.dataset.game);
  openCreate(null);
});
$('inCode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btJoin').click(); } });
$('btJoin').onclick = async () => {
  const n = myName(); if (!n) return;
  const c = $('inCode').value.trim().toUpperCase();
  if (c.length !== 4) return toast('Mã phòng gồm 4 ký tự');
  const j = await api('join', { room: c, name: n, av: myAv });
  if (j.err && j.canWatch && (await confirmBox(j.err + '. Vào xem ván không?'))) return watchRoom(c, n);
  if (j.err) return toast(j.err);
  store.set('sam_role', 'player');
  enterRoom(j.code);
};
async function watchRoom(c, n) {
  const j = await api('watch', { room: c, name: n, av: myAv });
  if (j.err) return toast(j.err);
  store.set('sam_role', j.spectator ? 'spec' : 'player');
  enterRoom(j.code);
}
$('btWatch').onclick = () => {
  const n = myName(); if (!n) return;
  const c = $('inCode').value.trim().toUpperCase();
  if (c.length !== 4) return toast('Nhập mã phòng muốn xem');
  watchRoom(c, n);
};
/* ---- danh sách phòng đang mở: bấm là vào, không cần mã ---- */
const PHASE_TXT = { lobby: 'Đang chờ', sam: 'Đang báo Sâm', play: 'Đang chơi', reveal: 'Đang chơi', over: 'Vừa xong ván', night: 'Đang đêm', witch: 'Đang đêm', dawn: 'Đang ngày', discuss: 'Đang thảo luận', vote: 'Đang bỏ phiếu', exec: 'Đang ngày', hunter: 'Đang ngày' };
let roomsTimer = null, roomsBusy = false;
async function loadRooms() {
  if (roomsBusy || current !== 'sHome' || document.hidden) return;
  roomsBusy = true;
  try {
    const j = await api('rooms', {});
    if (!j.err) renderRooms(j.rooms || []);
  } finally { roomsBusy = false; }
}
function renderRooms(list) {
  const box = $('roomList'); box.textContent = '';
  if (!list.length) { box.append(h('div', 'pr-empty', 'Chưa có phòng nào đang mở. Tạo phòng rồi rủ hội vào nhé!')); return; }
  list.forEach(r => {
    const row = h('div', 'pr-row');
    const avs = h('div', 'pr-avs');
    r.players.slice(0, 5).forEach(p => { const a = h('span', 'pr-av' + (p.bot ? ' bot' : ''), p.av || '🙂'); a.title = p.name + (p.bot ? ' (máy)' : ''); avs.append(a); });
    const info = h('div', 'pr-info');
    info.append(h('b', '', (r.game === 'masoi' ? '🐺 Ma Sói · ' : '🃏 Sâm · ') + 'Phòng của ' + (r.host || '…')));
    const meta = [`${PHASE_TXT[r.phase] || ''}${r.phase !== 'lobby' && r.gameNo ? ' ván ' + r.gameNo : ''}`, `${r.players.length}/${r.max} người`];
    if (r.spectators) meta.push(`👀 ${r.spectators}`);
    info.append(h('small', '', meta.join(' · ')));
    const acts = h('div', 'pr-acts');
    if (r.canJoin) {
      const bj = h('button', 'btn gold sm', 'Vào chơi');
      bj.onclick = async () => {
        const n = myName(); if (!n) return;
        const j = await api('join', { room: r.code, name: n, av: myAv });
        if (j.err && j.canWatch && (await confirmBox(j.err + '. Vào xem ván không?'))) return watchRoom(r.code, n);
        if (j.err) return toast(j.err);
        store.set('sam_role', 'player'); enterRoom(j.code);
      };
      acts.append(bj);
    }
    const bw = h('button', 'btn sm', '👀 Xem');
    bw.onclick = () => { const n = myName(); if (n) watchRoom(r.code, n); };
    acts.append(bw);
    row.append(avs, info, acts);
    box.append(row);
  });
}
$('btRoomsRef').onclick = () => loadRooms();

/* ---- chơi màn hình ngang: toàn màn hình + khoá xoay ngang (Android); iPhone thì nhắc xoay máy ---- */
const isLandscape = () => window.matchMedia('(orientation: landscape)').matches;
async function toggleLandscape() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) {
    try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
    try { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
    return;
  }
  const el = document.documentElement;
  try { await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); } catch (e) {}
  try { await screen.orientation.lock('landscape'); }
  catch (e) { if (!isLandscape()) toast('Xoay ngang điện thoại để chơi (nhớ tắt khoá xoay màn hình)'); }
}
$('btRotate').onclick = toggleLandscape;
if (!window.matchMedia('(pointer: coarse)').matches) $('btRotate').classList.add('hide');   // máy tính không cần
function startRoomsPoll() { clearInterval(roomsTimer); loadRooms(); roomsTimer = setInterval(loadRooms, 8000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRooms(); });
startRoomsPoll();

$('btSitLobby').onclick = async () => {
  const j = await api('join', { room: S.code, name: store.get('sam_name', 'Khách'), av: myAv });
  if (j.err) toast(j.err); else store.set('sam_role', 'player');
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
  $('fBotChat').checked = s.botChat !== undefined ? s.botChat : true;
  $('fPrivate').checked = !!s.private;
  setSeg('fTurn', s.turnMs || 30000);
  setSeg('fLevel', s.botLevel === 'amateur' ? 'amateur' : 'pro');
  setSeg('fPause', s.pauseLimitMs !== undefined ? s.pauseLimitMs : 600000);
  setSeg('fReplay', s.replayPolicy || 'all');
  formPts = Object.assign({ sam: 20, trang: 20, cong: 15, chat: 10, chatDeMult: 2, thoi2: 0 }, s.points || {});
  setSeg('fChain', (s.points && s.points.chainMode) || 'last');
  renderSteps();
  // chọn game (chỉ khi tạo mới)
  const gm = editMode ? 'sam' : store.get('sam_game', 'sam') || 'sam';
  setSeg('fGame', GAMES[gm] ? gm : 'sam');
  $('gameRow').hidden = editMode;
  syncGameForm();
  const ms = store.json('masoi_defaults', null) || {};
  setSeg('fMsDiscuss', ms.discussMs || 120000);
  $('fMsReveal').checked = ms.revealRole !== undefined ? ms.revealRole : true;
  $('fMsBotChat').checked = ms.botChat !== undefined ? ms.botChat : true;
  $('fMsPrivate').checked = !!ms.private;
  if (editMode) $('createTitle').textContent = 'Cài đặt phòng';
  $('btCreate').textContent = editMode ? 'Lưu cài đặt' : 'Tạo phòng';
  show('sCreate');
}
function formSettings() {
  return {
    ai: $('fAi').checked, botChat: $('fBotChat').checked, private: $('fPrivate').checked, botLevel: segVal('fLevel'), turnMs: +segVal('fTurn'), pauseLimitMs: +segVal('fPause'), replayPolicy: segVal('fReplay'),
    points: Object.assign({}, formPts, { chainMode: segVal('fChain') }),
  };
}
function syncGameForm() {
  const gm = segVal('fGame');
  $('roomForm').hidden = gm !== 'sam';
  $('msForm').hidden = gm !== 'masoi';
  if (!editMode) $('createTitle').textContent = 'Tạo phòng ' + (gm === 'masoi' ? 'Ma Sói' : 'Sâm Lốc');
}
$('fGame').addEventListener('click', () => setTimeout(syncGameForm, 0));
$('btCreate').onclick = async () => {
  const gm = editMode ? 'sam' : segVal('fGame');
  if (gm === 'masoi') {
    const ms = { discussMs: +segVal('fMsDiscuss'), revealRole: $('fMsReveal').checked, botChat: $('fMsBotChat').checked, private: $('fMsPrivate').checked };
    store.set('masoi_defaults', JSON.stringify(ms)); store.set('sam_game', 'masoi');
    const n = myName(); if (!n) return show('sHome');
    const j = await api('create', { name: n, av: myAv, game: 'masoi', settings: ms });
    if (j.err) return toast(j.err);
    store.set('sam_role', 'player');
    return enterRoom(j.code);
  }
  if (!editMode) store.set('sam_game', 'sam');
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
  store.set('sam_role', 'player');
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
  const wasGame = gameOf(S);
  Net.close(); room = null; S = null;
  try { wasGame && wasGame.leave && wasGame.leave(); } catch (x) {}
  try { Voice.reset(); } catch (x) {}
  store.set('sam_room', '');
  history.replaceState(null, '', location.pathname);
  $('resultOv').classList.remove('on');
  Sound.music(false);
  closeSheets();
  if (msg) toast(msg);
  show('sHome');
}
async function leaveRoom() {
  const inGame = S && !isSpec() && S.phase !== 'lobby' && S.phase !== 'over';
  if (inGame && !(await confirmBox(S.game === 'masoi' ? 'Rời làng giữa ván? Máy sẽ chơi thay vai của bạn.' : 'Rời phòng giữa ván? Máy sẽ đánh thay bạn tới hết ván.'))) return;
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
  if (S.game === 'masoi') return show('sMasoi');
  if (S.phase === 'lobby') show('sLobby'); else show('sGame');
}

/* ---------- chat box (luôn hiện, gõ trực tiếp ở dưới) ---------- */
const QUICK = ['Đánh nhanh lên!', 'Ngon! 👍', 'Cay thế 😤', 'Đen quá 😭', 'Hehe 😏', 'Bài xấu quá', 'Chờ tí', 'GG'];
let chatSeen = 0;
document.querySelectorAll('[data-chat]').forEach(box => {
  const list = h('div', 'cb-list');
  const form = h('form', 'cb-form');
  const qb = h('button', '', '⚡'); qb.type = 'button'; qb.title = 'Câu nhanh';
  const inp = document.createElement('input'); inp.maxLength = 200; inp.placeholder = 'Nhắn cả bàn…'; inp.autocomplete = 'off'; inp.enterKeyHint = 'send';
  const send = h('button', 'send', '➤'); send.type = 'submit';
  form.append(qb, inp, send);
  const quick = h('div', 'cb-quick hide');
  QUICK.forEach(t => { const b = h('button', '', t); b.type = 'button'; b.onclick = () => { sendChat(t); quick.classList.add('hide'); }; quick.append(b); });
  qb.onclick = () => quick.classList.toggle('hide');
  form.onsubmit = async e => {
    e.preventDefault();
    const v = inp.value.trim(); if (!v) return;
    if (await sendChat(v)) inp.value = '';
  };
  box.append(list, quick, form);
  if (box.hasAttribute('data-dock')) {
    const tk = h('div', 'cb-tick'); tk.title = 'Xem toàn bộ chat';
    tk.onclick = () => { box.classList.toggle('open'); if (box.classList.contains('open')) list.scrollTop = list.scrollHeight; };
    box.insertBefore(tk, quick);
    inp.addEventListener('focus', () => { if (window.innerWidth < 1100) box.classList.add('open'); list.scrollTop = list.scrollHeight; });
    document.addEventListener('pointerdown', e => { if (!box.contains(e.target)) box.classList.remove('open'); });
    form.addEventListener('submit', () => setTimeout(() => box.classList.remove('open'), 60));   // gửi xong thì gọn lại, không che bài
  }
});
async function sendChat(text) {
  const r = await act('chat', { text });
  return !r.err;
}
function myChatName() { return S && S.you >= 0 && S.players[S.you] ? S.players[S.you].name : store.get('sam_name', ''); }
// Điện thoại: 2 dòng chat mới nhất nằm ngay trên ô nhập (ngoài bàn chơi), chạm để mở cả lịch sử.
// Máy tính màn rộng: khung chat cố định bên phải bàn. Bàn chơi không bị chữ đè lên.
let tickSig = '', tickSeen = 0;
function renderTick(msgs, me) {
  const ticks = document.querySelectorAll('#sGame .cb-tick'); if (!ticks.length) return;
  const last = msgs.slice(-2);
  const sig = last.map(m => m.id).join(',');
  if (sig === tickSig) return;              // không vẽ lại khi tin nhắn không đổi (tránh nhấp nháy)
  tickSig = sig;
  ticks.forEach(tk => {
    tk.textContent = '';
    if (!last.length) { tk.append(h('div', 'ln empty', '💬 Chạm để xem chat · máy và người xem cũng nói ở đây')); return; }
    last.forEach(m => {
      const ln = h('div', 'ln ' + m.kind + (m.id > tickSeen ? ' new' : ''));
      if (m.kind === 'sys') ln.textContent = m.text;
      else {
        if (m.name === me && m.kind === (isSpec() ? 'spec' : 'player')) ln.classList.add('mine');
        ln.append(h('b', '', (m.kind === 'spec' ? '👀 ' : '') + (m.av ? m.av + ' ' : '') + m.name + ': '), document.createTextNode(m.text));
      }
      tk.append(ln);
    });
  });
  if (last.length) tickSeen = Math.max(tickSeen, last[last.length - 1].id);
}
const shortText = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t);
function renderChat() {
  if (!S) return;
  const msgs = (S.chat || []).slice(-40), me = myChatName();
  renderTick(msgs, me);
  document.querySelectorAll('[data-chat] .cb-list').forEach(l => {
    const atBottom = l.scrollHeight - l.scrollTop - l.clientHeight < 30;
    l.textContent = '';
    if (!msgs.length) { l.append(h('div', 'empty', 'Chat với cả bàn ở đây — người xem cũng chat được')); return; }
    msgs.forEach(m => {
      const ln = h('div', 'ln ' + m.kind);
      if (m.kind === 'sys') ln.textContent = m.text;
      else {
        if (m.name === me && m.kind === (isSpec() ? 'spec' : 'player')) ln.classList.add('mine');
        ln.append(h('b', '', (m.kind === 'spec' ? '👀 ' : '') + m.name + ': '), document.createTextNode(m.text));
      }
      l.append(ln);
    });
    if (atBottom || l.dataset.init !== '1') { l.scrollTop = l.scrollHeight; l.dataset.init = '1'; }
  });
}
function onChatState(first) {
  const msgs = S.chat || [];
  const last = msgs.length ? msgs[msgs.length - 1].id : 0;
  renderChat();
  if (first || last < chatSeen) { chatSeen = last; return; }   // vào lại phòng: không coi tin cũ là tin mới
  const fresh = msgs.filter(m => m.id > chatSeen);
  chatSeen = last;
  for (const m of fresh) {
    if (S && S.game === 'sam' && m.kind === 'player' && m.seat >= 0) { taunts[m.seat] = { text: shortText(m.text, 56), until: Date.now() + 3500, chat: true }; setTimeout(() => S && render(), 3600); }
  }
  if (fresh.some(m => m.kind !== 'sys' && m.name !== myChatName())) Sound.play('turn');
}

function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on')); }

/* ================= cài đặt ================= */
const ST_BIND = { stPiles: 'showPiles', stMute: 'mute', stVoice: 'voice', stPVoice: 'pvoice', stAmbient: 'ambient', stSpatial: 'spatial', stVibrate: 'vibrate', stReduce: 'reduce', stPerf: 'perf' };
const ST_RANGE = { stMaster: 'master', stMusic: 'music', stSfx: 'sfx', stMcVol: 'mcVol', stMaleVol: 'maleVol', stFemaleVol: 'femaleVol' };
function applySettings() {
  document.body.classList.toggle('reduce', !!settings.reduce);
  document.body.classList.toggle('perf', !!settings.perf);
  document.body.classList.toggle('piles-on', !!settings.showPiles);
  Sound.apply(settings);
  store.set('sam_settings', JSON.stringify(settings));
  Account.syncSettings();
}
document.getElementById('stMcGender').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  settings.mcGender = b.dataset.v; applySettings();
  Sound.unlock(); voiceLine('turn', null, 9);
});
function openSettings() {
  setSeg('stMcGender', settings.mcGender || 'nu');
  for (const id in ST_BIND) $(id).checked = !!settings[ST_BIND[id]];
  for (const id in ST_RANGE) $(id).value = settings[ST_RANGE[id]];
  $('settingsSheet').classList.add('on');
}
for (const id in ST_BIND) $(id).onchange = () => { settings[ST_BIND[id]] = $(id).checked; applySettings(); if (id === 'stVoice' && settings.voice) { Sound.unlock(); voiceLine('turn', null, 9); }
  if (id === 'stPVoice' && settings.pvoice) { Sound.unlock(); Sound.line(myGender() === 'nu' ? 'f' : 'm', 'chop1', 'player', 9, 0); } };
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
  box.append(whoLine());
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
  box.append(whoLine());
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
  box.append(grid);
}

function whoLine() {
  const e = h('p', 'who-line', Account.logged() ? `Tài khoản ${Account.user.name} — xem được trên mọi thiết bị` : 'Chơi khách: chỉ lưu trên máy này. ');
  if (!Account.logged()) { const a = h('a', '', 'Đăng nhập để lưu theo tài khoản'); a.href = '#'; a.style.color = 'var(--gold)'; a.onclick = ev => { ev.preventDefault(); Account.open(); }; e.append(a); }
  return e;
}
