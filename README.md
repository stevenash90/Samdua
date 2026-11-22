# Sâm Dứa 2.0

Game bài Sâm Lốc online chơi theo phòng, 2–5 người. Mỗi người dùng điện thoại hoặc máy tính của mình, thiếu người thì thêm máy.

## Tính năng

- **Luật bài**: rác, đôi, sám, tứ quý, sảnh (A-2-3 thấp nhất, Q-K-A cao nhất, không có K-A-2), **ba đôi thông**. Ba đôi thông A-2-3 hợp lệ; K-A-2 không hợp lệ.
- **Chặt**: tứ quý hoặc ba đôi thông chặt được một lá 2. **Ba đôi thông chỉ được đánh để chặt 2** (hoặc chặt đè ba đôi thông khác), không đánh khi cầm cái. Bộ cùng loại lớn hơn chặt đè được; bộ bằng nhau thì không. Chuỗi chặt đè nhiều tầng có hệ số x2.
- **Tính tiền** nằm trong module riêng (`src/scoring.js`). Mỗi khoản là một bút toán, chốt đúng một lần.
- Báo Sâm / bắt Sâm, cóng, thối 2, ăn trắng, báo 1, cấm để 2 về cuối.
- **Bàn bài**: bài đã đánh nằm lại trên bàn tới hết ván, mỗi người một khu. Ở vòng đang đánh, mọi bộ đều nhìn thấy, bộ mới nhất được làm nổi bật.
- **Kết thúc ván**: PLAY → REVEAL (giữ bộ bài cuối khoảng 2,8 giây) → RESULT, kèm bảng chi tiết tính tiền.
- **Xem lại cả ván** từ event log đã lưu: play/pause, tua 1x–4x, lùi/tiến từng nước, timeline đánh dấu các lần chặt, báo Sâm, tạm dừng.
- **Gợi ý AI** (chủ phòng bật/tắt): chỉ dùng thông tin công khai, không bao giờ tự đánh thay người chơi.
- **Chủ phòng**: tạm dừng/tiếp tục cả bàn (đồng hồ đóng băng), giới hạn tổng thời gian tạm dừng mỗi ván (hoặc không giới hạn), chuyển quyền, cho máy đánh thay người mất kết nối.
- **AFK**: cảnh báo sau 30 giây không tương tác. Người mất kết nối không bị tự bỏ lượt. Chủ phòng mất kết nối quá 20 giây thì quyền tự chuyển cho người khác.
- **Lưu bền vững**: PostgreSQL (hoặc file JSON khi chạy ở máy). Máy chủ khởi động lại giữa ván thì ván được giữ nguyên và tự tạm dừng.
- **Âm thanh**: hiệu ứng bài, chặt, Sâm, thắng/thua, thông báo, nhạc nền lounge, ambient, giọng đọc tiếng Việt (mặc định tắt), âm theo vị trí ghế. Từng nhóm có âm lượng riêng.
- Lịch sử ván, thống kê cá nhân, cài đặt (rung, giảm hiệu ứng, tiết kiệm hiệu năng).
- **Chat** trong phòng (người chơi và người xem), có câu nhanh; tin của người chơi hiện thành bong bóng cạnh ghế.
- **Người xem**: vào phòng bằng nút 👀 Xem (hoặc khi phòng đang chơi dở). Chỉ thấy bài công khai, chat được, không thao tác ván, không xem lại được ván. Còn chỗ thì bấm "Vào chơi" giữa các ván.
- **Đổi chỗ giải đen**: thua 10 ván liên tiếp thì được xin đổi chỗ (kể cả lúc đang chơi, nút trong menu ⋯). Người kia có 30 giây trả lời; đồng ý thì đổi chỗ từ ván sau. Có thoại "Đen quá, đổi chỗ phát!" / "Ok cưng!"; từ chối thì hiện câu đáp ngẫu nhiên.
- **Thống kê bàn** (nút 📊, mở được giữa ván): thắng/thua nhiều nhất, tỉ lệ thắng thua, báo Sâm, bắt Sâm, chặt, bị chặt, cóng, chuỗi xanh/đỏ hiện tại và dài nhất, lãi lỗ.
- **Máy nói chuyện**: 19 nhân vật máy có tính cách, quan hệ và chủ đề riêng (`src/platform/bots/personas.js`, chỉ dẫn đầy đủ ở `docs/NHAN_VAT.md`). Máy nói ít mà đúng lúc, đáp nhau và đáp người chơi, khơi chuyện thời sự (gói tin soạn sẵn + tiêu đề VnExpress tải miễn phí khi máy chủ thức dậy / có người mở app, đã lọc tin buồn và chính trị). Trong một bàn không máy nào nói lại câu đã nói. Chủ phòng tắt được.
- **Bàn 3D**: mặt nỉ nghiêng phối cảnh như ngồi tại bàn, viền gỗ, bài in 2 góc + khung J Q K, mặt lưng có hoa văn, bài trên tay xếp quạt. Điện thoại có chế độ màn ngang (nút ⟲). Cài đặt "Bài đã đánh trên bàn" (mặc định tắt) để hiện các bộ đã đánh.
- **Máy 2 mức Amateur / Pro** (mặc định Pro): Pro mô phỏng hàng trăm khả năng từ bài đã ra và bài trên tay (không nhìn trộm bài ai) để chọn nước lợi nhất; thử nghiệm thắng ~36% số ván trước 3 máy thường (đều nhau = 25%). Máy tự **báo Sâm có tính toán** khi khả năng thành công ≥ 70% (`src/aipro.js`).
- **Voice chat** kiểu Liên Quân: 🎧 nghe cả bàn, 🎙️ bật mic, đếm người trong voice + tắt tiếng riêng từng người, viền xanh quanh người đang nói. WebRTC nối thẳng giữa các máy; TURN lấy từ biến môi trường (Cloudflare / Metered / ExpressTURN…, xem `src/ice.js`). Người xem chỉ nghe.
- **Ma Sói** (game thứ 2, chọn khi tạo phòng): 5–12 người, thiếu thì thêm máy; vai Sói, Tiên tri, Bảo vệ, Phù thủy, Thợ săn, Dân làng chia theo số người. Đêm dân không chat được, Sói có kênh riêng, người chết chat kênh hồn ma, người xem chat kênh người xem (người chết đọc được; người xem không thấy vai cho tới khi hết ván); voice tự tắt mic ban đêm và khi đã chết. Máy suy luận theo kết quả soi, lời khai Tiên tri, chat của người chơi và phiếu bầu (máy Sói biết nhận Tiên tri giả). Đo bằng máy tự chơi: Sói thắng 43–58% ở mọi số người.
  - **Người dẫn truyện** (v3.4): 35 câu thu sẵn ở `public/games/masoi/voice/<mã>_<số>.mp3`, máy chủ chọn câu và bắt các bước chỉ-để-nghe (trời sáng, treo cổ) chờ đọc xong; bước cần thao tác được cộng thêm thời gian đọc. Thời lượng từng câu ở `src/games/masoi/narration.json` (thêm/đổi file thì đo lại). Nhạc nền lặp vòng ở `public/games/masoi/bgm/`, tự nhỏ đi khi đang đọc. Nút 🎙️/🎵 trên đầu màn để tắt riêng.
  - Voice theo luật (lọc ở cả máy gửi và máy nghe): ban ngày cả làng; ban đêm chỉ bầy Sói nghe nhau, dân im và không thấy ai đang bật mic; người chết chỉ nói với người chết; người xem chỉ nghe người sống ban ngày.
  - Ảnh vai (bộ Core 6) ở `public/games/masoi/roles/<vai>.webp`, vuông 480×480.
  - Ván có Phù thủy thì đêm nào cũng có lượt Phù thủy (kể cả khi bà đã chết) để không lộ. Sói treo máy không chọn ai thì bầy vồ ngẫu nhiên.
  - Nhạc: “Deep Horrors” – Kevin MacLeod (incompetech.com), CC BY 4.0.
