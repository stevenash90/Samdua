// Lớp phòng nền cho các game mới: người chơi, người xem, chủ phòng, kết nối, chat, voice, lưu/khôi phục.
// Game kế thừa và viết thêm: _handle(i, msg) (luật), view(i, role), các trường riêng trong snapshot/restore.
// (Sâm Lốc có room.js riêng từ trước; sẽ chuyển sang lớp này khi rảnh — xem docs/KIEN_TRUC.md.)
const crypto = require('crypto');
const PC = require('./config');
const { hashToken, pidOf, cleanName, cleanAv, cleanGender, cleanText, rid } = require('./players');

const CHAT_MAX = 80, CHAT_GAP_MS = 600, MAX_SPECTATORS = 20, SPEC_IDLE_MS = 10 * 60 * 1000;

class BaseRoom {
  constructor(code, deps, game) {
    this.game = game;
    this.code = code;
    this.deps = deps;
    this.created = this.now();
    this.touched = this.now();
    this.players = [];
    this.spectators = [];
    this.hostPid = null;
    this.phase = 'lobby';
    this.log = '';
    this.gameNo = 0;
    this.chat = [];
    this.chatSeq = 0;
    this.settings = {};
    // tạm thời (không lưu)
    this.conns = new Map();
    this.lastActive = new Map();
    this.offlineSince = new Map();
    this.lastChatAt = new Map();
    this.seenCids = new Map();
    this.voice = new Map();
    this.outbox = [];
    this.timers = new Set();
    this.closed = false;
  }
  now() { return this.deps.now ? this.deps.now() : Date.now(); }
  get maxPlayers() { return 99; }

