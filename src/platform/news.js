// Tin thời sự cho máy góp chuyện (miễn phí, không cần API key).
//  - CURATED: tin nóng soạn tay (có hạn dùng), chỉ giải trí / thể thao / chuyện vui.
//  - RSS: server tự lấy tiêu đề mới từ VnExpress (giải trí, thể thao, công nghệ, xe, du lịch, cười) khi thức dậy,
//    khi có người mở app mà tin đã cũ hơn 20 phút, và định kỳ 45 phút;
//    lọc bỏ tin buồn, tai nạn, pháp luật, chính trị. Không có mạng thì chỉ dùng CURATED.

const CURATED = [
  // mỗi chuyện chỉ 1 tin, chia đều các mảng (cat) để bàn không bị một chủ đề chiếm sóng
  { id: 'csmn', tag: 'showbiz', cat: 'giaitri', until: '2026-12-31', q: 'tối thứ Bảy ai xem Ca sĩ mặt nạ không, Trấn Thành đoán trúng được mấy mascot rồi?' },
  { id: 'toctien', tag: 'showbiz', cat: 'giaitri', until: '2026-12-10', q: 'Tóc Tiên vừa đứng thứ 3 Eurovision châu Á với bài Em Tiên, biết chưa?' },
  { id: 'atvncg', tag: 'showbiz', cat: 'giaitri', until: '2026-12-05', q: 'Anh trai vượt ngàn chông gai 2026 chung kết rồi, ai theo dõi không?' },
  { id: 'hhvn', tag: 'hoahau', cat: 'giaitri', until: '2026-12-20', q: 'Hoa hậu Việt Nam 2026 là Nguyễn Yến Trang, cô gái Hà Nội 20 tuổi, mọi người thấy sao?' },
  { id: 'tghp', tag: 'phim', cat: 'giaitri', until: '2026-12-20', q: 'phim Trại giam hạnh phúc của Tuấn Trần ra rạp 20/11, ai định đi xem không?' },
  { id: 'ngaycon', tag: 'phim', cat: 'giaitri', until: '2026-12-10', q: 'Ngày con còn mẹ đang dẫn đầu phòng vé đấy, ai xem chưa?' },
  { id: 'dtvn', tag: 'bongda', cat: 'thethao', until: '2026-12-05', q: 'tuyển Việt Nam vừa đá giao hữu ở Thiên Trường với Đài Bắc Trung Hoa và Kyrgyzstan, ai xem không?' },
  { id: 'dinhbac', tag: 'bongda', cat: 'thethao', until: '2027-01-31', q: 'Đình Bắc vô địch ASEAN Cup, lại còn vua phá lưới với cầu thủ hay nhất, đỉnh không?' },
  { id: 'asiancup', tag: 'bongda', cat: 'thethao', until: '2027-01-31', q: 'Asian Cup 2027 tuyển mình đi được tới đâu nhỉ?' },
  { id: 'choxau', tag: 'vui', cat: 'vui', until: '2027-01-31', q: 'có hội Chó Xấu Việt Nam hơn 300 nghìn thành viên, ai vào xem chưa, cười đau bụng?' },
];

// [địa chỉ, tag (máy nào hợp chủ đề sẽ đáp), mảng (cat: để xoay vòng cho đa dạng)]
const FEEDS = [
  ['https://vnexpress.net/rss/giai-tri.rss', 'showbiz', 'giaitri'],
  ['https://tuoitre.vn/rss/giai-tri.rss', 'showbiz', 'giaitri'],
  ['https://vnexpress.net/rss/the-thao.rss', 'bongda', 'thethao'],
  ['https://tuoitre.vn/rss/the-thao.rss', 'bongda', 'thethao'],
  ['https://thanhnien.vn/rss/the-thao.rss', 'bongda', 'thethao'],
  ['https://tuoitre.vn/rss/van-hoa.rss', 'showbiz', 'vanhoa'],
  ['https://thanhnien.vn/rss/van-hoa.rss', 'showbiz', 'vanhoa'],
  ['https://vnexpress.net/rss/thoi-su.rss', null, 'xahoi'],
  ['https://vnexpress.net/rss/gia-dinh.rss', null, 'xahoi'],
  ['https://tuoitre.vn/rss/nhip-song-tre.rss', null, 'xahoi'],
  ['https://thanhnien.vn/rss/gioi-tre.rss', null, 'xahoi'],
  ['https://vnexpress.net/rss/giao-duc.rss', null, 'giaoduc'],
  ['https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss', 'congnghe', 'congnghe'],
  ['https://vnexpress.net/rss/so-hoa.rss', 'congnghe', 'congnghe'],
  ['https://vnexpress.net/rss/oto-xe-may.rss', 'congnghe', 'congnghe'],
  ['https://vnexpress.net/rss/du-lich.rss', 'anuong', 'dulich'],
  ['https://vnexpress.net/rss/cuoi.rss', 'vui', 'vui'],
];

