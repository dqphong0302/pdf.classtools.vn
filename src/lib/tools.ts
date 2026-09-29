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
  Stamp,
  Table,
  Table2,
  Wrench
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Locale = 'vi' | 'en';
export type ToolCategory = 'organize' | 'edit' | 'optimize' | 'security' | 'convert';

export interface ToolInfo {
  category: ToolCategory;
  to: string;
  icon: LucideIcon;
  accent: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
}

/** ClassTools tone family per category (cobalt / teal / coral / yellow). */
export const CATEGORY_TONE: Record<ToolCategory, 'cobalt' | 'teal' | 'coral' | 'yellow'> = {
  organize: 'cobalt',
  edit: 'coral',
  optimize: 'teal',
  security: 'yellow',
  convert: 'cobalt'
};

export const CATEGORIES: { id: ToolCategory; title: Record<Locale, string>; hint: Record<Locale, string> }[] = [
  { id: 'organize', title: { vi: 'Tổ chức trang', en: 'Organize' }, hint: { vi: 'Ghép, tách, sắp xếp, xoay, đánh số', en: 'Merge, split, reorder, rotate, number' } },
  { id: 'edit', title: { vi: 'Chỉnh sửa & ký', en: 'Edit & sign' }, hint: { vi: 'Thêm chữ, chữ ký, che thông tin mật', en: 'Add text, sign, redact' } },
  { id: 'optimize', title: { vi: 'Tối ưu & sửa lỗi', en: 'Optimize & repair' }, hint: { vi: 'Nén nhẹ, sửa file hỏng, lưu trữ', en: 'Compress, repair, archive' } },
  { id: 'security', title: { vi: 'Bảo mật & kiểm tra', en: 'Security & checks' }, hint: { vi: 'Mật khẩu, làm phẳng, so sánh, quét', en: 'Passwords, flatten, compare, scan' } },
  { id: 'convert', title: { vi: 'Chuyển đổi', en: 'Convert' }, hint: { vi: 'PDF ⇄ ảnh, Excel, HTML, văn bản', en: 'PDF ⇄ images, Excel, HTML, text' } }
];

export const TOOLS: ToolInfo[] = [
  {
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
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
    category: 'organize',
    to: '/nup',
    icon: Table2,
    accent: 'linear-gradient(135deg, #f59e0b, #d97706)',
    title: { vi: 'N trang / tờ', en: 'N-up Pages' },
    description: {
      vi: 'Gộp 2, 4, 6, 9 trang lên một tờ A4 để in tiết kiệm giấy.',
      en: 'Fit 2, 4, 6 or 9 pages onto one A4 sheet to save paper.'
    }
  },

  {
    category: 'edit',
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
    category: 'edit',
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
    category: 'edit',
    to: '/redact',
    icon: EyeOff,
    accent: 'linear-gradient(135deg, #ef4444, #991b1b)',
    title: { vi: 'Bôi đen che mật (Redact)', en: 'Redact PDF' },
    description: {
      vi: 'Bôi đen vĩnh viễn vùng thông tin nhạy cảm (CCCD, tài khoản, mật khẩu).',
      en: 'Permanently blackout sensitive details (IDs, bank details, credentials).'
    }
  },

  {
    category: 'optimize',
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
    category: 'optimize',
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
    category: 'optimize',
    to: '/pdf-to-pdfa',
    icon: Archive,
    accent: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    title: { vi: 'PDF sang PDF/A', en: 'PDF to PDF/A' },
    description: {
      vi: 'Chuẩn hóa tệp sang ISO 19005-2 (PDF/A-2b) để lưu trữ vĩnh viễn.',
      en: 'Convert standard PDFs into long-term archival ISO 19005 (PDF/A-2b).'
    }
  },

  {
    category: 'security',
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
    category: 'security',
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
    category: 'security',
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
    category: 'security',
    to: '/scan',
    icon: Camera,
    accent: 'linear-gradient(135deg, #0284c7, #0369a1)',
    title: { vi: 'Quét từ Camera (Scan)', en: 'Scan to PDF' },
    description: {
      vi: 'Dùng camera/webcam chụp tài liệu, lọc màu đen trắng và xuất PDF.',
      en: 'Scan documents with device camera, apply B&W filters and save as PDF.'
    }
  },

  {
    category: 'convert',
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
    category: 'convert',
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
    category: 'convert',
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
    category: 'convert',
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
    category: 'convert',
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
    category: 'convert',
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
    category: 'convert',
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

export function toolForPath(pathname: string): ToolInfo | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return TOOLS.find((tool) => tool.to === clean);
}

/** Case- and accent-insensitive match on title + description in both languages. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function searchTools(query: string): ToolInfo[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return TOOLS;
  return TOOLS.filter((tool) => {
    const haystack = normalizeText(
      [tool.title.vi, tool.title.en, tool.description.vi, tool.description.en, tool.to].join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  });
}
