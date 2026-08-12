# CHANGELOG — Nhật Ký Thay Đổi Repo

Mọi thay đổi đáng kể, sửa lỗi, và tính năng mới được ghi tại đây (mới nhất lên đầu).

---

## [2026-08-12] — Xây dựng OrbitEval Web App Observability & Việt hóa UI Dashboard

### Thêm mới (Added)
- **OrbitEval Web App Platform (`server.py`, `index.html`, `style.css`, `app.js`):**
  - Xây dựng giao diện web dashboard theo phong cách chuẩn **Trace. AI Observability Platform** (Sidebar tối Dark Slate + Glass Canvas sáng).
  - Tích hợp 4 nhóm tính năng chính: **Tổng Quan & KPIs**, **Kho Dữ Liệu Golden Dataset (20 QA)**, **Phân Tích Lỗi & 5 Whys**, và **Thử Nghiệm Live Custom Sandbox**.
  - Kết nối backend server Python API (`/api/benchmark`, `/api/evaluate-custom`, `/api/re-eval`, `/api/system-status`) phục vụ chấm điểm và chạy đánh giá thời gian thực.
- **Việt hóa toàn bộ giao diện (Vietnamese UI Localization):**
  - Chuyển toàn bộ nhãn menu, thẻ KPI (*Độ trung thực, Độ phủ ngữ cảnh, Điểm sức khỏe chất lượng*), bộ lọc độ khó (*Dễ, Trung bình, Khó, Bẫy*), và bảng 20 câu hỏi sang tiếng Việt dễ hiểu cho người dùng.
- **Cấu hình Vercel Cloud Deployment (`vercel.json`, `server.py`):**
  - Bổ sung file `vercel.json` và xuất `handler` chuẩn Serverless giúp ứng dụng deploy trực tiếp lên Vercel Cloud mượt mà.
- **Tối ưu trải nghiệm cuộn trang (Custom Scrollbars & Sticky Headers):**
  - Giới hạn độ cao tối đa (`max-height: 460px`) cho bảng câu hỏi và kho dữ liệu Golden Dataset kèm thanh cuộn mượt (custom scrollbar), ghim cố định tiêu đề bảng (sticky header) giúp giao diện gọn gàng, không bị tràn cuộn dài.

### Nguyên nhân & Giải pháp (Fixes & Maintenance)
- **Lỗi Encoding Console Windows (`UnicodeEncodeError: 'charmap'`):**
  - *Nguyên nhân:* Mặc định Windows console (cp1252) không render trực tiếp được ký tự unicode emoji (`🚀`) khi chạy `print()`.
  - *Giải pháp:* Thay thế bằng chuỗi ASCII chuẩn `[OrbitEval Server] Running at http://localhost:8000` giúp server khởi động ổn định 100%.

---

## [2026-08-12] — Hoàn thiện Core Logic & Golden Dataset Benchmark (Day 14)

### Thêm mới (Added)
- Hoàn thiện `template.py` & `solution/solution.py` với các data models (`QAPair`, `EvalResult`), `RAGASEvaluator`, `LLMJudge`, `BenchmarkRunner` và `FailureAnalyzer`.
- Cập nhật bộ dữ liệu `golden_dataset.json` gồm 20 QA Pairs phân bổ chuẩn (5 Easy, 7 Medium, 5 Hard, 3 Adversarial).
- Sinh kết quả benchmark thực tế lưu tại `artifacts/benchmark_results.json` và `artifacts/actual_answers.json`.
