# [MÃ-TASK] Tiêu đề ngắn gọn của tính năng

| Thông tin | Chi tiết |
|---|---|
| **Mã task** | `XXXX-01` |
| **Phạm vi source** | `<admin-service / user-service / risk-credit-service / iafs-portal-credit-risk / storage-service / system-service / notification-service / iafs-compose>` |
| **Người viết spec** | `ba (<username_git>)` hoặc tên BA phụ trách |
| **Người code (DEV-1)** | `dev-1 (Chờ PO phân công)` (khi todo) hoặc `<Tên Dev> (<username_git>)` (khi accepted) |
| **Người code (DEV-2)** | `dev-2 (Chờ PO phân công)` (khi todo) hoặc `<Tên Dev> (<username_git>)` (khi accepted / không áp dụng nếu chỉ có 1 Dev) |
| **Người kiểm thử (TESTER)** | `tester` (Kiểm thử tự động trên Chrome thật qua MCP chrome-devtools / skill /browser-test) |
| **Người duyệt** | `PO (Chờ duyệt)` (khi todo) hoặc `PO (<username_git>)` (khi accepted) |
| **Ngày tạo** | `YYYY-MM-DD` |
| **Hạn hoàn thành** | `YYYY-MM-DD` |
| **Trạng thái** | `status::todo` / `status::accepted` / `status::doing` / `status::review` / `status::done` |
| **Nhánh Git** | `feat/<MA-TASK>-<mo-ta-ngan>` |

> **LƯU Ý QUY CHUẨN VỀ NHÂN SỰ & TRUY VẾT TÀI KHOẢN GIT**:
> - **Khi spec ở trạng thái `status::todo`**: Các trường `Người code (DEV-1)` và `Người code (DEV-2)` **BẮT BUỘC** ghi rõ `dev-1 (Chờ PO phân công)` và `dev-2 (Chờ PO phân công)`. Tuyệt đối CẤM tự ý gán tài khoản Git cá nhân của PO hay bất kỳ ai khi chưa có chỉ thị phân công.
> - **Khi PO duyệt spec sang `status::accepted`**: PO sẽ thẩm duyệt giải pháp và chỉ định đích danh lập trình viên phụ trách kèm account Git thật: `<Tên/Định danh> (<username_git>)`.


---

## 1. Mục tiêu & User Story

- **Mục tiêu**: Mô tả mục tiêu kinh doanh hoặc kỹ thuật cần đạt được.
- **User Story**: Là một `<Vai trò>`, tôi muốn `<Thực hiện hành động>`, để `<Đạt được kết quả mong đợi>`.
- **Tiêu chí nghiệm thu (Acceptance Criteria)**:
  - **AC-1**: Given `<Điều kiện ban đầu>`, When `<Hành động xảy ra>`, Then `<Kết quả mong đợi>`.
  - **AC-2**: ...

---

## 2. Phạm vi Source Code & Nhánh Baseline (Bắt buộc xác định trước khi viết code)

> **QUY TẮC BẮT BUỘC**: Trước khi lập trình, Dev/Agent phải xác định chính xác danh sách các service bị tác động để checkout nhánh tính năng từ đúng nhánh baseline chuẩn quy định tại [docs/BASELINE.md](../../BASELINE.md).

| STT | Repository / Service | Loại Service | Nhánh Baseline Chuẩn | Phạm vi thay đổi (Modules / Files / APIs) | Dev phụ trách |
|:---:|---|---|:---:|---|:---:|
| 1 | `iafs-portal-credit-risk` | Frontend Portal | `dev` | `src/app/pages/...`, `src/app/services/...` | `dev-1` |
| 2 | `<tên-backend-service>` | BE Microservice | `dev` hoặc `project/risk/dev` | Entity, Repo, Service, Controller, DTO | `dev-2` |
| 3 | `user-service` *(nếu có)* | BE Microservice | `project/risk/dev` | `function-mapping.json` (khai báo quyền @ApiMapping) | `dev-1` |
| 4 | `iafs-compose` *(nếu có)* | DevOps / Deploy | `risk/dev` | `docker-compose.yml`, biến môi trường container | `cicd` |

