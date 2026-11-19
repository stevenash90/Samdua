// Phòng Ma Sói: đêm (Sói cắn, Tiên tri soi, Bảo vệ che) → Phù thủy → sáng (công bố) → thảo luận → bỏ phiếu → treo cổ → đêm…
// Kênh chat: 'all' (ban ngày), 'wolf' (bầy sói), 'ghost' (người đã chết + người xem). Ban đêm dân làng không chat được.
const crypto = require('crypto');
const C = require('./config');
const { ROLES, roleSet, teamOf } = require('./roles');
const { BaseRoom } = require('../../platform/room-base');
const { BOT_LIST } = require('../../platform/bots/personas');
const AI = require('./ai');

const DISCUSS = [60000, 90000, 120000, 180000, 300000];
const DEFAULT_SETTINGS = () => ({ discussMs: 120000, revealRole: true, botChat: true, private: false });
function normalizeSettings(s, base) {
  const d = Object.assign(DEFAULT_SETTINGS(), base || {});
  s = s || {};
  return {
    discussMs: DISCUSS.includes(+s.discussMs) ? +s.discussMs : d.discussMs,
    revealRole: s.revealRole !== undefined ? !!s.revealRole : d.revealRole,
    botChat: s.botChat !== undefined ? !!s.botChat : d.botChat,
    private: s.private !== undefined ? !!s.private : !!d.private,
  };
}
const rnd = n => crypto.randomInt(n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = rnd(k + 1); [a[k], a[j]] = [a[j], a[k]]; } return a; };

class Room extends BaseRoom {
  constructor(code, deps) {
    super(code, deps, 'masoi');
    this.settings = DEFAULT_SETTINGS();
    this.g = null;
    this.phaseT = null;
  }
  get maxPlayers() { return C.MAX_PLAYERS; }

  /* ---------- tiện ích ---------- */
  alive(i) { return !!(this.g && this.g.alive[i]); }
  role(i) { return this.g ? this.g.roles[i] : null; }
  aliveIdx() { return this.players.map((_, k) => k).filter(k => this.alive(k)); }
  isWolf(i) { return this.role(i) === 'wolf'; }
  humansAlive() { return this.players.some((p, k) => !p.bot && this.alive(k)); }
  dur(ms) { return this.humansAlive() ? ms : Math.min(ms, C.FAST_MS); }
  botDelay() { return this.humansAlive() ? C.BOT_MIN_MS + rnd(Math.max(1, C.BOT_MAX_MS - C.BOT_MIN_MS)) : 200 + rnd(500); }
  inGame() { return this.g && this.phase !== 'lobby' && this.phase !== 'over'; }

  setPhase(phase, ms) {
    this.phase = phase;
    this.cancel(this.phaseT);
    const g = this.g;
    g.timer = ms ? { kind: phase, deadline: this.now() + ms, total: ms } : null;
    if (ms) this.phaseT = this.later(ms, () => { this.onTimeout(phase); this.commit(); });
    this.outbox.push({ type: 'phase', phase, day: g.day });
  }
  onTimeout(phase) {
    if (this.phase !== phase) return;
    if (phase === 'night') this.endNight();
    else if (phase === 'witch') this.resolveNight();
    else if (phase === 'dawn') this.afterDeaths('discuss');
    else if (phase === 'discuss') this.beginVote();
    else if (phase === 'vote') this.resolveVote();
    else if (phase === 'exec') this.afterDeaths('night');
    else if (phase === 'hunter') this.hunterShoot(null);
  }

