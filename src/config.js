// Cấu hình trung tâm. Mọi giá trị đều đổi được bằng biến môi trường cùng tên.
const num = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? +process.env[k] : d);
const str = (k, d) => process.env[k] || d;

module.exports = {
  PORT: num('PORT', 3000),
  DATABASE_URL: str('DATABASE_URL', ''),
  DATA_DIR: str('DATA_DIR', require('path').join(__dirname, '..', 'data')),

  MAX_PLAYERS: 5,
  HAND: 10,

  // Thời gian (ms)
  TURN_MS: num('TURN_MS', 30000),        // mặc định thời gian mỗi lượt (chủ phòng đổi được trong phòng)
  SAM_MS: num('SAM_MS', 12000),          // thời gian báo Sâm
  BOT_MS: num('BOT_MS', 1100),           // máy "suy nghĩ"
  REVEAL_MS: num('REVEAL_MS', 2800),     // giữ màn hình lá bài cuối trước khi hiện kết quả
  AFK_MS: num('AFK_MS', 30000),          // không tương tác bao lâu thì báo AFK
  HOST_GRACE_MS: num('HOST_GRACE_MS', 20000), // chủ phòng mất kết nối bao lâu thì chuyển quyền
  RECONNECT_MIN_MS: num('RECONNECT_MIN_MS', 10000), // kết nối lại giữa lượt: còn ít nhất bấy nhiêu thời gian
  PAUSE_LIMIT_MS: num('PAUSE_LIMIT_MS', 10 * 60 * 1000), // tổng thời gian tạm dừng tối đa mỗi ván (mặc định)
  ROOM_IDLE_MS: num('ROOM_IDLE_MS', 24 * 3600 * 1000),   // phòng không ai động vào bao lâu thì dọn

  // Luật chặt (không đổi luật đã thống nhất; cấu hình chỉ để mở rộng)
  // Cho phép tứ quý và ba đôi thông chặt chéo nhau. Chưa được xác nhận nên mặc định TẮT.
  CROSS_CHOP: str('CROSS_CHOP', '0') === '1',

  // Đăng nhập Google: OAuth Client ID (loại Web application) tạo trong Google Cloud Console
  GOOGLE_CLIENT_ID: str('GOOGLE_CLIENT_ID', ''),
};
