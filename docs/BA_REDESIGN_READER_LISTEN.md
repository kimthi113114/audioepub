# BA — Thiết kế lại màn hình Đọc & Nghe (Safari / iOS first)

> Tác giả: Lead BA · Trạng thái: **Chờ User duyệt** → sau đó chuyển Solution Architect.
> Các mục ghi "Giả thuyết" cần QA xác nhận bằng test thật trên iPhone Safari trước khi code.

## 1. Chẩn đoán hiện trạng (từ code)

| # | Vấn đề | Bằng chứng | Hậu quả trên Safari |
|---|--------|-----------|---------------------|
| P1 | **Đọc và Nghe dồn chung một màn hình**, 3 thanh chồng nhau: Navbar + toolbar reader (TOC, chương, prev/next) + PlayerBar cố định đáy | `App.tsx`, `ReaderView.tsx` toolbar | iPhone SE còn rất ít vùng chữ; thanh địa chỉ Safari co/giãn làm layout nhảy |
| P2 | **PlayerBar quá tải** trên 1 hàng: giọng, tốc độ, âm lượng, hẹn giờ, prev/play/next, phụ đề câu | `PlayerBar.tsx` (flex nowrap, maxWidth 135/175) | Chạm nhầm, chữ cắt ở màn <390px; slider âm lượng vô nghĩa trên iOS (JS không chỉnh được volume) |
| P3 | **Văn bản nằm trong iframe epub.js**; highlight + `scrollIntoView({behavior:'smooth', block:'center'})` chạy trong iframe | `ReaderView.tsx` effect highlight/auto-scroll | Giả thuyết: Safari cuộn trong iframe giật/lệch, câu đang đọc bị PlayerBar che |
| P4 | **Chạm câu = đọc từ câu đó**, trùng thao tác cuộn/chọn chữ | `span.addEventListener('click')` | Vô tình kích hoạt đọc khi cuộn; không có cách "chỉ đọc" yên lặng |
| P5 | **Nhiều engine TTS, mỗi câu một blob audio**, đổi `audio.src` liên tục | `useTTS.ts` | Giả thuyết: khe hở giữa câu; khi khoá màn hình, `play()` câu kế không có user gesture → Safari chặn; Lock Screen nhấp nháy |
| P6 | **Chọn giọng quá phức tạp** (Edge/Kokoro/VieNeu/Piper/WebSpeech; ~1700 dòng modal + drawer) | `VoiceModal.tsx`, `VoiceDrawer.tsx` | Kokoro WebGPU / Piper wasm nặng, Safari có thể hết RAM hoặc không hỗ trợ; user không biết chọn gì |
| P7 | **Đổi chế độ cuộn/lật trang = khởi tạo lại sách** (`flow` nằm trong effect `[book, readingMode]`) | `ReaderView.tsx` | Nhấp nháy, mất vị trí |

## 2. Nguyên tắc thiết kế mới

1. **Hai chế độ rõ ràng, một trạng thái chung**: *Đọc* (chữ là chính) và *Nghe* (điều khiển là chính). Chuyển qua lại không mất vị trí câu.
2. **Mỗi lúc chỉ một lớp điều khiển**, ẩn/hiện bằng một chạm vào vùng giữa.
3. **Đường nghe mặc định phải chạy tốt nhất trên Safari**; engine nặng là tuỳ chọn nâng cao.
4. Giữ luật AGENTS.md: 1 chương trong DOM, TOC có tìm kiếm + ảo hoá, `100dvh` + safe-area, ghim utterance, unlock bằng gesture.

## 3. User Stories & Acceptance Criteria

### US-01 · Chế độ Đọc tập trung
*As a* người đọc trên iPhone, *I want* màn hình chỉ có chữ khi đang đọc, *so that* tôi đọc thoải mái như một app sách.
- **AC1** Given đang đọc, When mở sách, Then chỉ thấy vùng chữ; thanh trên/dưới ẩn (chỉ còn vạch tiến độ ≤3px).
- **AC2** When chạm vùng giữa màn hình, Then hiện/ẩn thanh trên (Quay lại · Tên chương · Mục lục · Aa) và thanh dưới (nút Nghe + tiến độ). Ở chế độ lật trang, chạm 25% cạnh trái/phải = lùi/tiến trang.
- **AC3** Given iPhone SE (320×568), Then vùng chữ chiếm ≥ 90% chiều cao khi thanh ẩn; không cuộn ngang.
- **AC4** Layout dùng `100dvh`, padding `env(safe-area-inset-*)`; thanh địa chỉ Safari co/giãn không làm chữ nhảy vị trí.