  /* ---------- bắt đầu ván ---------- */
  startGame() {
    const n = this.players.length;
    const roles = shuffle(roleSet(n));
    this.gameNo++;
    this.g = {
      id: crypto.randomBytes(6).toString('hex'), no: this.gameNo, day: 1,
      roles, alive: Array(n).fill(true), deaths: [],   // deaths: {i, cause, day}
      night: null, guardLast: null, potions: { heal: true, poison: true },
      seen: [],                 // kết quả soi: {by, t, wolf, day}
      votes: {}, ready: [], lastVote: null,
      hunter: null, pendingHunter: [], claims: [], mind: {}, timer: null, winner: null,
      events: [],
    };
    this.players.forEach((p, i) => { if (p.bot) this.g.mind[i] = AI.newMind(this, i); });
    const counts = {};
    roles.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    this.sysChat(`🎭 Ván ${this.gameNo} bắt đầu: ${Object.keys(ROLES).filter(r => counts[r]).map(r => `${counts[r]} ${ROLES[r].name}`).join(', ')}`);
    this.beginNight(true);
  }

  /* ---------- đêm ---------- */
  beginNight(first) {
    const g = this.g;
    if (!first) g.day++;
    g.night = { wolf: {}, seer: null, guard: null, witch: null, victim: null };
    g.votes = {}; g.ready = [];
    this.sysChat(`🌙 Đêm ${g.day} buông xuống. Cả làng đi ngủ…`);
    this.setPhase('night', this.dur(C.NIGHT_MS));
    AI.scheduleNight(this);
  }
  nightActors() {
    const g = this.g, need = [];
    this.players.forEach((p, i) => {
      if (!this.alive(i)) return;
      const r = g.roles[i];
      if (r === 'wolf' || r === 'seer' || r === 'guard') need.push(i);
    });
    return need;
  }
  nightDone() {
    const g = this.g, n = g.night;
    return this.nightActors().every(i => {
      const r = g.roles[i];
      if (r === 'wolf') return n.wolf[i] !== undefined;
      if (r === 'seer') return n.seer !== null;
      if (r === 'guard') return n.guard !== null;
      return true;
    });
  }
  nightAct(i, kind, t) {
    const g = this.g;
    if (this.phase !== 'night') return { err: 'Chưa tới lúc' };
    if (!this.alive(i)) return { err: 'Bạn đã chết' };
    if (!Number.isInteger(t) || !this.alive(t)) return { err: 'Chọn một người còn sống' };
    const r = g.roles[i];
    if (kind === 'wolf') {
      if (r !== 'wolf') return { err: 'Bạn không phải Sói' };
      if (this.isWolf(t)) return { err: 'Không cắn đồng bọn' };
      g.night.wolf[i] = t;
      this.outbox.push({ type: 'wolfvote', by: i, t });
    } else if (kind === 'seer') {
      if (r !== 'seer') return { err: 'Bạn không phải Tiên tri' };
      if (g.night.seer !== null) return { err: 'Đêm nay đã soi rồi' };
      if (t === i) return { err: 'Không soi chính mình' };
      g.night.seer = t;
      g.seen.push({ by: i, t, wolf: this.isWolf(t), day: g.day });
      AI.onSeen(this, i, t);
    } else if (kind === 'guard') {
      if (r !== 'guard') return { err: 'Bạn không phải Bảo vệ' };
      if (t === g.guardLast) return { err: 'Không che cùng một người hai đêm liền' };
      g.night.guard = t;
    } else return { err: 'Thao tác không hợp lệ' };
    if (this.nightDone()) this.endNight();
    return {};
  }
  endNight() {
    const g = this.g, n = g.night;
    const tally = {};
    Object.values(n.wolf).forEach(t => { if (this.alive(t)) tally[t] = (tally[t] || 0) + 1; });
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(k => tally[k] === max).map(Number);
    n.victim = max > 0 ? pick(top) : null;
    const wi = this.players.findIndex((_, k) => this.alive(k) && g.roles[k] === 'witch');
    if (wi >= 0 && (g.potions.heal || g.potions.poison)) {
      n.witch = null;
      this.setPhase('witch', this.dur(C.WITCH_MS));
      AI.scheduleWitch(this, wi);
    } else this.resolveNight();
  }
  witchAct(i, heal, poison) {
    const g = this.g, n = g.night;
    if (this.phase !== 'witch') return { err: 'Chưa tới lúc' };
    if (g.roles[i] !== 'witch' || !this.alive(i)) return { err: 'Bạn không phải Phù thủy' };
    if (heal && (!g.potions.heal || n.victim === null)) return { err: 'Không cứu được' };
    if (poison !== null && poison !== undefined) {
      if (!g.potions.poison) return { err: 'Đã hết bình độc' };
      if (!this.alive(poison) || poison === i) return { err: 'Chọn người khác để đầu độc' };
    }
    n.witch = { heal: !!heal, poison: Number.isInteger(poison) ? poison : null };
    if (heal) g.potions.heal = false;
    if (n.witch.poison !== null) g.potions.poison = false;
    this.resolveNight();
    return {};
  }
  resolveNight() {
    const g = this.g, n = g.night, deaths = [];
    const w = n.witch || { heal: false, poison: null };
    if (n.victim !== null && n.guard !== n.victim && !w.heal) deaths.push([n.victim, 'wolf']);
    if (w.poison !== null && !deaths.some(d => d[0] === w.poison)) deaths.push([w.poison, 'poison']);
    g.guardLast = n.guard;
    deaths.forEach(([i, cause]) => this.kill(i, cause));
    if (!deaths.length) this.sysChat(`☀️ Trời sáng. Đêm qua bình yên, không ai chết.`);
    else this.sysChat(`☀️ Trời sáng. Đêm qua ${deaths.map(([i]) => this.deadName(i)).join(' và ')} đã chết.`);
    this.outbox.push({ type: 'dawn', deaths: deaths.map(d => d[0]) });
    if (this.checkWin()) return;
    this.setPhase('dawn', this.dur(C.DAWN_MS));
    AI.onDawn(this, deaths.map(d => d[0]));
  }
  deadName(i) { const r = this.g.roles[i]; return this.settings.revealRole ? `${this.players[i].name} (${ROLES[r].icon} ${ROLES[r].name})` : this.players[i].name; }
  kill(i, cause) {
    const g = this.g;
    if (!this.alive(i)) return;
    g.alive[i] = false;
    g.deaths.push({ i, cause, day: g.day });
    if (g.roles[i] === 'hunter') g.pendingHunter.push(i);
    AI.onDeath(this, i);
  }
  // sau công bố: xử lý Thợ săn rồi sang bước tiếp theo
  afterDeaths(next) {
    const g = this.g;
    if (this.checkWin()) return;
    if (g.pendingHunter.length) {
      const h = g.pendingHunter.shift();
      g.hunter = { i: h, next };
      this.sysChat(`🏹 ${this.players[h].name} là Thợ săn! Được bắn chết theo một người.`);
      this.setPhase('hunter', this.dur(C.HUNTER_MS));
      AI.scheduleHunter(this, h);
      return;
    }
    if (next === 'discuss') this.beginDiscuss();
    else this.beginNight(false);
  }
  hunterShoot(t) {
    const g = this.g, h = g.hunter;
    if (!h) return;
    g.hunter = null;
    if (Number.isInteger(t) && this.alive(t) && t !== h.i) {
      this.kill(t, 'hunter');
      this.sysChat(`💥 Thợ săn ${this.players[h.i].name} bắn chết ${this.deadName(t)}.`);
      this.outbox.push({ type: 'shot', by: h.i, t });
    } else this.sysChat(`Thợ săn ${this.players[h.i].name} không bắn ai.`);
    this.afterDeaths(h.next);
  }

