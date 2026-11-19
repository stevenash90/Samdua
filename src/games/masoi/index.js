// Mô tả game Ma Sói cho nền tảng (xem src/games/index.js).
const C = require('./config');
const room = require('./room');

module.exports = {
  id: 'masoi',
  name: 'Ma Sói',
  minPlayers: C.MIN_PLAYERS,
  maxPlayers: C.MAX_PLAYERS,
  bots: true,
  spectators: true,
  Room: room.Room,
  normalizeSettings: room.normalizeSettings,
  DEFAULT_SETTINGS: room.DEFAULT_SETTINGS,
  config: C,
};