- **Trang chủ (v3.6)**: hai ô chọn game Sâm Lốc / Ma Sói tạo phòng ngay; tên + avatar + giọng thu gọn thành một dòng khi đã đặt (bấm Sửa để mở); máy tính màn rộng chia 2 cột, bên phải là phòng đang mở. Enter ở ô mã phòng là vào chơi. Nút Tạo phòng luôn nằm dưới đáy màn khi form dài. Có viền sáng khi dùng bàn phím, nút biểu tượng có nhãn cho trình đọc màn hình.
- **Phòng đang mở**: trang chủ liệt kê các phòng công khai đang có người, bấm "Vào chơi" hoặc "👀 Xem" không cần mã. Chủ phòng bật "Phòng riêng tư" để ẩn.
- **Chat không đè bàn**: điện thoại hiện 2 dòng mới nhất ngay trên ô nhập, chạm để mở lịch sử; máy tính màn rộng có khung chat riêng bên phải bàn.
- **Đổi bộ bài mới**: người chơi đề nghị, chủ phòng quyết (chủ phòng tự đổi được). Bộ bài mới đổi kiểu mặt sau và viền; 5 kiểu xoay vòng.

## Tài khoản thành viên

- Đăng ký / đăng nhập bằng tên đăng nhập + mật khẩu (băm scrypt), hoặc **Google** (khi đã cấu hình `GOOGLE_CLIENT_ID`): tab Đăng ký có nút "Đăng ký bằng Google", tab Đăng nhập có "Đăng nhập bằng Google". Lần đầu dùng Google thì tự tạo tài khoản, lần sau vào đúng tài khoản đó.
- Tài khoản tạo bằng mật khẩu bấm **Liên kết Google** trong Hồ sơ để sau này đăng nhập được bằng cả hai cách. Tài khoản tạo bằng Google có thể **Đặt mật khẩu** (không bắt buộc) để đăng nhập bằng tên @… khi không dùng Google.
- Không đăng nhập vẫn chơi được (chế độ khách); lịch sử của khách gắn với trình duyệt.
- Hồ sơ: nickname, avatar, giới tính (quyết định giọng thoại). Cấu hình âm thanh/giọng đọc lưu theo tài khoản.
- Đăng nhập máy khác: thấy đủ lịch sử, thống kê, xem lại ván; đang ngồi trong phòng thì vào lại đúng ghế.
- Khi đăng ký/đăng nhập có thể gộp các ván đã chơi trên máy đó vào tài khoản.