  /* ---------- ngày ---------- */
  beginDiscuss() {
    const g = this.g;
    g.ready = [];
    this.sysChat(`🗣️ Ngày ${g.day}: thảo luận tìm Sói. Bấm "Sẵn sàng bỏ phiếu" khi xong.`);
    this.setPhase('discuss', this.dur(this.settings.discussMs));
    AI.scheduleDiscuss(this);
  }
  setReady(i, on) {
    const g = this.g;
    if (this.phase !== 'discuss' || !this.alive(i)) return { err: 'Chưa tới lúc' };
    g.ready = g.ready.filter(x => x !== i);
    if (on) g.ready.push(i);
    const need = this.players.map((p, k) => k).filter(k => this.alive(k) && !this.players[k].bot);
    if (need.length && need.every(k => g.ready.includes(k))) this.beginVote();
    return {};
  }
  beginVote() {
    const g = this.g;
    g.votes = {};
    this.sysChat('🗳️ Bỏ phiếu treo cổ! Chọn người nghi là Sói (hoặc bỏ qua).');
    this.setPhase('vote', this.dur(C.VOTE_MS));
    AI.scheduleVotes(this);
  }
  vote(i, t) {
    const g = this.g;
    if (this.phase !== 'vote') return { err: 'Chưa tới lúc bỏ phiếu' };
    if (!this.alive(i)) return { err: 'Người chết không được bỏ phiếu' };
    if (t !== -1 && (!Number.isInteger(t) || !this.alive(t) || t === i)) return { err: 'Chọn người khác' };
    g.votes[i] = t;
    this.outbox.push({ type: 'vote', by: i, t });
    if (this.aliveIdx().every(k => g.votes[k] !== undefined)) this.resolveVote();
    return {};
  }
  resolveVote() {
    const g = this.g, tally = {};
    let skip = 0;
    for (const k of this.aliveIdx()) {
      const t = g.votes[k];
      if (t === undefined || t === -1) { skip++; continue; }
      tally[t] = (tally[t] || 0) + 1;
    }
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(k => tally[k] === max).map(Number);
    g.lastVote = { votes: Object.assign({}, g.votes), day: g.day };
    AI.onVote(this, g.lastVote.votes);
    if (max > 0 && top.length === 1 && max > skip) {
      const t = top[0];
      this.kill(t, 'vote');
      this.sysChat(`⚖️ Làng treo cổ ${this.deadName(t)} với ${max} phiếu.`);
      this.outbox.push({ type: 'exec', t });
    } else {
      this.sysChat(top.length > 1 && max > 0 ? '⚖️ Hoà phiếu — không ai bị treo cổ.' : '⚖️ Không đủ phiếu — không ai bị treo cổ.');
      this.outbox.push({ type: 'exec', t: null });
    }
    if (this.checkWin()) return;
    this.setPhase('exec', this.dur(C.EXEC_MS));
  }

