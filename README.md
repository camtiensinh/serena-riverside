# Serena Riverside Social Arena

Hệ thống minigame sự kiện gồm form nhận bài Facebook, CMS quản trị, quét chỉ số qua Apify, bảng xếp hạng trình chiếu và vòng quay may mắn điều khiển từ CMS.

## Các trang chính

- Form: https://serena-riverside.vercel.app
- CMS: https://serena-riverside.vercel.app/admin
- Bảng xếp hạng: https://serena-riverside.vercel.app/live
- Vòng quay may mắn: https://serena-riverside.vercel.app/lucky

## Công nghệ

- Next.js 16, React 19, TypeScript
- Neon Postgres
- Vercel
- Apify Facebook Posts Scraper

## Chạy trên máy mới

Yêu cầu Node.js 20 trở lên và một database Postgres/Neon mới. Không dùng chung database production nếu chỉ muốn phát triển hoặc thử nghiệm.

```powershell
git clone <URL_REPOSITORY>
cd serena-riverside
npm install
Copy-Item .env.example .env.local
```

Điền các biến trong `.env.local`:

```dotenv
DATABASE_URL=postgresql://...
ADMIN_PASSWORD=mat-khau-quan-tri
SESSION_SECRET=chuoi-ngau-nhien-dai
KEY_ENCRYPTION_SECRET=chuoi-ngau-nhien-dai
CRON_SECRET=chuoi-ngau-nhien-dai
APP_URL=http://localhost:3000
```

Khởi tạo database và chạy dự án:

```powershell
npm run db:migrate
npm run dev
```

Mở http://localhost:3000 và http://localhost:3000/admin. Token Apify được thêm trong CMS, mã hóa trước khi lưu vào database.

## Kiểm tra trước khi triển khai

```powershell
npm test
npm run build
```

## Triển khai Vercel

1. Import repository này vào Vercel.
2. Tạo Neon database riêng cho môi trường đó.
3. Khai báo toàn bộ biến trong `.env.example` tại Vercel Project Settings.
4. Chạy `npm run db:migrate` với chuỗi kết nối database mới.
5. Deploy và cập nhật `APP_URL` thành domain thật.

## Nguyên tắc vận hành

- Hệ thống chỉ gọi Apify khi admin nhấn quét.
- Link Facebook được chuẩn hóa và chặn trùng ngay khi submit/import.
- Hashtag so khớp nguyên token Unicode, không phân biệt hoa thường.
- CMS và các màn trình chiếu đọc dữ liệu từ database; việc làm mới giao diện không tự quét Facebook.
- API key Apify được mã hóa AES-256-GCM. Không commit `.env.local`, `.vercel`, `ADMIN-ACCESS.local.txt` hoặc file log.

## Dữ liệu và tài khoản

Repository không chứa database production, API key Apify, mật khẩu CMS hay session secret. Người nhận mã nguồn phải tạo database và biến môi trường của riêng họ.
