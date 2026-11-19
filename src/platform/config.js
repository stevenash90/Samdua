// Cấu hình chung của nền tảng (mọi game dùng chung). Mọi giá trị đều đổi được bằng biến môi trường cùng tên.
// Cấu hình riêng của từng game nằm ở src/games/<game>/config.js.
const num = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? +process.env[k] : d);
const str = (k, d) => process.env[k] || d;

module.exports = {
  num, str,
  PORT: num('PORT', 3000),
  DATABASE_URL: str('DATABASE_URL', ''),
  DATA_DIR: str('DATA_DIR', require('path').join(__dirname, '..', '..', 'data')),

  // Vòng đời phòng (ms)
  TURN_MS: num('TURN_MS', 30000),        // mặc định thời gian mỗi lượt (chủ phòng đổi được trong phòng)
  AFK_MS: num('AFK_MS', 30000),          // không tương tác bao lâu thì báo AFK
  HOST_GRACE_MS: num('HOST_GRACE_MS', 20000), // chủ phòng mất kết nối bao lâu thì chuyển quyền
  RECONNECT_MIN_MS: num('RECONNECT_MIN_MS', 10000), // kết nối lại giữa lượt: còn ít nhất bấy nhiêu thời gian
  PAUSE_LIMIT_MS: num('PAUSE_LIMIT_MS', 10 * 60 * 1000), // tổng thời gian tạm dừng tối đa mỗi ván (mặc định)
  ROOM_IDLE_MS: num('ROOM_IDLE_MS', 24 * 3600 * 1000),   // phòng không ai động vào bao lâu thì dọn

  // Đăng nhập Google: OAuth Client ID (loại Web application) tạo trong Google Cloud Console
  GOOGLE_CLIENT_ID: str('GOOGLE_CLIENT_ID', ''),

  // Game mặc định khi tạo phòng mà không chỉ định
  DEFAULT_GAME: str('DEFAULT_GAME', 'sam'),
};