  /* ---------- kết thúc ---------- */
  checkWin() {
    const g = this.g;
    const al = this.aliveIdx();
    const w = al.filter(k => g.roles[k] === 'wolf').length, o = al.length - w;
    let winner = null;
    if (w === 0) winner = 'village';
    else if (w >= o) winner = 'wolf';
    if (!winner) return false;
    g.winner = winner;
    g.timer = null;
    this.cancel(this.phaseT);
    this.phase = 'over';
    this.sysChat(winner === 'wolf' ? '🐺 BẦY SÓI THẮNG! Làng đã bị thôn tính.' : '🎉 DÂN LÀNG THẮNG! Đã tiêu diệt hết Ma Sói.');
    this.sysChat('Vai: ' + this.players.map((p, k) => `${p.name} ${ROLES[g.roles[k]].icon}`).join(', '));
    this.outbox.push({ type: 'over', winner });
    AI.onOver(this);
    return true;
  }

  /* ---------- chat ---------- */
  ghost(i, role) { return role === 'spec' || i < 0 || (this.g && this.inGame() && !this.alive(i)); }
  canSeeChat(m, i, role) {
    const ch = m.ch || 'all';
    if (ch === 'all') return true;
    if (this.phase === 'over' || this.phase === 'lobby') return true;
    if (ch === 'wolf') return this.ghost(i, role) || (i >= 0 && this.isWolf(i));
    if (ch === 'ghost') return this.ghost(i, role);
    return true;
  }
  specChannel() { return this.inGame() ? 'ghost' : 'all'; }
  chatChannel(i) {
    if (!this.inGame()) return 'all';
    if (!this.alive(i)) return 'ghost';
    if (this.phase === 'night' || this.phase === 'witch') return this.isWolf(i) ? 'wolf' : null;
    return 'all';
  }
  onChat(e) { if (e.ch === 'all' && e.kind === 'player') AI.onHumanChat(this, e); }
  botChat(i, text, ch) {
    const p = this.players[i];
    if (!p || !this.settings.botChat && ch !== 'wolf') return;
    this.addChat({ kind: 'player', bot: true, name: (ch === 'wolf' ? '🐺 ' : '') + p.name, av: p.av, seat: i, text, ch: ch || 'all' });
  }

