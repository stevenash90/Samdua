// Phòng chơi + state machine của một ván.
//   lobby → sam → play → reveal → over → (sam ...)
// Server là nguồn sự thật duy nhất: mọi nước đi, quyền chủ phòng, đồng hồ và tiền đều xử lý ở đây.
const crypto = require('crypto');
const C = require('./config');
const R = require('./rules');
const S = require('./scoring');
const AI = require('./ai');
const BC = require('./botchat');
const News = require('./news');

// [tên, avatar, giọng] — lấy từ hồ sơ nhân vật (src/botchat.js)
const BOTS = BC.BOT_LIST;
const BOT_MIN_GAP = 2000;   // máy chat cách nhau tối thiểu 2 giây
const cleanGender = g => (g === 'nu' ? 'nu' : 'nam');
const TAUNTS = ['Chết nè!', 'Mày ngon!', 'Đi đâu hả con?', 'Từ từ đã!', 'Ôi bạn ơi!', 'Cay chưa?', 'Nộp điểm đây!', 'Về quê nuôi cá nhé!'];

// Bộ bài (kiểu dáng mặt sau / viền) — chủ phòng thay khi có người đề nghị "đổi bộ bài mới"
const DECKS = ['Đỏ cổ điển', 'Xanh hoàng gia', 'Đen vàng', 'Tím mộng', 'Lục bảo'];
const LOSE_STREAK_SWAP = 10;     // thua liên tiếp bấy nhiêu ván thì được xin đổi chỗ giải đen
const SWAP_ASK = 'Đen quá, đổi chỗ phát!';
const SWAP_YES = 'Ok cưng!';
const SWAP_NO = ['Ghế này phong thủy tốt, không đổi đâu!', 'Đen thì chịu khó đi cưng!', 'Đổi chỗ chứ đổi vận sao được!', 'Ngồi yên đó, ván sau đỏ lại!', 'Không đổi, tao đang lên tay!'];
const MAX_SPECTATORS = 20;
const CHAT_MAX = 60, CHAT_LEN = 200, CHAT_GAP_MS = 700;
const REQ_TTL_MS = 30000, DECK_COOLDOWN_MS = 60000, SPEC_IDLE_MS = 10 * 60 * 1000;
const cleanText = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_LEN);

