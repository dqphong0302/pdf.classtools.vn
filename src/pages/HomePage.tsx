import {
  Combine,
  Crop,
  FileSignature,
  FileText,
  Hash,
  Image,
  Images,
  LayoutList,
  Lock,
  PenLine,
  Scissors,
  Search,
  ShieldCheck,
  Table2
} from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';

const TOOLS = [
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
    to: '/edit',
    icon: PenLine,
    accent: 'linear-gradient(135deg, #5967ff, #8a7dff)',
    title: { vi: 'Chỉnh sửa PDF', en: 'Edit PDF' },
    description: {
      vi: 'Thêm chữ (tiếng Việt), chèn ảnh, đóng dấu mờ chữ/ảnh, số trang.',
      en: 'Add text (Vietnamese), insert images, text/image watermarks, page numbers.'
    }
  },
  {
    to: '/sign',
    icon: FileSignature,
    accent: 'linear-gradient(135deg, #f0805d, #b85b39)',
    title: { vi: 'Ký PDF', en: 'Sign PDF' },
    description: {
      vi: 'Vẽ hoặc gõ chữ ký, ký một hoặc tất cả các trang, lưu chữ ký.',
      en: 'Draw or type a signature, sign one or all pages, save signatures.'
    }
  },
  {
    to: '/compress',
    icon: FileText,
    accent: 'linear-gradient(135deg, #42a5f5, #00897b)',
    title: { vi: 'Nén PDF', en: 'Compress PDF' },
    description: {
      vi: 'Giảm dung lượng với Ghostscript (WASM) — 3 mức chất lượng.',
      en: 'Shrink file size with Ghostscript (WASM) — three quality presets.'
    }
  },
  {
    to: '/protect',
    icon: Lock,
    accent: 'linear-gradient(135deg, #8a7dff, #1d5d97)',
    title: { vi: 'Mật khẩu PDF', en: 'Protect PDF' },
    description: {
      vi: 'Đặt mật khẩu mở file (AES-128/256) hoặc bỏ mật khẩu bằng qpdf.',
      en: 'Add an open password (AES-128/256) or remove one with qpdf.'
    }
  },
  {
    to: '/pdf-to-images',
    icon: Image,
    accent: 'linear-gradient(135deg, #f06292, #ffb242)',
    title: { vi: 'PDF thành ảnh', en: 'PDF to Images' },
    description: {
      vi: 'Xuất từng trang thành ảnh JPG/PNG, tải riêng lẻ hoặc ZIP.',
      en: 'Export each page as JPG/PNG, download individually or as ZIP.'
    }
  },
  {
    to: '/images-to-pdf',
    icon: Images,
    accent: 'linear-gradient(135deg, #58c9b9, #2c7a3b)',
    title: { vi: 'Ảnh thành PDF', en: 'Images to PDF' },
    description: {
      vi: 'Ghép nhiều ảnh JPG/PNG thành PDF, chọn khổ A4/Letter/vừa ảnh.',
      en: 'Combine JPG/PNG images into a PDF with A4/Letter/fit sizes.'
    }
  },
  {
    to: '/extract-text',
    icon: Search,
    accent: 'linear-gradient(135deg, #60a5e3, #5967ff)',
    title: { vi: 'Trích xuất chữ', en: 'Extract Text' },
    description: {
      vi: 'Lấy toàn bộ chữ từ PDF theo từng trang, sao chép hoặc tải .txt.',
      en: 'Pull all text from a PDF per page, copy or download as .txt.'
    }
  },
  {
    to: '/nup',
    icon: Table2,
    accent: 'linear-gradient(135deg, #ffb242, #f06292)',
    title: { vi: 'N trang / tờ', en: 'N-up Pages' },
    description: {
      vi: 'Gộp 2, 4, 6, 9 trang lên một tờ A4 để in tiết kiệm giấy.',
      en: 'Fit 2, 4, 6 or 9 pages onto one A4 sheet to save paper.'
    }
  },
  {
    to: '/crop',
    icon: Crop,
    accent: 'linear-gradient(135deg, #5ebe78, #25bfa6)',
    title: { vi: 'Cắt mép trang', en: 'Crop Margins' },
    description: {
      vi: 'Thu gọn lề trắng của mọi trang theo mm, xem trước trước khi lưu.',
      en: 'Trim white margins on every page in mm with a preview.'
    }
  },
  {
    to: '/metadata',
    icon: Hash,
    accent: 'linear-gradient(135deg, #8a7dff, #42a5f5)',
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
        <span className="home-hero__badge"><ShieldCheck size={15} />{vi ? 'Miễn phí · Không cần tài khoản · Không tải lên' : 'Free · No account · No uploads'}</span>
        <h1 id="home-title">{vi ? <>Mọi thao tác PDF <em>ngay trên máy bạn</em></> : <>Every PDF action, <em>right on your device</em></>}</h1>
        <p className="home-hero__lead">
          {vi
            ? 'Ghép, tách, sắp xếp, chỉnh sửa và ký PDF bằng các công cụ chạy 100% trong trình duyệt. Không có tệp nào được gửi lên máy chủ.'
            : 'Merge, split, organize, edit and sign PDFs with tools that run 100% in your browser. No file ever reaches a server.'}
        </p>
        <p className="home-hero__privacy"><ShieldCheck size={15} />{vi ? 'Xử lý cục bộ bằng pdf-lib trong trình duyệt' : 'Processed locally with pdf-lib in your browser'}</p>
      </section>

      <section aria-labelledby="tools-heading">
        <div className="home-section-heading">
          <div>
            <h2 id="tools-heading">{vi ? 'Công cụ PDF' : 'PDF tools'}</h2>
            <p>{vi ? 'Chọn một công cụ và bắt đầu ngay — mở là dùng.' : 'Pick a tool and start right away — no setup.'}</p>
          </div>
        </div>
        <div className="tool-grid">
          {TOOLS.map(({ to, icon: Icon, accent, title, description }) => (
            <a key={to} className="pdf-tool-card" href={to}>
              <span className="pdf-tool-card__icon" style={{ background: accent }} aria-hidden="true"><Icon size={22} /></span>
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
            ? 'Quyền riêng tư: toàn bộ thao tác PDF diễn ra trong RAM của trình duyệt. Khi đóng tab, mọi dữ liệu tạm được xóa.'
            : 'Privacy: every PDF operation happens in browser memory. Close the tab and all temporary data is gone.'}
        </span>
      </aside>
    </ToolShell>
  );
}
