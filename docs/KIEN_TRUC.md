# Kiến trúc — nền tảng board game

Từ v3.2, mã nguồn chia thành **nền tảng** (dùng chung cho mọi game) và **game** (luật, máy, giao diện bàn riêng). Hiện có 2 game: Sâm Lốc (`sam`) và Ma Sói (`masoi`, từ v3.3).

## Cây thư mục

```
server.js                     điểm khởi động (Render chạy: node server.js) → src/platform/server.js
src/
  platform/                   ── NỀN TẢNG ──
    server.js                 HTTP + API + WebSocket, danh sách phòng, phục vụ file tĩnh
    config.js                 cấu hình chung (cổng, DB, thời gian phòng, Google, DEFAULT_GAME)
    store.js  migrate.js      lưu trữ Postgres/File, chuyển DB
    accounts.js               tài khoản, phiên, Google
    players.js                pid, làm sạch tên/avatar/chat
    room-base.js              lớp phòng nền cho game mới (người chơi, người xem, chủ phòng, chat theo kênh, voice, lưu/khôi phục)
    ice.js                    STUN/TURN cho voice
    news.js                   tin thời sự cho máy chat
    bots/personas.js          19 nhân vật máy (tính cách, câu thoại) — dùng được cho mọi game
  games/
    index.js                  danh sách game: get(id), list()
    sam/                      ── GAME SÂM LỐC ──
      index.js                mô tả game {id, name, minPlayers, maxPlayers, Room, normalizeSettings}
      config.js               cấu hình riêng (10 lá, thời gian báo Sâm, máy…), kế thừa platform/config
      rules.js scoring.js     luật bài, tính tiền
      ai.js aipro.js          máy Amateur / Pro, báo Sâm
      room.js                 phòng & ván (state machine), chat máy, voice, đổi chỗ, bộ bài
    masoi/                    ── GAME MA SÓI ── (kế thừa platform/room-base.js)
      roles.js                vai & chia vai theo số người
      room.js                 đêm → Phù thủy → sáng → thảo luận → bỏ phiếu → treo cổ; kênh chat all/wolf/ghost
      ai.js                   máy chơi theo độ nghi (soi, lời khai Tiên tri, chat người chơi, phiếu bầu)
public/
  index.html  style.css       khung giao diện
  core/                       ── NỀN TẢNG (trình duyệt) ──
    audio.js  voice.js        âm thanh, voice chat
    app.js                    mạng, tài khoản, trang chủ, phòng đang mở, tạo phòng, chat, cài đặt, lịch sử
    boot.js                   khởi động (nạp sau cùng)
  games/sam/                  ── GAME SÂM LỐC (trình duyệt) ──
    game.js                   lá bài, bàn, bài trên tay, kết quả, sự kiện ván, quản lý bàn, xem lại
    decks/<bộ>/*.webp         J Q K + mặt lưng của 4 bộ bài ảnh
  games/masoi/                ── GAME MA SÓI (trình duyệt) ── game.js, game.css (màn #sMasoi)
  audio/                      giọng đọc + hiệu ứng
test/
  platform/                   test nền tảng
  games/sam/                  test luật, máy, phòng Sâm
  e2e/                        test máy chủ thật qua WebSocket
```

## Hợp đồng giữa nền tảng và game

**Máy chủ** — `src/games/<id>/index.js` xuất `Room` có các hàm nền tảng gọi tới:

| Nhóm | Hàm |
|---|---|
| Người | `addHuman(token, name, av, ident)`, `addSpectator(...)`, `who(token)`, `idxOf(pid)`, `specIdx(pid)`, `humans()`, `connect(pid)`, `disconnect(pid)`, `removeSpectator(pid)` |
| Hành động | `handle(pid, msg)` → `{err?}` (gồm cả chat `chat`, voice `vjoin/vmic/vleave`) |
| Trạng thái | `view(i, role)` (phải có `game: '<id>'`), `eventsFor(i)`, `listing()` cho trang chủ |
| Vòng đời | `commit()`, `publish()`, `tick()`, `close()`, `snapshot()` (phải có `game`), `static restore(snap, deps)` |
| Voice | `voice` (Map), `vidOf(pid)` |

Phòng tạo qua API `create` với `game: '<id>'` (bỏ trống = `DEFAULT_GAME`). Phòng lưu cũ không có `game` được coi là `sam`.

**Trình duyệt** — script thường (không module), dùng chung phạm vi toàn cục, nạp theo thứ tự:
`core/audio.js → core/voice.js → core/app.js → games/<id>/game.js → core/boot.js`.
Mỗi game tự đăng ký `GAMES[id] = { name, onState(s, evs, first), leave() }`; nền tảng chuyển trạng thái phòng tới đúng game theo `s.game`.

**Lưu ý khi gửi lệnh:** `act(a, data)` — `data` không được dùng các tên trường `t`, `a`, `cid` (đã chặn ghi đè từ v3.3, game dùng `target` để chỉ người được chọn).

## Thêm một game mới (ví dụ Tiến Lên, Phỏm, Cờ tướng)

1. Tạo `src/games/<id>/` theo mẫu `sam/` (giữ đúng hợp đồng ở trên), thêm vào `src/games/index.js`.
2. Tạo `public/games/<id>/game.js`; khi có từ 2 game trở lên, `index.html` nạp `game.js` theo game của phòng (bước tiếp theo của lộ trình).
3. Test ở `test/games/<id>/`, thêm vào lệnh `npm test` nếu dùng thư mục mới (mặc định đã quét `test/games/*/`).

## Lộ trình còn lại (chưa làm, cần khi có game thứ hai)

- ~~Trang chủ: chọn game khi tạo phòng; danh sách phòng hiện tên game.~~ (xong ở v3.3)
- Chuyển `games/sam/room.js` sang kế thừa `src/platform/room-base.js` như Ma Sói (hiện Sâm vẫn tự chứa phần chung).
- Tách `renderLobby`, form tạo phòng (phần điểm/luật là của Sâm) thành phần chung + phần cài đặt riêng của game.
- `style.css`: tách phần bàn/lá bài sang `public/games/sam/game.css`.
- Thống kê & lịch sử: thêm cột `game` trong bảng `games` của DB.
