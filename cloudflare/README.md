# Giọng Edge cho bản web tĩnh (Cloudflare Worker)

Bản web tĩnh (GitHub Pages) không có server nên không có giọng AI. Worker này làm cầu nối miễn phí tới giọng
**Hoài My / Nam Minh** của Microsoft Edge. Trình duyệt không tự gọi được dịch vụ đó (cần header mà chỉ server mới đặt),
nên trang web gọi Worker, Worker gọi Microsoft rồi trả file mp3 về.

- Miễn phí: gói Cloudflare Workers Free cho 100.000 yêu cầu mỗi ngày.
- Chỉ trang trong `ALLOWED_ORIGINS` được dùng (mặc định `https://kimthi113114.github.io`), người lạ không dùng chung được.
- Câu giống nhau được cache ở Cloudflare nên đọc lại không tốn yêu cầu.
- Chỉ có giọng Edge. Kokoro, VieNeu vẫn cần server riêng (máy tính chạy `tts_worker.py`).

## Cách 1: bảng điều khiển Cloudflare (không cần dòng lệnh)

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**, đặt tên `audioepub-tts` → **Deploy**.
2. Bấm **Edit code**, xoá code mẫu, dán toàn bộ nội dung file `edge-tts-worker.js`, bấm **Deploy**.
3. (Tuỳ chọn) **Settings → Variables and Secrets → Add**: tên `ALLOWED_ORIGINS`, giá trị
   `https://kimthi113114.github.io` (nhiều trang thì cách nhau bằng dấu phẩy). Không đặt thì dùng danh sách mặc định.
4. Copy địa chỉ Worker, dạng `https://audioepub-tts.<tên-bạn>.workers.dev`.

## Cách 2: dòng lệnh

```bash
cd cloudflare
npx wrangler login
npx wrangler deploy
```

## Nối vào app

Mở web tĩnh → ☰ → **Giọng đọc** → tab **Khuyên dùng** → ô **Máy chủ giọng AI** → dán địa chỉ Worker → **Lưu**.
Trang tự tải lại và giọng Hoài My / Nam Minh chạy được. Địa chỉ được nhớ trong trình duyệt của từng thiết bị.
