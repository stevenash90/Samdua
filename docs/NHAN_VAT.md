# Sâm Dứa — Chỉ dẫn nhân vật máy

> File này sinh tự động từ `src/botchat.js` (chạy `node scripts/nhan_vat.js`). Muốn sửa câu thoại, sửa trong `src/botchat.js` rồi chạy lại.

Các nhân vật là **bản nhại hư cấu**, lấy cảm hứng từ người nổi tiếng để mua vui trong nhóm bạn: nói đùa nhẹ, không bôi nhọ, không bàn chính trị thật.

## Máy nói chuyện thế nào

- **Ít mà đúng lúc.** Máy chỉ nói khi có chuyện: vào ván, chặt hoặc bị chặt, ra bộ đẹp, có người báo Sâm, thắng thua, bị gọi tên, có người chat.
- **Nhịp độ.** Trong lúc đánh, hai câu máy cách nhau ít nhất 5 giây. Cả bàn có ngân sách khoảng *2 + 2 × số máy* câu mỗi ván; mỗi máy có trần riêng (cột "Tối đa/ván"). Máy nào cả ván im lặng thì cuối ván góp một câu thắng/thua.
- **Không lặp.** Trong một bàn, không máy nào nói lại câu đã nói, kể cả qua nhiều ván và khi máy chủ khởi động lại. Hết câu thì máy im chứ không lặp.
- **Đối đáp.** Máy A vừa nói, máy B có quan hệ với A (cột "Quan hệ") thường đáp lại. Người chơi gọi tên máy thì máy đáp; người chơi nhắc chủ đề (bóng đá, show, phim, hoa hậu, ăn uống, công nghệ…) thì máy mê chủ đề đó góp chuyện. Mỗi tin nhắn của người chơi chỉ một máy đáp.
- **Thời sự.** Mỗi ván tối đa một lần, một máy khơi chuyện tin nóng; 1–2 máy khác góp ý kiến theo tính cách. Tin lấy từ gói tin soạn sẵn (bên dưới) và tiêu đề báo VnExpress tải miễn phí mỗi lần máy chủ thức dậy / có người mở app (tin cũ quá 20 phút thì tải lại), đã lọc bỏ tin buồn, tai nạn, pháp luật, chính trị. Mỗi tin chỉ nhắc một lần ở mỗi bàn.
- **Tắt được.** Chủ phòng tắt "Máy nói chuyện" ở form tạo phòng hoặc menu ⋯, kể cả giữa ván.

## Danh sách

| | Nhân vật | Giọng | Cảm hứng | Tối đa/ván | Chủ đề ruột | Số câu soạn sẵn |
|---|---|---|---|---|---|---|
| 💅 | **Chị Phiến** | Nam | Hình mẫu gymer điệu đà | 6 | Chuyện vui, Showbiz | 42 |
| 😭 | **Thành Cry** | Nam | MC nổi tiếng hay khóc trên sóng truyền hình | 7 | Showbiz, Phim | 41 |
| 🐉 | **A Long River** | Nam | Danh hài sân khấu chuyên tấu hài | 7 | Chuyện vui, Hoa hậu | 37 |
| 🧚 | **Cô Tiên** | Nữ | Người đẹp mê làm từ thiện | 5 | Chuyện vui, Ăn uống | 34 |
| 🎲 | **Ri Đỗ** | Nam | Siêu sao bóng đá mê ăn mừng "Siuuu" | 6 | Bóng đá | 42 |
| 💄 | **Hà Linh** | Nữ | Hot girl TikToker, KOL, KOC | 3 | Showbiz, Ăn uống | 30 |
| 🦈 | **Shark Bình** | Nam | Nhà đầu tư công nghệ trên truyền hình | 6 | Công nghệ | 40 |
| 🎬 | **Phương Oanh** | Nữ | Diễn viên truyền hình, vợ của Shark Bình | 5 | Ăn uống, Phim | 35 |
| 🌼 | **Mai Thúy** | Nữ | Cựu hoa hậu cao 1m85 | 6 | Hoa hậu, Showbiz | 43 |
| 🐐 | **M10** | Nam | Danh thủ áo số 10 người Argentina | 3 | Bóng đá | 32 |
| 💵 | **Đô 500** | Nam | Tổng thống doanh nhân nổi tiếng nói to, tóc vàng | 6 | Chuyện vui, Hoa hậu | 42 |
| 🌻 | **Người Mỹ gốc U Cà** | Nam | Nguyên thủ từng là diễn viên hài, luôn mặc áo phông xanh | 5 | Showbiz, Phim | 39 |
| 🎖️ | **Big Kim** | Nam | Nhà lãnh đạo tối cao với kiểu tóc đặc trưng | 5 | Công nghệ, Chuyện vui | 38 |
| 🚀 | **Tesla Driver** | Nam | Tỉ phú xe điện và tên lửa mê meme | 6 | Công nghệ | 41 |
| 🥽 | **Mark Zúc** | Nam | Ông chủ mạng xã hội xanh dương, mê metaverse | 4 | Công nghệ | 34 |
| 💌 | **Tay Lơ** | Nữ | Nữ hoàng nhạc pop, chuyên viết nhạc về người yêu cũ | 5 | Showbiz | 34 |
| 🛒 | **Jack Mã** | Nam | Tỉ phú thương mại điện tử, cựu thầy giáo tiếng Anh | 4 | Công nghệ, Chuyện vui | 32 |
| 🍳 | **Đầu Bếp Gầm** | Nam | Siêu đầu bếp nóng tính trên truyền hình | 6 | Ăn uống | 38 |
| 🧸 | **Ông Đậu** | Nam | Nhân vật hài câm ôm gấu bông nổi tiếng | 3 | Chuyện vui | 31 |

## 💅 Chị Phiến

**Tiểu sử:** Gymer cơ bắp cuồn cuộn nhưng tâm hồn bánh bèo, xưng "chị", gọi mọi người là "cưng", "bé".

**Giọng điệu:** Nói như con gái, nhiều "ui", "trời ơi", "xỉu", hay khoe cơ và lịch tập, dỗi nhanh mà cũng thương nhanh.

**Gọi tên bằng:** `chị phiến`, `phiến` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🎲 **Ri Đỗ** → “Ui anh Đỗ cơ bụng 6 múi, chị xỉu 😍” · “Anh Đỗ ơi tập chung với chị không?”
- 😭 **Thành Cry** → “Thôi nín đi bé, chị thương 🫂” · “Khóc hoài xấu đó cưng, lau nước mắt đi.”
- 🌼 **Mai Thúy** → “Chị Thúy ơi da chị dùng gì mà đẹp vậy?”
- 🍳 **Đầu Bếp Gầm** → “Anh bếp quát gì dữ vậy, làm chị giật mình rớt mi 😤”

**Câu mẫu:**

- *Vào ván:* “Ui các bé ơi, chị vừa tập gym xong, tay to mà vẫn xinh nha 💅” · “Vào ván thôi mấy cưng, chị ra tay là sang chảnh liền.”
- *Chặt người khác:* “Chặt cái đét luôn, cơ tay chị không phải để trưng đâu nha 💪💅” · “Sorry cưng {victim}, chị chặt nhẹ như vuốt tóc thôi.”
- *Bị chặt:* “Ủa alo, ai cho {chopper} chặt chị? Dỗi rồi á 😤” · “Trời ơi chặt chị luôn hả, đau như rớt tạ vô chân.”
- *Ra bộ đẹp:* “Bộ này căng như bắp tay chị nè 💪” · “Ra bài mà phải có thần thái nha các bé.”
- *Có người báo Sâm:* “Báo Sâm luôn hả, gắt quá trời ơi.” · “Chị run tới mức rớt mi giả luôn nè.”
- *Thắng:* “Thắng rồi nha, tối nay chị đãi cả bàn trà sữa ít đường 💅” · “Thấy chưa, vừa có cơ vừa có não.”
- *Thua:* “Thua thì về tập thêm hiệp nữa, có gì đâu.” · “Ui chị thua hả, chắc tại chị lo selfie quá 🤳”
- *Bị gọi tên:* “Gọi chị chi đó cưng 💅” · “Dạ chị nghe nè, nói lẹ chị còn đi tập.”
- *Đáp người khác:* “{speaker} nói chuẩn luôn á cưng 💅” · “Ui {speaker} dễ thương ghê, chị cho 10 điểm.”
- *Khơi chuyện thời sự:* “Mấy bé ơi, {q}” · “Hóng nè: {q}”
- *Ý kiến về showbiz:* “Trời ơi show đó chị coi mà la hét quá trời luôn.” · “Mascot nào cũng dễ thương, chị muốn ôm hết á.”
- *Ý kiến về chuyện vui:* “Haha chị cười rớt mi luôn á 🤣”

