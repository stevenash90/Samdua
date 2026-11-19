// Sinh CSS cho các bộ bài ảnh (J Q K + mặt lưng nằm trong public/decks/<thư mục>/*.webp).
// Thêm bộ mới: thêm 1 dòng vào IMG_DECKS (số thứ tự = vị trí trong DECKS ở src/room.js), rồi chạy: node scripts/decks.js
const fs = require('fs');
const path = require('path');
const IMG_DECKS = [
  // [style, thư mục, màu lưng đậm, màu lưng nhạt, màu viền]
  [0, 'hoang-cung', '#8b1a1a', '#b3261e', '#d4af37'],
  [1, 'sieu-anh-hung', '#0f1f4a', '#1d3a7a', '#e2b84a'],
  [2, 'ai-cap', '#0d2a5c', '#16407f', '#d9b24c'],
  [3, 'la-ma', '#6b1414', '#9a2020', '#e0b64a'],
];
const KEYS = ['JS', 'JC', 'JD', 'JH', 'QS', 'QC', 'QD', 'QH', 'KS', 'KC', 'KD', 'KH'];
const out = ['/* @decks-begin — sinh tự động bởi scripts/decks.js, đừng sửa tay */'];
for (const [n, dir, b1, b2, edge] of IMG_DECKS) {
  const u = k => `url(decks/${dir}/${k}.webp)`;
  out.push(`body[data-deck="${n}"]{--back1:${b1};--back2:${b2};--edge:${edge}}`);
  out.push(`body[data-deck="${n}"] .card.back,body .dp .card.back[data-deckp="${n}"]{background:${b1} ${u('back')} center/cover;box-shadow:0 3px 6px #0007}`);
  out.push(`body[data-deck="${n}"] .card.back::after,body .dp .card.back[data-deckp="${n}"]::after{display:none}`);
  out.push(`body[data-deck="${n}"] .cnt{background:${b1} ${u('back')} center/cover}`);
  out.push(`body[data-deck="${n}"] .card.court{background:#fbf3df center/cover;border-color:${edge}}`);
  out.push(`body[data-deck="${n}"] .card.court>*{display:none}`);
  for (const k of KEYS) out.push(`body[data-deck="${n}"] .card[data-k="${k}"]{background-image:${u(k)}}`);
}
out.push('/* @decks-end */');
const file = path.join(__dirname, '..', 'public', 'style.css');
let css = fs.readFileSync(file, 'utf8');
const re = /\/\* @decks-begin[\s\S]*?@decks-end \*\//;
css = re.test(css) ? css.replace(re, out.join('\n')) : css + '\n' + out.join('\n') + '\n';
fs.writeFileSync(file, css);
// danh sách thư mục cho client tải trước
const js = path.join(__dirname, '..', 'public', 'app.js');
let app = fs.readFileSync(js, 'utf8');
app = app.replace(/const IMG_DECKS = \{[^}]*\};/, 'const IMG_DECKS = { ' + IMG_DECKS.map(d => `${d[0]}: '${d[1]}'`).join(', ') + ' };');
fs.writeFileSync(js, app);
console.log('Đã cập nhật CSS cho', IMG_DECKS.length, 'bộ bài ảnh');
