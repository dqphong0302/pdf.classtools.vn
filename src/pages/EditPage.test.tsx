import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditPage } from './EditPage';
import { addImageLayers, addImageWatermark, addTextLayers } from '../lib/pdfEdit';
import { stampPageNumbers } from '../lib/pdfPageNumbers';
import { stampTextWatermark } from '../lib/pdfWatermark';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn().mockRejectedValue(new Error('no preview'))
}));

vi.mock('../lib/pdfEdit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pdfEdit')>();
  return {
    ...actual,
    ensureEmbeddedFonts: vi.fn().mockResolvedValue({ regular: {}, bold: {} }),
    addTextLayers: vi.fn().mockResolvedValue(undefined),
    addImageLayers: vi.fn().mockResolvedValue(undefined),
    addImageWatermark: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../lib/pdfWatermark', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pdfWatermark')>()),
  stampTextWatermark: vi.fn()
}));

vi.mock('../lib/pdfPageNumbers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pdfPageNumbers')>()),
  stampPageNumbers: vi.fn()
}));

async function makeThreePageFile(): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page ${index + 1}`, { x: 20, y: 200, size: 24, font });
  }
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], 'three.pdf', { type: 'application/pdf' });
}

function renderEdit() {
  return render(
    <BrowserRouter>
      <EditPage />
    </BrowserRouter>
  );
}

function uploadFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('EditPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('loads a PDF and selects a target page', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());

    expect(await screen.findByText('3 trang')).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: /^Trang \d+$/ });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    expect(screen.getByRole('button', { name: 'Trang 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Trang 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds a text layer, applies the pipeline and downloads', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    const apply = screen.getByRole('button', { name: /Áp dụng & tải xuống/ });
    expect(apply).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Làm bài tại nhà' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chữ' }));

    expect(screen.getByText(/Làm bài tại nhà/)).toBeInTheDocument();
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    await waitFor(() => {
      expect(addTextLayers).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(addTextLayers).mock.calls[0][2]).toEqual([
      { pageIndex: 0, text: 'Làm bài tại nhà', xPct: 10, yPct: 10, fontSizePt: 14, colorHex: '#25223f', bold: false }
    ]);
    expect(await screen.findByText('Đã lưu bản chỉnh sửa.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('applies the watermark and page numbers when configured', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    fireEvent.change(screen.getByLabelText('Nội dung dấu mờ'), { target: { value: 'TÀI LIỆU NỘI BỘ' } });
    fireEvent.click(screen.getByLabelText('Bật đánh số trang'));
    fireEvent.change(screen.getByLabelText('Bắt đầu từ'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /Áp dụng & tải xuống/ }));
    await waitFor(() => {
      expect(stampTextWatermark).toHaveBeenCalledTimes(1);
      expect(stampPageNumbers).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(stampTextWatermark).mock.calls[0][2]).toMatchObject({ text: 'TÀI LIỆU NỘI BỘ', angle: 45 });
    expect(vi.mocked(stampPageNumbers).mock.calls[0][2]).toMatchObject({ startFrom: 2, position: 'bottom-center' });
  });

  it('adds an image layer and passes its bytes to the pipeline', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    const imageInput = container.querySelector('input[accept="image/png,image/jpeg"]') as HTMLInputElement;
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [pngFile] } });

    await waitFor(() => {
      expect(screen.getByText(/logo\.png/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Áp dụng & tải xuống/ }));
    await waitFor(() => {
      expect(addImageLayers).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(addImageLayers).mock.calls[0][1][0]).toMatchObject({ pageIndex: 0, widthPct: 40, xPct: 10, yPct: 10 });
  });

  it('disables apply again after removing every layer', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Ghi chú' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chữ' }));
    const apply = screen.getByRole('button', { name: /Áp dụng & tải xuống/ });
    expect(apply).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Xóa lớp chữ: Ghi chú/ }));
    expect(apply).toBeDisabled();
  });

  it('applies an image watermark when the image source tab is used', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    fireEvent.click(screen.getByRole('button', { name: 'Ảnh' }));
    const wmImageInput = container.querySelector('input[aria-label="Chọn ảnh dấu mờ (PNG/JPG)"]') as HTMLInputElement;
    expect(wmImageInput).not.toBeNull();
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'stamp.png', { type: 'image/png' });
    fireEvent.change(wmImageInput, { target: { files: [pngFile] } });

    const apply = screen.getByRole('button', { name: /Áp dụng & tải xuống/ });
    await waitFor(() => {
      expect(apply).toBeEnabled();
    });

    fireEvent.click(apply);
    await waitFor(() => {
      expect(addImageWatermark).toHaveBeenCalledTimes(1);
    });
    expect(stampTextWatermark).not.toHaveBeenCalled();
    expect(vi.mocked(addImageWatermark).mock.calls[0][1]).toMatchObject({
      widthPct: 45,
      opacity: 0.15,
      angle: 45,
      xPct: 50,
      yPct: 50
    });
    expect(await screen.findByText('Đã lưu bản chỉnh sửa.')).toBeInTheDocument();
  });

  it('keeps using the text watermark after switching back to the text tab', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    fireEvent.click(screen.getByRole('button', { name: 'Ảnh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chữ' }));

    fireEvent.change(screen.getByLabelText('Nội dung dấu mờ'), { target: { value: 'TÀI LIỆU NỘI BỘ' } });
    fireEvent.click(screen.getByRole('button', { name: /Áp dụng & tải xuống/ }));

    await waitFor(() => {
      expect(stampTextWatermark).toHaveBeenCalledTimes(1);
    });
    expect(addImageWatermark).not.toHaveBeenCalled();
    expect(vi.mocked(stampTextWatermark).mock.calls[0][2]).toMatchObject({ text: 'TÀI LIỆU NỘI BỘ', angle: 45 });
  });

  it('renders a draggable chip for each pending layer on the selected page', async () => {
    const { container } = renderEdit();
    uploadFile(container, await makeThreePageFile());
    await screen.findByText('3 trang');

    expect(container.querySelector('[data-layer-id]')).toBeNull();

    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Ghi chú' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chữ' }));

    const chip = await waitFor(() => {
      const found = container.querySelector('[data-layer-id]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(chip.textContent).toContain('Aa');
    expect(container.querySelectorAll('[data-layer-id]')).toHaveLength(1);
  });
});