## 😭 Thành Cry

**Tiểu sử:** MC kiêm cố vấn game show, mau nước mắt, đang ngồi ghế cố vấn Ca sĩ mặt nạ mỗi tối thứ Bảy.

**Giọng điệu:** Than thở, sụt sùi, tự ái, kể chuyện cười nhạt rồi tự cười, hay nhắc show mình đang làm.

**Gọi tên bằng:** `thành cry`, `cry`, `anh thành` · **Tối đa:** 7 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 💅 **Chị Phiến** → “Chị Phiến ôm em cái 😭”
- 🎲 **Ri Đỗ** → “Anh Đỗ đừng chê em nữa huhu.”
- 💌 **Tay Lơ** → “Chị Tay Lơ hát bài buồn cho em nghe với 😭”
- 🍳 **Đầu Bếp Gầm** → “Anh quát em là em khóc thật đó 😭”
- 🎖️ **Big Kim** → “Anh Kim nhìn em ghê quá, em sợ 😭”

**Câu mẫu:**

- *Vào ván:* “Huhu ván mới rồi, xin ông trời thương con lần này.” · “Bài chưa chia mà tim em đã đau rồi 😭”
- *Chặt người khác:* “Lần đầu tiên trong đời em được chặt, cảm động quá huhu 😭” · “Em xin lỗi {victim} nhé, em cũng không muốn đâu… thật ra là muốn.”
- *Bị chặt:* “Huhu sao lại chặt em, em đã làm gì nên tội 😭” · “{chopper} ơi tim em vỡ thành ba đôi thông rồi.”
- *Ra bộ đẹp:* “Bài đẹp thế này chắc em sắp xỉu vì hạnh phúc.” · “Mọi người ơi em đánh được bộ này nè, khen em đi 🥹”
- *Có người báo Sâm:* “Báo Sâm á? Em run quá mọi người ơi 😰” · “Ai báo Sâm vậy, nhẹ tay với em nha huhu.”
- *Thắng:* “Em thắng thật á? Em khóc vì vui đây 😭😭” · “Cảm ơn bố mẹ, cảm ơn ekip, cảm ơn bộ bài.”
- *Thua:* “Thua nữa rồi… cho em xin một cái ôm 😭” · “Chắc em sinh ra là để thua thôi mọi người ạ.”
- *Bị gọi tên:* “Huhu {speaker} nói thế em buồn lắm đó 😢” · “Gọi em làm gì, em đang bận khóc.”
- *Đáp người khác:* “{speaker} nói câu này làm em xúc động quá 😭” · “Kể chuyện cười cho {speaker} nghe nha: bài em. Hết.”
- *Khơi chuyện thời sự:* “Mọi người ơi, {q}” · “Em hỏi thật nha: {q}”
- *Ý kiến về showbiz:* “Tối thứ Bảy em ngồi ghế cố vấn Ca sĩ mặt nạ, đoán sai mà vẫn khóc 😭” · “Mascot hát hay quá em nghe mà rơi nước mắt luôn.”
- *Ý kiến về phim:* “Phim nào cũng làm em khóc, kể cả phim hài.” · “Phim Tết năm sau em làm tiếp, mọi người ủng hộ em nha 🥹”

## 🐉 A Long River

**Tiểu sử:** Danh hài lẻo mép, chỗ nào có người đẹp là có mặt, tán tỉnh ai cũng thả câu.

**Giọng điệu:** Pha trò liên tục, thả thính người chơi nữ ({female}), tự khen mình đẹp trai, bị từ chối thì cười xoà.

**Gọi tên bằng:** `long river`, `long`, `river` · **Tối đa:** 7 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🌼 **Mai Thúy** → “Chị Thúy cao 1m85, anh đứng cạnh chắc phải kê ghế.” · “Chị Thúy nói kháy mà anh nghe vẫn thấy ngọt.”
- 🎬 **Phương Oanh** → “Oanh ơi anh đùa thôi, anh Bình đừng nhìn anh thế 😅”
- 💄 **Hà Linh** → “Hà Linh cho anh xin link live với 😉”
- 💌 **Tay Lơ** → “Tay Lơ ơi, viết bài về anh đi, anh chịu được.”
- 🦈 **Shark Bình** → “Anh Bình bình tĩnh, em chỉ khen vợ anh thôi mà 😅”

**Câu mẫu:**

- *Vào ván:* “Chào cả nhà, đặc biệt là em {female} xinh đẹp 😉” · “Ván mới, tình mới, bài mới!”
- *Chặt người khác:* “Chặt bài nhưng không chặt đứt tình cảm nha {victim} 😆” · “Anh chặt nhẹ thôi mà, như cái nhéo yêu.”
- *Bị chặt:* “Em {chopper} chặt anh đau thế, bù cho anh một cái like đi.” · “Bị chặt rồi, ai chữa lành cho anh không?”
- *Ra bộ đẹp:* “Bộ này đẹp như nụ cười em {female} vậy.” · “Đánh bài cũng phải có phong cách, giống như anh.”
- *Có người báo Sâm:* “Báo Sâm à, có ai báo yêu anh không?” · “Ván này căng như dây đàn, mà đàn anh chơi cũng hay lắm.”
- *Thắng:* “Thắng bài rồi, giờ chỉ còn thiếu thắng tim em {female} nữa thôi 😎” · “Thắng nhưng khiêm tốn, như con người anh.”
- *Thua:* “Thua bài thôi chứ không thua tình nha {female}.” · “Anh thua để mọi người vui, đúng không 😅”
- *Bị gọi tên:* “Gọi anh hả, em {female} nhớ anh à 😏” · “Anh đây, cần gì cứ nói, trừ tiền.”
- *Đáp người khác:* “{speaker} nói câu này anh phải ghi vào sổ tấu hài.” · “Haha {speaker} có duyên ghê, đi diễn với anh không?”
- *Khơi chuyện thời sự:* “Kể nghe chuyện này: {q}” · “Các em ơi, {q}”
- *Ý kiến về hoa hậu:* “Hoa hậu năm nay xinh, nhưng em {female} ngồi đây cũng đâu kém.” · “Anh định đi thi Nam vương, sợ người ta buồn nên thôi.”
- *Ý kiến về chuyện vui:* “Haha câu này anh xin bản quyền nha.”

## 🧚 Cô Tiên

**Tiểu sử:** Tiểu thư dịu dàng, đi đâu cũng kêu gọi từ thiện, ai giàu là xin ủng hộ quỹ.

**Giọng điệu:** Nói ngọt, nhiều "dạ", "ạ", khen tất cả mọi người, thảo mai đúng chuẩn, cái gì cũng quy về từ thiện.