### Bật đăng nhập Google

1. console.cloud.google.com → tạo project (ví dụ `samdua`).
2. **APIs & Services → OAuth consent screen** (giao diện mới gọi là **Google Auth Platform → Branding / Audience**): chọn External, điền tên app và email → lưu. Ở **Audience** bấm **Publish app** để ai cũng đăng nhập được (để Testing thì chỉ email trong Test users vào được). App chỉ xin `openid email profile` nên không phải chờ Google duyệt.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** (hoặc **Clients → Create client**) → Application type: **Web application** → Authorized JavaScript origins: `https://samdua-1.onrender.com` (thêm `http://localhost:3000` nếu muốn thử ở máy) → Create. Không cần Redirect URI.
4. Copy **Client ID** (dạng `xxxx.apps.googleusercontent.com`) → Render → service `samdua-1` → Environment → thêm `GOOGLE_CLIENT_ID` → Save (Render tự deploy lại).
5. Mở trang → bấm ô "Khách · Đăng nhập / Đăng ký" → thấy nút Google dưới dòng "— hoặc —" là xong. Đổi tên miền thì nhớ sửa lại mục 3 (lỗi `origin_mismatch` / `The given origin is not allowed` nghĩa là thiếu tên miền ở đây).

## Giọng đọc

- Hai bộ giọng thu sẵn: Nữ (`assets/voice/f/`) và Nam (`assets/voice/m/`).
- MC chọn giọng Nữ/Nam; người chơi nói bằng giọng theo giới tính của mình. Chi tiết câu nào ai đọc: `docs/LOI_THOAI.md`.
- Âm lượng riêng cho MC, giọng Nam, giọng Nữ, hiệu ứng, nhạc nền. Một kênh thoại duy nhất: không đọc chồng, câu quan trọng cắt câu thường, đánh bài/bỏ lượt chỉ thỉnh thoảng mới nói.

## Sao lưu định kỳ & cảnh báo

