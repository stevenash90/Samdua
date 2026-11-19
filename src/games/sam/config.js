// Cấu hình riêng của game Sâm Lốc (kế thừa cấu hình chung của nền tảng).
const P = require('../../platform/config');
const { num, str } = P;

module.exports = Object.assign({}, P, {
  MAX_PLAYERS: 5,
  MIN_PLAYERS: 2,
  HAND: 10,

  SAM_MS: num('SAM_MS', 12000),          // thời gian báo Sâm
  BOT_THINK_MS: num('BOT_THINK_MS', 90), // thời gian máy Pro tính mỗi nước (ms)
  BOT_MS: num('BOT_MS', 1100),           // máy "suy nghĩ"
  REVEAL_MS: num('REVEAL_MS', 2800),     // giữ màn hình lá bài cuối trước khi hiện kết quả

  // Luật chặt (không đổi luật đã thống nhất; cấu hình chỉ để mở rộng)
  // Cho phép tứ quý và ba đôi thông chặt chéo nhau. Chưa được xác nhận nên mặc định TẮT.
  CROSS_CHOP: str('CROSS_CHOP', '0') === '1',
});