const hashToken = t => crypto.createHash('sha256').update('samdua:' + String(t)).digest('hex');
const pidOf = t => hashToken(t).slice(0, 20);
const cleanName = s => String(s || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Khách';
const cleanAv = s => Array.from(String(s || '').replace(/[\u0000-\u001f<>]/g, '')).slice(0, 4).join('') || '🙂';
const rid = () => crypto.randomBytes(8).toString('hex');

const DEFAULT_SETTINGS = () => ({
  ai: true,                       // cho phép người chơi bấm Gợi ý
  botChat: true,                  // máy nói chuyện trên chat theo tính cách
  private: false,                 // phòng riêng tư: không hiện trong danh sách phòng ở trang chủ
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
    botChat: s.botChat !== undefined ? !!s.botChat : d.botChat !== false,
    private: s.private !== undefined ? !!s.private : !!d.private,
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
    this.chat = [];
    this.chatSeq = 0;
    this.spectators = [];          // người vào xem: {pid, tokenHash, name, av}
    this.deck = { no: 1, style: 0 };
    this.swap = null;              // lời xin đổi chỗ đang chờ: {from, to, at} (pid)
    this.swapPlan = null;          // đã đồng ý, đổi khi bắt đầu ván sau: {a: người xin, b: người đồng ý} (pid)
    this.rstats = {};              // thống kê của bàn theo người chơi (pid)
    this.botUsed = {};             // tên máy -> câu soạn sẵn đã nói ở bàn này (không nói lại)
    this.newsUsed = [];            // tin thời sự đã nhắc ở bàn này
    this.deckReq = null;           // đề nghị đổi bộ bài đang chờ: {from, at} (pid)
    // tạm thời (không lưu)
    this.lastChatAt = new Map();
    this.lastDeckReq = new Map();
    this.conns = new Map();       // pid -> số kết nối
    this.lastActive = new Map();  // pid -> thời điểm tương tác cuối
    this.offlineSince = new Map(); // pid -> thời điểm mất kết nối
    this.seenCids = new Map();    // pid -> Map(cid -> phản hồi)
    this.timer = null;
    this.pauseTimer = null;
    this.botTalk = {};            // pid máy -> {said} trong ván hiện tại
    this.botQ = [];               // câu máy chờ nói
    this.botTimer = null;
    this.lastBotAt = 0;
    this.botGame = { lines: 0, budget: 0, news: 0 };
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

  addHuman(token, name, av, opt = {}) {
    this.rosterChanged();
    const pid = opt.pid || pidOf(token);
    const p = { pid, tokenHash: hashToken(token), name: cleanName(name), av: cleanAv(av), gender: cleanGender(opt.gender), member: !!opt.pid, bot: false, auto: false, score: 0 };
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

  /** Tài khoản đăng nhập ở thiết bị khác: gắn token thiết bị mới vào đúng ghế cũ. */
  rebind(pid, token) {
    const p = this.players.find(x => x.pid === pid && !x.bot);
    if (p) { p.tokenHash = hashToken(token); return true; }
    const sp = this.spectators.find(x => x.pid === pid);
    if (sp) { sp.tokenHash = hashToken(token); return true; }
    return false;
  }

  /** Token này là ai trong phòng: người chơi, người xem, hoặc không ai. */
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
    if (!quiet) this.sysChat(`${sp.name} thôi xem`);
  }

  /* ---------------- chat ---------------- */
  addChat(entry) {
    entry.id = ++this.chatSeq;
    entry.at = this.now();
    this.chat.push(entry);
    if (this.chat.length > CHAT_MAX) this.chat.splice(0, this.chat.length - CHAT_MAX);
    this.emit('chat', { msg: entry }, false);
    return entry;
  }
  sysChat(text) { return this.addChat({ kind: 'sys', text }); }
  userChat(pid, kind, name, av, seat, raw) {
    const text = cleanText(raw);
    if (!text) return { err: 'Tin nhắn trống' };
    const last = this.lastChatAt.get(pid) || 0;
    if (this.now() - last < CHAT_GAP_MS) return { err: 'Gõ chậm thôi 😅' };
    this.lastChatAt.set(pid, this.now());
    this.addChat({ kind, name, av, seat, text });
    if (kind === 'player' || kind === 'spec') this.botHear(seat, name, text);
    return {};
  }

  /* ---------------- danh sách phòng ở trang chủ ---------------- */
  // null = không hiện (phòng riêng tư, đã đóng, hoặc không còn người thật nào online)
  listing() {
    if (this.closed || this.settings.private) return null;
    const humans = this.players.filter(p => !p.bot && this.online(p)).length;
    if (!humans) return null;
    const host = this.players.find(p => p.pid === this.hostPid) || this.players.find(p => !p.bot);
    const open = this.phase === 'lobby' || this.phase === 'over';
    return {
      code: this.code, host: host ? host.name : '', phase: this.phase, gameNo: this.gameNo,
      players: this.players.map(p => ({ name: p.name, av: p.av, bot: !!p.bot })),
      max: C.MAX_PLAYERS, humans, spectators: this.spectators.length,
      canJoin: open && this.players.length < C.MAX_PLAYERS,
    };
  }

  /* ---------------- máy nói chuyện ---------------- */
  // Nguyên tắc: ít mà đúng lúc. Máy nói khi có chuyện (chặt, báo Sâm, thắng thua, bị gọi tên, có người chat),
  // đáp nhau theo quan hệ, thỉnh thoảng khơi chuyện thời sự. Trong một bàn không máy nào nói lại câu đã nói.
  persona(i) { const p = this.players[i]; return p && p.bot ? BC.PERSONAS[p.name] || null : null; }
  botPool(ps, cat, ctx, tag) {
    if (cat === 'rel') return (ps.rel && ps.rel[ctx.speakerName]) || [];
    if (cat === 'opinion') return (ps.opinion && ps.opinion[tag]) || ps.human || [];
    return ps[cat] || [];
  }
  botFresh(name, pool) { const used = this.botUsed[name] || []; return pool.filter(x => !used.includes(x)); }
  botFill(i, raw, ctx) {
    const others = this.players.filter((_, k) => k !== i);
    const any = () => (others.length ? BC.pick(others).name : 'mọi người');
    const fem = others.filter(o => o.gender === 'nu');
    const nm = k => (k !== undefined && k !== null && this.players[k] ? this.players[k].name : any());
    return raw
      .replace(/\{target\}/g, () => nm(ctx.target))
      .replace(/\{female\}/g, () => (fem.length ? BC.pick(fem).name : any()))
      .replace(/\{winner\}/g, () => nm(ctx.winner))
      .replace(/\{loser\}/g, () => nm(ctx.loser))
      .replace(/\{chopper\}/g, () => nm(ctx.chopper))
      .replace(/\{victim\}/g, () => nm(ctx.victim))
      .replace(/\{speaker\}/g, () => ctx.speakerName || any())
      .replace(/\{q\}/g, () => ctx.q || '');
  }
  // opt: { force, prio (đáp người chơi), depth, tag, news }
  botSay(i, cat, ctx = {}, opt = {}) {
    const p = this.players[i], ps = this.persona(i);
    if (!ps || !this.settings.botChat || this.closed) return false;
    if (typeof ctx.speaker === 'number' && this.players[ctx.speaker]) ctx.speakerName = this.players[ctx.speaker].name;
    const t = this.botTalk[p.pid] || (this.botTalk[p.pid] = { said: 0 });
    const cap = ps.talk || 4;
    if (t.said >= cap + (opt.prio ? 2 : 0)) return false;
    if (!opt.force && !opt.prio && this.botGame.lines >= this.botGame.budget) return false;
    if (!opt.force && !opt.prio && this.botQ.length >= 2) return false;
    if (!opt.force && this.botQ.some(q => q.pid === p.pid)) return false;
    let raw = null, text = null;
    if (cat === 'news') {
      raw = BC.pick(ps.news);   // khung câu được dùng lại, còn tin thì không bao giờ lặp
      ctx.q = opt.news.q;
      text = this.botFill(i, raw, ctx);
      text = text.charAt(0).toUpperCase() + text.slice(1);
    } else {
      const fresh = this.botFresh(p.name, this.botPool(ps, cat, ctx, opt.tag));
      if (fresh.length) { raw = BC.pick(fresh); text = this.botFill(i, raw, ctx); }
    }
    if (!text) return false;
    if (raw && cat !== 'news') {
      const u = this.botUsed[p.name] || (this.botUsed[p.name] = []);
      u.push(raw);
      if (u.length > 400) u.splice(0, 100);
    }
    const item = { pid: p.pid, name: p.name, text, cat, tag: opt.tag || (opt.news && opt.news.tag) || null, depth: opt.depth || 0, prio: !!opt.prio, force: !!opt.force };
    t.said++;
    if (!opt.prio) this.botGame.lines++;
    if (opt.prio) this.botQ.unshift(item); else this.botQ.push(item);
    this.pumpBots();
    return true;
  }
  maybeBot(i, cat, prob, ctx, opt) { return !!this.persona(i) && Math.random() < prob && this.botSay(i, cat, ctx, opt); }
  botIdx(except = -1) { return this.players.map((p, k) => (p.bot && k !== except && BC.PERSONAS[p.name] ? k : -1)).filter(k => k >= 0); }
  pumpBots() {
    if (this.botTimer || !this.botQ.length || this.closed) return;
    const head = this.botQ[0];
    const inPlay = this.phase === 'sam' || this.phase === 'play';
    // khoảng nghỉ giữa hai câu máy: tối thiểu BOT_MIN_GAP (2s), lúc đang đánh thì 5s (trừ khi đáp người chơi)
    const gap = Math.max(BOT_MIN_GAP, head.prio ? 0 : inPlay ? 5000 : 2600);
    const first = head.prio ? 1100 + crypto.randomInt(1000) : 1400 + crypto.randomInt(1400);
    const wait = Math.max(first, this.lastBotAt + gap - this.now());
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const item = this.botQ.shift();
      if (!item || this.closed) return;
      this.botFire(item);
    }, wait);
  }
  botFire(item) {
    if (this.closed) return;
    const k = this.idxOf(item.pid), text = item.text;
    if (k >= 0 && this.settings.botChat && text) {
      const p = this.players[k];
      this.lastBotAt = this.now();
      this.addChat({ kind: 'player', bot: true, name: p.name, av: p.av, seat: k, text });
      this.botReact(k, item, text);
      this.publish();
    }
    this.pumpBots();
  }
  // máy khác đáp lại câu vừa nói
  botReact(k, item, text) {
    const sp = this.players[k].name;
    const others = this.botIdx(k).sort(() => Math.random() - 0.5);
    if (item.cat === 'news') {
      let n = 0;
      for (const j of others) {
        if (n >= 2) break;
        if (Math.random() < (n ? 0.35 : 0.75) && this.botSay(j, 'opinion', { speaker: k, text }, { tag: item.tag, depth: 1, prio: true })) n++;
      }
      return;
    }
    if (item.depth >= 2) return;
    const rel = others.filter(j => this.botFresh(this.players[j].name, (BC.PERSONAS[this.players[j].name].rel || {})[sp] || []).length);
    if (rel.length && Math.random() < 0.5) { this.botSay(rel[0], 'rel', { speaker: k, text }, { depth: item.depth + 1 }); return; }
    if (others.length && Math.random() < 0.1) this.botSay(others[0], 'human', { speaker: k, text }, { depth: item.depth + 1 });
  }
  // người chơi / người xem vừa chat → tối đa một máy đáp
  botHear(seat, name, text) {
    if (!this.settings.botChat) return;
    if (this.now() - (this.lastHumanReply || 0) < 3500) return;
    const bots = this.botIdx(seat).sort(() => Math.random() - 0.5);
    if (!bots.length) return;
    const ctx = { speakerName: name, text };
    let done = false;
    const named = bots.find(j => BC.mentions(BC.PERSONAS[this.players[j].name], text));
    if (named !== undefined) done = Math.random() < 0.9 && this.botSay(named, 'reply', ctx, { prio: true });
    else {
      const tag = BC.topicOf(text);
      if (tag) {
        const fans = bots.filter(j => (BC.PERSONAS[this.players[j].name].fav || []).includes(tag));
        const j = fans.length ? fans[0] : bots[0];
        done = Math.random() < 0.65 && this.botSay(j, 'opinion', ctx, { prio: true, tag });
      } else if (Math.random() < 0.25) done = this.botSay(bots[0], 'human', ctx, { prio: true });
    }
    if (done) this.lastHumanReply = this.now();
  }
  // khơi chuyện thời sự (mỗi ván tối đa một lần)
  botNews(i) {
    if (this.botGame.news >= 1 || !this.settings.botChat) return false;
    const list = News.available(this.newsUsed, this.now());
    if (!list.length) return false;
    const n = BC.pick(list.slice(0, 6));
    if (!this.botSay(i, 'news', {}, { news: n })) return false;
    this.newsUsed.push(n.id);
    if (this.newsUsed.length > 300) this.newsUsed.splice(0, 100);
    this.botGame.news++;
    return true;
  }
  botsAfterGame(res, d) {
    if (!this.settings.botChat) return;
    const n = this.players.length;
    let loser = -1;
    for (let i = 0; i < n; i++) if (i !== res.winner && (loser < 0 || d[i] < d[loser])) loser = i;
    const ctx = { winner: res.winner, loser };
    if (this.persona(res.winner)) this.botSay(res.winner, 'win', ctx, { force: true });
    if (loser >= 0 && this.persona(loser) && Math.random() < 0.7) this.botSay(loser, 'lose', ctx, { force: true });
    // máy nào cả ván chưa nói câu nào thì góp một câu
    this.botIdx().forEach(i => {
      const t = this.botTalk[this.players[i].pid];
      if (!t || !t.said) this.botSay(i, i === res.winner ? 'win' : 'lose', ctx, { force: true });
    });
  }

  /* ---------------- đổi chỗ giải đen ---------------- */
  doSwap(a, b) {
    const pa = this.players[a], pb = this.players[b];
    this.rosterChanged();
    this.players[a] = pb; this.players[b] = pa;
    pa.lose = 0;
    this.swap = null;
    this.swapPlan = null;
    this.sysChat(`🔄 ${pa.name} đã đổi chỗ với ${pb.name}. Giải đen thôi!`);
    this.emit('swap', { a, b }, false);
  }

  /* ---------------- thống kê của bàn ---------------- */
  statOf(pid) {
    return this.rstats[pid] || (this.rstats[pid] = {
      games: 0, wins: 0, losses: 0, points: 0, best: 0, worst: 0, streak: 0, bestWin: 0, bestLose: 0,
      samCalls: 0, samWins: 0, samCaught: 0, chops: 0, chopped: 0, cong: 0, trang: 0,
    });
  }
  recordStats(res, g, entries, d) {
    this.players.forEach((p, i) => {
      const st = this.statOf(p.pid);
      const win = i === res.winner;
      st.games++;
      st.points += d[i];
      st.best = Math.max(st.best, d[i]);
      st.worst = Math.min(st.worst, d[i]);
      if (win) { st.wins++; st.streak = st.streak > 0 ? st.streak + 1 : 1; st.bestWin = Math.max(st.bestWin, st.streak); }
      else { st.losses++; st.streak = st.streak < 0 ? st.streak - 1 : -1; st.bestLose = Math.max(st.bestLose, -st.streak); }
      if (g.samBy === i) { st.samCalls++; if (res.type === 'sam') st.samWins++; }
      if (win && res.type === 'chan') st.samCaught++;
      if (win && res.type === 'trang') st.trang++;
      for (const e of entries) {
        if ((e.kind === 'chat2' || e.kind === 'chatde') && e.to === i) st.chops++;
        if ((e.kind === 'chat2' || e.kind === 'chatde') && e.from === i) st.chopped++;
        if (e.kind === 'cong' && e.from === i) st.cong++;
      }
    });
  }

  acceptSwap(from, to) {
    const a = this.players[from], b = this.players[to];
    this.swapPlan = { a: a.pid, b: b.pid };
    const when = this.phase === 'lobby' || this.phase === 'over' ? 'khi bắt đầu ván mới' : 'từ ván sau';
    this.sysChat(`${b.name}: "${SWAP_YES}" — ${a.name} và ${b.name} sẽ đổi chỗ ${when}`);
    this.emit('swapans', { yes: true, by: to, from, text: SWAP_YES }, false);
  }
  applySwapPlan() {
    const pl = this.swapPlan;
    if (!pl) return;
    const a = this.idxOf(pl.a), b = this.idxOf(pl.b);
    this.swapPlan = null;
    if (a >= 0 && b >= 0) this.doSwap(a, b);
  }

  /* ---------------- đổi bộ bài ---------------- */
  newDeck(byName, forName) {
    this.deck = { no: this.deck.no + 1, style: (this.deck.style + 1) % DECKS.length };
    this.deckReq = null;
    this.sysChat(`🃏 ${byName} đã thay bộ bài mới: ${DECKS[this.deck.style]}${forName ? ` (theo đề nghị của ${forName})` : ''}`);
    this.emit('deck', { style: this.deck.style }, false);
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
    this.applySwapPlan();
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
      roster: this.players.map(p => ({ pid: p.pid, name: p.name, av: p.av, bot: p.bot, gender: p.gender || 'nam' })),
    };
    this.players.forEach(p => { if (!p.bot) p.auto = false; });
    this.result = null;
    this.gameStart = {
      id: this.g.id, room: this.code, no: this.g.no, startedAt: this.g.startedAt,
      players: this.g.roster, settings: this.settings,
    };
    this.emit('deal', { hands: hands.map(h => h.slice()), lead, names: this.players.map(p => p.name) });
    this.botTalk = {};
    // câu thắng/thua của ván trước chưa kịp nói thì bỏ, không dồn vào đầu ván mới; chỉ giữ câu đáp người chơi
    this.botQ = this.botQ.filter(q => q.prio).slice(0, 1);
    { const bots = this.botIdx();
      this.botGame = { lines: 0, budget: 2 + 2 * bots.length, news: 0 };
      if (bots.length) this.maybeBot(BC.pick(bots), 'start', 0.6); }
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
    if (kind) {
      this.maybeBot(i, 'chop', 0.7, { victim: prev.by });
      if (!this.botQ.some(q => q.pid === this.players[i].pid && q.cat === 'chop')) this.maybeBot(prev.by, 'chopped', 0.6, { chopper: i });
    } else if (me.bot && ((cb.t === 'straight' && cb.n >= 6) || cb.t === 'quad' || cb.t === 'pairs3')) {
      this.maybeBot(i, 'brag', 0.3);
    } else if (me.bot && g.hands[i].length <= 6 && g.hands[i].length >= 2) {
      // giữa ván: máy chưa nói gì thì có thể khơi chuyện thời sự
      const tk = this.botTalk[me.pid];
      if ((!tk || !tk.said) && Math.random() < 0.25) this.botNews(i);
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
    if (Math.random() < 0.15) {
      const bots = this.botIdx();
      if (bots.length) this.botNews(BC.pick(bots));
    }
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
    this.players.forEach((p, i) => { p.score += d[i]; p.lose = i === res.winner ? 0 : (p.lose || 0) + 1; });
    this.recordStats(res, g, entries, d);
    this.botsAfterGame(res, d);
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
    const now = this.now();
    if (this.swap && now - this.swap.at > REQ_TTL_MS) { this.swap = null; this.sysChat('Lời xin đổi chỗ đã hết hạn'); changed = true; }
    if (this.deckReq && now - this.deckReq.at > REQ_TTL_MS) { this.deckReq = null; this.sysChat('Đề nghị đổi bộ bài đã hết hạn'); changed = true; }
    for (const sp of this.spectators.slice()) {
      if ((this.conns.get(sp.pid) || 0) > 0) continue;
      const off = this.offlineSince.get(sp.pid);
      if (off !== undefined && now - off > SPEC_IDLE_MS) { this.removeSpectator(sp.pid, true); changed = true; }
    }
    const afk = this.players.map(p => this.isAfk(p));
    const key = afk.join('');
    if (key !== this.afkKey) { this.afkKey = key; changed = true; }
    return changed;
  }

  /* ---------------- xử lý lệnh ---------------- */
  handle(pid, msg) {
    const i = this.idxOf(pid);
    if (i < 0) {
      const k = this.specIdx(pid);
      if (k < 0) return { err: 'Bạn không ở trong phòng này' };
      return this._spec(k, msg);
    }
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

  // người xem: chỉ được chat, báo hoạt động, rời phòng
  _spec(k, msg) {
    const sp = this.spectators[k];
    this.lastActive.set(sp.pid, this.now());
    if (msg.a === 'active') return { quiet: true };
    if (msg.a === 'chat') return this.userChat(sp.pid, 'spec', sp.name, sp.av, -1, msg.text);
    if (msg.a === 'leave') { this.removeSpectator(sp.pid); return {}; }
    return { err: 'Người xem không làm được thao tác này' };
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
      case 'chat': return this.userChat(me.pid, 'player', me.name, me.av, i, msg.text);
      // Xin đổi chỗ: được xin cả khi đang chơi; người kia đồng ý thì đổi từ ván tiếp theo
      case 'swapReq': {
        if ((me.lose || 0) < LOSE_STREAK_SWAP) return { err: `Thua ${LOSE_STREAK_SWAP} ván liên tiếp mới được xin đổi chỗ (bạn đang thua ${me.lose || 0} ván)` };
        const k = msg.idx | 0, t = this.players[k];
        if (!t || k === i) return { err: 'Chọn người muốn đổi chỗ' };
        if (this.swap) return { err: 'Đang có một lời xin đổi chỗ khác' };
        if (this.swapPlan) return { err: 'Đã có một lần đổi chỗ chờ ván sau' };
        this.sysChat(`🔄 ${me.name} thua ${me.lose} ván liền: "${SWAP_ASK}" (xin đổi với ${t.name})`);
        this.emit('swapreq', { from: i, to: k, text: SWAP_ASK }, false);
        if (t.bot) { this.acceptSwap(i, k); return {}; }   // máy luôn đồng ý
        this.swap = { from: me.pid, to: t.pid, at: this.now() };
        return {};
      }
      case 'swapAns': {
        const sw = this.swap;
        if (!sw || sw.to !== me.pid) return { err: 'Không có lời xin đổi chỗ nào' };
        const from = this.idxOf(sw.from);
        this.swap = null;
        if (from < 0) return {};
        if (msg.yes) this.acceptSwap(from, i);
        else {
          const text = SWAP_NO[crypto.randomInt(SWAP_NO.length)];
          this.sysChat(`${me.name}: "${text}" — không đổi chỗ với ${this.players[from].name}`);
          this.emit('swapans', { yes: false, by: i, from, text }, false);
        }
        return {};
      }
      case 'deckReq': {
        if (isHost) { this.newDeck(me.name); return {}; }
        if (this.deckReq) return { err: 'Đã có người đề nghị, chờ chủ phòng trả lời' };
        if (this.now() - (this.lastDeckReq.get(me.pid) || 0) < DECK_COOLDOWN_MS) return { err: 'Bạn vừa đề nghị rồi, đợi một chút' };
        this.lastDeckReq.set(me.pid, this.now());
        this.deckReq = { from: me.pid, at: this.now() };
        this.sysChat(`🃏 ${me.name} đề nghị chủ phòng đổi bộ bài mới`);
        this.emit('deckreq', { from: i }, false);
        return {};
      }
      case 'deckAns': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới đổi được bộ bài' };
        const dr = this.deckReq;
        if (!dr) return { err: 'Không có đề nghị nào' };
        const who = this.players[this.idxOf(dr.from)];
        if (msg.yes) this.newDeck(me.name, who && who.name);
        else { this.deckReq = null; this.sysChat('Chủ phòng giữ bộ bài cũ'); }
        return {};
      }
      case 'addBot': {
        if (!isHost || !idle) return { err: 'Không thêm máy được lúc này' };
        if (this.players.length >= C.MAX_PLAYERS) return { err: 'Phòng đã đủ 5 người' };
        const used = this.players.map(p => p.name);
        const free = BOTS.filter(x => !used.includes(x[0]));
        const [nm, av, gender] = free[crypto.randomInt(free.length)];
        this.rosterChanged();
        this.players.push({ pid: 'bot-' + rid(), tokenHash: null, name: nm, av, gender, bot: true, auto: false, score: 0 });
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
          if (msg.settings && msg.settings.botChat !== undefined) this.settings.botChat = !!msg.settings.botChat;
          if (msg.settings && msg.settings.private !== undefined) this.settings.private = !!msg.settings.private;
          if (!this.settings.botChat) this.botQ = [];
          this.emit('settings', { ai: this.settings.ai, botChat: this.settings.botChat }, false);
          return {};
        }
        this.settings = normalizeSettings(msg.settings, this.settings);
        if (!this.settings.botChat) this.botQ = [];
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
          { const bots = this.botIdx(i);
            if (bots.length) this.maybeBot(BC.pick(bots), 'sam', 0.6, { target: i }); }
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
    if (this.swap && (this.swap.from === p.pid || this.swap.to === p.pid)) this.swap = null;
    if (this.swapPlan && (this.swapPlan.a === p.pid || this.swapPlan.b === p.pid)) this.swapPlan = null;
    if (this.deckReq && this.deckReq.from === p.pid) this.deckReq = null;
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
    clearTimeout(this.botTimer);
    this.botQ = [];
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
      players: this.players.map(p => ({ pid: p.pid, tokenHash: p.tokenHash, name: p.name, av: p.av, gender: p.gender || 'nam', member: !!p.member, bot: p.bot, auto: p.auto, score: p.score, lose: p.lose || 0 })),
      chat: this.chat, chatSeq: this.chatSeq, spectators: this.spectators, deck: this.deck, swap: this.swap, swapPlan: this.swapPlan, deckReq: this.deckReq, rstats: this.rstats, botUsed: this.botUsed, newsUsed: this.newsUsed,
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
      chat: s.chat || [], chatSeq: s.chatSeq || 0, spectators: s.spectators || [], deck: s.deck || { no: 1, style: 0 },
      swap: s.swap || null, swapPlan: s.swapPlan || null, deckReq: s.deckReq || null, rstats: s.rstats || {},
      botUsed: s.botUsed || {}, newsUsed: s.newsUsed || [],
    });
    r.spectators.forEach(x => r.offlineSince.set(x.pid, r.now()));
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
  view(i, role = 'player') {
    const g = this.g, inGame = this.inGame() || (this.phase === 'over' && g);
    const spec = role === 'spec';
    if (spec) i = -1;
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
      settings: { ai: this.settings.ai, botChat: this.settings.botChat, private: !!this.settings.private, pauseLimitMs: this.settings.pauseLimitMs, replayPolicy: this.settings.replayPolicy, turnMs: this.settings.turnMs, points: this.settings.points },
      players: this.players.map((p, k) => ({
        name: p.name, av: p.av, gender: p.gender || 'nam', member: !!p.member, bot: p.bot, auto: !!p.auto, score: p.score,
        online: this.online(p), afk: this.isAfk(p),
        count: inGame && g ? g.hands[k].length : 0,
        passed: !!(inGame && g && this.phase === 'play' && g.passed[k]),
        played: !!(g && g.played[k]),
        lose: p.lose || 0,
      })),
      role, swapNeed: LOSE_STREAK_SWAP,
      spectators: this.spectators.map(x => ({ name: x.name, av: x.av, online: (this.conns.get(x.pid) || 0) > 0 })),
      chat: this.chat.slice(-CHAT_MAX),
      deck: { no: this.deck.no, style: this.deck.style, name: DECKS[this.deck.style] },
      swap: this.swap ? { from: this.idxOf(this.swap.from), to: this.idxOf(this.swap.to), at: this.swap.at } : null,
      swapPlan: this.swapPlan ? { a: this.idxOf(this.swapPlan.a), b: this.idxOf(this.swapPlan.b) } : null,
      rstats: this.players.map(p => this.rstats[p.pid] || null),
      deckReq: this.deckReq ? { from: this.idxOf(this.deckReq.from), at: this.deckReq.at } : null,
      hand: !spec && inGame && g ? g.hands[i] : [],
      turn: this.phase === 'play' && g ? g.turn : -1,
      turnId: g ? g.turnId : 0,
      table: inGame && g && g.table ? { by: g.table.by, cards: g.table.cards, label: g.table.label, chop: g.table.chop } : null,
      trick: inGame && g ? g.trick.map(t => ({ by: t.by, cards: t.cards, label: t.label, chop: t.chop, mult: t.mult })) : [],
      piles: inGame && g ? g.piles : [],
      chain: g && g.chain ? { twoBy: g.chain.twoBy, choppers: g.chain.choppers } : null,
      samBy: g && inGame ? g.samBy : null,
      samPending: !spec && this.phase === 'sam' && !!g && g.samAns[i] === null,
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

module.exports = { Room, DECKS, LOSE_STREAK_SWAP, BOTS, TAUNTS, pidOf, hashToken, cleanName, cleanAv, normalizeSettings, DEFAULT_SETTINGS };
