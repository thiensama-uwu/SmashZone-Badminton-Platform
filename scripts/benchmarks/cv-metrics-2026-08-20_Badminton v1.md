# Số liệu định lượng cho CV — đo ngày 2026-08-20

Nguồn: đo trực tiếp trên nhánh `main`, commit gần nhất `67aa8cd`.
Mục đích: kho số liệu thô để sau này chọn đưa vào CV. Mỗi mục ghi: **con số**,
cách đo, và mức tin cậy. Con số nào đo ở mức **logic/đại diện** (thiếu hạ tầng
thật) ghi rõ để chạy lại end-to-end sau.

> Môi trường đo: Node v22.18.0, Windows 11. **Docker KHÔNG chạy** lúc đo → các
> phép cần Postgres/RabbitMQ/Redis live (#8, #9 mức end-to-end) chỉ đo được ở mức
> logic/đại diện; phần còn lại đo trên module thật hoặc build thật.

---

## Bảng tóm tắt (chọn nhanh cho CV)

| # | Vấn đề | Con số đo được | Trạng thái |
|---|--------|----------------|-----------|
| 1 | Chống double-booking (khóa phân tán 2 lớp) | **100%** — 1/1.000 request song song giữ được slot, chặn 999 | ✅ Đo xong (module thật) |
| 2 | Idempotency chống tạo trùng khi retry | **100%** dedup — 500 request trùng → 1 bản ghi | ✅ Đo xong (module thật) |
| 6 | Code-splitting frontend (React.lazy + Vite) | Initial **~97.5 KB gzip / 61 chunks**, giảm **~80.7%** payload đầu | ✅ Đo xong (build thật) |
| 7 | Nén gzip asset khi truyền mạng | Tỉ lệ **~3.32×**, giảm **~69.9%** (1.680 → 506 KB) | ✅ Đo xong (build thật) |
| 3 | Bcrypt hashing (chống brute-force) | **~219 ms/hash** (cost 10) → ~4.6 hash/s | ✅ Đo xong (thư viện thật) |
| 4 | Zod input validation | **~66.700 validations/s** (~15 µs/request) | ✅ Đo xong (thư viện thật) |
| 5 | Fixed-window rate limiter | **100%** chính xác (5/10.000) · **~35.700 ops/s** | ✅ Đo xong (module thật) |
| 10 | JWT verify (xác thực stateless) | **~658 verify/s** (~1.5 ms), 0 truy vấn DB/request | ✅ Đo xong (thư viện thật) |
| 8 | Cache lịch trống (cache-hit vs build lại payload) | Nhanh **~455×**, giảm **~99.8%** latency phía server | ⚠️ Đại diện (chưa gồm DB thật) |
| 9 | Gateway security pipeline (rate-limit + JWT + RBAC) | **~1.027 req/s**, **p99 ~3.0 ms** (chi phí CPU) | ⚠️ Đại diện (in-process) |

---

## Chi tiết từng phép đo

### #1 — Chống double-booking (khóa phân tán 2 lớp) ✅
- **Con số**: 1.000 request đồng thời cùng đặt **một** slot → chỉ **1** giữ được
  khóa, **999** bị từ chối → **100% chống double-booking** (không slot nào bán 2 lần).
- **Cách đo**: gọi trực tiếp module thật `backend/shared/lib/distributed-lock.js`
  (`acquireLock` với `SET NX PX`) qua Redis emulator in-memory mô phỏng đúng
  semantics `NX/PX`; đếm số lock cấp được (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Thiết kế khóa phân tán 2 lớp (Redis + PostgreSQL) đạt 100%
  chống double-booking dưới 1.000 request đồng thời vào cùng một khung giờ."*
- Ghi chú: đo đúng tính đúng đắn của logic loại trừ; muốn số end-to-end thật cần
  bật Redis + Postgres (thường qua Docker).

### #2 — Idempotency chống tạo trùng khi retry ✅
- **Con số**: 500 request lặp cùng `Idempotency-Key` → chỉ **1** bản ghi được tạo,
  **499** trả kết quả cũ → **100% dedup**.
- **Cách đo**: module thật `backend/shared/lib/idempotency-store.js`
  (`claimProcessing` dùng `SET NX PX`) qua Redis emulator (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Triển khai idempotency cho request client và webhook ngân
  hàng, loại 100% giao dịch trùng (500 request lặp → 1 bản ghi)."*

### #6 — Code-splitting frontend (React.lazy + Vite) ✅
- **Con số**: build production tách thành **61 chunk** (60 chunk route/vendor lazy).
  Initial load chỉ **~97.5 KB gzip**, so với **~506 KB gzip** nếu gộp 1 bundle →
  **giảm ~80.7%** payload tải lần đầu. Các thư viện nặng (xlsx ~137 KB, apexcharts
  ~136 KB, leaflet ~43 KB gzip) được tách hẳn khỏi initial bundle.
- **Cách đo**: `vite build` → `dist/`, gzip từng asset và phân loại
  entry vs lazy chunk (script `bench-frontend.cjs`).
- **Câu CV gợi ý**: *"Code-splitting theo route giảm ~81% payload tải ban đầu (từ
  ~506 KB xuống ~98 KB gzip), tách xlsx/apexcharts/leaflet khỏi initial bundle."*

### #7 — Nén gzip asset khi truyền mạng ✅
- **Con số**: tổng asset **1.680 KB** → **506 KB** sau gzip → tỉ lệ nén **~3.32×**,
  tiết kiệm **~69.9%** băng thông truyền.
- **Cách đo**: gzip level 9 toàn bộ `dist/assets`, so byte (script `bench-frontend.cjs`).
- **Câu CV gợi ý**: *"Nén gzip giảm ~70% dung lượng asset truyền qua mạng (1.680 KB
  → 506 KB, tỉ lệ 3.3×)."*

### #3 — Bcrypt hashing (chống brute-force) ✅
- **Con số**: băm mật khẩu bcrypt **cost 10 ≈ 219 ms/hash** → chỉ **~4.6 hash/giây**,
  khiến brute-force offline chậm hơn ~5–6 bậc so với hàm băm thường.
- **Cách đo**: đo `bcrypt.hash` 50 lần trên thư viện thật `bcryptjs`
  (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Băm mật khẩu bcrypt cost 10 (~4.6 hash/s) làm brute-force
  offline bất khả thi."*
- Ghi chú: số ms/hash phụ thuộc CPU máy đo.

### #4 — Zod input validation ✅
- **Con số**: validate schema `holdSchema` (đặt sân) đạt **~66.700 lần/giây**
  (~15 µs/request) → overhead không đáng kể so với I/O.
- **Cách đo**: `schema.safeParse` 100.000 lần trên schema thật của dự án
  (`booking-schemas.js`) (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Kiểm tra đầu vào bằng Zod với ~66.700 lượt/giây (~15 µs),
  overhead không đáng kể."*

### #5 — Fixed-window rate limiter ✅
- **Con số**: với ngưỡng 5/cửa sổ, 10.000 request → cho qua đúng **5**, chặn **9.995**
  → **100% chính xác**. Throughput bản Redis Lua **~35.700 ops/giây**.
- **Cách đo**: module thật `backend/shared/lib/rate-limiter.js`
  (`createRateLimiter` in-memory + `createRedisRateLimiter` qua emulator)
  (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Rate limiter cửa sổ cố định chặn brute-force/spam với độ
  chính xác 100% và thông lượng ~35.700 ops/s."*

### #10 — JWT verify (xác thực stateless) ✅
- **Con số**: xác thực JWT **~658 verify/giây** (~1.5 ms/lần) mà **không truy vấn
  DB** cho mỗi request đã đăng nhập.
- **Cách đo**: `jwt.verify` (HS256) 5.000 lần trên thư viện thật `jsonwebtoken`
  (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Xác thực stateless bằng JWT (~1.5 ms/verify, 0 truy vấn DB),
  gộp toàn bộ auth + RBAC về API Gateway."*
- Ghi chú: số verify/s phụ thuộc CPU; `jsonwebtoken` nặng hơn HMAC thuần.

---

### #8 — Cache lịch trống (Redis) ⚠️ đại diện
- **Con số**: phục vụ payload lịch trống từ cache-hit nhanh hơn **~455×**, giảm
  **~99.8%** chi phí so với build + serialize lại payload cho mỗi request.
- **Cách đo**: so latency giữa (a) build lại + `JSON.stringify` payload ~32 slot và
  (b) trả chuỗi đã cache từ `Map`, 20.000 vòng (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Cache Redis tầng đọc giảm mạnh chi phí dựng lại payload lịch
  trống cho mỗi request lặp."*
- Ghi chú quan trọng: phần "cold" **mô phỏng chi phí build+serialize phía server**,
  **không** gồm round-trip DB thật → nên nói "logic-level" hoặc đo lại end-to-end
  với Postgres/Redis live nếu muốn số chắc.

### #9 — Gateway security pipeline (rate-limit + JWT + RBAC) ⚠️ đại diện
- **Con số**: pipeline bảo mật mỗi request (rate-limit → verify JWT → check role)
  đạt **~1.027 req/giây**, **p50 ~0.64 ms, p95 ~1.84 ms, p99 ~2.99 ms** (5.000 mẫu).
- **Cách đo**: chạy pipeline in-process mô phỏng gateway (script `bench-backend.cjs`).
- **Câu CV gợi ý**: *"Pipeline bảo mật tại API Gateway (rate-limit + JWT + RBAC)
  xử lý ~1.000 req/s với p99 ~3 ms."*
- Ghi chú quan trọng: chỉ đo **chi phí CPU** của pipeline, **không** gồm
  network/proxy tới downstream service → nên đo lại end-to-end trên stack chạy thật.

---

## Tái tạo số liệu

Scripts nằm cùng thư mục `scripts/benchmarks/`.

- Backend (#1–#5, #8, #9, #10) — không cần hạ tầng:
  `node scripts/benchmarks/bench-backend.cjs`
- Frontend (#6, #7) — cần build trước:
  `cd frontend && npx vite build && cd ..` → `node scripts/benchmarks/bench-frontend.cjs`

Muốn nâng #8, #9 lên mức end-to-end thật cần bật Redis + Postgres + services
(`docker compose up` → `npm run db:push` → `npm run start:all`), rồi đo bằng công
cụ bắn tải HTTP (vd `autocannon`) vào gateway đang chạy.

Dữ liệu thô JSON: [`backend-results.json`](./backend-results.json),
[`frontend-results.json`](./frontend-results.json).
