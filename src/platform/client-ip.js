// Lấy IP thật của người dùng để giới hạn tần suất (chống spam / dò mật khẩu).
// Trên Render, mọi kết nối đi qua máy trung gian nên địa chỉ socket là của Render, không phải của người dùng.
// Thứ tự tin: CF-Connecting-IP (Cloudflare đặt, người dùng không giả được)
//   → phần tử CUỐI của X-Forwarded-For (do máy trung gian gần nhất thêm vào; phần đầu người dùng tự ghi được nên không tin)
//   → địa chỉ socket. Chỉ đọc header khi chạy sau proxy (Render tự đặt biến RENDER, hoặc TRUST_PROXY=1).
const net = require('net');

const seen = {};   // tên nguồn → số lần dùng (hiện ở /health để kiểm tra trên máy chủ thật)
const clean = v => {
  v = String(v || '').trim().replace(/^\[|\]$/g, '').replace(/^::ffff:/, '');
  return net.isIP(v) ? v : '';
};

function clientIp(req, env = process.env) {
  const trust = env.TRUST_PROXY ? env.TRUST_PROXY === '1' : !!env.RENDER;
  const sock = clean(req.socket && req.socket.remoteAddress) || 'unknown';
  if (trust) {
    const h = req.headers || {};
    // Chỉ tin CF-Connecting-IP (Cloudflare luôn ghi đè). Bỏ True-Client-IP: Cloudflare không ghi đè header này
    // (trừ gói Enterprise) nên người dùng tự đặt được để né giới hạn tần suất (F-15).
    const cf = clean(h['cf-connecting-ip']);
    if (cf) { seen['cf-connecting-ip'] = (seen['cf-connecting-ip'] || 0) + 1; return cf; }
    const xff = String(h['x-forwarded-for'] || '').split(',').map(clean).filter(Boolean);
    if (xff.length) { seen['x-forwarded-for'] = (seen['x-forwarded-for'] || 0) + 1; return xff[xff.length - 1]; }
  }
  seen.socket = (seen.socket || 0) + 1;
  return sock;
}

module.exports = { clientIp, ipSources: () => Object.assign({}, seen) };