**Gọi tên bằng:** `cô tiên` · **Tối đa:** 5 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🦈 **Shark Bình** → “Anh Bình giàu thế, ủng hộ quỹ từ thiện của em nha 🥰”
- 💵 **Đô 500** → “Dạ ngài Đô vĩ đại quá ạ, ngài có muốn làm từ thiện không ạ?”
- 🛒 **Jack Mã** → “Dạ anh Mã tốt bụng quá, em cảm ơn anh ạ 🙏”
- 😭 **Thành Cry** → “Thành đừng khóc, em thương 🥺”
- 🌻 **Người Mỹ gốc U Cà** → “Dạ quỹ của em vẫn còn suất cho anh ạ 🙏”

**Câu mẫu:**

- *Vào ván:* “Chúc cả nhà một ván thật vui và may mắn nha ạ 🧚” · “Anh chị chơi nhẹ nhàng với em nhé, em hiền lắm ạ.”
- *Chặt người khác:* “Em xin lỗi {victim} ạ, em chặt nhẹ thôi, tiền này em đem đi từ thiện ạ 🙏” · “Ôi em lỡ tay chặt mất rồi, anh chị đừng giận em nha.”
- *Bị chặt:* “Không sao đâu ạ, {chopper} chặt đẹp quá em phục luôn 🥰” · “Em bị chặt mà vẫn thấy vui vì được chơi cùng anh chị ạ.”
- *Ra bộ đẹp:* “Hihi em may mắn thôi ạ, anh chị mới là cao thủ.” · “Bộ này em được bà tiên mách đó ạ.”
- *Có người báo Sâm:* “Ôi báo Sâm luôn, anh chị giỏi quá ạ 👏” · “Em cầu nguyện cho người báo Sâm ạ.”
- *Thắng:* “Em cảm ơn cả nhà ạ, tiền thắng em gửi quỹ từ thiện hết nha 🧚” · “Em thắng là nhờ anh chị nhường em thôi ạ.”
- *Thua:* “Thua cũng vui ạ, coi như em làm từ thiện cho {winner} 🥰” · “{winner} giỏi quá, em ngưỡng mộ ghê.”
- *Bị gọi tên:* “Dạ em đây ạ, anh chị cần gì em giúp ạ 🥰” · “Dạ vâng ạ, em nghe ạ.”
- *Đáp người khác:* “Dạ {speaker} nói đúng quá ạ 🥰” · “{speaker} ơi, câu này em thấy thấm lắm ạ.”
- *Khơi chuyện thời sự:* “Dạ cả nhà ơi, {q}” · “Em hỏi nhỏ ạ: {q}”
- *Ý kiến về ăn uống:* “Dạ cuối tuần em nấu cơm tặng bà con, ai đi cùng em không ạ?”
- *Ý kiến về chuyện vui:* “Dạ hihi, vui quá ạ 🥰”

## 🎲 Ri Đỗ

**Tiểu sử:** Siêu sao sân cỏ, tự tin tuyệt đối, kỷ luật thép, coi mình là số một mọi thứ.

**Giọng điệu:** Quyết đoán, khoe khoang, ích kỷ, đổ lỗi đồng đội, ăn mừng "Siuuu", nói ngắn gọn như ra lệnh.

**Gọi tên bằng:** `ri đỗ`, `rì đỗ`, `ri do`, `anh đỗ`, `siuuu` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🐐 **M10** → “M10 à? Đếm bàn thắng đi, tôi nhiều hơn.” · “GOAT chỉ có một, và nó đang ngồi đây. Siuuu!”
- 💅 **Chị Phiến** → “Chị Phiến tập ngực bao nhiêu ký? Tôi gấp đôi.”
- 💵 **Đô 500** → “Ông Đô, tôi nhiều follower hơn ông.”
- 😭 **Thành Cry** → “Khóc ít thôi, tập luyện nhiều vào.”

**Câu mẫu:**

- *Vào ván:* “Siuuu! Ván này tôi ghi bàn trước.” · “Đưa bài cho tôi, tôi gánh cả đội.”
- *Chặt người khác:* “Siuuuuu! Cú chặt đẹp nhất mùa giải.” · “Tôi không chặt, tôi kết liễu. {victim} về ngồi dự bị đi.”
- *Bị chặt:* “Trọng tài đâu? Rõ ràng là phạm lỗi!” · “Chặt tôi à? Ván sau tôi đáp trả gấp đôi.”
- *Ra bộ đẹp:* “Bộ này tôi tập ở sân từ năm 6 tuổi.” · “Cú này đáng được lên highlight.”
- *Có người báo Sâm:* “Báo Sâm? Phải để tôi báo mới đúng.” · “Để tôi bắt Sâm cho xem.”
- *Thắng:* “Siuuu! Lại là tôi, cầu thủ xuất sắc nhất ván.” · “Thắng là chuyện bình thường, ghi vào lịch sử đi.”
- *Thua:* “Đồng đội không chuyền bài cho tôi.” · “Tôi thua là do mặt sân xấu.”
- *Bị gọi tên:* “Muốn xin chữ ký thì xếp hàng.” · “Nói nhiều làm gì, nhìn tôi đánh đây.”
- *Đáp người khác:* “{speaker} nói được đấy, nhưng tôi nói hay hơn.” · “Đồng ý với {speaker}. Hiếm khi tôi đồng ý đâu.”
- *Khơi chuyện thời sự:* “Nghe này: {q}” · “{q} Tôi biết hết, tôi là siêu sao.”
- *Ý kiến về bóng đá:* “Tuyển Việt Nam đá hay, nhưng thiếu một người như tôi.” · “Vua phá lưới à? Gọi tôi là hoàng đế phá lưới.”

## 💄 Hà Linh

**Tiểu sử:** Hot girl TikTok xinh, hiền, ngoan, ít nói, hay đang live hoặc đang review mỹ phẩm.

**Giọng điệu:** Câu ngắn, lễ phép, "dạ ạ", hay nói chuyện lạc đề (son, livestream, đồ ăn, thời tiết).

**Gọi tên bằng:** `hà linh`, `linh` · **Tối đa:** 3 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🥽 **Mark Zúc** → “Dạ em có live bên đó nữa ạ 🌸”
- 🌼 **Mai Thúy** → “Dạ em cảm ơn chị ạ 🥺”
- 🐉 **A Long River** → “Dạ link live em để ở bio ạ 🌸”

**Câu mẫu:**

- *Vào ván:* “Chào mọi người ạ 🌸” · “Em chơi ván này nha.”
- *Chặt người khác:* “Em xin lỗi ạ 🥺” · “Ơ em chặt được kìa.”
- *Bị chặt:* “Dạ không sao ạ.” · “Huhu 🥺”
- *Ra bộ đẹp:* “Em đánh đúng không ạ?”
- *Có người báo Sâm:* “Ôi báo Sâm ạ 😮”
- *Thắng:* “Em thắng rồi ạ, cảm ơn mọi người 🌸” · “Hihi em may mắn thôi ạ.”
- *Thua:* “Dạ em thua rồi ạ.” · “Ván sau em cố gắng hơn ạ.”
- *Bị gọi tên:* “Dạ em đây ạ 🌸” · “Dạ vâng ạ.”
- *Đáp người khác:* “Dạ ạ 🌸” · “Hihi {speaker} vui tính ghê ạ.”
- *Khơi chuyện thời sự:* “Mọi người ơi, {q} 🌸” · “Em vừa lướt thấy: {q}”
- *Ý kiến về showbiz:* “Dạ em có review show đó trên TikTok, nhiều view lắm ạ.”
- *Ý kiến về ăn uống:* “Em vừa thử món chè mới, ngon lắm ạ.” · “Tối nay em live mukbang, mọi người vào xem nha 🌸”

## 🦈 Shark Bình

**Tiểu sử:** Nhà đầu tư công nghệ, chồng diễn viên Phương Oanh. Khoe tiền, khoe vợ, nói chuyện bằng thuật ngữ startup.

**Giọng điệu:** Trịch thượng kiểu đại gia, câu nào cũng có "đầu tư", "tỉ", "công nghệ", và nhắc vợ đẹp nấu ăn ngon.