---

## 3. API Contract (Hợp đồng giao tiếp giữa BE và FE)

### 3.1. Danh sách Endpoint

#### `GET /api/<feature>/list`
- **Mục đích**: Lấy danh sách có phân trang và tìm kiếm.
- **Phân quyền**: `@ApiMapping(id = "<nhóm-chức-năng>", action = {"view"})` (khớp với `function-mapping.json`).
- **Headers**:
  - `cid`: Company ID
  - `uid`: User ID
- **Params**:
  - `keyword` (`String`, optional): Từ khóa tìm kiếm (debounce 300ms từ FE).
  - `status` (`Integer`, optional): Trạng thái (1: Hoạt động, 0: Ngừng hoạt động).
  - `page` (`int`): Trang hiện tại (0-indexed).
  - `size` (`int`): Số bản ghi trên trang (10, 20, 50).
- **Response (200 OK)**:
  ```json
  {
    "code": 200,
    "message": "Thành công",
    "data": {
      "content": [
        {
          "id": 1,
          "code": "CODE_01",
          "name": "Tên bản ghi",
          "status": 1,
          "createDate": "2026-10-21T15:30:00",
          "createBy": "admin",
          "modifiedDate": "2026-10-21T15:30:00",
          "updateBy": "admin"
        }
      ],
      "totalElements": 1,
      "totalPages": 1,
      "size": 20,
      "number": 0
    }
  }
  ```

#### `POST /api/<feature>/create`
- **Mục đích**: Thêm mới bản ghi.
- **Phân quyền**: `@ApiMapping(id = "<nhóm-chức-năng>", action = {"create"}, auditMsg = "Thêm mới ...")`.
- **Request Body**:
  ```json
  {
    "code": "CODE_01",
    "name": "Tên bản ghi"
  }
  ```
- **Mã lỗi nghiệp vụ (BusinessException)**:
  - 400: `feature.create.code-exists` — "Mã này đã tồn tại trong hệ thống".
  - 400: `feature.create.name-required` — "Tên bản ghi không được để trống".

---

## 4. Mô hình hóa dữ liệu (Database Schema)

- **Tên bảng**: `rk_<feature>` hoặc `adm_<feature>`
- **Khóa chính**: `id BIGSERIAL PRIMARY KEY`
- **Kế thừa**: `PersistableEntity<Long>` (có sẵn `create_date`, `create_by`, `modified_date`, `update_by`, `status`, `company_id`, `version`) hoặc `MakerCheckerEntity<Long>` (nếu có phê duyệt 2 bước).
- **Các cột nghiệp vụ bổ sung**:
  - `code VARCHAR(50) NOT NULL` (Unique Index `uq_rk_<feature>_code`)
  - `name VARCHAR(255) NOT NULL`
- **Ràng buộc**: Mọi quan hệ 1-N / N-N dùng bảng trung gian có Foreign Key, tuyệt đối không lưu chuỗi CSV hay JSON blob.

---

## 5. Khung 9 mục đặc tả hành vi giao diện (Screen Behavior Spec)

1. **Mục đích & Điểm vào**: Route `/<module>/<feature>`, menu sidebar cấp 2, yêu cầu quyền `view`.
2. **Cấu trúc trang**: Tiêu đề trang `h5`, breadcrumb, không dùng Tabs (hoặc có Tabs nếu là Hub).
3. **Vùng điều khiển**: Ô tìm kiếm debounce 300ms (reset page về 0), dropdown lọc Trạng thái (mặc định "Đang hoạt động"), nút "+ Thêm mới" bên phải.
4. **Bảng danh sách**:
   - Cột 1: Mã bản ghi (in đậm, `cursor: pointer` -> click mở xem chi tiết).
   - Cột 2: Tên bản ghi.
   - Cột 3: Trạng thái (Chip xanh: Đang hoạt động, Chip xám: Ngừng hoạt động).
   - Cột 4-7: 4 cột audit (`Ngày tạo`, `Người tạo`, `Ngày sửa`, `Người sửa`).
   - Cột 8: Hành động (Sửa, Xóa).
   - Dòng `<TableStateRow>` xử lý đủ: Đang tải, Lỗi (nút Thử lại), Trống dữ liệu.
