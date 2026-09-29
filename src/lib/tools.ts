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
export type ToolCategory = 'organize' | 'optimize' | 'toPdf' | 'fromPdf' | 'edit' | 'security';

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
  optimize: 'teal',
  toPdf: 'yellow',
  fromPdf: 'yellow',
  edit: 'coral',
  security: 'cobalt'
};

export const CATEGORIES: { id: ToolCategory; title: Record<Locale, string>; hint: Record<Locale, string> }[] = [
  { id: 'organize', title: { vi: 'Sắp xếp PDF', en: 'Organize PDF' }, hint: { vi: 'Ghép, tách, sắp xếp, quét', en: 'Merge, split, reorder, scan' } },
  { id: 'optimize', title: { vi: 'Tối ưu PDF', en: 'Optimize PDF' }, hint: { vi: 'Nén, sửa lỗi, làm phẳng', en: 'Compress, repair, flatten' } },
  { id: 'toPdf', title: { vi: 'Chuyển sang PDF', en: 'Convert to PDF' }, hint: { vi: 'Ảnh, Excel, HTML sang PDF', en: 'Images, Excel, HTML to PDF' } },
  { id: 'fromPdf', title: { vi: 'Chuyển từ PDF', en: 'Convert from PDF' }, hint: { vi: 'PDF sang ảnh, Excel, PDF/A, văn bản', en: 'PDF to images, Excel, PDF/A, text' } },
  { id: 'edit', title: { vi: 'Chỉnh sửa PDF', en: 'Edit PDF' }, hint: { vi: 'Sửa, xoay, đánh số, đóng dấu, cắt', en: 'Edit, rotate, number, watermark, crop' } },
  { id: 'security', title: { vi: 'Bảo mật PDF', en: 'PDF security' }, hint: { vi: 'Mật khẩu, ký, che thông tin, so sánh', en: 'Password, sign, redact, compare' } }
];

