# Kiến trúc — nền tảng board game

Từ v3.2, mã nguồn chia thành **nền tảng** (dùng chung cho mọi game) và **game** (luật, máy, giao diện bàn riêng). Hiện có 1 game: Sâm Lốc (`sam`).

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
public/
  index.html  style.css       khung giao diện
  core/                       ── NỀN TẢNG (trình duyệt) ──
    audio.js  voice.js        âm thanh, voice chat
    app.js                    mạng, tài khoản, trang chủ, phòng đang mở, tạo phòng, chat, cài đặt, lịch sử
    boot.js                   khởi động (nạp sau cùng)
  games/sam/                  ── GAME SÂM LỐC (trình duyệt) ──
    game.js                   lá bài, bàn, bài trên tay, kết quả, sự kiện ván, quản lý bàn, xem lại
    decks/<bộ>/*.webp         J Q K + mặt lưng của 4 bộ bài ảnh
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
`core/app.js` gọi các hàm game cung cấp: `onState(s, evs, first)`, `render()`, `renderLobby()`, `Replay`, `openReplay(id)`.

## Thêm một game mới (ví dụ Tiến Lên, Phỏm, Cờ tướng)

1. Tạo `src/games/<id>/` theo mẫu `sam/` (giữ đúng hợp đồng ở trên), thêm vào `src/games/index.js`.
2. Tạo `public/games/<id>/game.js`; khi có từ 2 game trở lên, `index.html` nạp `game.js` theo game của phòng (bước tiếp theo của lộ trình).
3. Test ở `test/games/<id>/`, thêm vào lệnh `npm test` nếu dùng thư mục mới (mặc định đã quét `test/games/*/`).

## Lộ trình còn lại (chưa làm, cần khi có game thứ hai)

- Trang chủ: chọn game khi tạo phòng; danh sách phòng hiện tên game.
- Tách phần dùng chung còn nằm trong `games/sam/room.js` (chat, người xem, chủ phòng, tạm dừng, AFK, voice) ra `src/platform/room-base.js` để game mới kế thừa.
- Tách `renderLobby`, form tạo phòng (phần điểm/luật là của Sâm) thành phần chung + phần cài đặt riêng của game.
- `style.css`: tách phần bàn/lá bài sang `public/games/sam/game.css`.
- Thống kê & lịch sử: thêm cột `game` trong bảng `games` của DB.
