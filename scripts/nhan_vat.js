// Sinh docs/NHAN_VAT.md từ hồ sơ nhân vật trong src/platform/bots/personas.js và tin trong src/platform/news.js.
// Chạy: node scripts/nhan_vat.js
const fs = require('fs');
const path = require('path');
const { PERSONAS } = require('../src/platform/bots/personas');
const { CURATED } = require('../src/platform/news');

const TAG = { showbiz: 'Showbiz', bongda: 'Bóng đá', phim: 'Phim', hoahau: 'Hoa hậu', congnghe: 'Công nghệ', anuong: 'Ăn uống', vui: 'Chuyện vui' };
const CAT = [['start', 'Vào ván'], ['chop', 'Chặt người khác'], ['chopped', 'Bị chặt'], ['brag', 'Ra bộ đẹp'], ['sam', 'Có người báo Sâm'],
  ['win', 'Thắng'], ['lose', 'Thua'], ['reply', 'Bị gọi tên'], ['human', 'Đáp người khác'], ['news', 'Khơi chuyện thời sự']];
const count = p => CAT.reduce((s, [k]) => s + (p[k] || []).length, 0)
  + Object.values(p.opinion || {}).reduce((s, a) => s + a.length, 0)
  + Object.values(p.rel || {}).reduce((s, a) => s + a.length, 0);
const ex = (a, n = 2) => (a || []).slice(0, n).map(x => `“${x}”`).join(' · ');

const out = [];
out.push('# Sâm Dứa — Chỉ dẫn nhân vật máy', '');
out.push('> File này sinh tự động từ `src/platform/bots/personas.js` (chạy `node scripts/nhan_vat.js`). Muốn sửa câu thoại, sửa trong `src/platform/bots/personas.js` rồi chạy lại.', '');
out.push('Các nhân vật là **bản nhại hư cấu**, lấy cảm hứng từ người nổi tiếng để mua vui trong nhóm bạn: nói đùa nhẹ, không bôi nhọ, không bàn chính trị thật.', '');
out.push('## Máy nói chuyện thế nào', '');
out.push('- **Ít mà đúng lúc.** Máy chỉ nói khi có chuyện: vào ván, chặt hoặc bị chặt, ra bộ đẹp, có người báo Sâm, thắng thua, bị gọi tên, có người chat.');
out.push('- **Nhịp độ.** Trong lúc đánh, hai câu máy cách nhau ít nhất 5 giây. Cả bàn có ngân sách khoảng *2 + 2 × số máy* câu mỗi ván; mỗi máy có trần riêng (cột "Tối đa/ván"). Máy nào cả ván im lặng thì cuối ván góp một câu thắng/thua.');
out.push('- **Không lặp.** Trong một bàn, không máy nào nói lại câu đã nói, kể cả qua nhiều ván và khi máy chủ khởi động lại. Hết câu thì máy im chứ không lặp.');
out.push('- **Đối đáp.** Máy A vừa nói, máy B có quan hệ với A (cột "Quan hệ") thường đáp lại. Người chơi gọi tên máy thì máy đáp; người chơi nhắc chủ đề (bóng đá, show, phim, hoa hậu, ăn uống, công nghệ…) thì máy mê chủ đề đó góp chuyện. Mỗi tin nhắn của người chơi chỉ một máy đáp.');
out.push('- **Thời sự.** Mỗi ván tối đa một lần, một máy khơi chuyện tin nóng; 1–2 máy khác góp ý kiến theo tính cách. Tin lấy từ gói tin soạn sẵn (bên dưới) và tiêu đề báo VnExpress tải miễn phí mỗi lần máy chủ thức dậy / có người mở app (tin cũ quá 20 phút thì tải lại), đã lọc bỏ tin buồn, tai nạn, pháp luật, chính trị. Mỗi tin chỉ nhắc một lần ở mỗi bàn.');
out.push('- **Tắt được.** Chủ phòng tắt "Máy nói chuyện" ở form tạo phòng hoặc menu ⋯, kể cả giữa ván.', '');

out.push('## Danh sách', '');
out.push('| | Nhân vật | Giọng | Cảm hứng | Tối đa/ván | Chủ đề ruột | Số câu soạn sẵn |');
out.push('|---|---|---|---|---|---|---|');
for (const [n, p] of Object.entries(PERSONAS)) {
  out.push(`| ${p.av} | **${n}** | ${p.gender === 'nu' ? 'Nữ' : 'Nam'} | ${p.inspired} | ${p.talk} | ${(p.fav || []).map(t => TAG[t]).join(', ')} | ${count(p)} |`);
}
out.push('');

for (const [n, p] of Object.entries(PERSONAS)) {
  out.push(`## ${p.av} ${n}`, '');
  out.push(`**Tiểu sử:** ${p.bio}`, '');
  out.push(`**Giọng điệu:** ${p.style}`, '');
  out.push(`**Gọi tên bằng:** ${p.keys.map(k => '`' + k + '`').join(', ')} · **Tối đa:** ${p.talk} câu/ván`, '');
  const rel = Object.entries(p.rel || {});
  if (rel.length) {
    out.push('**Quan hệ** (khi người đó vừa nói):', '');
    for (const [r, a] of rel) out.push(`- ${PERSONAS[r] ? PERSONAS[r].av : ''} **${r}** → ${ex(a, 2)}`);
    out.push('');
  }
  out.push('**Câu mẫu:**', '');
  for (const [k, label] of CAT) if ((p[k] || []).length) out.push(`- *${label}:* ${ex(p[k])}`);
  const op = Object.entries(p.opinion || {}).filter(([t]) => (p.fav || []).includes(t));
  for (const [t, a] of op) out.push(`- *Ý kiến về ${TAG[t].toLowerCase()}:* ${ex(a)}`);
  out.push('');
}

out.push('## Gói tin nóng soạn sẵn', '');
out.push('Máy dùng tin này tới ngày hết hạn; ngoài ra còn tin tự tải từ báo.', '');
out.push('| Chủ đề | Câu máy hỏi | Hết hạn |', '|---|---|---|');
for (const n of CURATED) out.push(`| ${TAG[n.tag]} | ${n.q.charAt(0).toUpperCase() + n.q.slice(1)} | ${n.until} |`);
out.push('');

const file = path.join(__dirname, '..', 'docs', 'NHAN_VAT.md');
fs.writeFileSync(file, out.join('\n'));
console.log('Đã ghi', file);