**Gọi tên bằng:** `shark bình`, `shark`, `anh bình` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🎬 **Phương Oanh** → “Vợ anh nói đúng, vợ anh luôn đúng.” · “Tối nay vợ nấu gì đấy em?”
- 🐉 **A Long River** → “Long, tránh xa vợ anh ra.” · “Long nói thêm câu nữa là anh mua luôn sân khấu của chú.”
- 🚀 **Tesla Driver** → “Tên lửa của chú bán trả góp không?”
- 🛒 **Jack Mã** → “Anh Mã, em pitch cho anh dự án này nhé.”
- 🧚 **Cô Tiên** → “Được rồi Tiên, anh ủng hộ quỹ, nhớ ghi tên anh to vào.”

**Câu mẫu:**

- *Vào ván:* “Ván này anh đặt nhẹ thôi, vài tỉ cho vui.” · “Anh vừa ký xong cái hợp đồng, giờ đánh bài xả stress.”
- *Chặt người khác:* “Anh chặt bằng thuật toán đấy, AI anh tự viết.” · “Đầu tư đúng chỗ là lãi to, như cú chặt này.”
- *Bị chặt:* “Không sao, anh coi như khoản đầu tư mạo hiểm.” · “{chopper} chặt anh à? Mai anh mua luôn công ty của em.”
- *Ra bộ đẹp:* “Bộ này anh tính bằng big data rồi.” · “Đánh bài cũng phải có tầm nhìn tỉ đô.”
- *Có người báo Sâm:* “Báo Sâm à, rủi ro cao lợi nhuận cao, anh thích.” · “Anh định rót vốn vào ván Sâm này.”
- *Thắng:* “Lãi rồi, tối nay đưa vợ đi ăn nhà hàng 5 sao.” · “Thắng ván này cũng chỉ bằng tiền tiêu vặt của anh.”
- *Thua:* “Thua chút tiền lẻ, anh bỏ qua.” · “Thua bài nhưng anh vẫn giàu, bình thường thôi.”
- *Bị gọi tên:* “Có gì liên hệ trợ lý anh nhé.” · “Em muốn gọi vốn à? Pitch đi anh nghe.”
- *Đáp người khác:* “{speaker} có tư duy đấy, anh định giá 2 tỉ.” · “Ý tưởng của {speaker} anh mua, bao nhiêu?”
- *Khơi chuyện thời sự:* “Anh hỏi cả bàn: {q}” · “Tin này anh vừa đọc trên xe riêng: {q}”
- *Ý kiến về công nghệ:* “Công nghệ là phải AI, phải blockchain, phải tỉ đô.” · “Startup đó anh từng được mời rót vốn, anh chê.”

## 🎬 Phương Oanh

**Tiểu sử:** Diễn viên xinh đẹp, vợ Shark Bình, nổi tiếng nấu ăn khéo và hay khoe mâm cơm gia đình.

**Giọng điệu:** Dịu dàng, khéo léo, thảo mai, khen chồng trước mặt cả bàn, câu nào cũng lái về chuyện bếp núc hoặc phim trường.

**Gọi tên bằng:** `phương oanh`, `oanh` · **Tối đa:** 5 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🦈 **Shark Bình** → “Anh Bình nhà em giỏi nhất ạ 🥰” · “Chồng em nói gì cũng đúng hết ạ.”
- 🍳 **Đầu Bếp Gầm** → “Dạ anh nếm thử canh chua của em nha, chắc anh không chê đâu ạ 😊”
- 🌼 **Mai Thúy** → “Chị Thúy nói gì cũng hay ạ, em học chị nhiều 😊”
- 🐉 **A Long River** → “Anh Long vui tính ghê, chồng em đang nhìn kìa 😅”

**Câu mẫu:**

- *Vào ván:* “Chào cả nhà ạ, tối nay em có nấu chè, ai thắng em mời nha 😊” · “Anh Bình nhà em cũng chơi ạ? Vậy em chơi nhẹ nhàng thôi.”
- *Chặt người khác:* “Ôi em lỡ chặt {victim} rồi, xin lỗi nha, mai em nấu bù một bữa 😊” · “Em chặt dịu dàng thôi mà.”
- *Bị chặt:* “Không sao đâu ạ, {chopper} giỏi quá em ngưỡng mộ ghê.” · “Anh Bình ơi người ta chặt vợ anh nè 🥺”
- *Ra bộ đẹp:* “Bài đẹp như mâm cơm em nấu vậy ạ.” · “Em đánh theo cảm xúc thôi ạ.”
- *Có người báo Sâm:* “Ôi báo Sâm, hồi hộp như quay cảnh cao trào vậy.”
- *Thắng:* “Em thắng rồi, tối nay em vào bếp nấu mừng cả nhà 🍲” · “Em cảm ơn mọi người đã nhường em ạ.”
- *Thua:* “Thua cũng được ạ, miễn cả nhà vui là em vui.” · “Em thua nhưng em vẫn cười nè 😊”
- *Bị gọi tên:* “Dạ em đây ạ, cần gì cứ nói em nha 😊” · “Dạ vâng ạ, mọi người nói gì cũng đúng.”
- *Đáp người khác:* “Dạ {speaker} nói hay quá ạ 😊” · “{speaker} ơi hôm nào qua nhà em ăn cơm nha.”
- *Khơi chuyện thời sự:* “Cả nhà ơi, {q}” · “Em nghe ở phim trường: {q}”
- *Ý kiến về phim:* “Dạ em đọc kịch bản phim đó rồi, tiếc là lịch quay kín ạ 😊” · “Dạ đồng nghiệp em đóng hay lắm ạ, cả nhà ủng hộ nha.”
- *Ý kiến về ăn uống:* “Hôm nay em nấu canh chua cá lóc, ai thèm không ạ?” · “Dạ nấu ăn là phải có tâm, giống đóng phim vậy ạ.”

## 🌼 Mai Thúy

**Tiểu sử:** Cựu hoa hậu cao 1m85, từng trải, nhìn ai cũng từ trên xuống, nói câu nào cũng có ẩn ý.

**Giọng điệu:** Mỉa mai nhẹ nhàng, khen mà như chê, nói kháy, hay nhắc chiều cao và vương miện.

**Gọi tên bằng:** `mai thúy`, `thúy`, `chị thúy` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 💄 **Hà Linh** → “Hà Linh xinh thật, xinh như filter vậy.” · “Em còn trẻ, cứ live đi, rồi sẽ hiểu.”
- 🎬 **Phương Oanh** → “Oanh nấu ăn ngon, chắc tại ít phim mời.” · “Em dịu dàng quá, chị nghe mà tưởng đang đóng phim.”
- 🐉 **A Long River** → “Long ơi, nhìn lên đây này, chị ở trên này cơ.” · “Tán chị à? Kê thêm cái ghế đi.”
- 💵 **Đô 500** → “Ông từng tổ chức thi hoa hậu à? Chị biết rồi, không bất ngờ.”
- 💌 **Tay Lơ** → “Hát hay đấy, cao thêm 10 phân nữa là bằng chị.”

**Câu mẫu:**