  /* ---------- lệnh ---------- */
  _handle(i, msg) {
    const a = msg.a, me = this.players[i];
    const isHost = me.pid === this.hostPid;
    const idle = this.phase === 'lobby' || this.phase === 'over';
    switch (a) {
      case 'chat': {
        const ch = this.chatChannel(i);
        if (!ch) return { err: 'Đêm xuống, dân làng đang ngủ 😴' };
        const name = (ch === 'wolf' ? '🐺 ' : ch === 'ghost' ? '👻 ' : '') + me.name;
        return this.userChat(me.pid, 'player', name, me.av, i, msg.text, ch);
      }
      case 'addBot': {
        if (!isHost || !idle) return { err: 'Không thêm máy được lúc này' };
        if (this.players.length >= C.MAX_PLAYERS) return { err: `Phòng đã đủ ${C.MAX_PLAYERS} người` };
        const used = this.players.map(p => p.name);
        const free = BOT_LIST.filter(x => !used.includes(x[0]));
        if (!free.length) return { err: 'Hết máy' };
        const [nm, av, gender] = pick(free);
        this.backToLobby();
        this.addBotPlayer(nm, av, gender);
        this.log = `${nm} vào làng`;
        return {};
      }
      case 'settings': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới đổi được' };
        if (!idle) {
          if (msg.settings && msg.settings.botChat !== undefined) this.settings.botChat = !!msg.settings.botChat;
          if (msg.settings && msg.settings.private !== undefined) this.settings.private = !!msg.settings.private;
          return {};
        }
        this.settings = normalizeSettings(msg.settings, this.settings);
        return {};
      }
      case 'start': {
        if (!isHost) return { err: 'Chỉ chủ phòng mới bắt đầu được' };
        if (!idle) return { err: 'Ván đang chơi' };
        if (this.players.length < C.MIN_PLAYERS) return { err: `Cần ít nhất ${C.MIN_PLAYERS} người (thêm máy cho đủ)` };
        this.startGame();
        return {};
      }
      case 'lobby': { if (isHost && this.phase === 'over') this.backToLobby(); return {}; }
      case 'night': return this.nightAct(i, msg.kind, msg.target);
      case 'witch': return this.witchAct(i, !!msg.heal, Number.isInteger(msg.poison) ? msg.poison : null);
      case 'ready': return this.setReady(i, !!msg.on);
      case 'vote': return this.vote(i, Number.isInteger(msg.target) ? msg.target : -1);
      case 'shoot': {
        const g = this.g;
        if (this.phase !== 'hunter' || !g.hunter || g.hunter.i !== i) return { err: 'Không phải lượt bạn' };
        this.hunterShoot(Number.isInteger(msg.target) ? msg.target : null);
        return {};
      }
      default: return { err: 'Thao tác không hợp lệ' };
    }
  }
  backToLobby() { if (this.phase === 'over') { this.phase = 'lobby'; this.g = null; } }
  onRoster() { this.backToLobby(); }
  replaceWithBot(i) {
    super.replaceWithBot(i);
    if (this.g) { this.g.mind[i] = AI.newMind(this, i); AI.rescheduleFor(this, i); }
  }

  /* ---------- lưu & khôi phục ---------- */
  snapshot() {
    const s = this.baseSnapshot();
    const g = this.g ? JSON.parse(JSON.stringify(this.g)) : null;
    if (g && g.timer && g.timer.deadline) g.timer.remaining = Math.max(0, g.timer.deadline - this.now());
    s.g = g;
    return s;
  }
  static restore(s, deps) {
    const r = new Room(s.code, deps);
    r.baseRestore(s);
    r.settings = normalizeSettings(s.settings);
    r.g = s.g || null;
    if (r.g && r.inGame()) {
      // khởi động lại đồng hồ của bước đang dở, máy làm lại việc của bước đó
      const left = r.g.timer ? Math.max(5000, r.g.timer.remaining || r.g.timer.total || 10000) : 10000;
      const ph = r.phase;
      r.setPhase(ph, left);
      AI.reschedulePhase(r);
    }
    return r;
  }

  /* ---------- dữ liệu gửi client ---------- */
  view(i, role = 'player') {
    const g = this.g, spec = role === 'spec';
    if (spec) i = -1;
    const v = this.baseView(i, role);
    const ghost = this.ghost(i, role);
    const over = this.phase === 'over';
    const known = k => {
      if (!g) return null;
      if (over || ghost || k === i) return g.roles[k];
      if (i >= 0 && this.isWolf(i) && this.isWolf(k)) return 'wolf';
      if (!g.alive[k] && this.settings.revealRole) return g.roles[k];
      return null;
    };
    const showVotes = g && (this.phase === 'vote' || this.phase === 'exec');
    const votesNow = this.phase === 'vote' ? g.votes : g && g.lastVote && g.lastVote.day === g.day ? g.lastVote.votes : {};
    v.settings = Object.assign({}, this.settings);
    v.min = C.MIN_PLAYERS; v.max = C.MAX_PLAYERS;
    v.roleInfo = ROLES;
    v.setup = roleSet(Math.max(this.players.length, C.MIN_PLAYERS)).reduce((o, r) => { o[r] = (o[r] || 0) + 1; return o; }, {});
    v.players = this.players.map((p, k) => ({
      name: p.name, av: p.av, gender: p.gender, bot: p.bot, member: !!p.member, online: this.online(p), afk: this.isAfk(p),
      alive: g ? g.alive[k] : true, role: known(k),
      vote: showVotes && votesNow[k] !== undefined ? votesNow[k] : null,
      ready: !!(g && this.phase === 'discuss' && g.ready.includes(k)),
    }));
    if (g) {
      v.g = {
        no: g.no, day: g.day, winner: g.winner,
        timer: g.timer ? { left: Math.max(0, (g.timer.deadline || 0) - this.now()), total: g.timer.total, kind: g.timer.kind } : null,
        deaths: g.deaths.map(d => ({ i: d.i, cause: over || ghost ? d.cause : d.cause === 'vote' || d.cause === 'hunter' ? d.cause : 'night', day: d.day })),
        hunter: g.hunter ? g.hunter.i : null,
      };
      if (i >= 0 && !spec) {
        const r = g.roles[i], n = g.night || {};
        const me = { role: r, alive: g.alive[i] };
        if (r === 'wolf') { me.mates = this.players.map((_, k) => k).filter(k => g.roles[k] === 'wolf' && k !== i); me.wolfVotes = this.phase === 'night' ? n.wolf : {}; }
        if (r === 'seer') { me.seen = g.seen.filter(x => x.by === i).map(x => ({ t: x.t, wolf: x.wolf, day: x.day })); me.done = this.phase === 'night' && n.seer !== null; }
        if (r === 'guard') { me.guardLast = g.guardLast; me.target = this.phase === 'night' ? n.guard : null; }
        if (r === 'witch') { me.potions = g.potions; if (this.phase === 'witch') me.victim = n.victim; }
        if (this.phase === 'vote') me.myVote = g.votes[i] !== undefined ? g.votes[i] : null;
        if (this.phase === 'discuss') me.ready = g.ready.includes(i);
        v.me = me;
      }
      if (ghost && this.phase === 'night') v.ghostNight = { wolf: g.night.wolf, seer: g.night.seer, guard: g.night.guard };
    }
    return v;
  }
}

module.exports = { Room, normalizeSettings, DEFAULT_SETTINGS, DISCUSS };