- `.github/workflows/backup.yml` chạy 02:00 mỗi ngày, xuất toàn bộ database, **mã hoá** rồi lưu 30 ngày ở GitHub → Actions → Artifacts. Cần 2 secret của repo: `DATABASE_URL`, `BACKUP_PASSWORD`. Chạy tay: Actions → "Sao lưu database" → Run workflow.
- Render → Settings → **Health Check Path** = `/health` (máy chủ trả 503 khi DB lỗi, Render tự khởi động lại và báo email).
- Cảnh báo khi web sập: tạo monitor miễn phí trên UptimeRobot trỏ vào `https://samdua-1.onrender.com/health` (5 phút/lần, báo email). Monitor này cũng giữ cho Render không ngủ.
- **Mật khẩu sao lưu**: repo đang công khai nên ai có tài khoản GitHub cũng tải được file sao lưu đã mã hoá. Đặt `BACKUP_PASSWORD` là chuỗi ngẫu nhiên **≥ 24 ký tự** (không dùng mật khẩu dễ đoán), hoặc chuyển repo sang Private.

## Bảo mật (v3.7)

Kiểm tra bảo mật tháng 11/2026, đã sửa:
- Đường dẫn sai định dạng (`/%`, `//`) không còn làm sập máy chủ; mọi phản hồi có header bảo mật (CSP, chống nhúng iframe, Referrer-Policy, Permissions-Policy).
- **Ma Sói**: Sói chọn ai chỉ gửi cho bầy Sói và người chết. **Người xem không thấy vai, kênh Sói, kênh hồn ma hay hành động đêm cho tới khi hết ván** (trước đây mở trình duyệt thứ hai bấm 👀 Xem là biết hết). Người xem chat ở kênh riêng (người chết đọc được). Voice lọc ở cả máy gửi và máy nghe; người xem không bao giờ nói được.
- Chống lạm dụng: mỗi kết nối WebSocket tối đa ~15 tin/giây (gửi dồn bị bỏ, quá nhiều thì ngắt); mỗi người tối đa 3 kết nối/phòng, mỗi IP tối đa 40; bật/tắt voice không ghi database; tạo phòng tối đa 10/phút/IP và 2000 phòng toàn máy chủ; phòng tạo ra mà không ai vào sau 5 phút thì dọn; nhập sai mã phòng 15 lần/phút thì khoá một phút (chống dò phòng riêng tư).
- Mật khẩu TURN chỉ cấp khi đang thật sự kết nối vào một phòng.
- Tài khoản: tên/avatar được làm sạch ở mọi đường vào; đổi mật khẩu thì đăng xuất các máy khác; có nút "Đăng xuất mọi thiết bị khác"; phiên hết hạn được dọn mỗi ngày.
- `/health` công khai chỉ trả `ok`/`version`/`storage`/`db`. Xem chi tiết: đặt biến `HEALTH_KEY` trên Render rồi mở `/health?key=<HEALTH_KEY>`.
- Giới hạn tần suất chỉ tin `CF-Connecting-IP` (bỏ `True-Client-IP` vì người dùng tự đặt được).

Biến môi trường mới (đều có mặc định, không bắt buộc đặt): `HEALTH_KEY`, `MAX_ROOMS`, `CREATE_PER_MIN`, `MISS_PER_MIN`, `ROOM_ORPHAN_MS`, `WS_RATE`, `WS_BURST`, `WS_MAX_DROPS`, `WS_PER_IP`, `WS_PER_PID`, `PG_SSL_VERIFY` (đặt `1` để kiểm tra chứng chỉ TLS của database — bật thử rồi xem `/health` còn `"db":"ok"`).

## Cấu trúc

```
server.js                 điểm khởi động → src/platform/server.js
src/platform/             nền tảng dùng chung: server, config, store, accounts, players, ice (voice), news, bots/personas
src/games/index.js        danh sách game
src/games/sam/            game Sâm Lốc: rules, scoring, ai, aipro, room, config
public/core/              trình duyệt – nền tảng: app.js, audio.js, voice.js, boot.js
public/games/sam/         trình duyệt – Sâm: game.js, decks/
test/platform, test/games/sam, test/e2e
(chi tiết & cách thêm game mới: docs/KIEN_TRUC.md)
```

## Chạy ở máy

```
npm install
npm start            # http://localhost:3000
npm test             # unit test
npm run test:e2e     # test đầu-cuối (file JSON); đặt TEST_DATABASE_URL để test với Postgres
```

Không đặt `DATABASE_URL` thì dữ liệu lưu ở thư mục `data/`.