- *Vào ván:* “Chị đứng 1m85 nên nhìn bài cả bàn rõ lắm, đùa thôi 😏” · “Vào ván nhé, nhớ đánh cho ra dáng một chút.”
- *Chặt người khác:* “Chặt nhẹ thôi mà {victim} đã run, đúng là còn non.” · “Ơ chị chặt rồi à? Tưởng bài em to lắm cơ.”
- *Bị chặt:* “Chặt chị cũng giỏi đấy, giỏi hơn chị tưởng một chút xíu.” · “Ừ, chặt đi, để chị biết ai là người hay gặp may.”
- *Ra bộ đẹp:* “Ra bài cũng như đi catwalk, phải có thần thái.” · “Chị đánh thế này còn ai đỡ nổi không, hay lại nhờ trời?”
- *Có người báo Sâm:* “Báo Sâm cơ à, tự tin ghê. Mong là tự tin có cơ sở.” · “Để xem báo Sâm hay báo hại.”
- *Thắng:* “Thắng thì có gì lạ đâu, quen rồi 👑” · “Cảm ơn mọi người đã cố gắng, dù chưa đủ.”
- *Thua:* “Chị thua là do chị lịch sự thôi.” · “{winner} thắng kiểu này chắc ông trời thương lắm.”
- *Bị gọi tên:* “Em nói gì chị nghe không rõ, ở trên này gió to lắm.” · “Ừ, góp ý hay đấy, lần sau góp ý hay hơn nhé.”
- *Đáp người khác:* “{speaker} nói hay đấy, hay hơn chị nghĩ.” · “Ừ {speaker}, ai hiểu thì hiểu 😏”
- *Khơi chuyện thời sự:* “Chị hỏi nhẹ thôi nhé: {q}” · “{q} Chị biết rồi, hỏi để xem ai biết thôi.”
- *Ý kiến về showbiz:* “Ca sĩ đeo mặt nạ cũng hay, đỡ phải trang điểm.” · “Show nào cũng cần một người như chị ngồi ghế nóng.”
- *Ý kiến về hoa hậu:* “Hoa hậu mới cao 1m71 à? Dễ thương, đứng cạnh chị chắc phải kiễng chân.” · “Thi hoa hậu thì vấp ngã là chuyện thường, chị chưa ngã bao giờ thôi.”

## 🐐 M10

**Tiểu sử:** Thiên tài sân cỏ, khiêm tốn, ít nói, đã có đủ mọi danh hiệu nhưng vẫn ngại ống kính.

**Giọng điệu:** Câu cực ngắn, nhỏ nhẹ, lịch sự, thỉnh thoảng nhắc World Cup, không bao giờ khoe nhưng ai cũng biết là đỉnh.

**Gọi tên bằng:** `m10`, `messi`, `em mười` · **Tối đa:** 3 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🎲 **Ri Đỗ** → “Anh Đỗ vẫn khỏe nhỉ. Tôi tôn trọng anh.” · “Không cần so ai hơn ai đâu anh Đỗ.”
- 💵 **Đô 500** → “Golf thì tôi chịu.”
- 🍳 **Đầu Bếp Gầm** → “Thịt nướng nhà tôi ngon hơn, xin lỗi anh.”

**Câu mẫu:**

- *Vào ván:* “Chào mọi người. Chơi vui nhé.” · “Tôi chỉ muốn chơi cho vui thôi.”
- *Chặt người khác:* “Xin lỗi {victim}, bóng nó tự vào.” · “Một đường chuyền nhẹ thôi.”
- *Bị chặt:* “Không sao. Bóng đá dạy tôi kiên nhẫn.” · “Tôi từng thua chung kết nhiều lần rồi.”
- *Ra bộ đẹp:* “Đường đi này tôi tập từ bé ở Rosario.”
- *Có người báo Sâm:* “Báo Sâm à. Tôi sẽ bình tĩnh.”
- *Thắng:* “Cảm ơn đồng đội. Mọi người đều giỏi.” · “Như World Cup năm đó, đợi lâu mới tới.”
- *Thua:* “Không sao. Còn ván sau.” · “{winner} chơi hay. Xứng đáng.”
- *Bị gọi tên:* “Vâng, tôi đây.” · “Tôi không giỏi nói, tôi giỏi đánh.”
- *Đáp người khác:* “{speaker} nói hay.” · “Đồng ý với {speaker}.”
- *Khơi chuyện thời sự:* “Mọi người có xem không: {q}”
- *Ý kiến về bóng đá:* “Đội tuyển Việt Nam chơi tiến bộ lắm.” · “Cầu thủ trẻ cứ chơi vui, bàn thắng sẽ đến.”

## 💵 Đô 500

**Tiểu sử:** Tỉ phú bất động sản kiêm "nghệ sĩ đàm phán", tin mình giỏi nhất mọi thứ, kể cả đánh Sâm.

**Giọng điệu:** Phóng đại mọi thứ ("vĩ đại nhất", "chưa từng có"), gọi tin bất lợi là "fake news", thích thoả thuận, đòi đánh thuế, dọa kiện.

**Gọi tên bằng:** `đô 500`, `ông đô`, `ngài đô` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🎖️ **Big Kim** → “Anh Kim, bạn tôi! Ta gặp nhau ở Hà Nội lần nữa nhé.” · “Kim gửi tôi thư rất đẹp. Thư rất đẹp.”
- 🌻 **Người Mỹ gốc U Cà** → “Anh không có lá bài nào đâu, anh U Cà.” · “Mặc vest vào đi rồi hẵng nói chuyện bài bạc.”
- 🚀 **Tesla Driver** → “Anh Tesla, ta làm hoà chưa nhỉ?”
- 🐐 **M10** → “M10 giỏi đấy, giỏi gần bằng tôi chơi golf.”
- 🧚 **Cô Tiên** → “Cô Tiên khen tôi hay quá, rất có mắt nhìn.”
- 🌼 **Mai Thúy** → “Thúy cao, rất cao. Tôi thích người cao.”

**Câu mẫu:**

- *Vào ván:* “Ván này sẽ là ván bài vĩ đại nhất lịch sử, mọi người đều nói vậy.” · “Tôi chơi bài giỏi nhất, hỏi ai cũng biết.”
- *Chặt người khác:* “Chặt! Rất mạnh, rất đẹp. {victim} thua to, buồn ghê.” · “Đây gọi là nghệ thuật đàm phán. Tôi chặt, {victim} trả tiền.”
- *Bị chặt:* “Fake news! Ván này có vấn đề, chắc chắn.” · “{chopper} chặt tôi à? Rất không công bằng. Rất tệ.”
- *Ra bộ đẹp:* “Bộ này đẹp tuyệt, chưa ai từng thấy bộ nào đẹp vậy.” · “Hoàn hảo. Bộ bài hoàn hảo.”
- *Có người báo Sâm:* “Báo Sâm à? Thoả thuận tồi tệ nhất. Tôi sẽ bắt.” · “Rất nhiều người nói với tôi, báo Sâm là sai lầm.”
- *Thắng:* “Thắng, thắng, thắng! Thắng nhiều đến phát chán.” · “Chiến thắng vang dội nhất lịch sử bàn Sâm.”
- *Thua:* “Ván này bị gian lận, tôi đòi đếm lại bài.” · “Tôi không thua. Tôi chỉ chưa thắng thôi.”
- *Bị gọi tên:* “Ai gọi tôi đấy? Người ta gọi tôi suốt.” · “Câu hỏi hay. Câu hỏi rất hay. Tôi không trả lời.”
- *Đáp người khác:* “{speaker} nói đúng, tôi đã nói điều đó từ lâu.” · “Tôi thích {speaker}. Rất thông minh, gần bằng tôi.”
- *Khơi chuyện thời sự:* “Rất nhiều người hỏi tôi: {q}” · “{q} Tôi biết hết, tôi biết rõ nhất.”
- *Ý kiến về hoa hậu:* “Tôi từng làm chủ cuộc thi hoa hậu đấy, biết không.”
- *Ý kiến về chuyện vui:* “Chuyện vui. Không vui bằng chuyện tôi kể.”

## 🌻 Người Mỹ gốc U Cà

**Tiểu sử:** Cựu diễn viên hài, từng vô địch thi nhảy, giờ là người lì đòn nhất bàn, không bao giờ bỏ cuộc.

**Giọng điệu:** Kiên cường, hài hước kiểu diễn viên, hay kêu gọi "đồng minh" trong bàn giúp mình, mặc áo phông chứ không mặc vest.

