// Lưu trữ bền vững.
//  - Có DATABASE_URL: PostgreSQL (khuyên dùng trên Render — dữ liệu sống qua restart/deploy).
//  - Không có: file JSON trong DATA_DIR (chạy máy nhà / dev; trên Render free ổ đĩa bị xoá mỗi lần restart).
// Mỗi phòng ghi tuần tự (hàng đợi riêng) để không bị chen ngang; event của ván có khoá (game_id, seq) nên ghi lặp không nhân đôi.
const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS rooms (
        code text PRIMARY KEY,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS games (
        id text PRIMARY KEY,
        room_code text NOT NULL,
        game_no int,
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        players jsonb NOT NULL,
        settings jsonb,
        result jsonb,
        deltas jsonb
      );
      CREATE INDEX IF NOT EXISTS games_players_idx ON games USING gin (players jsonb_path_ops);
      CREATE INDEX IF NOT EXISTS games_ended_idx ON games (ended_at DESC);
      CREATE TABLE IF NOT EXISTS game_events (
        game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        seq int NOT NULL,
        type text NOT NULL,
        data jsonb NOT NULL,
        at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (game_id, seq)
      );
      CREATE TABLE IF NOT EXISTS room_events (
        id bigserial PRIMARY KEY,
        room_code text NOT NULL,
        type text NOT NULL,
        data jsonb,
        at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];

class BaseStore {
  constructor(log) {
    this.log = log || console.log;
    this.queues = new Map();
    this.lastError = null;
    this.lastOk = null;
  }
  // xếp hàng ghi theo phòng
  enqueue(code, fn) {
    const prev = this.queues.get(code) || Promise.resolve();
    const next = prev.then(fn).then(() => { this.lastOk = Date.now(); }, e => {
      this.lastError = { at: Date.now(), msg: String(e && e.message || e) };
      this.log('store error', code, e && e.message);
    });
    this.queues.set(code, next);
    next.then(() => { if (this.queues.get(code) === next) this.queues.delete(code); });
    return next;
  }
  async flush() { await Promise.all([...this.queues.values()]); }
  commit(code, snapshot, extra) { return this.enqueue(code, () => this._commit(code, snapshot, extra || {})); }
  deleteRoom(code) { return this.enqueue(code, () => this._deleteRoom(code)); }
  roomEvent(code, type, data) { return this.enqueue('ev:' + code, () => this._roomEvent(code, type, data)); }
}

/* ======================= PostgreSQL ======================= */
class PgStore extends BaseStore {
  constructor(url, log) {
    super(log);
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(url);
    this.pool = new Pool({
      connectionString: url, max: 5,
      ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
    });
    this.pool.on('error', e => this.log('pg pool error', e.message));
    this.kind = 'postgres';
  }
  async init() {
    const c = await this.pool.connect();
    try {
      await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const { rows } = await c.query('SELECT version FROM schema_migrations');
      const done = new Set(rows.map(r => r.version));
      for (const m of MIGRATIONS) {
        if (done.has(m.version)) continue;
        await c.query('BEGIN');
        try {
          await c.query(m.sql);
          await c.query('INSERT INTO schema_migrations(version) VALUES ($1)', [m.version]);
          await c.query('COMMIT');
          this.log('migration applied', m.version);
        } catch (e) { await c.query('ROLLBACK'); throw e; }
      }
    } finally { c.release(); }
  }
  async _commit(code, snap, { events = [], gameStart, gameEnd }) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      if (gameStart) {
        await c.query(
          `INSERT INTO games (id, room_code, game_no, started_at, players, settings)
           VALUES ($1,$2,$3,to_timestamp($4/1000.0),$5,$6) ON CONFLICT (id) DO NOTHING`,
          [gameStart.id, gameStart.room, gameStart.no, gameStart.startedAt, JSON.stringify(gameStart.players), JSON.stringify(gameStart.settings)]);
      }
      if (events.length) {
        const gid = (gameStart && gameStart.id) || snap.g && snap.g.id;
        if (gid) {
          const vals = [], params = [];
          events.forEach((e, k) => {
            params.push(gid, e.seq, e.type, JSON.stringify(e));
            vals.push(`($${k * 4 + 1},$${k * 4 + 2},$${k * 4 + 3},$${k * 4 + 4})`);
          });
          await c.query(`INSERT INTO game_events (game_id, seq, type, data) VALUES ${vals.join(',')} ON CONFLICT DO NOTHING`, params);
        }
      }
      if (gameEnd) {
        await c.query(
          `UPDATE games SET ended_at = to_timestamp($2/1000.0), result = $3, deltas = $4 WHERE id = $1 AND ended_at IS NULL`,
          [gameEnd.id, gameEnd.endedAt, JSON.stringify(gameEnd.result), JSON.stringify(gameEnd.deltas)]);
      }
      await c.query(
        `INSERT INTO rooms (code, snapshot, updated_at) VALUES ($1,$2,now())
         ON CONFLICT (code) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
        [code, JSON.stringify(snap)]);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { c.release(); }
  }
  async _deleteRoom(code) { await this.pool.query('DELETE FROM rooms WHERE code = $1', [code]); }
  async _roomEvent(code, type, data) {
    await this.pool.query('INSERT INTO room_events (room_code, type, data) VALUES ($1,$2,$3)', [code, type, JSON.stringify(data || {})]);
  }
  async loadRooms() {
    const { rows } = await this.pool.query('SELECT snapshot FROM rooms');
    return rows.map(r => r.snapshot);
  }
  async getGame(id) {
    const { rows } = await this.pool.query('SELECT * FROM games WHERE id = $1', [id]);
    if (!rows.length) return null;
    const ev = await this.pool.query('SELECT data FROM game_events WHERE game_id = $1 ORDER BY seq', [id]);
    const g = rows[0];
    return {
      id: g.id, room: g.room_code, no: g.game_no, startedAt: +g.started_at, endedAt: g.ended_at ? +g.ended_at : null,
      players: g.players, settings: g.settings, result: g.result, deltas: g.deltas, events: ev.rows.map(r => r.data),
    };
  }
  async gamesFor(pid, limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT id, room_code, game_no, started_at, ended_at, players, result, deltas FROM games
       WHERE players @> $1::jsonb AND ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT $2`,
      [JSON.stringify([{ pid }]), limit]);
    return rows.map(g => ({
      id: g.id, room: g.room_code, no: g.game_no, startedAt: +g.started_at, endedAt: +g.ended_at,
      players: g.players, result: g.result, deltas: g.deltas,
    }));
  }
  async ping() { await this.pool.query('SELECT 1'); }
  async dump() {
    const out = {};
    for (const t of ['schema_migrations', 'rooms', 'games', 'game_events', 'room_events']) {
      out[t] = (await this.pool.query(`SELECT * FROM ${t}`)).rows;
    }
    return out;
  }
  async close() { await this.flush(); await this.pool.end(); }
}

