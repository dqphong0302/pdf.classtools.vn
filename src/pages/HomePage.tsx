import {
  Archive,
  Camera,
  Combine,
  Crop,
  EyeOff,
  FileCode,
  FileSignature,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Hash,
  Image,
  Images,
  Layers,
  LayoutList,
  Lock,
  PenLine,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Stamp,
  Table,
  Table2,
  Wrench
} from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';

const TOOLS = [
  // Nhóm 1: Tổ chức & Sắp xếp PDF
  {
    to: '/merge',
    icon: Combine,
    accent: 'linear-gradient(135deg, #60a5e3, #1d5d97)',
    title: { vi: 'Ghép PDF', en: 'Merge PDF' },
    description: {
      vi: 'Gộp nhiều tệp PDF thành một, kéo đổi thứ tự trước khi ghép.',
      en: 'Combine multiple PDFs into one and reorder files before merging.'
    }
  },
  {
    to: '/split',
    icon: Scissors,
    accent: 'linear-gradient(135deg, #ffb242, #b85b39)',
    title: { vi: 'Tách / Trích trang', en: 'Split & Extract' },
    description: {
      vi: 'Cắt theo khoảng trang (vd 1-3, 5), tách mỗi N trang, tải ZIP.',
      en: 'Cut by page ranges (e.g. 1-3, 5), split every N pages, download ZIP.'
    }
  },
  {
    to: '/organize',
    icon: LayoutList,
    accent: 'linear-gradient(135deg, #5ebe78, #2c7a3b)',
    title: { vi: 'Sắp xếp trang', en: 'Organize Pages' },
    description: {
      vi: 'Kéo thả sắp trang, xoay, xóa, nhân đôi, chèn trang trắng.',
      en: 'Drag pages, rotate, delete, duplicate, insert blank pages.'
    }
  },
  {
    to: '/rotate',
    icon: RotateCw,
    accent: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    title: { vi: 'Xoay PDF', en: 'Rotate PDF' },
    description: {
      vi: 'Xoay tất cả hoặc từng trang riêng lẻ theo góc 90° hoặc 180° tức thì.',
      en: 'Rotate all or specific PDF pages by 90° or 180° instantly.'
    }
  },
  {
    to: '/page-numbers',
    icon: Hash,
    accent: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    title: { vi: 'Đánh số trang', en: 'Page Numbers' },
    description: {
      vi: 'Đánh số trang tự động, tùy chọn vị trí góc/giữa và bỏ qua bìa.',
      en: 'Add automatic page numbers with customizable positions and formats.'
    }
  },
  {
    to: '/watermark',
    icon: Stamp,
    accent: 'linear-gradient(135deg, #ec4899, #be185d)',
    title: { vi: 'Đóng dấu (Watermark)', en: 'Add Watermark' },
    description: {
      vi: 'Đóng dấu chữ bản quyền hoặc logo mờ, xoay 45°, chỉnh độ trong suốt.',
      en: 'Stamp text or image watermarks with custom angles and opacity.'
    }
  },
  {
    to: '/crop',
    icon: Crop,
    accent: 'linear-gradient(135deg, #10b981, #047857)',
    title: { vi: 'Cắt mép trang', en: 'Crop Margins' },
    description: {
      vi: 'Thu gọn lề trắng của mọi trang theo mm, xem trước trước khi lưu.',
      en: 'Trim white margins on every page in mm with a preview.'
    }
  },
  {
    to: '/nup',
    icon: Table2,
    accent: 'linear-gradient(135deg, #f59e0b, #d97706)',
    title: { vi: 'N trang / tờ', en: 'N-up Pages' },
    description: {
      vi: 'Gộp 2, 4, 6, 9 trang lên một tờ A4 để in tiết kiệm giấy.',
      en: 'Fit 2, 4, 6 or 9 pages onto one A4 sheet to save paper.'
    }
  },

  // Nhóm 2: Chỉnh sửa, Ký & Che mật
  {
    to: '/edit',
    icon: PenLine,
    accent: 'linear-gradient(135deg, #6366f1, #4338ca)',
    title: { vi: 'Chỉnh sửa PDF', en: 'Edit PDF' },
    description: {
      vi: 'Thêm chữ (tiếng Việt), chèn ảnh, đóng dấu mờ chữ/ảnh, số trang.',
      en: 'Add text (Vietnamese), insert images, text/image watermarks, page numbers.'
    }
  },
  {
    to: '/sign',
    icon: FileSignature,
    accent: 'linear-gradient(135deg, #f97316, #c2410c)',
    title: { vi: 'Ký PDF', en: 'Sign PDF' },
    description: {
      vi: 'Vẽ hoặc gõ chữ ký, ký một hoặc tất cả các trang, lưu chữ ký.',
      en: 'Draw or type a signature, sign one or all pages, save signatures.'
    }
  },
  {
    to: '/redact',
    icon: EyeOff,
    accent: 'linear-gradient(135deg, #ef4444, #991b1b)',
    title: { vi: 'Bôi đen che mật (Redact)', en: 'Redact PDF' },
    description: {
      vi: 'Bôi đen vĩnh viễn vùng thông tin nhạy cảm (CCCD, tài khoản, mật khẩu).',
      en: 'Permanently blackout sensitive details (IDs, bank details, credentials).'
    }
  },

  // Nhóm 3: Tối ưu, Sửa lỗi & Chuẩn hóa
  {
    to: '/compress',
    icon: FileText,
    accent: 'linear-gradient(135deg, #06b6d4, #0e7490)',
    title: { vi: 'Nén PDF', en: 'Compress PDF' },
    description: {
      vi: 'Giảm dung lượng với Ghostscript (WASM) — 3 mức chất lượng.',
      en: 'Shrink file size with Ghostscript (WASM) — three quality presets.'
    }
  },
  {
    to: '/repair',
    icon: Wrench,
    accent: 'linear-gradient(135deg, #eab308, #a16207)',
    title: { vi: 'Sửa lỗi PDF', en: 'Repair PDF' },
    description: {
      vi: 'Khôi phục file hỏng bảng xref hoặc luồng stream bằng QPDF WASM.',
      en: 'Recover corrupted or unreadable PDFs by rebuilding xref tables.'
    }
  },
  {
    to: '/pdf-to-pdfa',
    icon: Archive,
    accent: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    title: { vi: 'PDF sang PDF/A', en: 'PDF to PDF/A' },
    description: {
      vi: 'Chuẩn hóa tệp sang ISO 19005-2 (PDF/A-2b) để lưu trữ vĩnh viễn.',
      en: 'Convert standard PDFs into long-term archival ISO 19005 (PDF/A-2b).'
    }
  },

  // Nhóm 4: Bảo mật & So sánh
  {
    to: '/protect',
    icon: Lock,
    accent: 'linear-gradient(135deg, #8b5cf6, #4c1d95)',
    title: { vi: 'Mật khẩu PDF', en: 'Protect PDF' },
    description: {
      vi: 'Đặt mật khẩu mở file (AES-128/256) hoặc bỏ mật khẩu bằng qpdf.',
      en: 'Add an open password (AES-128/256) or remove one with qpdf.'
    }
  },
  {
    to: '/flatten',
    icon: Layers,
    accent: 'linear-gradient(135deg, #64748b, #334155)',
    title: { vi: 'Làm phẳng PDF', en: 'Flatten PDF' },
    description: {
      vi: 'Hợp nhất toàn bộ form field và chữ ký vào nền trang chống sửa.',
      en: 'Merge form fields and signatures into standard non-editable graphics.'
    }
  },
  {
    to: '/compare',
    icon: GitCompare,
    accent: 'linear-gradient(135deg, #f43f5e, #be123c)',
    title: { vi: 'So sánh PDF (Compare)', en: 'Compare PDF' },
    description: {
      vi: 'So sánh 2 tài liệu song song hoặc tô màu đỏ các điểm khác biệt.',
      en: 'Compare two PDFs side-by-side or highlight pixel changes with Diff Overlay.'
    }
  },
  {
    to: '/scan',
    icon: Camera,
    accent: 'linear-gradient(135deg, #0284c7, #0369a1)',
    title: { vi: 'Quét từ Camera (Scan)', en: 'Scan to PDF' },
    description: {
      vi: 'Dùng camera/webcam chụp tài liệu, lọc màu đen trắng và xuất PDF.',
      en: 'Scan documents with device camera, apply B&W filters and save as PDF.'
    }
  },

  // Nhóm 5: Chuyển đổi định dạng & Dữ liệu
  {
    to: '/pdf-to-images',
    icon: Image,
    accent: 'linear-gradient(135deg, #d946ef, #a21caf)',
    title: { vi: 'PDF thành ảnh', en: 'PDF to Images' },
    description: {
      vi: 'Xuất từng trang thành ảnh JPG/PNG, tải riêng lẻ hoặc ZIP.',
      en: 'Export each page as JPG/PNG, download individually or as ZIP.'
    }
  },
  {
    to: '/images-to-pdf',
    icon: Images,
    accent: 'linear-gradient(135deg, #10b981, #15803d)',
    title: { vi: 'Ảnh thành PDF', en: 'Images to PDF' },
    description: {
      vi: 'Ghép nhiều ảnh JPG/PNG thành PDF, chọn khổ A4/Letter/vừa ảnh.',
      en: 'Combine JPG/PNG images into a PDF with A4/Letter/fit sizes.'
    }
  },
  {
    to: '/extract-text',
    icon: Search,
    accent: 'linear-gradient(135deg, #38bdf8, #0284c7)',
    title: { vi: 'Trích xuất chữ', en: 'Extract Text' },
    description: {
      vi: 'Lấy toàn bộ chữ từ PDF theo từng trang, sao chép hoặc tải .txt.',
      en: 'Pull all text from a PDF per page, copy or download as .txt.'
    }
  },
  {
    to: '/html-to-pdf',
    icon: FileCode,
    accent: 'linear-gradient(135deg, #f97316, #ea580c)',
    title: { vi: 'HTML sang PDF', en: 'HTML to PDF' },
    description: {
      vi: 'Soạn thảo hoặc dán mã HTML/CSS, xem trước và xuất PDF chuẩn in.',
      en: 'Compose HTML/CSS code, preview and export high-fidelity PDF.'
    }
  },
  {
    to: '/excel-to-pdf',
    icon: FileSpreadsheet,
    accent: 'linear-gradient(135deg, #16a34a, #15803d)',
    title: { vi: 'Excel sang PDF', en: 'Excel to PDF' },
    description: {
      vi: 'Chuyển đổi bảng tính .xlsx/.xls/.csv thành tài liệu PDF kẻ lưới A4.',
      en: 'Convert spreadsheets (.xlsx, .xls, .csv) into clean A4 grid-table PDFs.'
    }
  },
  {
    to: '/pdf-to-excel',
    icon: Table,
    accent: 'linear-gradient(135deg, #059669, #047857)',
    title: { vi: 'PDF sang Excel', en: 'PDF to Excel' },
    description: {
      vi: 'Trích xuất dữ liệu bảng biểu từ PDF sang bảng tính Microsoft Excel (.xlsx).',
      en: 'Extract tabular PDF data into editable Microsoft Excel spreadsheets.'
    }
  },
  {
    to: '/metadata',
    icon: Hash,
    accent: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    title: { vi: 'Sửa metadata', en: 'Edit Metadata' },
    description: {
      vi: 'Xem và sửa tiêu đề, tác giả, từ khóa — hoặc xóa sạch thông tin.',
      en: 'View and edit title, author, keywords — or wipe them entirely.'
    }
  }
];