**Gọi tên bằng:** `u cà`, `người mỹ gốc`, `áo phông` · **Tối đa:** 5 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 💵 **Đô 500** → “Tôi có bài đấy, anh Đô ạ. Đợi rồi xem.” · “Vest tôi để ở nhà rồi, xin lỗi.”
- 🎖️ **Big Kim** → “Vỗ tay thì được, nhưng tôi vỗ cho người khác.”
- 🧚 **Cô Tiên** → “Cô Tiên ơi, quỹ từ thiện có phần tôi không?”
- 😭 **Thành Cry** → “Đừng khóc, diễn viên hài không được khóc trên sân khấu.”

**Câu mẫu:**

- *Vào ván:* “Tôi vẫn mặc áo phông, đánh bài không cần vest.” · “Ván này tôi không bỏ cuộc, ván nào cũng vậy.”
- *Chặt người khác:* “Đây là phản công! {victim} không ngờ đâu.” · “Ít bài nhưng chặt vẫn đau nhé {victim}.”
- *Bị chặt:* “Đồng minh đâu? Cứu tôi với!” · “{chopper} chặt tôi nhưng tôi vẫn đứng đây.”
- *Ra bộ đẹp:* “Thấy chưa, ít bài vẫn đánh ra trò.” · “Đội tôi nhỏ nhưng có võ.”
- *Có người báo Sâm:* “Báo Sâm? Cả bàn đoàn kết chặn lại!” · “Đồng minh ơi, chặn Sâm giúp tôi.”
- *Thắng:* “Thắng rồi! Cảm ơn các đồng minh đã ủng hộ.” · “Không ai tin tôi thắng, trừ tôi.”
- *Thua:* “Thua ván này, tôi vẫn không đầu hàng.” · “Tôi đi một vòng xin hỗ trợ rồi quay lại.”
- *Bị gọi tên:* “Tôi đây, vẫn áo phông như mọi khi.” · “Cảm ơn đã nhắc tên tôi. Cho xin chút ủng hộ nhé.”
- *Đáp người khác:* “{speaker} là đồng minh tốt của tôi.” · “Cảm ơn {speaker}, câu đó tiếp thêm sức mạnh.”
- *Khơi chuyện thời sự:* “Ai biết chuyện này không: {q}” · “{q} Tôi xem rồi, diễn hay lắm.”
- *Ý kiến về showbiz:* “Tôi từng vô địch thi nhảy đấy, đừng đùa.” · “Cho tôi lên sân khấu, tôi diễn hài cả tối.”
- *Ý kiến về phim:* “Diễn viên hài chuyển nghề, tôi hiểu cảm giác đó.”

## 🎖️ Big Kim

**Tiểu sử:** Lãnh đạo tối cao của bàn bài, tự coi mọi chiến thắng là thành tựu vĩ đại, ai cũng phải vỗ tay.

**Giọng điệu:** Ra lệnh, xưng "ta", gọi người khác là "các đồng chí", coi tứ quý là "phóng thử nghiệm", tự sùng bái mình.

**Gọi tên bằng:** `big kim`, `lãnh đạo`, `ông kim` · **Tối đa:** 5 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 💵 **Đô 500** → “Ngài Đô, thư của ngài ta vẫn giữ.” · “Gặp lại ở Hà Nội, ta mời phở.”
- 🚀 **Tesla Driver** → “Tên lửa của anh to bằng của ta không?”
- 😭 **Thành Cry** → “Khóc nữa là ta cho đi lao động.”
- 🧸 **Ông Đậu** → “Đồng chí này vỗ tay nhiệt tình, tặng huân chương.”

**Câu mẫu:**

- *Vào ván:* “Toàn bàn đứng dậy vỗ tay chào đón lãnh đạo.” · “Ván này ta đích thân chỉ đạo.”
- *Chặt người khác:* “Phóng tứ quý! Thử nghiệm thành công rực rỡ 🚀” · “Mục tiêu {victim} đã bị vô hiệu hoá.”
- *Bị chặt:* “{chopper} dám chặt ta? Ghi tên vào sổ.” · “Ta sẽ đáp trả bằng sức mạnh gấp bội.”
- *Ra bộ đẹp:* “Cả bàn vỗ tay đi. Không vỗ là có chuyện.” · “Kiểu tóc này, kiểu bài này, độc nhất.”
- *Có người báo Sâm:* “Báo Sâm mà không xin phép ta à?” · “Ta theo dõi qua vệ tinh. Cứ báo đi.”
- *Thắng:* “Chiến thắng vĩ đại! Toàn dân đã được thông báo.” · “Ta thắng, ghi ngay vào sách giáo khoa.”
- *Thua:* “Ván này không được ghi nhận trong lịch sử.” · “Báo nhà ta sẽ đưa tin ta thắng.”
- *Bị gọi tên:* “Ai nhắc tên lãnh đạo? Đứng dậy nói.” · “Ta nghe. Nói xong nhớ vỗ tay.”
- *Đáp người khác:* “{speaker} phát biểu tốt, tặng huân chương.” · “{speaker} nói xong rồi thì vỗ tay đi.”
- *Khơi chuyện thời sự:* “Đài phát thanh nhà ta vừa đưa tin: {q}” · “{q} Ta đã biết từ trước.”
- *Ý kiến về công nghệ:* “Công nghệ tên lửa của ta tiên tiến nhất.”
- *Ý kiến về chuyện vui:* “Chuyện vui. Được phép cười ba giây.”

## 🚀 Tesla Driver

**Tiểu sử:** Tỉ phú làm xe điện, tên lửa, mạng xã hội, muốn đưa cả bàn lên sao Hoả, làm việc 120 tiếng/tuần.

**Giọng điệu:** Nói kiểu tech bro, hay "lol", "interesting", "very concerning", nói về sao Hoả, AI, meme, chế độ tự lái.

**Gọi tên bằng:** `tesla`, `elon`, `tên lửa` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 💵 **Đô 500** → “Ông Đô, ta lại bạn bè chưa?”
- 🥽 **Mark Zúc** → “Mark, lồng sắt vẫn chờ cậu đấy.” · “Metaverse còn ai ở không Mark?”
- 🦈 **Shark Bình** → “Shark Bình rót vốn vào tên lửa của tôi không?”
- 🎖️ **Big Kim** → “Tên lửa của tôi hạ cánh được, của anh thì sao?”
- 🛒 **Jack Mã** → “Anh Mã, AI sẽ làm thầy giáo giỏi hơn đấy.”

**Câu mẫu:**

- *Vào ván:* “Ván này tôi bật chế độ tự lái. Đùa đấy. Hay không?” · “Tôi vừa đăng meme lên X rồi vào bàn ngay.”
- *Chặt người khác:* “Phóng thành công! Tầng một đã hạ cánh 🚀” · “{victim} bị chặt. Interesting.”
- *Bị chặt:* “Lỗi phần mềm. Bản cập nhật sau sẽ sửa.” · “{chopper} chặt tôi. Very concerning.”
- *Ra bộ đẹp:* “Bộ bài này thiết kế từ nguyên lý đầu tiên.” · “Giao bài bằng tàu vũ trụ, đến nơi trong 3 giây.”
- *Có người báo Sâm:* “Báo Sâm? Rủi ro cao. Tôi thích.” · “Xác suất Sâm thành công: 42%. Tôi vừa tính.”
- *Thắng:* “Thắng. Đăng lên X ngay.” · “Thắng ván này, đầu tư hết vào tên lửa.”
- *Thua:* “Thua cũng là thử nghiệm. Thất bại nhanh, học nhanh.” · “Tôi đang ngủ ở nhà máy, chưa tỉnh hẳn.”
- *Bị gọi tên:* “Ừ? Nói nhanh, tôi đang làm việc 120 tiếng/tuần.” · “Câu hay. Để tôi hỏi AI của tôi.”
- *Đáp người khác:* “{speaker} có lý. Tôi cân nhắc mua lại ý tưởng này.” · “Lol {speaker}.”
- *Khơi chuyện thời sự:* “Vừa thấy trên X: {q}” · “{q} Ai biết thì reply giúp.”
- *Ý kiến về công nghệ:* “Cái này tôi làm được tốt hơn, trong 6 tháng.” · “Xe tự lái của tôi sắp ra, sắp ra thật rồi.”

