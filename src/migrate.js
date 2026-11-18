// Chuyển dữ liệu từ database cũ sang database mới (dùng khi đổi vùng máy chủ, ví dụ Ohio → Singapore).
// Cách dùng: trên Render đặt DATABASE_URL = database MỚI, MIGRATE_FROM_URL = database CŨ, rồi deploy.
// Khi khởi động, nếu database mới còn trống, máy chủ chép toàn bộ: tài khoản, phiên đăng nhập, ván, nhật ký ván, phòng.
// Database mới đã có dữ liệu thì không chép (không bao giờ ghi đè). Chép xong thì xoá MIGRATE_FROM_URL.
const TABLES = [
  ['users', 'id'],
  ['sessions', 'token_hash'],
  ['games', 'id'],
  ['game_events', 'game_id, seq'],
  ['rooms', 'code'],
  ['room_events', 'id'],
];

const val = v => (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v);

async function copyAll(srcUrl, dst, log = console.log) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(srcUrl);
  const src = new Pool({ connectionString: srcUrl, max: 2, ssl: local || /sslmode=disable/.test(srcUrl) ? false : { rejectUnauthorized: false } });
  const out = {};
  try {
    const has = async (pool, t) => +(await pool.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
    if ((await has(dst, 'users')) || (await has(dst, 'games'))) {
      log('migrate: database mới đã có dữ liệu → bỏ qua, không ghi đè');
      return { skipped: true };
    }
    for (const [t, order] of TABLES) {
      let off = 0, n = 0;
      for (;;) {
        const { rows } = await src.query(`SELECT * FROM ${t} ORDER BY ${order} LIMIT 500 OFFSET ${off}`);
        if (!rows.length) break;
        const cols = Object.keys(rows[0]);
        const params = [], tuples = [];
        rows.forEach(r => { tuples.push('(' + cols.map(c => { params.push(val(r[c])); return '$' + params.length; }).join(',') + ')'); });
        await dst.query(`INSERT INTO ${t} (${cols.join(',')}) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`, params);
        n += rows.length; off += rows.length;
      }
      out[t] = n;
    }
    await dst.query(`SELECT setval(pg_get_serial_sequence('room_events','id'), GREATEST((SELECT COALESCE(max(id),0) FROM room_events),1))`);
    log('migrate: đã chép xong', JSON.stringify(out));
    return out;
  } finally {
    await src.end().catch(() => {});
  }
}

module.exports = { copyAll, TABLES };
