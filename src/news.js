// Tin thời sự cho máy góp chuyện (miễn phí, không cần API key).
//  - CURATED: tin nóng soạn tay (có hạn dùng), chỉ giải trí / thể thao / chuyện vui.
//  - RSS: server tự lấy tiêu đề mới từ VnExpress (giải trí, thể thao, công nghệ, xe, du lịch, cười) khi thức dậy,
//    khi có người mở app mà tin đã cũ hơn 20 phút, và định kỳ 45 phút;
//    lọc bỏ tin buồn, tai nạn, pháp luật, chính trị. Không có mạng thì chỉ dùng CURATED.

const CURATED = [
  { id: 'csmn', tag: 'showbiz', until: '2026-12-31', q: 'tối thứ Bảy ai xem Ca sĩ mặt nạ không, Trấn Thành đoán trúng được mấy mascot rồi?' },
  { id: 'csmn-negav', tag: 'showbiz', until: '2026-12-15', q: 'nghe nói Negav là người bị loại đầu tiên ở Ca sĩ mặt nạ, đúng không?' },
  { id: 'csmn-cosao', tag: 'showbiz', until: '2026-12-31', q: 'mascot Cô Sao ở Ca sĩ mặt nạ được Trấn Thành khen nức nở, mọi người đoán là ai?' },
  { id: 'csmn-bp', tag: 'showbiz', until: '2026-12-15', q: 'Bích Phương khóc vì nhận ra người quen sau mascot Mimibu, ai xem tập đó chưa?' },
  { id: 'toctien', tag: 'showbiz', until: '2026-12-10', q: 'Tóc Tiên vừa đứng thứ 3 Eurovision châu Á với bài Em Tiên, biết chưa?' },
  { id: 'atvncg', tag: 'showbiz', until: '2026-12-05', q: 'Anh trai vượt ngàn chông gai 2026 chung kết rồi, ai theo dõi không?' },
  { id: 'hhvn', tag: 'hoahau', until: '2026-12-20', q: 'Hoa hậu Việt Nam 2026 là Nguyễn Yến Trang, cô gái Hà Nội 20 tuổi, mọi người thấy sao?' },
  { id: 'missu', tag: 'hoahau', until: '2026-12-05', q: 'Miss Universe năm nay mấy thí sinh vấp ngã lúc diễn áo tắm, xem clip chưa?' },
  { id: 'tghp', tag: 'phim', until: '2026-12-20', q: 'phim Trại giam hạnh phúc của Tuấn Trần ra rạp 20/11, ai định đi xem không?' },
  { id: 'ngaycon', tag: 'phim', until: '2026-12-10', q: 'Ngày con còn mẹ đang dẫn đầu phòng vé đấy, ai xem chưa?' },
  { id: 'dtvn', tag: 'bongda', until: '2026-12-05', q: 'tuyển Việt Nam vừa đá giao hữu ở Thiên Trường với Đài Bắc Trung Hoa và Kyrgyzstan, ai xem không?' },
  { id: 'dinhbac', tag: 'bongda', until: '2027-01-31', q: 'Đình Bắc vô địch ASEAN Cup, lại còn vua phá lưới với cầu thủ hay nhất, đỉnh không?' },
  { id: 'asiancup', tag: 'bongda', until: '2027-01-31', q: 'Asian Cup 2027 tuyển mình đi được tới đâu nhỉ?' },
  { id: 'choxau', tag: 'vui', until: '2027-01-31', q: 'có hội Chó Xấu Việt Nam hơn 300 nghìn thành viên, ai vào xem chưa, cười đau bụng?' },
];

const FEEDS = [
  ['https://vnexpress.net/rss/giai-tri.rss', 'showbiz'],
  ['https://vnexpress.net/rss/the-thao.rss', 'bongda'],
  ['https://vnexpress.net/rss/so-hoa.rss', 'congnghe'],
  ['https://vnexpress.net/rss/oto-xe-may.rss', 'congnghe'],
  ['https://vnexpress.net/rss/du-lich.rss', 'anuong'],
  ['https://vnexpress.net/rss/cuoi.rss', 'vui'],
];

// Tin buồn, pháp luật, chính trị, chuyện riêng tư nhạy cảm → không đưa vào bàn bài
const BLOCK = /chết|tử vong|qua đời|thiệt mạng|tai nạn|nạn nhân|bắt giữ|bị bắt|khởi tố|truy nã|xét xử|án tù|ngồi tù|tù nhân|ma túy|ma tuý|cháy|hỏa hoạn|hoả hoạn|lũ|bão|động đất|sập|xâm hại|hiếp|giết|sát hại|đâm|chém|ung thư|bệnh|ốm|nhập viện|cấp cứu|tang|lừa đảo|chiến tranh|xung đột|quân sự|tên lửa|vũ khí|nga|ukraine|israel|gaza|iran|trung quốc|mỹ|đảng|quốc hội|bộ trưởng|thủ tướng|chủ tịch|tổng thống|bầu cử|ly hôn|ngoại tình|nợ|phá sản|tự tử|trầm cảm|bạo lực|nghi phạm|công an|cảnh sát|điều tra|phạt|kiện|scandal|tố cáo|sa thải|thất nghiệp|giảm giá vàng|chứng khoán/i;

let rss = [];          // [{id, tag, q, at}]
let timer = null, lastAt = 0, busy = false, lastErr = null;

function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// tách tiêu đề từ RSS, lọc, biến thành câu hỏi
function parseFeed(xml, tag) {
  const out = [];
  const items = String(xml || '').match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const t = decode((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    if (!t || t.length < 12 || t.length > 110 || BLOCK.test(t)) continue;
    out.push({ id: link || t, tag, q: `đọc báo thấy "${t}", mọi người biết chưa?` });
    if (out.length >= 8) break;
  }
  return out;
}

async function refresh(log) {
  if (typeof fetch !== 'function' || busy) return;
  busy = true; lastAt = Date.now();
  const all = [];
  for (const [url, tag] of FEEDS) {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'SamDua/1.0 (friends card game)' } });
      clearTimeout(to);
      if (r.ok) all.push(...parseFeed(await r.text(), tag));
    } catch (e) { lastErr = e.message; log && log('news', url, e.message); }
  }
  busy = false;
  if (all.length) { rss = all.map(x => Object.assign(x, { at: Date.now() })); lastErr = null; }
}
// có người mở app (tạo/vào phòng): tin cũ hơn 20 phút thì tải lại, không chờ
function freshen(log, maxAgeMs = 20 * 60 * 1000) { if (Date.now() - lastAt > maxAgeMs) refresh(log); }
function status() { return { items: rss.length, curated: CURATED.length, updated: lastAt ? new Date(lastAt).toISOString() : null, error: lastErr }; }

function start(log, everyMs = 45 * 60 * 1000) {
  if (timer) return;
  refresh(log);
  timer = setInterval(() => refresh(log), everyMs);
  if (timer.unref) timer.unref();
}

// tin còn hạn, chưa dùng ở bàn này; ưu tiên tin soạn tay, rồi tin RSS mới
function available(used = [], now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const cur = CURATED.filter(n => (!n.until || n.until >= day) && !used.includes(n.id));
  const fresh = rss.filter(n => !used.includes(n.id));
  return cur.concat(fresh);
}

module.exports = { CURATED, parseFeed, start, refresh, freshen, status, available, BLOCK, _setRss: a => { rss = a; } };