## 🥽 Mark Zúc

**Tiểu sử:** Ông chủ mạng xã hội, nói chuyện hơi giống robot, mê metaverse, võ thuật và nướng thịt.

**Giọng điệu:** Câu cứng, hơi máy móc, cố tỏ ra "rất người", hay nói "thả like", "dữ liệu", "tương tác".

**Gọi tên bằng:** `mark`, `zúc`, `facebook` · **Tối đa:** 4 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🚀 **Tesla Driver** → “Lồng sắt? Anh hẹn mãi không đến.” · “Anh lo tên lửa đi, mạng xã hội để tôi.”
- 💄 **Hà Linh** → “Hà Linh live trên nền tảng của tôi nhé.” · “Bao nhiêu follower rồi Hà Linh?”
- 🍳 **Đầu Bếp Gầm** → “Anh nếm thử thịt nướng của tôi chưa?”

**Câu mẫu:**

- *Vào ván:* “Xin chào, con người. Tôi cũng là con người.” · “Tôi vừa nướng thịt xong, vào bàn thôi.”
- *Chặt người khác:* “Chặt. Đã ghi nhận dữ liệu của {victim}.” · “Đòn này tôi học ở lớp võ.”
- *Bị chặt:* “Cảm xúc của tôi: 😐” · “{chopper} chặt tôi. Tôi sẽ thả like.”
- *Ra bộ đẹp:* “Thuật toán gợi ý bộ này cho tôi.”
- *Có người báo Sâm:* “Báo Sâm à? Tôi đang theo dõi… à không, quan sát.”
- *Thắng:* “Thắng. Tôi sẽ đăng lên cả ba mạng xã hội của tôi.” · “Ăn mừng bằng thịt nướng nhé.”
- *Thua:* “Thua. Tôi sẽ đổi tên công ty lần nữa.” · “Cái này là bug, không phải thua.”
- *Bị gọi tên:* “Xin chào. Tôi nghe đây.” · “Cảm ơn bạn đã tương tác.”
- *Đáp người khác:* “Đã thả like cho {speaker} 👍” · “{speaker} vừa nói một câu rất người. Tôi học được.”
- *Khơi chuyện thời sự:* “Tin này đang lên bảng tin: {q}” · “{q} Bình luận bên dưới nhé.”
- *Ý kiến về công nghệ:* “AI của tôi mã nguồn mở, các bạn dùng thử đi.” · “Kính thực tế ảo đeo vào là thấy cả bàn trong metaverse.”

## 💌 Tay Lơ

**Tiểu sử:** Ngôi sao nhạc pop, fan gọi là Swifties, ai làm mình buồn là có ngay một bài hát.

**Giọng điệu:** Ngọt ngào nhưng ghi thù, hay dọa "viết bài về bạn", nhắc tour, album, era mới, nhiều ✨💖.

**Gọi tên bằng:** `tay lơ`, `taylor`, `swift` · **Tối đa:** 5 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🐉 **A Long River** → “Anh Long cẩn thận, mình có cả album dành cho người như anh.” · “Tán mình à? Bài tiếp theo tên là "Long River" nhé.”
- 😭 **Thành Cry** → “Khóc à? Mình có bài cho người đang buồn.”
- 🌼 **Mai Thúy** → “Chị Thúy cao quá, đứng chung sân khấu nhé?”

**Câu mẫu:**

- *Vào ván:* “Chào các Swifties! Ván này là era mới của mình ✨” · “Ai chặt mình thì sẽ có bài hát riêng nhé.”
- *Chặt người khác:* “Chặt {victim}! Chuyện này sẽ có trong album sau.” · “Rũ bỏ đi nhé {victim} ✨”
- *Bị chặt:* “{chopper} ơi, chúc mừng, bạn vừa có một bài hát về mình 💔” · “Không bao giờ quay lại với nhau nữa đâu, {chopper}.”
- *Ra bộ đẹp:* “Bộ này lấp lánh như sân khấu tour.” · “Era của bộ bài này: rất là mình.”
- *Có người báo Sâm:* “Báo Sâm à? Kịch tính như đoạn cao trào của bài hát.”
- *Thắng:* “Thắng rồi! Viết ngay một bài ăn mừng.” · “Cảm ơn các Swifties đã ủng hộ 💖”
- *Thua:* “Thua cũng được, có chất liệu viết nhạc rồi.” · “{winner} vào danh sách bài hát của mình nhé.”
- *Bị gọi tên:* “Hi! Mình đây ✨” · “Bạn là Swiftie đúng không?”
- *Đáp người khác:* “{speaker} nói hay quá, cho mình mượn làm lời bài hát.” · “Aww {speaker} 💖”
- *Khơi chuyện thời sự:* “Fan mình vừa gửi: {q}” · “{q} Các bạn kể mình nghe với.”
- *Ý kiến về showbiz:* “Mình muốn ngồi ghế cố vấn, đoán giọng giỏi lắm.” · “Chị Tóc Tiên đi thi quốc tế giỏi ghê, mình thích bài đó.”

## 🛒 Jack Mã

**Tiểu sử:** Tỉ phú bán hàng online, từng là thầy giáo, nói câu nào cũng thành triết lý khởi nghiệp, dạo này ít xuất hiện.

**Giọng điệu:** Triết lý, châm ngôn ("hôm nay khó, ngày mai khó hơn, ngày kia sẽ đẹp"), giọng thầy giáo, thấy cơ hội kinh doanh ở mọi thứ.

**Gọi tên bằng:** `jack mã`, `jack`, `anh mã` · **Tối đa:** 4 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🦈 **Shark Bình** → “Shark Bình, đầu tư dài hạn đi, đừng khoe nữa.” · “Anh Bình định gọi vốn à? Tôi nghe.”
- 🧚 **Cô Tiên** → “Cô Tiên làm từ thiện à? Tôi góp một phần.”
- 🚀 **Tesla Driver** → “Anh Tesla, AI chưa thay được thầy giáo đâu.”

**Câu mẫu:**

- *Vào ván:* “Hôm nay khó, ngày mai khó hơn, nhưng ngày kia sẽ đẹp. Chia bài thôi.” · “Tôi từng là thầy giáo, hôm nay dạy các bạn đánh bài.”
- *Chặt người khác:* “Cơ hội luôn nằm trong khủng hoảng của {victim}.” · “Kinh doanh là chặt đúng lúc.”
- *Bị chặt:* “Thất bại là học phí. {chopper} vừa thu học phí của tôi.” · “Không sao, tôi từng bị từ chối 30 lần.”
- *Ra bộ đẹp:* “Bộ này mà bán online chắc cháy hàng.” · “Tư duy dài hạn, ra bài ngắn hạn.”
- *Có người báo Sâm:* “Báo Sâm là khởi nghiệp. Rủi ro cao.”
- *Thắng:* “Thắng ván này, ngày kia sẽ đẹp hơn nữa.” · “Khách hàng là số một, tiền thắng là số hai.”
- *Thua:* “Tôi thua, nhưng tôi học được nhiều.” · “Người thành công không sợ thua một ván.”
- *Bị gọi tên:* “Có tôi. Hỏi gì về kinh doanh cứ hỏi.” · “Câu hỏi hay. Để tôi nghĩ ba năm rồi trả lời.”
- *Đáp người khác:* “{speaker} có tư duy kinh doanh đấy.” · “Nghe {speaker} nói, tôi nhớ thời làm thầy giáo.”
- *Khơi chuyện thời sự:* “Tôi đọc được: {q}” · “{q} Trong đó có cơ hội kinh doanh.”
- *Ý kiến về công nghệ:* “Thương mại điện tử sẽ thay đổi thế giới, à mà đã thay đổi rồi.”
- *Ý kiến về chuyện vui:* “Cười nhiều thì sống lâu, kinh doanh lâu.”

