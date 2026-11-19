// Định danh & làm sạch dữ liệu người chơi — dùng chung cho mọi game.
const crypto = require('crypto');

const CHAT_LEN = 200;
// mã người chơi (pid) suy ra từ token thiết bị; thành viên đăng nhập dùng 'u_<id>' (xem accounts.js)
const hashToken = t => crypto.createHash('sha256').update('samdua:' + String(t)).digest('hex');
const pidOf = t => hashToken(t).slice(0, 20);
const cleanName = s => String(s || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Khách';
const cleanAv = s => Array.from(String(s || '').replace(/[\u0000-\u001f<>]/g, '')).slice(0, 4).join('') || '🙂';
const cleanGender = g => (g === 'nu' ? 'nu' : 'nam');
const cleanText = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_LEN);
const rid = () => crypto.randomBytes(8).toString('hex');

module.exports = { CHAT_LEN, hashToken, pidOf, cleanName, cleanAv, cleanGender, cleanText, rid };
