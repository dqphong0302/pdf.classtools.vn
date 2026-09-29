import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressPdf } from '../lib/wasmGhostscript';
import { CompressPage } from './CompressPage';

vi.mock('../lib/wasmGhostscript', () => ({
  compressPdf: vi.fn(async (bytes: Uint8Array) => ({
    bytes: new Uint8Array([1, 2, 3]),
    originalSize: bytes.byteLength,
    compressedSize: Math.max(1, Math.floor(bytes.byteLength / 2))
  }))
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

describe('CompressPage', () => {
  let sample: File;

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(compressPdf).mockClear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    sample = await createPdfFile(2, 'sample.pdf');
  });

  it('defaults to the balanced ebook preset once a file is loaded', async () => {
    const { container } = render(<CompressPage />);
    // Options stay hidden until there is a file to compress.
    expect(screen.queryByRole('button', { name: /Nén PDF/ })).not.toBeInTheDocument();
    upload(container, sample);
    await screen.findByText('2 trang');

    expect(screen.getByRole('button', { name: /Cân bằng \(150dpi\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Chất lượng cao \(300dpi\)/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Nhỏ nhất \(72dpi\)/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Nén PDF/ })).toBeEnabled();
  });

  it('compresses with the ebook preset and downloads the result', async () => {
    const { container } = render(<CompressPage />);
    upload(container, sample);

    expect(await screen.findByText('2 trang')).toBeInTheDocument();
    expect(screen.getByText(/KB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nén PDF/ }));

    const status = await screen.findByRole('status');
    expect(compressPdf).toHaveBeenCalledTimes(1);
    expect(compressPdf).toHaveBeenCalledWith(expect.any(Uint8Array), 'ebook');
    expect(status).toHaveTextContent('Đã tiết kiệm 50%');
    expect(status).toHaveTextContent('KB');

    fireEvent.click(screen.getByRole('button', { name: /Tải xuống/ }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('sends the chosen screen preset to the compressor', async () => {
    const { container } = render(<CompressPage />);
    upload(container, sample);
    await screen.findByText('2 trang');

    fireEvent.click(screen.getByRole('button', { name: /Nhỏ nhất \(72dpi\)/ }));
    expect(screen.getByRole('button', { name: /Nhỏ nhất \(72dpi\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cân bằng \(150dpi\)/ })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: /Nén PDF/ }));
    await screen.findByRole('status');

    expect(compressPdf).toHaveBeenCalledWith(expect.any(Uint8Array), 'screen');
  });

  it('warns and still offers the download when the result is larger', async () => {
    vi.mocked(compressPdf).mockResolvedValueOnce({
      bytes: new Uint8Array([9, 9, 9]),
      originalSize: sample.size,
      compressedSize: sample.size + 128
    });

    const { container } = render(<CompressPage />);
    upload(container, sample);
    await screen.findByText('2 trang');

    fireEvent.click(screen.getByRole('button', { name: /Nén PDF/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('không thể nén thêm');
    expect(screen.queryByText(/Đã tiết kiệm/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải xuống/ })).toBeEnabled();
  });
});
