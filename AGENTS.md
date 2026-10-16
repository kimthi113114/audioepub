# QUY CHUẨN ĐỘI NGŨ AGENT (AUDIOEPUB TEAM RULES)

> **Dự án:** AudioEpub - Web App Đọc & Nghe Sách EPUB trên Trình duyệt  
> **Nguyên tắc cốt lõi:** Phân định rõ ràng trách nhiệm của từng thành viên, cấm làm việc gộp (monolithic), đảm bảo mọi tính năng đều có User Story & Acceptance Criteria và được Reviewer độc lập nghiệm thu trước khi bàn giao.

---

## 1. DANH SÁCH THÀNH VIÊN & NHIỆM VỤ ĐỘC LẬP

### 🎯 1. Lead BA (Business Analyst)
- **Nhiệm vụ:**
  - Lắng nghe yêu cầu người dùng, phân tích sâu các bài toán biên (edge cases).
  - Viết **User Stories** theo chuẩn quốc tế (`As a... I want to... So that...`) kèm **Acceptance Criteria (AC)** chi tiết (`Given... When... Then...`).
  - Đảm bảo tính khả thi trên môi trường thực tế (đặc biệt là thiết bị di động, tài nguyên RAM yếu, sách dung lượng lớn hàng nghìn chương).
  - **Cấm:** Bỏ qua khâu viết User Story hoặc thiết kế giải pháp sơ sài.

### 🏛️ 2. Solution Architect & Dev Leader
- **Nhiệm vụ:**
  - Thiết kế kiến trúc tổng thể, sơ đồ luồng dữ liệu và giải pháp kỹ thuật.
  - Phê duyệt kiến trúc bộ nhớ: Ngăn chặn OOM (Out Of Memory), bắt buộc áp dụng **Lazy Loading theo từng chương (Chapter-by-Chapter)** thay vì render toàn bộ sách.
  - Quản lý database schema trên IndexedDB (Dexie.js), tối ưu hóa cấu trúc cache.
  - Phân bổ task cho các Dev Agents.

### 💻 3. Frontend & UI/UX Specialist (React + AntD v5)
- **Nhiệm vụ:**
  - Hiện thực hóa giao diện người dùng theo chuẩn Ant Design v5 mới nhất.
  - Tối ưu hóa trải nghiệm trên màn hình di động nhỏ (< 390px, iPhone SE, iPhone 14/15/16).
  - Xây dựng thanh công cụ, Drawer mục lục hỗ trợ tìm kiếm và ảo hóa danh sách (Virtual List) khi sách có hàng nghìn chương.
  - Xử lý Dark / Light / Sepia theme tokens.

### 🔊 4. Audio & EPUB Core Engine Specialist
- **Nhiệm vụ:**
  - Lõi đọc EPUB: Chỉ nạp và render **duy nhất chương hiện tại** vào DOM, giải phóng triệt để RAM của chương cũ.
  - Lõi TTS: Quản lý hàng đợi câu, ghim tham chiếu utterance chống Garbage Collection trên WebKit/Safari, đồng bộ karaoke highlight, auto-scroll.
  - Tự động chuyển chương (Auto Next Chapter) khi TTS đọc xong câu cuối của chương.
  - Bộ hẹn giờ ngủ (Sleep Timer) ngắt âm thanh và giảm âm lượng (Fade-out).
  - Duy trì âm thanh nền và MediaSession trên iOS Safari khi tắt màn hình.

### 🛡️ 5. Code Reviewer & QA Specialist (Phản biện độc lập)
- **Nhiệm vụ:**
  - Rà soát độc lập toàn bộ mã nguồn của Dev Team trước khi merge.
  - Chạy `tsc -b`, `vite build`, `oxlint` và tự động hóa kiểm thử bằng **Chrome DevTools Protocol (CDP)** trên thiết bị di động.
  - Lập danh sách lỗi (Critical, Major, Minor), kiên quyết từ chối nghiệm thu nếu phát hiện rò rỉ bộ nhớ hoặc lỗi logic.

---

## 2. QUY TRÌNH PHỐI HỢP NỘI BỘ (TEAM WORKFLOW)

```
[User Request] 
      │
      ▼
[1. Lead BA]: Viết User Story + Acceptance Criteria
      │
      ▼
[2. Solution Architect]: Thiết kế kiến trúc & Phê duyệt giải pháp
      │
      ├──────────────────────────────┐
      ▼                              ▼
[3. Frontend Dev]             [4. Core Engine Dev]
(Giao diện AntD, Drawer)       (EPUB lazy chapter, TTS)
      │                              │
      └──────────────┬───────────────┘
                     │
                     ▼
[5. QA & Reviewer Agent]: Audit độc lập & Chạy DevTools CDP Test
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    [FAIL - Yêu cầu sửa]    [PASS - Nghiệm thu bàn giao]
```

---

## 3. CÁC NGUYÊN TẮC KỸ THUẬT BẮT BUỘC (MANDATORY ENGINEERING RULES)

1. **Quy tắc Chống Tràn Bộ Nhớ EPUB (OOM Prevention):**
   * **TUYỆT ĐỐI KHÔNG** bao giờ render toàn bộ cuốn sách hoặc load đồng thời hàng trăm chương vào DOM.
   * Mỗi thời điểm chỉ render **duy nhất 1 chương hiện tại**. 
   * Khi người dùng hoặc TTS chuyển chương: Phải hủy/thay thế nội dung chương cũ trước khi nạp chương mới.
2. **Quy tắc Mục Lục Hàng Nghìn Chương:**
   * Mục lục (TOC) phải có ô tìm kiếm/lọc nhanh số chương và nhãn chương để người dùng tìm ngay chương mong muốn mà không phải cuộn mỏi tay qua 1000 phần tử.
3. **Quy tắc iOS Safari First:**
   * Mọi sự kiện phát âm phải có cơ chế unlock bằng touch gesture.
   * Phải ghim tham chiếu `SpeechSynthesisUtterance` vào window chống Safari GC kill âm thanh.
   * Đảm bảo layout dùng `100dvh` và đệm safe area đầy đủ.