5. **Hành vi ghi (CRUD)**:
   - Sửa bản ghi: Dialog mở ở **View Mode** mặc định (`[Đóng] [Sửa]`). Bấm "Sửa" mới chuyển sang Edit mode (`[Hủy] [Lưu]`). Nút "Lưu" chỉ bật khi có thay đổi thực tế (dirty checking).
   - Thêm mới: Mở ở Edit mode ngay, lưu xong đóng Dialog.
   - Xóa: Mở `<ConfirmDialog>`.
6. **Phân quyền trên UI**: Nút không có quyền bị disable kèm Tooltip giải thích, không ẩn hoàn toàn.
7. **Phản hồi thao tác**: Thao tác Dialog báo lỗi bằng `<Alert>` inline bên trong Dialog. Thao tác Xóa ngoài bảng báo Toast.
8. **Điều hướng & Deep Link**: Mở Dialog sync URL `?id=123`. Có nút `<CopyLinkButton>` cạnh tiêu đề Dialog.
9. **Responsive**: Chia 2 cột trên desktop (`DialogFieldGrid`), co về 1 cột trên mobile.

---

## 6. Phân chia lát cắt dọc (Vertical Slice)

| Lát cắt | Dev phụ trách | Phạm vi Backend | Phạm vi Frontend |
|---|---|---|---|
| **Lát 1 (Xem & Tìm kiếm)** | `dev-1` | Entity, DDL, Repo, Service, API `GET /list` và `GET /{id}` | Bảng danh sách, phân trang, tìm kiếm, View mode Dialog |
| **Lát 2 (Thêm, Sửa, Xóa)** | `dev-2` | Service, API `POST /create`, `PUT /update`, `DELETE /{id}` | Edit mode Dialog, validation, ConfirmDialog Xóa |

### File dùng chung (Chỉ giao đúng 1 Dev chỉnh sửa):
- `iafs-portal-credit-risk/src/app/configs/navigationConfig.ts` (Giao cho `dev-1`)
- `iafs-portal-credit-risk/src/app/configs/routesConfig.tsx` (Giao cho `dev-1`)
- `user-service/src/main/resources/json/function-mapping.json` (Giao cho `dev-1`)

---

## 7. Kịch bản kiểm thử (Test Cases)

| Mã TC | Tiêu đề | Vai trò | Các bước thao tác | Kết quả mong đợi |
|---|---|---|---|---|
| **TC-1** | Tìm kiếm từ khóa | User | Nhập từ khóa vào ô search | Bảng tự reload sau 300ms, hiển thị đúng kết quả |
| **TC-2** | Xem chi tiết bản ghi | User | Click ô cột đầu tiên | Mở Dialog ở chế độ Xem (toàn bộ field disabled) |
| **TC-3** | Bật Edit mode | Admin | Bấm nút "Sửa" trong Dialog | Mở khóa field, cụm nút đổi thành Hủy / Lưu |
| **TC-4** | Dirty checking | Admin | Chưa sửa gì | Nút "Lưu" vẫn bị disabled |
| **TC-5** | Lưu cập nhật | Admin | Sửa tên và bấm "Lưu" | Báo thành công, cập nhật snapshot, quay lại View mode |
| **TC-6** | Phân quyền xóa | User không có quyền | Rê chuột vào icon Xóa | Icon bị disabled kèm Tooltip giải thích |

---

## 8. Đánh giá Rủi ro Kỹ thuật & Phương án Giảm thiểu (Risk Assessment & Mitigation)

