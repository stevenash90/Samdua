# Giọng đọc (2 bộ: Nữ và Nam)

Mỗi bộ giọng là các file mp3 đặt tên theo câu:

- Giọng Nữ: `assets/voice/f/<câu>.mp3`
- Giọng Nam: `assets/voice/m/<câu>.mp3`

Chạy `python3 scripts/make_audio.py` để chuẩn hoá âm lượng, cắt khoảng lặng và xuất vào `public/audio/`.

## Ai đọc câu nào

- Câu gắn với một người chơi (ra bài, chặt, báo Sâm, bắt Sâm, Sâm thành công/thất bại): nếu bật **Thoại người chơi**, câu đó được đọc bằng giọng theo giới tính của người đó (máy Mai Thúy, Cô Tiên, Phương Oanh là Nữ; máy khác là Nam).
- Câu dẫn trò (bắt đầu ván, đến lượt, còn 5 giây, mời người tiếp theo) và mọi câu khi tắt thoại người chơi: **MC** đọc; chọn giọng MC Nữ/Nam trong Cài đặt.
- Bộ nào thiếu câu thì tự dùng câu của bộ kia.

## Danh sách câu

| Tên file | Khi nào | Nữ (`f/`) | Nam (`m/`) |
|---|---|---|---|
| `start` | Ván bắt đầu (MC) | thiếu | có |
| `turn` | Tới lượt bạn chặn bài (MC) | có | có |
| `invite` | Tới lượt bạn cầm cái (MC) | có | thiếu |
| `next` | Hết vòng, người khác cầm cái (MC) | có | thiếu |
| `play` | Ra bài thường (người chơi, thỉnh thoảng) | thiếu | có |
| `5s` | Lượt của bạn còn 5 giây (MC) | có | có |
| `sam` | Báo Sâm (người báo) | có | có |
| `catch` | Bắt Sâm (người bắt) | có | có |
| `samwin` | Sâm thành công (người báo) | có | có |
| `samfail` | Sâm bị bắt (người báo Sâm thất bại) | có | có |
| `chop1` | Chặt 2 (người chặt) | có | có |
| `chopde` | Chặt đè (người chặt) | có | có |
| `chopde2` | Chặt đè từ tầng 3 (người chặt) | có | có |
| `swapreq` | "Đen quá, đổi chỗ phát!" — người thua 10 ván liền xin đổi chỗ | thiếu | có |
| `swapyes` | "Ok cưng!" — người được xin đồng ý | thiếu | có |
| `swapno` | Người được xin từ chối (chưa có bản thu; hiện chữ ngẫu nhiên: "Ghế này phong thủy tốt, không đổi đâu!"…) | thiếu | thiếu |

Muốn thêm câu mới (ví dụ bỏ lượt, thắng, thua), gửi file kèm mô tả, Claude sẽ gắn vào sự kiện.
