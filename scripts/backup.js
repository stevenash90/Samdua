// Sao lưu toàn bộ dữ liệu (Postgres hoặc file) ra một file JSON.
// Dùng: DATABASE_URL=... node scripts/backup.js [đường-dẫn-file]
const fs = require('fs');
const C = require('../src/config');
const { createStore } = require('../src/store');

(async () => {
  const store = createStore(C, () => {});
  await store.init();
  const data = await store.dump();
  const out = process.argv[2] || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), storage: store.kind, data }, null, 1));
  const n = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  console.log('Đã sao lưu', store.kind, n, '→', out);
  await store.close();
})().catch(e => { console.error('Sao lưu lỗi:', e.message); process.exit(1); });
