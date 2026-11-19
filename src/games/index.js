// Danh sách game của nền tảng. Thêm game mới:
//   1. Tạo thư mục src/games/<id>/ với index.js xuất { id, name, minPlayers, maxPlayers, Room, normalizeSettings }.
//      Room phải có cùng giao diện với Sâm: handle(pid, msg), view(i, role), eventsFor(i), commit(), publish(), tick(),
//      snapshot(), static restore(snap, deps), close(), addHuman/addSpectator/who/connect/disconnect/listing…
//   2. Thêm vào GAMES bên dưới.
//   3. Giao diện: public/games/<id>/game.js (xem docs/KIEN_TRUC.md).
const PC = require('../platform/config');
const GAMES = {
  sam: require('./sam'),
};

function get(id) { return GAMES[id] || GAMES[PC.DEFAULT_GAME] || GAMES.sam; }
function has(id) { return Object.prototype.hasOwnProperty.call(GAMES, id); }
function list() { return Object.values(GAMES).map(g => ({ id: g.id, name: g.name, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers })); }

module.exports = { GAMES, get, has, list };
