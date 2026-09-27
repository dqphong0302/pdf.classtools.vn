# ClassTools PDF (pdf.classtools.vn)

Bộ công cụ PDF miễn phí chạy **100% trong trình duyệt** — tệp không bao giờ rời khỏi thiết bị của người dùng. Triển khai trên **Cloudflare Workers** với static assets.

## Công cụ (25 công cụ toàn diện)

| Tool | Route | Chức năng |
|---|---|---|
| **Ghép PDF** | `/merge` | Gộp nhiều tệp, đổi thứ tự, xuất 1 tệp duy nhất |
| **Tách / Trích** | `/split` | Khoảng (`1-3, 5`), mỗi N trang, chọn trên preview, xuất ZIP |
| **Sắp xếp trang** | `/organize` | Kéo-thả, xoay, xóa, nhân đôi, chèn trang trắng, đảo ngược |
| **Xoay PDF** | `/rotate` | Xoay toàn bộ hoặc từng trang riêng lẻ theo góc 90°/180° |
| **Đánh số trang** | `/page-numbers` | Tùy biến vị trí góc/giữa, định dạng chữ và bỏ qua bìa |
| **Đóng dấu (Watermark)** | `/watermark` | Đóng dấu chữ bản quyền hoặc logo mờ, xoay 45°, chỉnh opacity |
| **Cắt mép** | `/crop` | CropBox theo mm, thu gọn lề trắng |
| **N trang/tờ** | `/nup` | In 2-up, 4-up, 6-up, 9-up trên tờ A4 (tiết kiệm giấy) |
| **Chỉnh sửa** | `/edit` | Chữ tiếng Việt (Roboto nhúng), ảnh, số trang, kéo layer |
| **Ký PDF** | `/sign` | Vẽ hoặc gõ chữ ký số hóa, ký 1 hoặc tất cả trang |
| **Bôi đen che mật (Redact)** | `/redact` | Kéo chuột bôi đen vĩnh viễn vùng thông tin nhạy cảm (CCCD, mã thẻ) |
| **Nén PDF** | `/compress` | Ghostscript WASM, 3 preset (300/150/72 dpi), hiển thị % tiết kiệm |
| **Sửa lỗi PDF (Repair)** | `/repair` | Khôi phục file hỏng bảng xref hoặc luồng stream qua QPDF WASM |
| **PDF sang PDF/A** | `/pdf-to-pdfa` | Chuẩn hóa sang ISO 19005-2 (PDF/A-2b) để lưu trữ vĩnh viễn |
| **Mật khẩu (Protect)** | `/protect` | Mã hóa AES-128/256 và mở khóa bằng qpdf WASM |
| **Làm phẳng (Flatten)** | `/flatten` | Hợp nhất toàn bộ form field và chữ ký vào nền trang chống sửa |
| **So sánh PDF (Compare)** | `/compare` | So sánh 2 file song song hoặc tô màu đỏ các điểm pixel khác biệt |
| **Quét từ Camera (Scan)** | `/scan` | Dùng camera/webcam chụp tài liệu, lọc màu B&W và xuất PDF |
| **PDF thành ảnh** | `/pdf-to-images` | Xuất JPG/PNG từng trang, tải riêng lẻ hoặc ZIP |
| **Ảnh thành PDF** | `/images-to-pdf` | Hàng loạt ảnh, khổ A4/Letter/vừa ảnh, sắp thứ tự |
| **Trích chữ** | `/extract-text` | Theo trang/toàn bộ, copy + tải .txt |
| **HTML sang PDF** | `/html-to-pdf` | Soạn thảo HTML/CSS, xem trước và xuất PDF chuẩn in |
| **Excel sang PDF** | `/excel-to-pdf` | Đọc .xlsx/.xls/.csv và xuất bảng PDF kẻ lưới chuẩn A4 |
| **PDF sang Excel** | `/pdf-to-excel` | Trích xuất bảng dữ liệu từ PDF sang Microsoft Excel (.xlsx) |
| **Metadata** | `/metadata` | Xem/sửa title/author/keywords, xóa sạch thông tin ẩn |

Ngôn ngữ: Việt (mặc định) / English. Dark mode. Không cần tài khoản, không upload.

## Kiến trúc

```
pdf/
├── worker/index.ts        # Cloudflare Worker: security headers + cache assets
├── wrangler.jsonc         # Custom domain pdf.classtools.vn (assets binding)
├── src/
│   ├── lib/               # pdfOps, pdfEdit, pdfSign, pdfPreview (pdf.js), ranges, download
│   ├── components/        # ToolShell (chrome), FileDrop
│   ├── pages/             # Home + 5 tool pages (lazy-loaded per route)
│   └── assets/fonts/      # Roboto TTF (subset nhúng vào PDF, hỗ trợ tiếng Việt)
└── dist/                  # Build output (deploy lên Worker)
```

- **pdf-lib**: thao tác cấu trúc PDF (merge/split/rotate/text/image).
- **pdfjs-dist**: render preview/thumbnail + trích chữ (worker local, không CDN).
- **@pdf-lib/fontkit + Roboto TTF**: chữ tiếng Việt trong PDF (StandardFonts không có dấu).
- **@bentopdf/gs-wasm** (Ghostscript, ~15 MB): nén PDF — lazy-load khi mở tool Compress.
- **@jspawn/qpdf-wasm** (~1.3 MB): mã hóa/mở khóa mật khẩu — lazy-load khi mở tool Protect.
- **JSZip**: đóng gói kết quả tách / PDF→ảnh thành ZIP.
- WASM binary được copy từ node_modules vào `public/wasm/` qua `scripts/copy-wasm.mjs` (chạy tự động trong `prebuild`/`predev`).

## Phát triển

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # vitest (61 tests)
pnpm lint       # eslint
pnpm build      # tsc -b && vite build
pnpm preview
```

## Triển khai

Yêu cầu: Cloudflare account có quyền quản lý DNS `classtools.vn`.

```bash
pnpm deploy
# hoặc: pnpm build && pnpm exec wrangler deploy
```

Lần đầu deploy, wrangler tự tạo custom domain `pdf.classtools.vn` (route đã khai báo trong `wrangler.jsonc`). Worker thêm security headers (nosniff, DENY iframe, referrer-policy, permissions-policy) và cache immutable cho `/assets/*`.

## Quyền riêng tư

Toàn bộ thao tác PDF diễn ra trong RAM của trình duyệt. Không có request upload; chỉ tải thư viện tĩnh từ CDN. Khi đóng tab, mọi dữ liệu tạm biến mất.