## Triển khai trên Render

Service web hiện tại giữ nguyên:

- Build Command: `npm install`
- Start Command: `node server.js`
- Health Check Path (nên đặt): `/health`

### Bật lưu trữ bền vững (bắt buộc nếu không muốn mất phòng/điểm khi Render ngủ hoặc deploy)

Ổ đĩa của Render free bị xoá mỗi lần khởi động lại, nên phải dùng Postgres ngoài:

1. Tạo database miễn phí trên **Neon** (neon.tech). Gói Free không hết hạn. Render Postgres free bị xoá sau 30 ngày nên không dùng.
2. Copy connection string (dạng `postgresql://...neon.tech/neondb?sslmode=require`).
3. Trên Render: service → **Environment** → thêm biến `DATABASE_URL` = chuỗi vừa copy → Save. Render sẽ tự deploy lại.
4. Mở `https://<app>.onrender.com/health`, thấy `"storage":"postgres"` và `"db":"ok"` là xong.

Bảng dữ liệu được tạo tự động (migration chạy lúc khởi động).

### Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `DATABASE_URL` | Postgres; trống = file JSON | trống |
| `TURN_MS` | thời gian lượt mặc định (phòng tự chỉnh được) | 30000 |
| `SAM_MS` | thời gian báo Sâm | 12000 |
| `REVEAL_MS` | thời gian giữ bộ bài cuối | 2800 |
| `AFK_MS` | không tương tác bao lâu thì báo AFK | 30000 |
| `HOST_GRACE_MS` | chủ phòng mất kết nối bao lâu thì chuyển quyền | 20000 |
| `PAUSE_LIMIT_MS` | giới hạn tạm dừng mặc định mỗi ván | 600000 |
| `CROSS_CHOP` | `1` = tứ quý được đè ba đôi thông (chưa xác nhận luật) | 0 |
| `GOOGLE_CLIENT_ID` | bật nút đăng nhập Google | trống |
| `MIGRATE_FROM_URL` | chỉ dùng khi đổi database (vd. sang Singapore): đặt = database CŨ, máy chủ tự chép dữ liệu sang database mới nếu còn trống; chép xong thì xoá | trống |
| `TURN_KEY_ID` + `TURN_KEY_API_TOKEN` | TURN của Cloudflare cho voice | trống |
| `METERED_APP` + `METERED_API_KEY` | TURN của Metered / Open Relay | trống |
| `TURN_URLS` + `TURN_USERNAME` + `TURN_CREDENTIAL` | TURN bất kỳ (ExpressTURN…) | trống |
| `BOT_THINK_MS` | thời gian máy Pro tính mỗi nước | 90 |
| `BOT_NEWS` | `0` = không tải tin báo cho máy (chỉ dùng gói tin soạn sẵn) | bật |

Điểm/tiền (chặt 2, hệ số chặt đè, Sâm, ăn trắng, cóng, thối 2) do chủ phòng chỉnh khi tạo phòng.

## Vận hành

- **Sao lưu**: `DATABASE_URL=... npm run backup` → file `backup-<thời gian>.json` (đủ mọi bảng).
- **Kiểm tra sống**: `GET /health` trả `ok`, phiên bản, kiểu lưu trữ, trạng thái DB. Số phòng, số kết nối, TURN, nguồn IP: `/health?key=<HEALTH_KEY>`.
- **Quay lại bản trước**: trên Render chọn deploy cũ → *Rollback*. Hoặc `git revert` commit lỗi rồi push.
- **Sau khi máy chủ khởi động lại**: các ván đang chơi tự tạm dừng. Chủ phòng bấm **Tiếp tục** khi mọi người đã vào lại.

## Luật tiền chặt (mặc định)

- Chặt 2 một lần: người đánh 2 trả tiền chặt cho người chặt.
- Bị chặt đè: người đánh 2 ban đầu không mất gì; người bị đè trả `chặt × 2` cho người đè. Đè tầng tiếp theo nhân tiếp ×2.
- Chế độ "Đè cuối" (mặc định): chỉ mắt xích cuối được thanh toán. Chế độ "Mọi tầng": mỗi lần đè đều thanh toán.
- Tiền chặt được chốt khi hết vòng hoặc hết ván.
