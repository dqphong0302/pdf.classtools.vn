import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openPdfView } from '../lib/pdfPreview';
import { ExtractTextPage } from './ExtractTextPage';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn(async () => ({
    pageCount: 2,
    pages: [],
    render: vi.fn(),
    getPageText: async (pageNumber: number) => `Trang ${pageNumber} nội dung`,
    destroy: vi.fn()
  }))
}));

async function createPdfFile(pages: number, name: string): Promise<File> {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    doc.addPage([200, 300]);
  }
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], name, { type: 'application/pdf' });
}

function upload(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ExtractTextPage', () => {
  let twoPage: File;

  beforeAll(async () => {
    twoPage = await createPdfFile(2, 'tai-lieu.pdf');
  });

  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderWithExtractedText(): Promise<void> {
    const { container } = render(<ExtractTextPage />);
    upload(container, twoPage);
    expect(await screen.findByText('2 trang')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Trích xuất chữ/ }));
    await screen.findByLabelText('Kết quả');
  }

  it('extracts text and shows the full text in a readonly textarea', async () => {
    await renderWithExtractedText();

    const output = screen.getByLabelText('Kết quả') as HTMLTextAreaElement;
    expect(output).toHaveAttribute('readonly');
    expect(output.value).toContain('Trang 1 nội dung');
    expect(output.value).toContain('Trang 2 nội dung');
    expect(screen.getByRole('button', { name: 'Toàn bộ' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the selected page text when switching to the per-page view', async () => {
    await renderWithExtractedText();

    fireEvent.click(screen.getByRole('button', { name: 'Theo trang' }));
    expect(screen.getByRole('button', { name: 'Theo trang' })).toHaveAttribute('aria-pressed', 'true');

    const select = screen.getByLabelText('Chọn trang') as HTMLSelectElement;
    expect(screen.getByRole('button', { name: /Trang 1 · 16 ký tự/ })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '2' } });

    const output = screen.getByLabelText('Kết quả') as HTMLTextAreaElement;
    expect(output.value).toBe('Trang 2 nội dung');
    expect(output.value).not.toContain('Trang 1 nội dung');
  });

  it('copies the text to the clipboard and shows a status chip', async () => {
    await renderWithExtractedText();

    fireEvent.click(screen.getByRole('button', { name: /Sao chép/ }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã sao chép');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Trang 1 nội dung'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Trang 2 nội dung'));
  });

  it('downloads the full text as a .txt file', async () => {
    await renderWithExtractedText();

    fireEvent.click(screen.getByRole('button', { name: /Tải tệp \.txt/ }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('shows a notice when the PDF has no extractable text', async () => {
    vi.mocked(openPdfView).mockResolvedValueOnce({
      pageCount: 2,
      pages: [],
      render: vi.fn(),
      getPageText: async () => '',
      destroy: vi.fn()
    });

    const { container } = render(<ExtractTextPage />);
    upload(container, twoPage);
    await screen.findByText('2 trang');

    fireEvent.click(screen.getByRole('button', { name: /Trích xuất chữ/ }));

    expect(await screen.findByText('PDF này không có chữ có thể trích xuất.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Kết quả')).not.toBeInTheDocument();
  });

  it('shows an alert for unreadable files', async () => {
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });

    const { container } = render(<ExtractTextPage />);
    upload(container, broken);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đọc được tệp');
    expect(screen.getByText('Tải lên một tệp PDF để bắt đầu trích xuất chữ.')).toBeInTheDocument();
  });
});
