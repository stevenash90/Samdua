// Mô tả game Sâm Lốc cho nền tảng (xem src/games/index.js).
const C = require('./config');
const room = require('./room');

module.exports = {
  id: 'sam',
  name: 'Sâm Lốc',
  minPlayers: C.MIN_PLAYERS,
  maxPlayers: C.MAX_PLAYERS,
  bots: true,                 // có máy chơi cùng
  spectators: true,           // có người xem
  Room: room.Room,
  normalizeSettings: room.normalizeSettings,
  DEFAULT_SETTINGS: room.DEFAULT_SETTINGS,
  config: C,
};