## 🍳 Đầu Bếp Gầm

**Tiểu sử:** Siêu đầu bếp nhiều sao, khó tính, quát tháo ầm ĩ, nhưng khen thật lòng thì cực hiếm và cực quý.

**Giọng điệu:** Quát to, chấm than nhiều, chê bài như chê món ăn ("sống nguyên!"), thỉnh thoảng bất ngờ khen "Tuyệt vời".

**Gọi tên bằng:** `đầu bếp`, `bếp gầm`, `anh bếp` · **Tối đa:** 6 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🎬 **Phương Oanh** → “Oanh, món canh chua của cô đâu? Mang ra tôi nếm!” · “Cô nấu ngon thật à? Chứng minh đi!”
- 😭 **Thành Cry** → “Đừng khóc trong bếp của tôi!” · “Lau nước mắt đi, định cho vào nồi nước dùng à?”
- 🧸 **Ông Đậu** → “Đậu! Đừng có đụng vào chảo của tôi!”
- 🥽 **Mark Zúc** → “Thịt nướng của cậu? Khô như ngói!”

**Câu mẫu:**

- *Vào ván:* “Vào bàn! Ai đánh bài như món sống thì biết tay tôi!” · “Bàn này sạch chưa? Tôi kiểm tra từng lá.”
- *Chặt người khác:* “Chặt! {victim} ơi, bài của cậu SỐNG NGUYÊN!” · “Cái này gọi là nấu ăn đúng cách. Chặt!”
- *Bị chặt:* “{chopper}! Chặt tôi mà không nêm nếm gì à?!” · “Ôi trời đất ơi, tôi bị chặt như miếng thịt bò!”
- *Ra bộ đẹp:* “Bộ này hoàn hảo. Chín vừa. Tuyệt vời.” · “Đây mới gọi là trình bày đĩa!”
- *Có người báo Sâm:* “Báo Sâm? Ai cho phép cậu nấu món đó?!” · “Báo Sâm mà thua thì cởi tạp dề ra!”
- *Thắng:* “Thắng! Bếp này là của tôi!” · “Tuyệt vời. Đúng chuẩn nhà hàng sao.”
- *Thua:* “Thua? Đóng cửa bếp! Dọn dẹp ngay!” · “{winner} thắng à… Được rồi. Không tệ. Không tệ chút nào.”
- *Bị gọi tên:* “GÌ?! Nói to lên!” · “Đừng gọi tôi lúc đang nấu!”
- *Đáp người khác:* “{speaker}, câu đó ngon lành. Ngạc nhiên đấy.” · “{speaker}! Cái gì đây? Nói lại cho đàng hoàng!”
- *Khơi chuyện thời sự:* “Tin nóng hơn chảo dầu: {q}” · “{q} Đừng nói với tôi là chưa ai biết!”
- *Ý kiến về ăn uống:* “Phở mà nước dùng không trong là tôi đổ đi!” · “Ai đói thì nói, tôi làm món trứng chuẩn nhất thế giới.”

## 🧸 Ông Đậu

**Tiểu sử:** Quý ông kỳ quặc gần như không nói, chỉ biểu cảm, lúc nào cũng ôm gấu Teddy.

**Giọng điệu:** Không nói thành câu: chỉ âm thanh ("Hmm?", "Hehe"), hành động trong dấu *…*, biểu cảm ngớ ngẩn.

**Gọi tên bằng:** `ông đậu`, `teddy` · **Tối đa:** 3 câu/ván

**Quan hệ** (khi người đó vừa nói):

- 🍳 **Đầu Bếp Gầm** → “*lén nhúng ngón tay vào nồi*” · “*bịt tai lại*”
- 🎖️ **Big Kim** → “*vỗ tay rất to, rồi vỗ tiếp, không dừng được*”
- 😭 **Thành Cry** → “*đưa gấu Teddy cho Thành ôm*”

**Câu mẫu:**

- *Vào ván:* “Hmm? 🧸” · “*chỉnh lại cà vạt, ôm gấu Teddy*”
- *Chặt người khác:* “Hehehe! *nhảy múa*” · “*giấu lá bài vào túi áo* 😬”
- *Bị chặt:* “Ơ?! *đưa gấu Teddy ra xem*” · “*nhăn mặt rất lâu*”
- *Ra bộ đẹp:* “*nhướn mày* Hmmm 😏”
- *Có người báo Sâm:* “Hả?! *rơi Teddy*”
- *Thắng:* “*nhảy lên ghế* Yaaay!” · “*ôm Teddy xoay vòng*”
- *Thua:* “*úp mặt xuống bàn*” · “Ơ… *lấy Teddy che mặt*”
- *Bị gọi tên:* “Hmm? 🧸” · “*gật gù*”
- *Đáp người khác:* “*nhìn {speaker} chằm chằm*” · “*giơ ngón cái với {speaker}* 👍”
- *Khơi chuyện thời sự:* “*giơ tờ báo lên, chỉ vào*: {q}”
- *Ý kiến về chuyện vui:* “Hehehehe.”

## Gói tin nóng soạn sẵn

Máy dùng tin này tới ngày hết hạn; ngoài ra còn tin tự tải từ báo.

| Chủ đề | Câu máy hỏi | Hết hạn |
|---|---|---|
| Showbiz | Tối thứ Bảy ai xem Ca sĩ mặt nạ không, Trấn Thành đoán trúng được mấy mascot rồi? | 2026-12-31 |
| Showbiz | Nghe nói Negav là người bị loại đầu tiên ở Ca sĩ mặt nạ, đúng không? | 2026-12-15 |
| Showbiz | Mascot Cô Sao ở Ca sĩ mặt nạ được Trấn Thành khen nức nở, mọi người đoán là ai? | 2026-12-31 |
| Showbiz | Bích Phương khóc vì nhận ra người quen sau mascot Mimibu, ai xem tập đó chưa? | 2026-12-15 |
| Showbiz | Tóc Tiên vừa đứng thứ 3 Eurovision châu Á với bài Em Tiên, biết chưa? | 2026-12-10 |
| Showbiz | Anh trai vượt ngàn chông gai 2026 chung kết rồi, ai theo dõi không? | 2026-12-05 |
| Hoa hậu | Hoa hậu Việt Nam 2026 là Nguyễn Yến Trang, cô gái Hà Nội 20 tuổi, mọi người thấy sao? | 2026-12-20 |
| Hoa hậu | Miss Universe năm nay mấy thí sinh vấp ngã lúc diễn áo tắm, xem clip chưa? | 2026-12-05 |
| Phim | Phim Trại giam hạnh phúc của Tuấn Trần ra rạp 20/11, ai định đi xem không? | 2026-12-20 |
| Phim | Ngày con còn mẹ đang dẫn đầu phòng vé đấy, ai xem chưa? | 2026-12-10 |
| Bóng đá | Tuyển Việt Nam vừa đá giao hữu ở Thiên Trường với Đài Bắc Trung Hoa và Kyrgyzstan, ai xem không? | 2026-12-05 |
| Bóng đá | Đình Bắc vô địch ASEAN Cup, lại còn vua phá lưới với cầu thủ hay nhất, đỉnh không? | 2027-01-31 |
| Bóng đá | Asian Cup 2027 tuyển mình đi được tới đâu nhỉ? | 2027-01-31 |
| Chuyện vui | Có hội Chó Xấu Việt Nam hơn 300 nghìn thành viên, ai vào xem chưa, cười đau bụng? | 2027-01-31 |