export const TOOLS: ToolInfo[] = [
  {
    category: 'organize',
    to: '/merge',
    icon: Combine,
    accent: 'linear-gradient(135deg, #60a5e3, #1d5d97)',
    title: { vi: 'Ghép PDF', en: 'Merge PDF' },
    description: {
      vi: 'Gộp nhiều tệp PDF thành một theo thứ tự bạn muốn.',
      en: 'Combine PDFs in the order you want.'
    }
  },
  {
    category: 'organize',
    to: '/split',
    icon: Scissors,
    accent: 'linear-gradient(135deg, #ffb242, #b85b39)',
    title: { vi: 'Tách PDF', en: 'Split PDF' },
    description: {
      vi: 'Tách một trang, một nhóm trang hoặc chia tệp thành nhiều PDF.',
      en: 'Extract pages or split one PDF into several files.'
    }
  },
  {
    category: 'optimize',
    to: '/compress',
    icon: FileText,
    accent: 'linear-gradient(135deg, #06b6d4, #0e7490)',
    title: { vi: 'Nén PDF', en: 'Compress PDF' },
    description: {
      vi: 'Giảm dung lượng tệp PDF mà vẫn giữ chất lượng tốt nhất.',
      en: 'Reduce file size while keeping the best quality.'
    }
  },
  {
    category: 'fromPdf',
    to: '/pdf-to-excel',
    icon: Table,
    accent: 'linear-gradient(135deg, #059669, #047857)',
    title: { vi: 'PDF sang Excel', en: 'PDF to Excel' },
    description: {
      vi: 'Lấy dữ liệu bảng từ PDF sang bảng tính Excel.',
      en: 'Pull tables out of a PDF into an Excel spreadsheet.'
    }
  },
  {
    category: 'toPdf',
    to: '/excel-to-pdf',
    icon: FileSpreadsheet,
    accent: 'linear-gradient(135deg, #16a34a, #15803d)',
    title: { vi: 'Excel sang PDF', en: 'Excel to PDF' },
    description: {
      vi: 'Chuyển bảng tính Excel, CSV thành PDF dễ đọc, dễ in.',
      en: 'Turn Excel and CSV sheets into easy-to-read PDFs.'
    }
  },
  {
    category: 'edit',
    to: '/edit',
    icon: PenLine,
    accent: 'linear-gradient(135deg, #6366f1, #4338ca)',
    title: { vi: 'Chỉnh sửa PDF', en: 'Edit PDF' },
    description: {
      vi: 'Thêm chữ, hình ảnh vào PDF, hỗ trợ đầy đủ tiếng Việt.',
      en: 'Add text and images to a PDF, with full Vietnamese support.'
    }
  },
  {
    category: 'fromPdf',
    to: '/pdf-to-images',
    icon: Image,
    accent: 'linear-gradient(135deg, #d946ef, #a21caf)',
    title: { vi: 'PDF sang ảnh', en: 'PDF to JPG' },
    description: {
      vi: 'Chuyển từng trang PDF thành ảnh JPG hoặc PNG.',
      en: 'Convert each PDF page to a JPG or PNG image.'
    }
  },
  {
    category: 'toPdf',
    to: '/images-to-pdf',
    icon: Images,
    accent: 'linear-gradient(135deg, #10b981, #15803d)',
    title: { vi: 'Ảnh sang PDF', en: 'JPG to PDF' },
    description: {
      vi: 'Chuyển ảnh JPG, PNG thành PDF, chỉnh hướng và lề trang.',
      en: 'Convert JPG and PNG images to PDF with page layout options.'
    }
  },
  {
    category: 'security',
    to: '/sign',
    icon: FileSignature,
    accent: 'linear-gradient(135deg, #f97316, #c2410c)',
    title: { vi: 'Ký PDF', en: 'Sign PDF' },
    description: {
      vi: 'Ký tên lên PDF bằng chữ ký vẽ tay hoặc gõ chữ.',
      en: 'Sign a PDF with a drawn or typed signature.'
    }
  },
  {
    category: 'edit',
    to: '/watermark',
    icon: Stamp,
    accent: 'linear-gradient(135deg, #ec4899, #be185d)',
    title: { vi: 'Đóng dấu', en: 'Watermark' },
    description: {
      vi: 'Đóng dấu chữ hoặc logo lên PDF, chỉnh góc và độ mờ.',
      en: 'Stamp text or a logo over a PDF with angle and opacity.'
    }
  },
  {
    category: 'edit',
    to: '/rotate',
    icon: RotateCw,
    accent: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    title: { vi: 'Xoay PDF', en: 'Rotate PDF' },
    description: {
      vi: 'Xoay toàn bộ hoặc từng trang PDF theo ý muốn.',
      en: 'Rotate all pages or just the ones you choose.'
    }
  },
  {
    category: 'toPdf',
    to: '/html-to-pdf',
    icon: FileCode,
    accent: 'linear-gradient(135deg, #f97316, #ea580c)',
    title: { vi: 'HTML sang PDF', en: 'HTML to PDF' },
    description: {
      vi: 'Chuyển mã HTML thành PDF chuẩn khổ A4.',
      en: 'Convert HTML into a print-ready A4 PDF.'
    }
  },
  {
    category: 'security',
    to: '/protect',
    icon: Lock,
    accent: 'linear-gradient(135deg, #8b5cf6, #4c1d95)',
    title: { vi: 'Bảo vệ PDF', en: 'Protect PDF' },
    description: {
      vi: 'Đặt mật khẩu để bảo vệ PDF, hoặc mở khoá tệp đã có mật khẩu.',
      en: 'Add a password to a PDF, or unlock a protected one.'
    }
  },
  {
    category: 'organize',
    to: '/organize',
    icon: LayoutList,
    accent: 'linear-gradient(135deg, #5ebe78, #2c7a3b)',
    title: { vi: 'Sắp xếp PDF', en: 'Organize PDF' },
    description: {
      vi: 'Sắp xếp, xoá, thêm trang trắng hoặc nhân đôi trang PDF.',
      en: 'Reorder, delete, duplicate pages or insert blank ones.'
    }
  },
  {
    category: 'fromPdf',
    to: '/pdf-to-pdfa',
    icon: Archive,
    accent: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    title: { vi: 'PDF sang PDF/A', en: 'PDF to PDF/A' },
    description: {
      vi: 'Chuyển PDF sang PDF/A để lưu trữ lâu dài.',
      en: 'Convert PDF to PDF/A for long-term archiving.'
    }
  },
  {
    category: 'optimize',
    to: '/repair',
    icon: Wrench,
    accent: 'linear-gradient(135deg, #eab308, #a16207)',
    title: { vi: 'Sửa lỗi PDF', en: 'Repair PDF' },
    description: {
      vi: 'Khôi phục tệp PDF bị hỏng hoặc không mở được.',
      en: 'Recover a damaged PDF that will not open.'
    }
  },
  {
    category: 'edit',
    to: '/page-numbers',
    icon: Hash,
    accent: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    title: { vi: 'Đánh số trang', en: 'Page Numbers' },
    description: {
      vi: 'Thêm số trang vào PDF, chọn vị trí và kiểu chữ.',
      en: 'Add page numbers with the position and style you want.'
    }
  },
  {
    category: 'organize',
    to: '/scan',
    icon: Camera,
    accent: 'linear-gradient(135deg, #0284c7, #0369a1)',
    title: { vi: 'Quét sang PDF', en: 'Scan to PDF' },
    description: {
      vi: 'Chụp tài liệu bằng camera điện thoại và lưu thành PDF.',
      en: 'Capture documents with your camera and save as PDF.'
    }
  },
  {
    category: 'security',
    to: '/compare',
    icon: GitCompare,
    accent: 'linear-gradient(135deg, #f43f5e, #be123c)',
    title: { vi: 'So sánh PDF', en: 'Compare PDF' },
    description: {
      vi: 'So sánh hai bản PDF và tô sáng những chỗ khác nhau.',
      en: 'Compare two PDFs and highlight the differences.'
    }
  },
  {
    category: 'security',
    to: '/redact',
    icon: EyeOff,
    accent: 'linear-gradient(135deg, #ef4444, #991b1b)',
    title: { vi: 'Che thông tin', en: 'Redact PDF' },
    description: {
      vi: 'Che vĩnh viễn thông tin nhạy cảm như số CCCD, tài khoản.',
      en: 'Permanently black out sensitive information.'
    }
  },
  {
    category: 'edit',
    to: '/crop',
    icon: Crop,
    accent: 'linear-gradient(135deg, #10b981, #047857)',
    title: { vi: 'Cắt PDF', en: 'Crop PDF' },
    description: {
      vi: 'Cắt bớt lề trắng hoặc vùng không cần trên trang PDF.',
      en: 'Trim margins or unwanted areas from PDF pages.'
    }
  },
  {
    category: 'optimize',
    to: '/flatten',
    icon: Layers,
    accent: 'linear-gradient(135deg, #64748b, #334155)',
    title: { vi: 'Làm phẳng PDF', en: 'Flatten PDF' },
    description: {
      vi: 'Gộp biểu mẫu và chữ ký vào trang để không sửa được nữa.',
      en: 'Merge form fields and signatures into the page.'
    }
  },
  {
    category: 'organize',
    to: '/nup',
    icon: Table2,
    accent: 'linear-gradient(135deg, #f59e0b, #d97706)',
    title: { vi: 'Nhiều trang / tờ', en: 'N-up PDF' },
    description: {
      vi: 'In nhiều trang trên một tờ giấy để tiết kiệm giấy.',
      en: 'Print several pages on one sheet to save paper.'
    }
  },
  {
    category: 'fromPdf',
    to: '/extract-text',
    icon: Search,
    accent: 'linear-gradient(135deg, #38bdf8, #0284c7)',
    title: { vi: 'PDF sang văn bản', en: 'PDF to Text' },
    description: {
      vi: 'Lấy toàn bộ chữ trong PDF để sao chép hoặc lưu .txt.',
      en: 'Get all the text from a PDF to copy or save as .txt.'
    }
  },
  {
    category: 'edit',
    to: '/metadata',
    icon: Hash,
    accent: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    title: { vi: 'Sửa thông tin PDF', en: 'Edit Metadata' },
    description: {
      vi: 'Xem, sửa hoặc xoá tiêu đề, tác giả, từ khoá của PDF.',
      en: 'View, edit or clear the title, author and keywords.'
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