  /* ---------- hẹn giờ (tự huỷ khi đóng phòng) ---------- */
  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (this.closed) return;
      try { fn(); } catch (e) { this.deps.log && this.deps.log('timer error', this.code, e); }
    }, Math.max(0, ms));
    this.timers.add(t);
    return t;
  }
  cancel(t) { if (t) { clearTimeout(t); this.timers.delete(t); } }

  /* ---------- người chơi ---------- */
  idxOf(pid) { return this.players.findIndex(p => p.pid === pid); }
  hostIdx() { return this.idxOf(this.hostPid); }
  humans() { return this.players.filter(p => !p.bot); }
  online(p) { return p.bot || (this.conns.get(p.pid) || 0) > 0; }
  isAfk(p) {
    if (p.bot || !this.online(p)) return false;
    const t = this.lastActive.get(p.pid);
    return t !== undefined && this.now() - t > PC.AFK_MS;
  }
  newPlayer(pid, token, name, av, opt = {}) {
    return { pid, tokenHash: token ? hashToken(token) : null, name: cleanName(name), av: cleanAv(av), gender: cleanGender(opt.gender), member: !!opt.member, bot: !!opt.bot };
  }
  addHuman(token, name, av, opt = {}) {
    const pid = opt.pid || pidOf(token);
    const p = this.newPlayer(pid, token, name, av, { gender: opt.gender, member: !!opt.pid });
    this.players.push(p);
    if (!this.hostPid || this.hostIdx() < 0) this.hostPid = pid;
    this.lastActive.set(pid, this.now());
    this.onRoster && this.onRoster();
    return p;
  }
  addBotPlayer(name, av, gender) {
    const p = this.newPlayer('bot-' + rid(), null, name, av, { gender, bot: true });
    p.name = String(name).slice(0, 24);   // tên máy là tên nhân vật, không cắt 16 ký tự như tên người
    this.players.push(p);
    this.onRoster && this.onRoster();
    return p;
  }
  auth(token) {
    if (!token) return -1;
    const h = hashToken(token);
    return this.players.findIndex(p => p.tokenHash && p.tokenHash === h);
  }
  rebind(pid, token) {
    const p = this.players.find(x => x.pid === pid && !x.bot) || this.spectators.find(x => x.pid === pid);
    if (p) { p.tokenHash = hashToken(token); return true; }
    return false;
  }
  who(token) {
    const i = this.auth(token);
    if (i >= 0) return { role: 'player', i, pid: this.players[i].pid };
    if (!token) return null;
    const h = hashToken(token);
    const sp = this.spectators.find(x => x.tokenHash === h);
    return sp ? { role: 'spec', pid: sp.pid } : null;
  }
  specIdx(pid) { return this.spectators.findIndex(x => x.pid === pid); }
  addSpectator(token, name, av, opt = {}) {
    const pid = opt.pid || pidOf(token);
    let sp = this.spectators.find(x => x.pid === pid);
    if (sp) { sp.name = cleanName(name); sp.av = cleanAv(av); return sp; }
    if (this.spectators.length >= MAX_SPECTATORS) return null;
    sp = { pid, tokenHash: hashToken(token), name: cleanName(name), av: cleanAv(av) };
    this.spectators.push(sp);
    this.lastActive.set(pid, this.now());
    this.sysChat(`👀 ${sp.name} vào xem`);
    return sp;
  }
  removeSpectator(pid, quiet) {
    const k = this.specIdx(pid);
    if (k < 0) return;
    const sp = this.spectators.splice(k, 1)[0];
    this.conns.delete(pid);
    this.voice.delete(pid);
    if (!quiet) this.sysChat(`${sp.name} thôi xem`);
  }
  setHost(pid) { this.hostPid = pid; }
  removePlayer(i, reason) {
    const p = this.players[i];
    const wasHost = p.pid === this.hostPid;
    this.conns.delete(p.pid);
    this.voice.delete(p.pid);
    if (this.phase === 'lobby' || this.phase === 'over') this.players.splice(i, 1);
    else this.replaceWithBot(i);   // đang chơi: máy chơi thay
    this.log = reason === 'kick' ? `${p.name} đã bị mời ra` : `${p.name} rời phòng`;
    if (wasHost) {
      const c = this.players.find(q => !q.bot && this.online(q)) || this.players.find(q => !q.bot);
      this.hostPid = c ? c.pid : null;
    }
    this.onRoster && this.onRoster();
    if (!this.humans().length) this.close();
  }
  replaceWithBot(i) {
    const p = this.players[i];
    p.bot = true; p.tokenHash = null; p.pid = 'bot-' + rid();
    p.name = (p.name + ' (máy)').slice(0, 22);
  }

  /* ---------- kết nối ---------- */
  connect(pid) {
    this.conns.set(pid, (this.conns.get(pid) || 0) + 1);
    this.lastActive.set(pid, this.now());
    this.offlineSince.delete(pid);
  }
  disconnect(pid) {
    const n = Math.max(0, (this.conns.get(pid) || 0) - 1);
    this.conns.set(pid, n);
    if (n > 0) return;
    this.voice.delete(pid);
    this.offlineSince.set(pid, this.now());
  }
  tick() {
    let changed = false;
    const hi = this.hostIdx(), host = hi >= 0 ? this.players[hi] : null;
    if (!host || (!this.online(host) && this.now() - (this.offlineSince.get(host.pid) || this.now()) > PC.HOST_GRACE_MS)) {
      const c = this.players.find(p => !p.bot && this.online(p) && p.pid !== this.hostPid);
      if (c) { this.hostPid = c.pid; this.log = `${c.name} được chuyển quyền chủ phòng`; changed = true; }
    }
    const now = this.now();
    for (const sp of this.spectators.slice()) {
      if ((this.conns.get(sp.pid) || 0) > 0) continue;
      const off = this.offlineSince.get(sp.pid);
      if (off !== undefined && now - off > SPEC_IDLE_MS) { this.removeSpectator(sp.pid, true); changed = true; }
    }
    return changed;
  }

  /* ---------- chat ---------- */
  // ch: kênh ('all' mặc định). Game lọc kênh trong chatFor(i, role).
  addChat(entry) {
    entry.id = ++this.chatSeq;
    entry.at = this.now();
    this.chat.push(entry);
    if (this.chat.length > CHAT_MAX) this.chat.splice(0, this.chat.length - CHAT_MAX);
    this.outbox.push({ type: 'chat', msg: entry });
    return entry;
  }
  sysChat(text, ch) { return this.addChat({ kind: 'sys', text, ch: ch || 'all' }); }
  userChat(pid, kind, name, av, seat, raw, ch) {
    const text = cleanText(raw);
    if (!text) return { err: 'Tin nhắn trống' };
    const last = this.lastChatAt.get(pid) || 0;
    if (this.now() - last < CHAT_GAP_MS) return { err: 'Gõ chậm thôi 😅' };
    this.lastChatAt.set(pid, this.now());
    const e = this.addChat({ kind, name, av, seat, text, ch: ch || 'all' });
    this.onChat && this.onChat(e);
    return {};
  }
  canSeeChat() { return true; }
  chatFor(i, role) { return this.chat.filter(m => this.canSeeChat(m, i, role)).slice(-60); }

  /* ---------- voice ---------- */
  vidOf(pid) { return crypto.createHash('sha256').update(this.code + ':' + pid).digest('hex').slice(0, 10); }
  voiceOp(pid, msg) {
    const isPlayer = this.idxOf(pid) >= 0;
    if (!isPlayer && this.specIdx(pid) < 0) return { err: 'Bạn không ở trong phòng này' };
    if (msg.a === 'vleave') { this.voice.delete(pid); return {}; }
    const mic = isPlayer && !!(msg.a === 'vjoin' ? msg.mic : msg.on);
    if (msg.a === 'vmic' && !this.voice.has(pid)) return { err: 'Chưa vào voice' };
    this.voice.set(pid, { mic });
    return {};
  }
  voiceList() {
    const out = [];
    for (const [pid, v] of this.voice) {
      const i = this.idxOf(pid), k = this.specIdx(pid);
      if (i < 0 && k < 0) { this.voice.delete(pid); continue; }
      const p = i >= 0 ? this.players[i] : this.spectators[k];
      out.push({ vid: this.vidOf(pid), seat: i, name: p.name, mic: !!v.mic });
    }
    return out;
  }

  /* ---------- lệnh ---------- */
  handle(pid, msg) {
    if (!msg) return { err: 'Lệnh trống' };
    if (msg.a === 'vjoin' || msg.a === 'vmic' || msg.a === 'vleave') return this.voiceOp(pid, msg);
    const i = this.idxOf(pid);
    if (i < 0) {
      const k = this.specIdx(pid);
      if (k < 0) return { err: 'Bạn không ở trong phòng này' };
      const sp = this.spectators[k];
      this.lastActive.set(sp.pid, this.now());
      if (msg.a === 'active') return { quiet: true };
      if (msg.a === 'chat') return this.userChat(sp.pid, 'spec', sp.name, sp.av, -1, msg.text, this.specChannel ? this.specChannel() : 'all');
      if (msg.a === 'leave') { this.removeSpectator(sp.pid); return {}; }
      return { err: 'Người xem không làm được thao tác này' };
    }
    const cid = typeof msg.cid === 'string' ? msg.cid.slice(0, 40) : null;
    if (cid) {
      const seen = this.seenCids.get(pid) || new Map();
      if (seen.has(cid)) return Object.assign({ dup: true }, seen.get(cid));
      const res = this._handleBase(i, msg);
      seen.set(cid, res);
      if (seen.size > 60) seen.delete(seen.keys().next().value);
      this.seenCids.set(pid, seen);
      return res;
    }
    return this._handleBase(i, msg);
  }
  _handleBase(i, msg) {
    const me = this.players[i];
    this.lastActive.set(me.pid, this.now());
    if (msg.a === 'active') return { quiet: true };
    if (msg.a === 'leave') { this.removePlayer(i, 'leave'); return {}; }
    const idle = this.phase === 'lobby' || this.phase === 'over';
    if (msg.a === 'kick') {
      const k = msg.idx | 0;
      if (me.pid !== this.hostPid || !idle || k === i || !this.players[k]) return { err: 'Không mời ra được' };
      this.removePlayer(k, 'kick');
      return {};
    }
    return this._handle(i, msg);
  }

  /* ---------- trang chủ ---------- */
  listing() {
    if (this.closed || this.settings.private) return null;
    const humans = this.players.filter(p => !p.bot && this.online(p)).length;
    if (!humans) return null;
    const host = this.players.find(p => p.pid === this.hostPid) || this.players.find(p => !p.bot);
    const open = this.phase === 'lobby' || this.phase === 'over';
    return {
      game: this.game, code: this.code, host: host ? host.name : '', phase: this.phase, gameNo: this.gameNo,
      players: this.players.map(p => ({ name: p.name, av: p.av, bot: !!p.bot })),
      max: this.maxPlayers, humans, spectators: this.spectators.length,
      canJoin: open && this.players.length < this.maxPlayers,
    };
  }

  /* ---------- lưu & gửi ---------- */
  baseSnapshot() {
    return {
      v: 1, game: this.game, code: this.code, created: this.created, touched: this.touched, settings: this.settings,
      players: this.players, spectators: this.spectators, hostPid: this.hostPid, phase: this.phase, log: this.log,
      gameNo: this.gameNo, chat: this.chat, chatSeq: this.chatSeq,
    };
  }
  baseRestore(s) {
    Object.assign(this, {
      created: s.created, touched: s.touched || Date.now(), players: s.players || [], spectators: s.spectators || [],
      hostPid: s.hostPid, phase: s.phase || 'lobby', log: s.log || '', gameNo: s.gameNo || 0, chat: s.chat || [], chatSeq: s.chatSeq || 0,
    });
    this.players.forEach(p => { if (!p.bot) this.offlineSince.set(p.pid, this.now()); });
    this.spectators.forEach(x => this.offlineSince.set(x.pid, this.now()));
  }
  snapshot() { return this.baseSnapshot(); }
  publish() { this.deps.send && this.deps.send(this); this.outbox = []; }
  commit() {
    this.touched = this.now();
    if (this.deps.store && !this.closed) this.deps.store.commit(this.code, this.snapshot(), { events: [], gameStart: null, gameEnd: null });
    this.publish();
  }
  baseView(i, role) {
    return {
      game: this.game, code: this.code, phase: this.phase, you: role === 'spec' ? -1 : i, role, host: this.hostIdx(), log: this.log,
      gameNo: this.gameNo, voice: this.voiceList(),
      spectators: this.spectators.map(x => ({ name: x.name, av: x.av, online: (this.conns.get(x.pid) || 0) > 0 })),
      chat: this.chatFor(role === 'spec' ? -1 : i, role),
    };
  }
  eventsFor(i, role) {
    return this.outbox.filter(e => e.type !== 'chat' || this.canSeeChat(e.msg, i, role || (i < 0 ? 'spec' : 'player')));
  }
  close() {
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.deps.onClose && this.deps.onClose(this);
  }
}

module.exports = { BaseRoom, CHAT_MAX };
