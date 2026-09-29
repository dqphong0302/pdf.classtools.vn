import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SplitPage } from './SplitPage';
import { renderPdfToImages } from '../lib/pdfPageImages';
import * as download from '../lib/download';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn().mockRejectedValue(new Error('no preview'))
}));

vi.mock('../lib/pdfPageImages', () => ({
  renderPdfToImages: vi.fn(async () => [
    { pageNumber: 1, bytes: new Uint8Array([1]) },
    { pageNumber: 2, bytes: new Uint8Array([2]) }
  ])
}));

async function createPdfFile(pages: number, name: string): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = doc.addPage([200, 300]);
    page.drawText(`${name} ${index + 1}`, { x: 20, y: 200, size: 24, font });
  }
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], name, { type: 'application/pdf' });
}

function upload(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('SplitPage', () => {
  let sixPage: File;

  beforeAll(async () => {
    sixPage = await createPdfFile(6, 'six.pdf');
  });

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderWithSixPages() {
    const { container } = render(<SplitPage />);
    upload(container, sixPage);
    await screen.findByText('6 trang');
    return container;
  }

  it('switches between the three split modes with aria-pressed state', async () => {
    await renderWithSixPages();

    const rangesTab = screen.getByRole('button', { name: 'Khoảng trang' });
    const everyTab = screen.getByRole('button', { name: 'Mỗi N trang' });
    const selectTab = screen.getByRole('button', { name: 'Chọn trên xem trước' });

    expect(rangesTab).toHaveAttribute('aria-pressed', 'true');
    expect(everyTab).toHaveAttribute('aria-pressed', 'false');
    expect(selectTab).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(everyTab);
    expect(everyTab).toHaveAttribute('aria-pressed', 'true');
    expect(rangesTab).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Số trang mỗi phần')).toBeInTheDocument();

    fireEvent.click(selectTab);
    expect(selectTab).toHaveAttribute('aria-pressed', 'true');
    expect(everyTab).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('button', { name: 'Trang 1' })).toBeInTheDocument();
    expect(screen.getByText('Đã chọn: 0 trang')).toBeInTheDocument();
  });

  it('extracts page ranges and downloads the result', async () => {
    await renderWithSixPages();

    const input = screen.getByLabelText('Khoảng trang cần trích');
    fireEvent.change(input, { target: { value: '1-3, 5' } });

    expect(await screen.findByText('Đã chọn: 1-3, 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trích xuất' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('4 trang');
    expect(screen.getByDisplayValue('six-trang-1-3-5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('shows an alert for out-of-bounds page ranges', async () => {
    await renderWithSixPages();

    const input = screen.getByLabelText('Khoảng trang cần trích');
    fireEvent.change(input, { target: { value: '99' } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ngoài phạm vi');
    expect(alert).toHaveTextContent('6 trang');
    expect(screen.getByRole('button', { name: 'Trích xuất' })).toBeDisabled();
  });

  it('splits the file every N pages into separate downloadable parts', async () => {
    await renderWithSixPages();

    fireEvent.click(screen.getByRole('button', { name: 'Mỗi N trang' }));
    const nInput = screen.getByLabelText('Số trang mỗi phần');
    fireEvent.change(nInput, { target: { value: '2' } });
    expect(await screen.findByText('Tách thành 3 phần')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tách' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('3 tệp');
    expect(screen.getByText('part-1-2.pdf')).toBeInTheDocument();
    expect(screen.getByText('part-3-4.pdf')).toBeInTheDocument();
    expect(screen.getByText('part-5-6.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('2 trang')).toHaveLength(3);

    const downloads = screen.getAllByRole('button', { name: 'Tải xuống' });
    expect(downloads).toHaveLength(3);
    fireEvent.click(downloads[0]);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('downloads all parts as a ZIP after an every-N split', async () => {
    await renderWithSixPages();

    fireEvent.click(screen.getByRole('button', { name: 'Mỗi N trang' }));
    const nInput = screen.getByLabelText('Số trang mỗi phần');
    fireEvent.change(nInput, { target: { value: '2' } });
    expect(await screen.findByText('Tách thành 3 phần')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tách' }));
    await screen.findByText('part-1-2.pdf');

    expect(screen.getByRole('button', { name: 'Tải tất cả (ZIP)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tải tất cả (ZIP)' }));

    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(await screen.findByRole('button', { name: 'Tải tất cả (ZIP)' })).toBeEnabled();
  });

  it('selects pages on the fallback preview grid and extracts them', async () => {
    await renderWithSixPages();

    fireEvent.click(screen.getByRole('button', { name: 'Chọn trên xem trước' }));

    const card1 = await screen.findByRole('button', { name: 'Trang 1' });
    expect(card1).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(card1);
    fireEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang 6' }));

    expect(card1).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Đã chọn: 3 trang')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trích trang đã chọn' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('3 trang');
    expect(screen.getByDisplayValue('six-trang-1-3-6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly alert for unreadable files', async () => {
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });
    const { container } = render(<SplitPage />);
    upload(container, broken);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đọc được tệp');
    expect(screen.getByText('Tải lên một tệp PDF để bắt đầu tách trang.')).toBeInTheDocument();
  });
  it('asks for a save format and exports the extracted pages as images in a ZIP', async () => {
    const container = await renderWithSixPages();
    const downloadSpy = vi.spyOn(download, 'downloadBytes').mockImplementation(() => undefined);

    fireEvent.change(screen.getByLabelText('Khoảng trang cần trích'), { target: { value: '1, 3' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Trích xuất/ }));
    await screen.findByText(/Đã trích 2 trang/);

    // PDF is the default choice
    expect(screen.getByRole('button', { name: 'Tệp PDF' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    await waitFor(() => expect(downloadSpy).toHaveBeenCalledTimes(1));
    expect(downloadSpy.mock.calls[0][1]).toMatch(/\.pdf$/);

    fireEvent.click(screen.getByRole('button', { name: 'Ảnh JPG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    await waitFor(() => expect(downloadSpy).toHaveBeenCalledTimes(2));
    expect(renderPdfToImages).toHaveBeenCalledWith(expect.any(Uint8Array), 'jpg');
    const [, name, mime] = downloadSpy.mock.calls[1];
    expect(name).toMatch(/\.zip$/);
    expect(mime).toBe('application/zip');
    expect(container).toBeTruthy();
  });
});