| Mã RR | Rủi ro tiềm ẩn | Mức độ | Tác động chi tiết | Phương án Giảm thiểu / Giải pháp kỹ thuật |
|---|---|---|---|---|
| **R-01** | *[Quá tải hiệu năng / Tải dữ liệu lớn]* | **CAO** | *[Ảnh hưởng đến bộ nhớ RAM, CSDL, mạng hoặc tính ổn định]* | 1. *[Thiết lập giới hạn an toàn / Validation ngưỡng]*<br>2. *[Áp dụng Cache / Phân trang / Tối ưu câu truy vấn]* |
| **R-02** | *[Xung đột ghi đè dữ liệu đồng thời]* | **TRUNG BÌNH** | *[Nhiều người cùng cập nhật 1 bản ghi]* | 1. *[Sử dụng trường version (Optimistic Locking)]*<br>2. *[Bắt ngoại lệ và yêu cầu tải lại dữ liệu mới nhất]* |
| **R-03** | *[Lỗi dữ liệu ngoại lai / Dữ liệu rỗng]* | **THẤP** | *[Lỗi định dạng, ngoại lệ công thức hoặc giá trị null]* | 1. *[Xử lý fallback giá trị mặc định an toàn]*<br>2. *[Ghi log cảnh báo và thông báo lỗi thân thiện trên UI]* |

---

## 9. Các Câu hỏi Làm rõ & Nhật ký Quyết định Thiết kế (Open Questions & Decision Log)

Bảng ghi nhận các vấn đề nghiệp vụ cần làm rõ và chốt với PO / Dev Leader trước khi hiện thực hóa mã nguồn:

| STT | Vấn đề / Câu hỏi làm rõ | Phương án đề xuất (Khuyên dùng) | Phương án thay thế | Trạng thái |
|:---:|---|---|---|:---:|
| **Q-1** | *[Vấn đề cần làm rõ 1, vd: Xử lý dữ liệu trùng lặp / ngoại lệ]* | **Phương án A (Khuyên dùng):** *[Mô tả giải pháp đề xuất tối ưu]* | **Phương án B:** *[Mô tả giải pháp thay thế]* | `Đang chờ chốt (Pending)` / `Đã chốt Phương án A (Accepted)` |
| **Q-2** | *[Vấn đề cần làm rõ 2, vd: Cú pháp phân tách / Quy tắc làm tròn]* | **Phương án A (Khuyên dùng):** *[Mô tả giải pháp đề xuất tối ưu]* | **Phương án B:** *[Mô tả giải pháp thay thế]* | `Đang chờ chốt (Pending)` / `Đã chốt Phương án A (Accepted)` |

---

## 10. Nhật ký Sự cố & Xử lý Khiếm khuyết do Người dùng / PO Phản ánh (User Raised Issues & Defect Remediation Log)

Bảng ghi nhận toàn bộ các vấn đề, lỗi giao diện, lỗi nghiệp vụ, hoặc phản hồi phát sinh do PO / Người dùng phát hiện trong quá trình kiểm thử hoặc nghiệm thu thực tế, kèm phân tích nguyên nhân gốc rễ và giải pháp khắc phục triệt để:

| Mã Issue | Phản ánh của Người dùng / PO | Phân loại & Mức độ | Nguyên nhân Gốc rễ (Root Cause) | Giải pháp Kỹ thuật & Kết quả Xử lý | Trạng thái |
|:---:|---|:---:|---|---|:---:|
| **ISS-01** | *[Trích dẫn câu hỏi / lỗi người dùng phản ánh, vd: "ấn nút phê duyệt báo 2 toast..."]* | *[UI / Backend / Logic SoD]*<br>*(Cao / Trung bình / Thấp)* | *[Mô tả chính xác nguyên nhân gốc rễ sau khi trace mã nguồn và dữ liệu thật]* | 1. *[Hành động sửa ở Backend / Frontend]*<br>2. *[Kết quả kiểm chứng thực tế / Ảnh bằng chứng]* | `ĐANG XỬ LÝ (Doing)` / `ĐÃ GIẢI QUYẾT (Verified)` |
| **ISS-02** | *[Vấn đề 2]* | *[Phân loại]* | *[Nguyên nhân]* | *[Giải pháp]* | `ĐANG XỬ LÝ (Doing)` / `ĐÃ GIẢI QUYẾT (Verified)` |