### US-02 · Chế độ Nghe (mini-player + Player đầy đủ)
*As a* người nghe, *I want* bấm một nút "Nghe" để vào trình phát, *so that* tôi nghe mà không bị rối bởi nút đọc.
- **AC1** When bấm **Nghe**, Then mini-player (cao ≤ 64px) hiện ở đáy, bắt đầu đọc từ **câu đầu tiên đang hiển thị** (hoặc câu đã chọn), và phát ngay trong cùng cú chạm (gesture unlock iOS).
- **AC2** Mini-player chỉ gồm: ◀◀ ⏯ ▶▶ · tên chương · mở rộng ⌃. Chạm ⌃ mở **Player đầy đủ** (bottom sheet 85dvh).
- **AC3** Player đầy đủ gồm: bìa/tên sách, tên chương, tiến độ chương, ⏮ chương · ⏪ câu · ⏯ lớn · ⏩ câu · ⏭ chương, **Tốc độ** (chip 0.75–2.0x), **Hẹn giờ ngủ**, **Giọng** (1 dòng → mở chọn giọng), nút "Về chế độ Đọc".
- **AC4** Nút tối thiểu 44×44pt; khoảng cách giữa nút ≥ 8pt.
- **AC5** Không hiển thị slider âm lượng trên iOS (người dùng dùng nút cứng); desktop giữ.

### US-03 · Đồng bộ câu đang đọc ↔ vị trí hiển thị
*As a* người nghe, *I want* câu đang đọc luôn thấy được và không bị che, *so that* tôi nhìn theo như karaoke.
- **AC1** Câu đang đọc được highlight; khi ra ngoài vùng nhìn thấy, tự cuộn để câu nằm ở ~35–40% chiều cao **vùng hiển thị thực (trừ mini-player và safe-area)**.
- **AC2** Nếu người dùng tự cuộn/vuốt khi đang nghe, Then tạm dừng auto-scroll và hiện nút nổi "⤓ Về câu đang đọc"; chạm nút thì cuộn lại và bật auto-scroll.
- **AC3** Không dùng cuộn "smooth" nếu gây giật trên Safari; ưu tiên cuộn bằng container của app thay vì trong iframe — *Architect quyết định cách thực hiện*.
- **AC4** Hết câu cuối → nạp chương kế (huỷ chương cũ) → đọc tiếp, không cần chạm lại, kể cả khi khoá màn hình.

### US-04 · Chạm câu không còn gây đọc nhầm
- **AC1** Ở chế độ Đọc, chạm vào chữ chỉ hiện/ẩn thanh (US-01), **không** phát âm.
- **AC2** **Nhấn giữ** một câu → menu nhỏ: "Đọc từ đây · Đánh dấu · Sao chép".
- **AC3** Ở chế độ Nghe, chạm một câu = nhảy đọc từ câu đó.

### US-05 · Âm thanh bền vững trên Safari/iOS
- **AC1** Lần phát đầu luôn nằm trong cú chạm của người dùng. Nếu bị chặn, hiện "Chạm để tiếp tục nghe" thay vì im lặng.
- **AC2** Chuyển câu không có khoảng lặng > 300ms với engine mặc định (prefetch câu kế, tái sử dụng một phần tử audio).
- **AC3** Khoá màn hình / chuyển app: tiếp tục đọc ≥ 30 phút liên tục trong test thực tế; Lock Screen có tên sách, chương, bìa, nút Play/Pause/Trước/Sau hoạt động.
- **AC4** Khi có cuộc gọi/Siri làm gián đoạn, tự chuyển sang Tạm dừng (không phát đè), hiện nút Tiếp tục.
- **AC5** Mỗi blob/ObjectURL được thu hồi; RAM không tăng tuyến tính sau 1 giờ nghe (QA đo bằng Web Inspector).

