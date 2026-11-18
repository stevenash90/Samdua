// Phòng chơi + state machine của một ván.
//   lobby → sam → play → reveal → over → (sam ...)
// Server là nguồn sự thật duy nhất: mọi nước đi, quyền chủ phòng, đồng hồ và tiền đều xử lý ở đây.
const crypto = require('crypto');
const C = require('./config');
const R = require('./rules');
const S = require('./scoring');
const AI = require('./ai');

const BOTS = [
  ['Chị Phiến', '💅'], ['Thành Cry', '😭'], ['A Long River', '🐉'], ['Ri Đỗ', '🎲'], ['Shark Bình', '🦈'],
  ['Tô Tổng', '🍜'], ['Mai Thúy', '🌼'], ['Cô Tiên', '🧚'], ['Hà Linh', '💄'], ['Tún', '🐥'],
];
const TAUNTS = ['Chết nè!', 'Mày ngon!', 'Đi đâu hả con?', 'Từ từ đã!', 'Ôi bạn ơi!', 'Cay chưa?', 'Nộp điểm đây!', 'Về quê nuôi cá nhé!'];

const hashToken = t => crypto.createHash('sha256').update('samdua:' + String(t)).digest('hex');
const pidOf = t => hashToken(t).slice(0, 20);
const cleanName = s => String(s || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Khách';
const cleanAv = s => Array.from(String(s || '').replace(/[\u0000-\u001f<>]/g, '')).slice(0, 4).join('') || '🙂';
const rid = () => crypto.randomBytes(8).toString('hex');

const DEFAULT_SETTINGS = () => ({
  ai: true,                       // cho phép người chơi bấm Gợi ý
  pauseLimitMs: C.PAUSE_LIMIT_MS, // 0 = không giới hạn (phòng riêng)
  replayPolicy: 'all',            // 'all': người trong ván xem toàn bộ bài khi xem lại; 'own': chỉ bài của mình
  turnMs: C.TURN_MS,
  points: S.normalizePoints({}),
});

function normalizeSettings(s, base) {
  const d = base || DEFAULT_SETTINGS();
  s = s || {};
  const turnMs = s.turnMs !== undefined ? Math.max(10000, Math.min(120000, Math.round(+s.turnMs || 0))) : d.turnMs;
  const pl = s.pauseLimitMs !== undefined ? Math.max(0, Math.min(3600e3, Math.round(+s.pauseLimitMs || 0))) : d.pauseLimitMs;
  return {
    ai: s.ai !== undefined ? !!s.ai : d.ai,
    pauseLimitMs: pl,
    replayPolicy: s.replayPolicy !== undefined ? (s.replayPolicy === 'own' ? 'own' : 'all') : d.replayPolicy,
    turnMs: Number.isFinite(turnMs) ? turnMs : d.turnMs,
    points: S.normalizePoints(Object.assign({}, d.points, s.points || {})),
  };
}

class Room {
  /**
   * deps: { store, send(room), now(), log(...) }
   * send(room) được gọi sau mỗi thay đổi để server đẩy trạng thái tới client.
   */
  constructor(code, deps) {
    this.code = code;
    this.deps = deps;
    this.created = this.now();
    this.touched = this.now();
    this.settings = DEFAULT_SETTINGS();
    this.players = [];
    this.hostPid = null;
    this.phase = 'lobby';
    this.g = null;
    this.result = null;
    this.log = '';
    this.lastWinnerPid = null;
    this.gameNo = 0;
    this.hostLog = [];
    // tạm thời (không lưu)
    this.conns = new Map();       // pid -> số kết nối
    this.lastActive = new Map();  // pid -> thời điểm tương tác cuối
    this.offlineSince = new Map(); // pid -> thời điểm mất kết nối
    this.seenCids = new Map();    // pid -> Map(cid -> phản hồi)
    this.timer = null;
    this.pauseTimer = null;
    this.outbox = [];             // sự kiện chờ đẩy tới client (âm thanh/hiệu ứng)
    this.pending = [];            // sự kiện chờ ghi DB
    this.gameStart = null;
    this.gameEnd = null;
    this.closed = false;
  }

  now() { return this.deps.now ? this.deps.now() : Date.now(); }

  /* ---------------- người chơi ---------------- */
  idxOf(pid) { return this.players.findIndex(p => p.pid === pid); }
  hostIdx() { return this.idxOf(this.hostPid); }
  humans() { return this.players.filter(p => !p.bot); }
  online(p) { return p.bot || (this.conns.get(p.pid) || 0) > 0; }
  isAfk(p) {
    if (p.bot || !this.online(p)) return false;
    const t = this.lastActive.get(p.pid);
    return t !== undefined && this.now() - t > C.AFK_MS;
  }
  inGame() { return this.phase === 'sam' || this.phase === 'play' || this.phase === 'reveal'; }

  rosterChanged() { if (this.phase === 'over') this.g = null; }

  addHuman(token, name, av) {
    this.rosterChanged();
    const pid = pidOf(token);
    const p = { pid, tokenHash: hashToken(token), name: cleanName(name), av: cleanAv(av), bot: false, auto: false, score: 0 };
    this.players.push(p);
    if (!this.hostPid || this.hostIdx() < 0) this.setHost(pid, 'create');
    this.lastActive.set(pid, this.now());
    this.roomEvent('join', { pid, name: p.name });
    return p;
  }

  auth(token) {
    if (!token) return -1;
    const h = hashToken(token);
    return this.players.findIndex(p => p.tokenHash && p.tokenHash === h);
  }

  setHost(pid, reason) {
    const from = this.hostPid;
    this.hostPid = pid;
    const entry = { at: this.now(), from, to: pid, reason };
    this.hostLog.push(entry);
    if (this.hostLog.length > 50) this.hostLog.shift();
    if (from && from !== pid) {
      const to = this.players[this.idxOf(pid)];
      this.emit('host', { to: this.idxOf(pid), name: to && to.name, reason });
      this.roomEvent('host_transfer', entry);
    }
  }

  /* ---------------- sự kiện ---------------- */
  // persist: ghi vào event log của ván (replay). Luôn đẩy tới client để chạy âm thanh/hiệu ứng.
  emit(type, data = {}, persist = true) {
    const g = this.g;
    const ev = Object.assign({}, data, { type });
    if (g && persist && !g.ended) {
      ev.seq = ++g.evSeq;
      ev.t = this.now() - g.startedAt;
      this.pending.push(ev);
    }
    this.outbox.push(ev);
    return ev;
  }
  roomEvent(type, data) { this.deps.store && this.deps.store.roomEvent(this.code, type, data); }

  /* ---------------- đồng hồ ---------------- */
  setTimer(kind, ms, total) {
    clearTimeout(this.timer);
    const g = this.g;
    g.timer = { kind, deadline: this.now() + ms, total: total || ms };
    this.timer = setTimeout(() => this.onTimer(kind), Math.max(0, ms));
  }
  freezeTimer() {
    const g = this.g;
    clearTimeout(this.timer);
    this.timer = null;
    if (!g || !g.timer) return;
    if (!g.timer.frozen) {
      g.timer.remaining = Math.max(0, g.timer.deadline - this.now());
      g.timer.frozen = true;
      delete g.timer.deadline;
    }
  }
  unfreezeTimer(minMs = 0) {
    const g = this.g;
    if (!g || !g.timer || !g.timer.frozen) return;
    const t = g.timer;
    this.setTimer(t.kind, Math.max(minMs, t.remaining), t.total);
  }
  onTimer(kind) {
    if (this.closed) return;
    try {
      if (this.g && this.g.pause) return;
      if (kind === 'sam' && this.phase === 'sam') this.beginPlay();
      else if (kind === 'turn' && this.phase === 'play') this.timeoutMove();
      else if (kind === 'bot' && this.phase === 'play') this.botMove();
      else if (kind === 'reveal' && this.phase === 'reveal') this.toResult();
      this.commit();
    } catch (e) { this.deps.log && this.deps.log('timer error', this.code, e); }
  }

  /* ---------------- ván mới ---------------- */
  startGame() {
    const n = this.players.length;
    let hands;
    if (this.deps.deal) hands = this.deps.deal(n);   // dùng cho test
    else {
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 0; i--) { const j = crypto.randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      hands = this.players.map((_, i) => deck.slice(i * C.HAND, (i + 1) * C.HAND));
    }
    hands = hands.map(h => h.slice().sort((a, b) => a - b));
    let lead = this.players.findIndex(p => p.pid === this.lastWinnerPid);
    if (lead < 0) lead = this.deps.firstLead !== undefined ? this.deps.firstLead : crypto.randomInt(n);
    this.gameNo++;
    this.g = {
      id: `${this.code}-${this.now().toString(36)}-${rid().slice(0, 4)}`,
      no: this.gameNo,
      startedAt: this.now(),
      hands, table: null, trick: [], piles: hands.map(() => []),
      turn: lead, lead, samBy: null, turnId: 1, evSeq: 0,
      passed: Array(n).fill(false), played: Array(n).fill(false),
      samAns: this.players.map(p => (p.bot ? false : null)),
      chain: null, ledger: [], timer: null, pause: null, pauseUsed: 0, wait: null, reveal: null,
      roster: this.players.map(p => ({ pid: p.pid, name: p.name, av: p.av, bot: p.bot })),
    };
    this.players.forEach(p => { if (!p.bot) p.auto = false; });
    this.result = null;
    this.gameStart = {
      id: this.g.id, room: this.code, no: this.g.no, startedAt: this.g.startedAt,
      players: this.g.roster, settings: this.settings,
    };
    this.emit('deal', { hands: hands.map(h => h.slice()), lead, names: this.players.map(p => p.name) });
    this.log = 'Chia bài xong';
    for (let k = 0; k < n; k++) {
      const i = (lead + k) % n, label = R.instantWin(hands[i]);
      if (label) return this.finish({ type: 'trang', winner: i, label });
    }
    this.phase = 'sam';
    this.emit('samopen', {});
    this.setTimer('sam', C.SAM_MS);
    if (this.g.samAns.every(a => a !== null)) this.beginPlay();
  }

  beginPlay() {
    const g = this.g;
    this.phase = 'play';
    g.samAns = g.samAns.map(a => (a === null ? false : a));
    if (g.samBy !== null) g.turn = g.samBy;
    this.log = g.samBy !== null ? `${this.players[g.samBy].name} báo Sâm!` : `${this.players[g.turn].name} đánh trước`;
    this.emit('start', { turn: g.turn, samBy: g.samBy });
    this.scheduleTurn();
  }

  scheduleTurn() {
    const g = this.g;
    const p = this.players[g.turn];
    g.wait = null;
    if (p.bot || p.auto) return this.setTimer('bot', C.BOT_MS);
    this.setTimer('turn', this.settings.turnMs);
    if (!this.online(p)) {
      // Mất kết nối: không tự bỏ lượt — đóng băng đồng hồ, chờ kết nối lại hoặc chủ phòng xử lý.
      this.freezeTimer();
      g.wait = { idx: g.turn, since: this.now() };
    }
  }

  // Hết giờ (người chơi đang kết nối nhưng không đánh): bỏ lượt; nếu đang cầm cái thì đánh bộ gợi ý.
  timeoutMove() {
    const g = this.g, i = g.turn;
    if (g.table) return this.doPass(i, true);
    const s = AI.suggest(g, i);
    if (s.cards) this.doPlay(i, s.cards, R.checkPlay(g, i, s.cards), true);
    else this.doPass(i, true);
  }

  botMove() {
    const g = this.g, i = g.turn;
    const s = AI.suggest(g, i);
    if (s.cards) {
      const cb = R.checkPlay(g, i, s.cards);
      if (typeof cb === 'object') return this.doPlay(i, s.cards, cb, true);
    }
    if (g.table) return this.doPass(i, true);
    // không nên xảy ra: cầm cái mà không có gợi ý — đánh lá nhỏ nhất hợp lệ
    for (const c of g.hands[i]) {
      const cb = R.checkPlay(g, i, [c]);
      if (typeof cb === 'object') return this.doPlay(i, [c], cb, true);
    }
  }

  doPlay(i, cards, cb, auto = false) {
    const g = this.g, me = this.players[i];
    const prev = g.table;
    const kind = prev ? R.chopKind(cb, prev.combo, prev.chop) : null;
    g.hands[i] = g.hands[i].filter(c => !cards.includes(c));
    g.played[i] = true;
    g.turnId++;
    const label = R.comboLabel(cb);
    let depth = 0, mult = 1;
    if (kind === 'chat2') {
      g.chain = { twoBy: prev.by, choppers: [i] };
      depth = 1;
      this.log = `${me.name} chặt 2 của ${this.players[prev.by].name}!`;
    } else if (kind === 'chatde' && g.chain) {
      g.chain.choppers.push(i);
      depth = g.chain.choppers.length;
      mult = Math.pow(this.settings.points.chatDeMult, depth - 1);
      this.log = `${me.name} chặt đè ${this.players[prev.by].name} x${mult}!`;
    } else {
      this.log = `${me.name} đánh ${label.toLowerCase()}`;
    }
    const play = { by: i, cards: cards.slice().sort((a, b) => a - b), combo: cb, label, chop: kind, depth, mult };
    g.trick.push(play);
    g.table = { cards: play.cards, by: i, combo: cb, label, chop: !!kind };
    this.emit('play', { by: i, cards: play.cards, label, t2: cb.t, n: cb.n, chop: kind, depth, mult, auto, left: g.hands[i].length });
    const longCut = prev && prev.combo.t === 'straight' && prev.combo.n >= 5;
    if (kind || longCut) {
      const k = crypto.randomInt(TAUNTS.length);
      this.emit('taunt', { by: i, k, text: TAUNTS[k] }, false);
    }
    if (g.samBy !== null && i !== g.samBy) return this.finish({ type: 'chan', winner: i, label });
    if (!g.hands[i].length) return this.finish({ type: g.samBy === i ? 'sam' : 'thuong', winner: i, label });
    this.advance(i);
  }

  doPass(i, auto = false) {
    const g = this.g;
    g.passed[i] = true;
    g.turnId++;
    this.log = `${this.players[i].name} bỏ lượt`;
    this.emit('pass', { by: i, auto });
    this.advance(i);
  }

  advance(i) {
    const g = this.g, j = R.nextSeat(g, i);
    if (j === g.table.by) this.endRound();
    g.turn = j;
    this.emit('turn', { to: j }, false);
    this.scheduleTurn();
  }

  endRound() {
    const g = this.g;
    this.settleChain();
    // bài của vòng vừa xong chuyển về khu bài đã đánh của từng người (vẫn nằm trên bàn tới hết ván)
    for (const pl of g.trick) g.piles[pl.by].push({ cards: pl.cards, label: pl.label, chop: pl.chop || null });
    g.trick = [];
    g.table = null;
    g.passed.fill(false);
    this.emit('round', { leader: g.turn });
  }

  settleChain() {
    const g = this.g;
    if (!g.chain) return;
    const entries = S.chopEntries(g.chain, this.settings.points);
    g.ledger.push(...entries);
    if (entries.length) this.emit('chopsettle', { entries });
    g.chain = null;
  }

  finish(res) {
    const g = this.g, n = this.players.length;
    clearTimeout(this.timer);
    clearTimeout(this.pauseTimer);
    this.settleChain();
    const end = S.endEntries(res, g, this.settings.points);
    const entries = g.ledger.concat(end);
    const d = S.deltasOf(entries, n);
    this.players.forEach((p, i) => (p.score += d[i]));
    const wn = this.players[res.winner].name;
    const title = {
      thuong: `${wn} về nhất!`,
      sam: `${wn} báo Sâm thành công!`,
      chan: `${wn} bắt Sâm của ${g.samBy !== null ? this.players[g.samBy].name : ''}!`,
      trang: `${wn} ăn trắng — ${res.label}!`,
    }[res.type];
    const last = g.trick.length ? g.trick[g.trick.length - 1] : null;
    this.result = {
      gameId: g.id, type: res.type, title, winner: res.winner, samBy: g.samBy, label: res.label,
      lastCards: res.type === 'trang' ? g.hands[res.winner].slice() : last ? last.cards : [],
      lastLabel: res.type === 'trang' ? res.label : last ? last.label : '',
      entries,
      rows: this.players.map((p, i) => ({
        name: p.name, av: p.av, delta: d[i], total: p.score, hand: g.hands[i].slice(),
        cong: res.type === 'thuong' && i !== res.winner && !g.played[i],
        thoi2: res.type === 'thuong' && i !== res.winner ? g.hands[i].filter(c => R.P(c) === R.TWO).length : 0,
      })),
    };
    g.reveal = { winner: res.winner, type: res.type, cards: this.result.lastCards, label: this.result.lastLabel, by: res.type === 'trang' ? res.winner : last ? last.by : res.winner };
    this.lastWinnerPid = this.players[res.winner].pid;
    this.phase = 'reveal';
    g.timer = null;
    g.pause = null;
    g.wait = null;
    this.log = title;
    this.emit('end', { kind: res.type, winner: res.winner, samBy: g.samBy, title, deltas: d, entries });
    g.ended = true;
    this.gameEnd = { id: g.id, endedAt: this.now(), result: this.publicResult(), deltas: d };
    this.setTimer('reveal', C.REVEAL_MS);
  }

  publicResult() {
    const r = this.result;
    return { type: r.type, title: r.title, winner: r.winner, samBy: r.samBy, entries: r.entries, rows: r.rows, lastCards: r.lastCards, lastLabel: r.lastLabel };
  }

  toResult() {
    this.phase = 'over';
    if (this.g) this.g.timer = null;
    this.emit('result', {}, false);
  }

  /* ---------------- tạm dừng ---------------- */
  pause(byIdx, kind = 'host') {
    const g = this.g;
    if (!g || g.pause || !(this.phase === 'sam' || this.phase === 'play')) return 'Không tạm dừng được lúc này';
    const lim = this.settings.pauseLimitMs;
    if (kind === 'host' && lim && g.pauseUsed >= lim) return 'Đã dùng hết thời gian tạm dừng của ván';
    this.freezeTimer();
    g.pause = { by: byIdx, at: this.now(), kind };
    this.log = kind === 'system' ? 'Ván tạm dừng (máy chủ khởi động lại)' : `${byIdx >= 0 ? this.players[byIdx].name : 'Chủ phòng'} tạm dừng ván`;
    this.emit('pause', { by: byIdx, kind });
    this.armPauseLimit();
    return null;
  }
  armPauseLimit() {
    const g = this.g;
    clearTimeout(this.pauseTimer);
    const lim = this.settings.pauseLimitMs;
    if (!g || !g.pause || !lim || g.pause.kind === 'system') return;
    const left = lim - g.pauseUsed - (this.now() - g.pause.at);
    this.pauseTimer = setTimeout(() => {
      if (this.g === g && g.pause) { this.resume(-1, 'limit'); this.commit(); }
    }, Math.max(0, left));
  }
  resume(byIdx, reason = 'host') {
    const g = this.g;
    if (!g || !g.pause) return 'Ván không tạm dừng';
    clearTimeout(this.pauseTimer);
    if (g.pause.kind !== 'system') g.pauseUsed += this.now() - g.pause.at;
    g.pause = null;
    this.log = reason === 'limit' ? 'Hết thời gian tạm dừng, ván tiếp tục' : 'Ván tiếp tục';
    this.emit('resume', { by: byIdx, reason });
    const cur = this.phase === 'play' ? this.players[g.turn] : null;
    if (cur && !cur.bot && !cur.auto && !this.online(cur)) {
      g.wait = { idx: g.turn, since: this.now() };   // vẫn chờ người mất kết nối
    } else {
      g.wait = null;
      this.unfreezeTimer();
    }
    return null;
  }

  /* ---------------- kết nối ---------------- */
  connect(pid) {
    const was = (this.conns.get(pid) || 0) > 0;
    this.conns.set(pid, (this.conns.get(pid) || 0) + 1);
    this.lastActive.set(pid, this.now());
    this.offlineSince.delete(pid);
    const i = this.idxOf(pid);
    if (i < 0) return;
    const p = this.players[i];
    if (!was) {
      if (p.auto) p.auto = false;
      this.emit('conn', { idx: i, online: true }, false);
      const g = this.g;
      if (g && this.phase === 'play' && g.wait && g.wait.idx === i && !g.pause) {
        g.wait = null;
        this.unfreezeTimer(C.RECONNECT_MIN_MS);
      }
    }
  }
  disconnect(pid) {
    const n = Math.max(0, (this.conns.get(pid) || 0) - 1);
    this.conns.set(pid, n);
    if (n > 0) return;
    this.offlineSince.set(pid, this.now());
    const i = this.idxOf(pid);
    if (i < 0) return;
    this.emit('conn', { idx: i, online: false }, false);
    const g = this.g;
    if (g && this.phase === 'play' && g.turn === i && !g.pause && !this.players[i].bot && !this.players[i].auto) {
      this.freezeTimer();
      g.wait = { idx: i, since: this.now() };
    }
  }

  // gọi định kỳ: chuyển chủ phòng khi chủ phòng mất kết nối quá lâu; phát hiện AFK
  tick() {
    let changed = false;
    const hi = this.hostIdx();
    const host = hi >= 0 ? this.players[hi] : null;
    if (!host || (!this.online(host) && this.now() - (this.offlineSince.get(host.pid) || this.now()) > C.HOST_GRACE_MS)) {
      const cand = this.players.find(p => !p.bot && this.online(p) && p.pid !== this.hostPid);
      if (cand) { this.setHost(cand.pid, host ? 'host_offline' : 'no_host'); this.log = `${cand.name} được chuyển quyền chủ phòng`; changed = true; }
    }
    const afk = this.players.map(p => this.isAfk(p));
    const key = afk.join('');
    if (key !== this.afkKey) { this.afkKey = key; changed = true; }
    return changed;
  }

  /* ---------------- xử lý lệnh ---------------- */
  handle(pid, msg) {
    const i = this.idxOf(pid);
    if (i < 0) return { err: 'Bạn không ở trong phòng này' };
    const cid = typeof msg.cid === 'string' ? msg.cid.slice(0, 40) : null;
    if (cid) {
      const seen = this.seenCids.get(pid) || new Map();
      if (seen.has(cid)) return Object.assign({ dup: true }, seen.get(cid));
      const res = this._handle(i, msg);
      seen.set(cid, res);
      if (seen.size > 60) seen.delete(seen.keys().next().value);
      this.seenCids.set(pid, seen);
      return res;
    }
    return this._handle(i, msg);
  }

  _handle(i, msg) {
    const a = msg.a, g = this.g, me = this.players[i];
    const idle = this.phase === 'lobby' || this.phase === 'over';
    const isHost = me.pid === this.hostPid;
    this.lastActive.set(me.pid, this.now());
    if (a === 'active') return { quiet: true };
    if (me.auto && a !== 'active') me.auto = false;
    const paused = g && g.pause;
    switch (a) {
      case 'leave': this.removePlayer(i, 'leave'); return {};
      case 'addBot': {
        if (!isHost || !idle) return { err: 'Không thêm máy được lúc này' };
        if (this.players.length >= C.MAX_PLAYERS) return { err: 'Phòng đã đủ 5 người' };
        const used = this.players.map(p => p.name);
        const free = BOTS.filter(x => !used.includes(x[0]));
        const [nm, av] = free[crypto.randomInt(free.length)];
        this.rosterChanged();
        this.players.push({ pid: 'bot-' + rid(), tokenHash: null, name: nm, av, bot: true, auto: false, score: 0 });
        this.log = `${nm} vào bàn`;
        return {};
      }
      case 'kick': {
        const k = msg.idx | 0;
        if (!isHost || !idle || k === i || !this.players[k]) return { err: 'Không mời ra được' };
        this.removePlayer(k, 'kick');
        return {};
      }
      case 'settings': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới đổi được cài đặt' };
        if (!idle) {
          // trong ván chỉ được bật/tắt gợi ý
          if (msg.settings && msg.settings.ai !== undefined) this.settings.ai = !!msg.settings.ai;
          this.emit('settings', { ai: this.settings.ai }, false);
          return {};
        }
        this.settings = normalizeSettings(msg.settings, this.settings);
        return {};
      }
      case 'transferHost': {
        const k = msg.idx | 0, t = this.players[k];
        if (!isHost || !t || t.bot || k === i) return { err: 'Không chuyển được quyền chủ phòng' };
        this.setHost(t.pid, 'manual');
        this.log = `${me.name} chuyển quyền chủ phòng cho ${t.name}`;
        return {};
      }
      case 'start':
        if (!isHost || !idle) return { err: 'Chỉ chủ phòng mới bắt đầu được' };
        if (this.players.length < 2) return { err: 'Cần ít nhất 2 người' };
        this.startGame();
        return {};
      case 'pause': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới tạm dừng được' };
        const e = this.pause(i);
        return e ? { err: e } : {};
      }
      case 'resume': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới tiếp tục được' };
        const e = this.resume(i);
        return e ? { err: e } : {};
      }
      case 'autoplay': {
        const k = msg.idx | 0, t = this.players[k];
        if (!isHost || !t || t.bot || !this.inGame()) return { err: 'Không cho máy đánh thay được' };
        if (this.online(t)) return { err: 'Người chơi vẫn đang kết nối' };
        t.auto = true;
        this.log = `Máy đánh thay ${t.name} cho tới khi kết nối lại`;
        if (g && this.phase === 'play' && g.turn === k && !g.pause) { g.wait = null; this.setTimer('bot', C.BOT_MS); }
        return {};
      }
      case 'sam':
        if (paused) return { err: 'Ván đang tạm dừng' };
        if (this.phase !== 'sam' || g.samAns[i] !== null) return { err: 'Hết lượt báo Sâm' };
        g.samAns[i] = !!msg.yes;
        if (msg.yes) {
          g.samBy = i;
          this.emit('sam', { by: i });
          this.beginPlay();
        } else if (g.samAns.every(x => x !== null)) this.beginPlay();
        return {};
      case 'play': {
        if (paused) return { err: 'Ván đang tạm dừng' };
        if (this.phase !== 'play' || g.turn !== i) return { err: 'Chưa đến lượt bạn' };
        if (msg.v !== undefined && msg.v !== g.turnId) return { err: 'Lượt đã thay đổi, thử lại' };
        const cards = Array.isArray(msg.cards) ? msg.cards.slice(0, 13) : null;
        const cb = R.checkPlay(g, i, cards);
        if (typeof cb === 'string') return { err: cb };
        this.doPlay(i, cards, cb);
        return {};
      }
      case 'pass':
        if (paused) return { err: 'Ván đang tạm dừng' };
        if (this.phase !== 'play' || g.turn !== i) return { err: 'Chưa đến lượt bạn' };
        if (msg.v !== undefined && msg.v !== g.turnId) return { err: 'Lượt đã thay đổi, thử lại' };
        if (!g.table) return { err: 'Bạn đang cầm cái, phải đánh' };
        this.doPass(i);
        return {};
      case 'suggest': {
        if (!this.settings.ai) return { err: 'Chủ phòng đã tắt gợi ý' };
        if (this.phase !== 'play' || g.turn !== i || paused) return { err: 'Chỉ gợi ý khi đến lượt bạn' };
        // chỉ đưa vào thông tin công khai: tay của mình + số lá của người khác
        const view = {
          hands: g.hands.map((h, k) => (k === i ? h.slice() : Array(h.length).fill(-1))),
          table: g.table, passed: g.passed.slice(), samBy: g.samBy,
        };
        const s = AI.suggest(view, i);
        return { quiet: true, suggest: s };
      }
    }
    return { err: 'Lệnh không hợp lệ' };
  }

  removePlayer(i, reason) {
    const p = this.players[i];
    const wasHost = p.pid === this.hostPid;
    this.conns.delete(p.pid);
    if (this.phase === 'lobby' || this.phase === 'over') {
      this.rosterChanged();
      this.players.splice(i, 1);
    } else {
      // đang chơi: máy đánh thay tới hết ván
      p.bot = true; p.auto = false; p.tokenHash = null; p.pid = 'bot-' + rid();
      p.name = (p.name + ' (máy)').slice(0, 22);
      const g = this.g;
      if (g.samAns[i] === null) g.samAns[i] = false;
      if (this.phase === 'sam' && g.samAns.every(a => a !== null)) this.beginPlay();
      else if (this.phase === 'play' && g.turn === i && !g.pause) { g.wait = null; this.setTimer('bot', C.BOT_MS); }
    }
    this.roomEvent(reason, { name: p.name });
    this.log = reason === 'kick' ? `${p.name} đã bị mời ra` : `${p.name} rời phòng`;
    if (wasHost) {
      const cand = this.players.find(q => !q.bot && this.online(q)) || this.players.find(q => !q.bot);
      if (cand) this.setHost(cand.pid, 'host_left');
      else this.hostPid = null;
    }
    if (!this.humans().length) this.close();
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.pauseTimer);
    this.deps.onClose && this.deps.onClose(this);
  }

  /* ---------------- lưu & khôi phục ---------------- */
  snapshot() {
    const g = this.g;
    let gs = null;
    if (g) {
      gs = JSON.parse(JSON.stringify(g));
      if (gs.timer && !gs.timer.frozen && gs.timer.deadline) {
        gs.timer.remaining = Math.max(0, gs.timer.deadline - this.now());
      }
    }
    return {
      v: 2, code: this.code, created: this.created, touched: this.touched, settings: this.settings,
      players: this.players.map(p => ({ pid: p.pid, tokenHash: p.tokenHash, name: p.name, av: p.av, bot: p.bot, auto: p.auto, score: p.score })),
      hostPid: this.hostPid, phase: this.phase, g: gs, result: this.result, log: this.log,
      lastWinnerPid: this.lastWinnerPid, gameNo: this.gameNo, hostLog: this.hostLog,
    };
  }

  static restore(s, deps) {
    const r = new Room(s.code, deps);
    Object.assign(r, {
      created: s.created, touched: s.touched || Date.now(), settings: normalizeSettings(s.settings),
      players: s.players, hostPid: s.hostPid, phase: s.phase, g: s.g, result: s.result, log: s.log || '',
      lastWinnerPid: s.lastWinnerPid, gameNo: s.gameNo || 0, hostLog: s.hostLog || [],
    });
    const g = r.g;
    if (r.phase === 'reveal') r.phase = 'over';
    if (g && (r.phase === 'sam' || r.phase === 'play')) {
      // Đồng hồ đóng băng ở thời gian còn lại lúc lưu; ván tự tạm dừng chờ mọi người vào lại.
      if (g.timer) { g.timer = { kind: g.timer.kind, remaining: g.timer.remaining || 0, total: g.timer.total, frozen: true }; }
      if (!g.pause) {
        g.pause = { by: -1, at: r.now(), kind: 'system' };
        r.log = 'Ván tạm dừng (máy chủ khởi động lại). Chủ phòng bấm Tiếp tục khi mọi người đã vào.';
      }
      g.wait = null;
    } else if (g) {
      g.timer = null; g.pause = null;
    }
    // chưa ai kết nối lại: tính mốc mất kết nối từ lúc khôi phục
    r.players.forEach(p => { if (!p.bot) r.offlineSince.set(p.pid, r.now()); });
    return r;
  }

  publish() { this.deps.send && this.deps.send(this); this.outbox = []; }

  commit() {
    this.touched = this.now();
    const events = this.pending; this.pending = [];
    const gameStart = this.gameStart; this.gameStart = null;
    const gameEnd = this.gameEnd; this.gameEnd = null;
    if (this.deps.store && !this.closed) {
      this.deps.store.commit(this.code, this.snapshot(), { events, gameStart, gameEnd });
    }
    this.deps.send && this.deps.send(this);
    this.outbox = [];
  }

  /* ---------------- dữ liệu gửi client ---------------- */
  view(i) {
    const g = this.g, inGame = this.inGame() || (this.phase === 'over' && g);
    const now = this.now();
    let timer = null;
    if (g && g.timer) {
      timer = g.timer.frozen
        ? { left: g.timer.remaining, total: g.timer.total, frozen: true, kind: g.timer.kind }
        : { left: Math.max(0, g.timer.deadline - now), total: g.timer.total, kind: g.timer.kind };
    }
    const host = this.hostIdx();
    return {
      code: this.code, phase: this.phase, you: i, host, log: this.log,
      gameId: g ? g.id : null, gameNo: this.gameNo,
      settings: { ai: this.settings.ai, pauseLimitMs: this.settings.pauseLimitMs, replayPolicy: this.settings.replayPolicy, turnMs: this.settings.turnMs, points: this.settings.points },
      players: this.players.map((p, k) => ({
        name: p.name, av: p.av, bot: p.bot, auto: !!p.auto, score: p.score,
        online: this.online(p), afk: this.isAfk(p),
        count: inGame && g ? g.hands[k].length : 0,
        passed: !!(inGame && g && this.phase === 'play' && g.passed[k]),
        played: !!(g && g.played[k]),
      })),
      hand: inGame && g ? g.hands[i] : [],
      turn: this.phase === 'play' && g ? g.turn : -1,
      turnId: g ? g.turnId : 0,
      table: inGame && g && g.table ? { by: g.table.by, cards: g.table.cards, label: g.table.label, chop: g.table.chop } : null,
      trick: inGame && g ? g.trick.map(t => ({ by: t.by, cards: t.cards, label: t.label, chop: t.chop, mult: t.mult })) : [],
      piles: inGame && g ? g.piles : [],
      chain: g && g.chain ? { twoBy: g.chain.twoBy, choppers: g.chain.choppers } : null,
      samBy: g && inGame ? g.samBy : null,
      samPending: this.phase === 'sam' && g && g.samAns[i] === null,
      timer,
      pause: g && g.pause ? {
        by: g.pause.by, kind: g.pause.kind, elapsed: now - g.pause.at, used: g.pauseUsed,
        limit: this.settings.pauseLimitMs,
      } : null,
      pauseUsed: g ? g.pauseUsed : 0,
      wait: g && g.wait ? { idx: g.wait.idx, elapsed: now - g.wait.since } : null,
      reveal: (this.phase === 'reveal' || this.phase === 'over') && g ? g.reveal : null,
      result: this.phase === 'over' ? this.result : null,
      hostLog: this.hostLog.slice(-5),
    };
  }

  /** Sự kiện của lần cập nhật này, đã lọc theo người xem (không lộ bài kín). */
  eventsFor(i) {
    return this.outbox.map(e => {
      if (e.type === 'deal') return { type: 'deal', seq: e.seq, lead: e.lead };
      return e;
    });
  }
}

module.exports = { Room, BOTS, TAUNTS, pidOf, hashToken, cleanName, cleanAv, normalizeSettings, DEFAULT_SETTINGS };