export function HomePage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <section className="home-hero" aria-labelledby="home-title">
        <span className="home-hero__badge">
          <ShieldCheck size={15} />
          {vi ? '25 công cụ PDF · 100% xử lý tại máy bạn · Không gửi dữ liệu lên mạng' : '25 PDF tools · 100% processed on device · Zero uploads'}
        </span>
        <h1 id="home-title">
          {vi ? (
            <>
              Bộ công cụ PDF toàn diện <em>ngay trong trình duyệt</em>
            </>
          ) : (
            <>
              All-in-One PDF Suite <em>right in your browser</em>
            </>
          )}
        </h1>
        <p className="home-hero__lead">
          {vi
            ? 'Ghép, tách, nén, ký tên, bôi đen mật, so sánh, đóng dấu, xuất Excel, HTML và chuẩn hóa PDF/A với 25 công cụ chuyên nghiệp. Tệp của bạn không bao giờ rời khỏi thiết bị.'
            : 'Merge, split, compress, sign, redact, compare, watermark, convert to Excel, HTML and PDF/A with 25 pro tools. Files never leave your device.'}
        </p>
        <p className="home-hero__privacy">
          <ShieldCheck size={15} />
          {vi ? 'Xử lý tốc độ cao bằng WebAssembly (Ghostscript & QPDF) và pdf-lib' : 'Powered by client-side WebAssembly (Ghostscript & QPDF) and pdf-lib'}
        </p>
      </section>

      <section aria-labelledby="tools-heading">
        <div className="home-section-heading">
          <div>
            <h2 id="tools-heading">{vi ? 'Tất cả 25 công cụ PDF' : 'All 25 PDF tools'}</h2>
            <p>{vi ? 'Chọn một công cụ và bắt đầu ngay — mở là dùng tức thì.' : 'Pick a tool and start right away — instant execution.'}</p>
          </div>
        </div>
        <div className="tool-grid">
          {TOOLS.map(({ to, icon: Icon, accent, title, description }) => (
            <a key={to} className="pdf-tool-card" href={to}>
              <span className="pdf-tool-card__icon" style={{ background: accent }} aria-hidden="true">
                <Icon size={22} />
              </span>
              <h2>{title[locale]}</h2>
              <p>{description[locale]}</p>
              <span className="pdf-tool-card__cta">{vi ? 'Mở công cụ' : 'Open tool'} →</span>
            </a>
          ))}
        </div>
      </section>

      <aside className="home-band">
        <ShieldCheck size={22} aria-hidden="true" />
        <span>
          {vi
            ? 'Quyền riêng tư tuyệt đối: toàn bộ thao tác PDF diễn ra trong bộ nhớ RAM của trình duyệt. Không có tải lên, không thu thập dữ liệu cá nhân.'
            : 'Absolute privacy: all PDF operations run in browser RAM. Zero uploads, zero telemetry, zero data collection.'}
        </span>
      </aside>
    </ToolShell>
  );
}
