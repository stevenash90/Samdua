# Sâm Lốc online

Game bài Sâm chơi theo phòng, 2–5 người, mỗi người dùng điện thoại/máy tính của mình. Thiếu người thì thêm máy.

## Chạy thử trên máy

Cần Node.js 16 trở lên, không phải cài thêm thư viện nào.

```
node server.js
```

Mở http://localhost:3000. Máy khác cùng wifi vào bằng `http://<IP-máy-bạn>:3000`.

## Đưa lên web riêng

Bất kỳ host nào chạy được Node đều dùng được (VPS, Render, Railway, Fly.io...):

- Lệnh chạy: `node server.js` (hoặc `npm start`)
- Cổng: đọc từ biến môi trường `PORT`, mặc định 3000
- Trên VPS có Nginx: proxy về cổng đó và tắt buffering cho đường `/events` (`proxy_buffering off;`) để cập nhật bàn chơi tức thì

Chỉ chạy **một** tiến trình: phòng chơi lưu trong bộ nhớ, khởi động lại server là mất phòng và điểm.

## Cách chơi

1. Một người bấm **Tạo phòng mới**, rồi **Sao chép link mời** gửi cho nhóm.
2. Mọi người mở link, nhập tên, bấm **Vào phòng**.
3. Chủ phòng bấm **Bắt đầu**. Hết ván, chủ phòng bấm **Ván mới**; điểm cộng dồn.

Mỗi lượt có 30 giây, hết giờ tự bỏ lượt (đang cầm cái thì máy đánh hộ). Ai rời giữa ván thì máy đánh thay.

## Chỉnh luật / điểm

Đầu file `server.js`:

| Hằng số | Ý nghĩa | Mặc định |
|---|---|---|
| `TURN_MS` | Thời gian mỗi lượt | 30000 |
| `SAM_MS` | Thời gian báo Sâm | 12000 |
| `PT_SAM` | Điểm Sâm (mỗi nhà) / đền Sâm | 20 |
| `PT_TRANG` | Điểm ăn trắng (mỗi nhà) | 20 |
| `PT_CONG` | Phạt cóng | 15 |
| `PT_CHAT` | Tứ quý chặt 2 | 10 |

Luật đang áp dụng: xem mục "Luật chơi tóm tắt" ở trang chủ của game.