### US-06 · Chọn giọng đơn giản
- **AC1** Mặc định chỉ 3 nhóm: **Khuyên dùng** (Edge Hoài My / Nam Minh), **Trên máy** (giọng iOS), **Nâng cao** (Kokoro, VieNeu, Piper — thu gọn, cảnh báo dung lượng/RAM).
- **AC2** Engine nặng (WebGPU/wasm) chỉ hiện khi thiết bị đủ điều kiện; Safari không hỗ trợ thì ẩn kèm lý do.
- **AC3** Có nút **Nghe thử** 3–5 giây cho mỗi giọng. Lựa chọn được nhớ.
- **AC4** Engine đang chọn lỗi (mạng/server) → tự lùi về giọng "Trên máy" và báo rõ.

### US-07 · Mục lục & Cài đặt chữ
- **AC1** Mục lục mở dạng bottom sheet 90dvh, ô tìm số/nhãn chương (không dấu), **danh sách ảo hoá**, tự cuộn tới chương hiện tại.
- **AC2** Nút **Aa** mở sheet nhỏ: cỡ chữ, giãn dòng, font, theme Sáng/Sepia/Tối, **Cuộn dọc/Lật trang**. Đổi cuộn/lật **không nạp lại sách** và giữ nguyên câu hiện tại.
- **AC3** Theme áp dụng đồng bộ cho vùng chữ, thanh, sheet.

### US-08 · Hẹn giờ ngủ
- **AC1** Chọn nhanh: 15 · 30 · 45 · 60 phút · Hết chương · Tắt. Giảm âm lượng dần 30s cuối (iOS không chỉnh volume bằng JS → Architect tìm phương án thay thế).
- **AC2** Đếm ngược hiển thị trong Player đầy đủ và chip nhỏ ở mini-player.

## 4. Wireframe (iPhone 390×844)

```
CHẾ ĐỘ ĐỌC (thanh ẩn)         CHẠM GIỮA → hiện thanh
┌───────────────────┐         ┌───────────────────┐
│▔▔▔▔ tiến độ ▔▔▔▔▔│         │ ←  Chương 12  ☰  Aa│
│                   │         ├───────────────────┤
│   Văn bản …       │         │   Văn bản …       │
│   Văn bản …       │         │                   │
│                   │         ├───────────────────┤
│                   │         │ ▔▔▔▔▔ 37% ▔▔▔▔▔  │
│                   │         │ [   🎧 Nghe   ]   │
└───────────────────┘         └───────────────────┘

CHẾ ĐỘ NGHE (mini-player)     PLAYER ĐẦY ĐỦ (sheet 85dvh)
┌───────────────────┐         ┌───────────────────┐
│ Văn bản …         │         │        ⌄          │
│ ▓▓câu đang đọc▓▓  │         │  [bìa]  Tên sách  │
│ Văn bản …         │         │  Chương 12        │
│       [⤓ Về câu]  │         │ ──●──────  12/80  │
├───────────────────┤         │ ⏮   ⏪   ⏯   ⏩   ⏭ │
│ ◀◀  ⏯  ▶▶  Ch.12 ⌃│         │ 1.0x 1.25x 1.5x … │
└───────────────────┘         │ 🌙 Hẹn giờ 🎙 Giọng│
                              │ [ Về chế độ Đọc ] │
                              └───────────────────┘
```

## 5. Rủi ro / câu hỏi cho Architect & QA

1. **Iframe epub.js vs. render tự quản**: US-03 có thể cần thay iframe bằng container của app (vẫn 1 chương/DOM). Đây là quyết định kiến trúc lớn nhất, cần chốt trước khi chia task.
2. **Engine mặc định**: đề xuất Edge-TTS (server) — cần xác nhận server luôn khả dụng qua HTTPS, cùng origin, khi dùng iPhone.
3. Volume/fade-out trên iOS bị hạn chế → cần phương án thay thế.
4. Giả thuyết P3, P5 chưa kiểm chứng bằng thiết bị thật — QA lập kịch bản đo "trước/sau" trước khi sửa.

## 6. Thứ tự triển khai đề xuất

1. **Sprint 1 (đau nhất):** US-01 + US-02 + US-04 (tách Đọc/Nghe, mini-player, bỏ chạm-là-đọc).
2. **Sprint 2:** US-03 + US-05 (đồng bộ cuộn, độ bền âm thanh Safari).
3. **Sprint 3:** US-06, US-07, US-08.
4. Mỗi sprint kết thúc bằng QA: `tsc -b`, `vite build`, `oxlint`, test CDP/iPhone thật.
