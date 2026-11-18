# Lời thoại người chơi (giọng Nam / Nữ)

Game tự phát thoại theo giới tính của từng người chơi (máy: Mai Thúy, Cô Tiên, Tún là giọng Nữ; các máy khác giọng Nam).
Chỉ cần thu âm (ElevenLabs hoặc tự thu), đặt đúng tên file, rồi chạy `python3 scripts/make_audio.py`.

- Giọng Nam: `assets/voice/players/m/<sự kiện>_<số>.mp3`
- Giọng Nữ:  `assets/voice/players/f/<sự kiện>_<số>.mp3`

Mỗi sự kiện có thể có nhiều câu (`_1`, `_2`, `_3`…); game chọn ngẫu nhiên và tránh lặp lại câu vừa nói.
Câu nên ngắn 0,5–2 giây. Thiếu file nào thì sự kiện đó im lặng, không lỗi.

| Sự kiện | Khi nào | Gợi ý câu Nam (`m/`) | Gợi ý câu Nữ (`f/`) |
|---|---|---|---|
| `play_1..3` | Đánh bài thường (chỉ thỉnh thoảng mới nói) | "Đỡ này!" · "Ra bài!" · "Chặn đi xem nào" | "Đỡ nè!" · "Em ra bài đây" · "Ai chặn được không?" |
| `chop_1..3` | Chặt 2 / chặt đè | "Chặt luôn!" · "Đứng im đó!" · "Hai này của anh!" | "Chặt nè!" · "Đâu có dễ vậy!" · "Hai này của em nha!" |
| `pass_1..3` | Bỏ lượt (chỉ thỉnh thoảng) | "Bỏ!" · "Thôi qua" · "Nhường đấy" | "Em bỏ" · "Qua đi" · "Nhường đó" |
| `baosam_1..2` | Báo Sâm | "Sâm! Ai cản nổi?" · "Báo Sâm nhé!" | "Báo Sâm nha!" · "Sâm rồi, cản em đi!" |
| `batsam_1..2` | Bắt Sâm thành công | "Bắt Sâm! Nộp tiền đây!" · "Sâm gì mà Sâm!" | "Bắt được rồi nha!" · "Sâm hụt rồi!" |
| `win_1..2` | Về nhất | "Về nhất! Đưa tiền đây" · "Quá dễ!" | "Em về nhất nha!" · "Dễ ợt!" |
| `lose_1..2` | Thua nặng nhất ván | "Cay thật sự" · "Ván sau gỡ!" | "Cay ghê á" · "Ván sau em gỡ!" |

Gửi file cho Claude (đặt tên theo bảng, hoặc ghi rõ câu nào là sự kiện nào) là được gắn vào game.