/* ======================= File JSON ======================= */
class FileStore extends BaseStore {
  constructor(dir, log) {
    super(log);
    this.dir = dir;
    this.kind = 'file';
  }
  async init() {
    for (const d of ['rooms', 'games']) fs.mkdirSync(path.join(this.dir, d), { recursive: true });
  }
  p(...a) { return path.join(this.dir, ...a); }
  safe(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '_'); }
  readJson(f, d = null) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } }
  writeJson(f, obj) {
    const tmp = f + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, f);
  }
  async _commit(code, snap, { events = [], gameStart, gameEnd }) {
    const gid = (gameStart && gameStart.id) || (gameEnd && gameEnd.id) || (snap.g && snap.g.id);
    if (gid && (gameStart || events.length || gameEnd)) {
      const f = this.p('games', this.safe(gid) + '.json');
      const g = this.readJson(f) || {
        id: gid, room: gameStart ? gameStart.room : code, no: gameStart ? gameStart.no : null,
        startedAt: gameStart ? gameStart.startedAt : Date.now(), endedAt: null,
        players: gameStart ? gameStart.players : [], settings: gameStart ? gameStart.settings : null,
        result: null, deltas: null, events: [],
      };
      const have = new Set(g.events.map(e => e.seq));
      for (const e of events) if (!have.has(e.seq)) g.events.push(e);
      g.events.sort((a, b) => a.seq - b.seq);
      if (gameEnd && !g.endedAt) { g.endedAt = gameEnd.endedAt; g.result = gameEnd.result; g.deltas = gameEnd.deltas; }
      this.writeJson(f, g);
    }
    this.writeJson(this.p('rooms', this.safe(code) + '.json'), snap);
  }
  async _deleteRoom(code) { try { fs.unlinkSync(this.p('rooms', this.safe(code) + '.json')); } catch (e) {} }
  async _roomEvent(code, type, data) {
    fs.appendFileSync(this.p('room_events.log'), JSON.stringify({ at: Date.now(), room: code, type, data }) + '\n');
  }
  async loadRooms() {
    return fs.readdirSync(this.p('rooms')).filter(f => f.endsWith('.json')).map(f => this.readJson(this.p('rooms', f))).filter(Boolean);
  }
  async getGame(id) { return this.readJson(this.p('games', this.safe(id) + '.json')); }
  async gamesFor(pid, limit = 50) {
    const out = [];
    for (const f of fs.readdirSync(this.p('games'))) {
      if (!f.endsWith('.json')) continue;
      const g = this.readJson(this.p('games', f));
      if (g && g.endedAt && g.players.some(p => p.pid === pid)) {
        const { events, settings, ...rest } = g;
        out.push(rest);
      }
    }
    return out.sort((a, b) => b.endedAt - a.endedAt).slice(0, limit);
  }
  async ping() { fs.accessSync(this.dir, fs.constants.W_OK); }
  async dump() {
    return {
      rooms: await this.loadRooms(),
      games: fs.readdirSync(this.p('games')).map(f => this.readJson(this.p('games', f))),
    };
  }
  async close() { await this.flush(); }
}

function createStore(cfg, log) {
  return cfg.DATABASE_URL ? new PgStore(cfg.DATABASE_URL, log) : new FileStore(cfg.DATA_DIR, log);
}

module.exports = { createStore, PgStore, FileStore, MIGRATIONS };
