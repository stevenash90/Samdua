// Cấu hình riêng của Ma Sói (kế thừa cấu hình chung).
const P = require('../../platform/config');
const { num } = P;

module.exports = Object.assign({}, P, {
  MIN_PLAYERS: 5,
  MAX_PLAYERS: 12,
  NIGHT_MS: num('MS_NIGHT_MS', 30000),     // đêm: Sói cắn, Tiên tri soi, Bảo vệ che
  WITCH_MS: num('MS_WITCH_MS', 20000),     // Phù thủy quyết định
  DAWN_MS: num('MS_DAWN_MS', 6000),        // công bố người chết
  VOTE_MS: num('MS_VOTE_MS', 30000),       // bỏ phiếu
  HUNTER_MS: num('MS_HUNTER_MS', 20000),   // Thợ săn chọn người bắn
  EXEC_MS: num('MS_EXEC_MS', 6000),        // công bố kết quả treo cổ
  FAST_MS: num('MS_FAST_MS', 4000),        // khi không còn người thật nào sống: chạy nhanh
  BOT_MIN_MS: num('MS_BOT_MIN_MS', 2500),  // máy "nghĩ"
  BOT_MAX_MS: num('MS_BOT_MAX_MS', 9000),
});
