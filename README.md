# ClassTools PDF (pdf.classtools.vn)

Bộ công cụ PDF miễn phí chạy **100% trong trình duyệt** — tệp không bao giờ rời khỏi thiết bị của người dùng. Triển khai trên **Cloudflare Workers** với static assets.

## Công cụ (13)

| Tool | Route | Chức năng |
|---|---|---|
| **Ghép PDF** | `/merge` | Gộp nhiều tệp, đổi thứ tự, xuất 1 tệp |
| **Tách / Trích** | `/split` | Khoảng (`1-3, 5`), mỗi N trang, chọn trên preview, xuất ZIP |
| **Sắp xếp trang** | `/organize` | Kéo-thả, xoay, xóa, nhân đôi, chèn trang trắng, đảo ngược |
| **Chỉnh sửa** | `/edit` | Chữ tiếng Việt (Roboto nhúng), ảnh, dấu mờ chữ/ảnh, số trang, kéo layer |
| **Ký PDF** | `/sign` | Vẽ/gõ chữ ký, ký 1 hoặc tất cả trang, lưu chữ ký dùng lại |
| **Nén PDF** | `/compress` | Ghostscript WASM, 3 preset (300/150/72 dpi), hiển thị % tiết kiệm |
| **Mật khẩu** | `/protect` | Mã hóa AES-128/256 và mở khóa bằng qpdf WASM |
| **PDF thành ảnh** | `/pdf-to-images` | JPG/PNG từng trang, 720/1080/1440px, tải ZIP |
| **Ảnh thành PDF** | `/images-to-pdf` | Hàng loạt ảnh, khổ A4/Letter/vừa ảnh, sắp thứ tự |
| **Trích chữ** | `/extract-text` | Theo trang/toàn bộ, copy + tải .txt |
| **N trang/tờ** | `/nup` | 1×2 / 2×2 / 2×3 / 3×3 trên tờ A4 (ngang/dọc) |
| **Cắt mép** | `/crop` | CropBox theo mm, cảnh báo trang quá nhỏ |
| **Metadata** | `/metadata` | Xem/sửa title/author/keywords, xóa sạch |

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