// Tin buồn, pháp luật, chính trị, chuyện riêng tư nhạy cảm → không đưa vào bàn bài
const BLOCK = /chết|tử vong|qua đời|thiệt mạng|tai nạn|nạn nhân|bắt giữ|bị bắt|khởi tố|truy nã|xét xử|án tù|ngồi tù|tù nhân|ma túy|ma tuý|cháy|hỏa hoạn|hoả hoạn|lũ|bão|động đất|sập|xâm hại|hiếp|giết|sát hại|đâm|chém|ung thư|bệnh|ốm|nhập viện|cấp cứu|tang|lừa đảo|chiến tranh|xung đột|quân sự|tên lửa|vũ khí|nga|ukraine|israel|gaza|iran|trung quốc|mỹ|đảng|quốc hội|bộ trưởng|thủ tướng|chủ tịch|tổng thống|bầu cử|ly hôn|ngoại tình|nợ|phá sản|tự tử|trầm cảm|bạo lực|nghi phạm|công an|cảnh sát|điều tra|phạt|kiện|scandal|tố cáo|sa thải|thất nghiệp|giảm giá vàng|chứng khoán|tổng bí thư|chính phủ|nghị định|nghị quyết|thanh tra|kỷ luật|tham nhũng|hối lộ|đột quỵ|mất tích|đuối nước|ngộ độc|trộm|cướp|va chạm|lật xe|tông xe|tử hình|biểu tình|khủng bố|mại dâm|cờ bạc|thuế|sạt lở|ngập/i;

let rss = [];
let feedStatus = {};          // [{id, tag, q, at}]
let timer = null, lastAt = 0, busy = false, lastErr = null;

function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// tách tiêu đề từ RSS, lọc, biến thành câu hỏi
function parseFeed(xml, tag, cat) {
  const out = [];
  const items = String(xml || '').match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const t = decode((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    if (!t || t.length < 12 || t.length > 110 || BLOCK.test(t)) continue;
    out.push({ id: link || t, tag, cat: cat || tag || 'khac', q: `đọc báo thấy "${t}", mọi người biết chưa?` });
    if (out.length >= 8) break;
  }
  return out;
}

async function refresh(log) {
  if (typeof fetch !== 'function' || busy) return;
  busy = true; lastAt = Date.now();
  const all = [];
  const okFeeds = {};
  for (const [url, tag, cat] of FEEDS) {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'SamDua/1.0 (friends card game)' } });
      clearTimeout(to);
      if (r.ok) { const got = parseFeed(await r.text(), tag, cat); all.push(...got); okFeeds[url.replace(/^https:\/\/|\.rss$/g, '')] = got.length; }
      else okFeeds[url.replace(/^https:\/\/|\.rss$/g, '')] = 'HTTP ' + r.status;
    } catch (e) { lastErr = e.message; okFeeds[url.replace(/^https:\/\/|\.rss$/g, '')] = 'lỗi'; log && log('news', url, e.message); }
  }
  busy = false;
  feedStatus = okFeeds;
  if (all.length) {
    const seen = new Set();   // cùng một chuyện nhiều báo đưa: giữ một
    rss = all.filter(x => { const k = x.q.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(x => Object.assign(x, { at: Date.now() }));
    lastErr = null;
  }
}
// có người mở app (tạo/vào phòng): tin cũ hơn 20 phút thì tải lại, không chờ
function freshen(log, maxAgeMs = 20 * 60 * 1000) { if (Date.now() - lastAt > maxAgeMs) refresh(log); }
function status() {
  const cats = {}; for (const n of rss) cats[n.cat] = (cats[n.cat] || 0) + 1;
  return { items: rss.length, curated: CURATED.length, cats, feeds: feedStatus, updated: lastAt ? new Date(lastAt).toISOString() : null, error: lastErr };
}

function start(log, everyMs = 45 * 60 * 1000) {
  if (timer) return;
  refresh(log);
  timer = setInterval(() => refresh(log), everyMs);
  if (timer.unref) timer.unref();
}

// tin còn hạn, chưa dùng ở bàn này (tin soạn tay và tin RSS ngang hàng)
function available(used = [], now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const cur = CURATED.filter(n => (!n.until || n.until >= day) && !used.includes(n.id));
  const fresh = rss.filter(n => !used.includes(n.id));
  return cur.concat(fresh);
}
// chọn một tin cho bàn: xoay vòng các mảng (giải trí, thể thao, văn hoá, xã hội, giáo dục, công nghệ, du lịch, vui),
// mảng nào bàn này lâu chưa nhắc thì được ưu tiên; trong mảng chọn ngẫu nhiên trong vài tin mới nhất.
function pickFor(used = [], recentCats = [], now = Date.now()) {
  const list = available(used, now);
  if (!list.length) return null;
  const by = {};
  for (const n of list) (by[n.cat || n.tag || 'khac'] = by[n.cat || n.tag || 'khac'] || []).push(n);
  const age = c => { const k = recentCats.lastIndexOf(c); return k < 0 ? Infinity : recentCats.length - k; };   // bao nhiêu tin trước đã nhắc mảng này
  const cats = Object.keys(by).sort(() => Math.random() - 0.5).sort((a, b) => age(b) - age(a));
  const pool = by[cats[0]].slice(0, 5);
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { CURATED, FEEDS, parseFeed, start, refresh, freshen, status, available, pickFor, BLOCK, _setRss: a => { rss = a; } };
