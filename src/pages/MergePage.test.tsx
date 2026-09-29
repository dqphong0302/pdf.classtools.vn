import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MergePage } from './MergePage';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn().mockRejectedValue(new Error('no preview'))
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

function upload(container: HTMLElement, files: File[]): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('MergePage', () => {
  let twoPage: File;
  let threePage: File;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    twoPage = await createPdfFile(2, 'a.pdf');
    threePage = await createPdfFile(3, 'b.pdf');
  });

  it('lists added files with page chips and enables merge only with two files', async () => {
    const { container } = render(<MergePage />);
    // Nothing but the drop zone until a file is chosen.
    expect(screen.queryByRole('button', { name: /Ghép \d+ tệp/ })).not.toBeInTheDocument();

    upload(container, [twoPage, threePage]);

    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
    expect(await screen.findByText(/^2 trang/)).toBeInTheDocument();
    expect(await screen.findByText(/^3 trang/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghép 2 tệp' })).toBeEnabled();
  });

  it('reorders files with move up and move down buttons', async () => {
    const { container } = render(<MergePage />);
    upload(container, [twoPage, threePage]);
    await screen.findByText(/^3 trang/);

    expect(screen.getByRole('button', { name: /Di chuyển a\.pdf lên trên/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Di chuyển b\.pdf xuống dưới/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Di chuyển a\.pdf xuống dưới/ }));

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('b.pdf');
    expect(items[1]).toHaveTextContent('a.pdf');
    expect(screen.getByRole('button', { name: /Di chuyển b\.pdf lên trên/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Di chuyển a\.pdf lên trên/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Di chuyển a\.pdf xuống dưới/ })).toBeDisabled();
  });

  it('merges the files and downloads the result', async () => {
    const { container } = render(<MergePage />);
    upload(container, [twoPage, threePage]);
    await screen.findByText(/^3 trang/);

    fireEvent.click(screen.getByRole('button', { name: /Ghép 2 tệp/ }));

    expect(await screen.findByText(/Đã ghép 5 trang/)).toBeInTheDocument();
    // No file-name prompt: the result is named automatically.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tải xuống/ }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('disables merge after removing files down to one', async () => {
    const { container } = render(<MergePage />);
    upload(container, [twoPage, threePage]);
    await screen.findByText(/^3 trang/);

    fireEvent.click(screen.getByRole('button', { name: /Xóa a\.pdf/ }));

    await waitFor(() => expect(screen.queryByText('a.pdf')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ghép 1 tệp' })).toBeDisabled();
    expect(screen.getByText('Thêm ít nhất một tệp nữa để ghép.')).toBeInTheDocument();
  });

  it('skips oversized and unreadable files with an alert notice', async () => {
    const big = new File([new Uint8Array(2)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 101 * 1024 * 1024 });
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });

    const { container } = render(<MergePage />);
    upload(container, [big, broken]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không đọc được tệp'));
    expect(screen.getByRole('alert')).toHaveTextContent('quá 100 MB');
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ghép \d+ tệp/ })).not.toBeInTheDocument();
  });

  it('accepts images and merges them as pages', async () => {
    const png = new File(
      [Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DwnwEAAMIByR/6d1AAAAAASUVORK5CYII='), (c) => c.charCodeAt(0))],
      'anh.png',
      { type: 'image/png' }
    );
    const { container } = render(<MergePage />);
    upload(container, [twoPage, png]);

    expect(await screen.findByText('anh.png')).toBeInTheDocument();
    await screen.findByText(/^Ảnh ·/);
    fireEvent.click(screen.getByRole('button', { name: /Ghép 2 tệp/ }));
    expect(await screen.findByText(/Đã ghép 3 trang/)).toBeInTheDocument();
  });
});
