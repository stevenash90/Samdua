// Danh sách máy chủ STUN/TURN cho voice chat (WebRTC).
// STUN miễn phí luôn có. TURN (trung chuyển khi hai máy không nối thẳng được, hay gặp trên 4G) lấy từ biến môi trường:
//   Cloudflare:   TURN_KEY_ID + TURN_KEY_API_TOKEN       (cấp mật khẩu tạm, key không lộ ra trình duyệt)
//   Metered:      METERED_APP + METERED_API_KEY          (tên app trong <app>.metered.live)
//   Bất kỳ (ExpressTURN…): TURN_URLS (cách nhau dấu phẩy) + TURN_USERNAME + TURN_CREDENTIAL
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
let cache = null, cacheAt = 0;
const TTL = 6 * 3600;   // mật khẩu tạm sống 6 giờ, làm mới mỗi giờ

async function fetchJson(url, opt) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(url, Object.assign({ signal: ac.signal }, opt));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

async function turnServers(env, log) {
  const out = [];
  if (env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN) {
    try {
      const j = await fetchJson(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: TTL }),
      });
      const list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
      out.push(...list);
    } catch (e) { log && log('ice cloudflare', e.message); }
  }
  if (env.METERED_APP && env.METERED_API_KEY) {
    try {
      const app = String(env.METERED_APP).replace(/^https?:\/\//, '').replace(/\.metered\.live.*$/, '');
      const j = await fetchJson(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`);
      if (Array.isArray(j)) out.push(...j);
    } catch (e) { log && log('ice metered', e.message); }
  }
  if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    const urls = String(env.TURN_URLS).split(/[,\s]+/).filter(Boolean)
      .map(u => (/^(turns?|stun):/.test(u) ? u : 'turn:' + u));
    if (urls.length) out.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }
  return out;
}

async function iceServers(env = process.env, log) {
  if (cache && Date.now() - cacheAt < 3600 * 1000) return cache;
  const turn = await turnServers(env, log);
  const list = STUN.concat(turn);
  if (turn.length) { cache = list; cacheAt = Date.now(); }
  return list;
}
function status(env = process.env) {
  return env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN ? 'cloudflare'
    : env.METERED_APP && env.METERED_API_KEY ? 'metered'
    : env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL ? 'custom' : 'none';
}

module.exports = { iceServers, status, turnServers };
