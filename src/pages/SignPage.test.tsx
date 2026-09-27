import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignPage } from './SignPage';
import { placeSignatures } from '../lib/pdfSign';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn().mockRejectedValue(new Error('no preview'))
}));

vi.mock('../lib/pdfSign', () => ({
  placeSignatures: vi.fn().mockResolvedValue([{ x: 10, y: 10, width: 100, height: 40 }])
}));

const ctxStub = {
  font: '',
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  measureText: vi.fn(() => ({ width: 100 })),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn()
};

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

describe('SignPage', () => {
  let threePage: File;

  beforeAll(async () => {
    threePage = await createPdfFile(3, 'three.pdf');
  });

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(new Blob(['x'], { type: 'image/png' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA');
    vi.mocked(placeSignatures).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderWithThreePages() {
    const { container } = render(<SignPage />);
    upload(container, threePage);
    await screen.findByText('3 trang');
    return container;
  }

  function typeSignature(name: string): void {
    fireEvent.click(screen.getByRole('button', { name: 'GÕ' }));
    fireEvent.change(screen.getByLabelText('Nhập tên chữ ký'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'Sử dụng chữ ký' }));
  }

  it('shows one card per page and selects the target page', async () => {
    const container = await renderWithThreePages();

    expect(container.querySelectorAll('.thumb-card')).toHaveLength(3);

    const card1 = screen.getByRole('button', { name: 'Trang 1' });
    const card3 = screen.getByRole('button', { name: 'Trang 3' });
    expect(card1).toHaveAttribute('aria-pressed', 'true');
    expect(card3).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(card3);
    expect(card3).toHaveAttribute('aria-pressed', 'true');
    expect(card1).toHaveAttribute('aria-pressed', 'false');
  });

  it('captures a typed signature, signs page 1 and exposes the download', async () => {
    await renderWithThreePages();

    typeSignature('Nguyễn Văn A');

    expect(await screen.findByText('Chữ ký đã sẵn sàng')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ký & tải xuống' }));

    expect(await screen.findByText('Đã ký và tạo tệp PDF mới.')).toBeInTheDocument();

    const calls = vi.mocked(placeSignatures).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1][0]).toMatchObject({ pageIndex: 0, xPct: 60, yPct: 85, widthPct: 35 });

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('signs the selected page 3', async () => {
    await renderWithThreePages();

    fireEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    typeSignature('Nguyễn Văn A');
    await screen.findByText('Chữ ký đã sẵn sàng');

    fireEvent.click(screen.getByRole('button', { name: 'Ký & tải xuống' }));
    await screen.findByText('Đã ký và tạo tệp PDF mới.');

    const calls = vi.mocked(placeSignatures).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1][0]).toMatchObject({ pageIndex: 2, xPct: 60, yPct: 85, widthPct: 35 });
  });

  it('shows an alert when using the signature pad before drawing', async () => {
    await renderWithThreePages();

    fireEvent.click(screen.getByRole('button', { name: 'Sử dụng chữ ký' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa có chữ ký');
    expect(vi.mocked(placeSignatures)).not.toHaveBeenCalled();
  });

  it('downloads the signed PDF through an anchor click', async () => {
    await renderWithThreePages();

    typeSignature('Phong');
    await screen.findByText('Chữ ký đã sẵn sàng');

    fireEvent.click(screen.getByRole('button', { name: 'Ký & tải xuống' }));
    await screen.findByText('Đã ký và tạo tệp PDF mới.');

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('signs every page when the sign-all checkbox is checked', async () => {
    await renderWithThreePages();

    const allPages = screen.getByLabelText('Ký tất cả các trang');
    expect(allPages).not.toBeChecked();
    fireEvent.click(allPages);
    expect(allPages).toBeChecked();

    typeSignature('Nguyễn Văn A');
    await screen.findByText('Chữ ký đã sẵn sàng');

    fireEvent.click(screen.getByRole('button', { name: 'Ký & tải xuống' }));
    await screen.findByText('Đã ký và tạo tệp PDF mới.');

    const calls = vi.mocked(placeSignatures).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toHaveLength(3);
    expect(calls[0][1].map((placement) => placement.pageIndex)).toEqual([0, 1, 2]);
    for (const placement of calls[0][1]) {
      expect(placement).toMatchObject({ xPct: 60, yPct: 85, widthPct: 35 });
    }
  });

  it('saves the captured signature and restores it from a saved thumbnail after reload', async () => {
    const first = render(<SignPage />);
    upload(first.container, threePage);
    await screen.findByText('3 trang');

    typeSignature('Nguyễn Văn A');
    await screen.findByText('Chữ ký đã sẵn sàng');

    const raw = localStorage.getItem('classtools-pdf-signatures');
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string) as Array<{ id: string; dataUrl: string; createdAt: number }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].dataUrl).toBe('data:image/png;base64,AAA');
    expect(typeof stored[0].id).toBe('string');
    expect(typeof stored[0].createdAt).toBe('number');
    expect(screen.getByLabelText('Dùng chữ ký đã lưu 1')).toBeInTheDocument();

    first.unmount();

    const second = render(<SignPage />);
    upload(second.container, threePage);
    await screen.findByText('3 trang');

    expect(screen.getByLabelText('Dùng chữ ký đã lưu 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ký & tải xuống' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Dùng chữ ký đã lưu 1'));

    expect(await screen.findByText('Chữ ký đã sẵn sàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ký & tải xuống' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Ký & tải xuống' }));
    await screen.findByText('Đã ký và tạo tệp PDF mới.');

    const calls = vi.mocked(placeSignatures).mock.calls;
    expect(calls).toHaveLength(1);
    const expectedBytes = Array.from(atob('AAA'), (char) => char.charCodeAt(0));
    expect(Array.from(calls[0][1][0].pngBytes)).toEqual(expectedBytes);
  });

  it('deletes a saved signature from the list and localStorage', async () => {
    const { container } = render(<SignPage />);
    upload(container, threePage);
    await screen.findByText('3 trang');

    typeSignature('Nguyễn Văn A');
    await screen.findByText('Chữ ký đã sẵn sàng');
    expect(screen.getByLabelText('Dùng chữ ký đã lưu 1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Xóa chữ ký đã lưu 1'));

    expect(screen.queryByLabelText('Dùng chữ ký đã lưu 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Chữ ký đã lưu')).not.toBeInTheDocument();
    expect(localStorage.getItem('classtools-pdf-signatures')).toBe('[]');
  });

  it('dedupes saved signatures by dataUrl', async () => {
    localStorage.setItem(
      'classtools-pdf-signatures',
      JSON.stringify([{ id: 'existing', dataUrl: 'data:image/png;base64,AAA', createdAt: 1 }])
    );
    const { container } = render(<SignPage />);
    upload(container, threePage);
    await screen.findByText('3 trang');

    typeSignature('Nguyễn Văn A');
    await screen.findByText('Chữ ký đã sẵn sàng');

    const stored = JSON.parse(localStorage.getItem('classtools-pdf-signatures') as string) as Array<{
      id: string;
      dataUrl: string;
      createdAt: number;
    }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('existing');
    expect(screen.getByLabelText('Dùng chữ ký đã lưu 1')).toBeInTheDocument();
  });

  it('ignores malformed saved signatures when loading', async () => {
    localStorage.setItem(
      'classtools-pdf-signatures',
      JSON.stringify([
        'junk',
        { id: 'bad-url', dataUrl: 'http://example.invalid/x.png', createdAt: 1 },
        { id: 'bad-date', dataUrl: 'data:image/png;base64,OKK', createdAt: 'nope' }
      ])
    );
    const { container } = render(<SignPage />);
    upload(container, threePage);
    await screen.findByText('3 trang');

    expect(screen.queryByText('Chữ ký đã lưu')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dùng chữ ký đã lưu 1')).not.toBeInTheDocument();
  });
});
