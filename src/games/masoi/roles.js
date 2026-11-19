// Vai trong Ma Sói & cách chia vai theo số người.
const ROLES = {
  wolf: { name: 'Ma Sói', icon: '🐺', team: 'wolf', desc: 'Mỗi đêm cùng bầy sói chọn một người để cắn. Ban ngày giả làm dân lành.' },
  seer: { name: 'Tiên tri', icon: '🔮', team: 'village', desc: 'Mỗi đêm soi một người, biết người đó có phải Sói không.' },
  guard: { name: 'Bảo vệ', icon: '🛡️', team: 'village', desc: 'Mỗi đêm che chở một người (được che chính mình), không che cùng một người hai đêm liền.' },
  witch: { name: 'Phù thủy', icon: '🧪', team: 'village', desc: 'Biết ai bị Sói cắn. Có 1 bình cứu và 1 bình độc, mỗi bình dùng một lần cả ván.' },
  hunter: { name: 'Thợ săn', icon: '🏹', team: 'village', desc: 'Khi chết (bị cắn hay bị treo), được bắn chết theo một người.' },
  villager: { name: 'Dân làng', icon: '🧑‍🌾', team: 'village', desc: 'Không có năng lực đặc biệt. Dùng lý lẽ và lá phiếu để tìm ra Sói.' },
};

function wolvesFor(n) { return n <= 6 ? 1 : n <= 9 ? 2 : 3; }   // đo cân bằng bằng máy tự chơi: ~45–60% Sói thắng mọi số người
// danh sách vai cho n người (chưa xáo)
function roleSet(n) {
  const out = [];
  const w = wolvesFor(n);
  for (let k = 0; k < w; k++) out.push('wolf');
  out.push('seer', 'guard');
  if (n >= 7) out.push('witch');
  if (n >= 8) out.push('hunter');
  while (out.length < n) out.push('villager');
  return out.slice(0, n);
}
// Ảnh + truyện của vai (bộ Core 6). Ảnh vuông 480×480 ở public/games/masoi/roles/<id>.webp
const LORE = {
  "wolf": "Ẩn mình giữa dân làng, Sói thường chỉ bộc lộ bản năng săn mồi khi màn đêm buông xuống. Chúng phối hợp với đồng loại để tìm con mồi.",
  "seer": "Được ban cho khả năng nhìn xuyên màn sương dối trá, Tiên tri âm thầm tìm ra những kẻ mang dòng máu Sói trước khi ngôi làng bị diệt vong.",
  "guard": "Người canh giữ cuối cùng của ngôi làng, luôn đứng giữa bóng tối và những người vô tội. Mỗi đêm, họ chọn một sinh mạng để che chở.",
  "witch": "Người nắm giữ những bí thuật cổ xưa, có thể níu một sinh mạng khỏi cửa tử hoặc kết liễu kẻ khác bằng độc dược.",
  "hunter": "Một thợ săn dày dạn sống ngoài rìa làng, quen lần theo dấu chân quái thú. Ngay cả khi gục ngã, phát súng cuối cùng của họ vẫn có thể đổi cục diện.",
  "villager": "Một cư dân bình thường của ngôi làng, không sở hữu phép thuật hay vũ khí đặc biệt. Sức mạnh của họ nằm ở quan sát, lập luận và sự đoàn kết."
};
for (const k of Object.keys(ROLES)) { ROLES[k].art = `/games/masoi/roles/${k}.webp?v=1`; ROLES[k].lore = LORE[k] || ''; }

const teamOf = r => (ROLES[r] ? ROLES[r].team : 'village');

module.exports = { ROLES, roleSet, wolvesFor, teamOf };
