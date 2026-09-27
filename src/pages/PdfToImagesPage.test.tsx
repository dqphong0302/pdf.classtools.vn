import { PDFDocument } from 'pdf-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StandardFonts } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfToImagesPage } from './PdfToImagesPage';
import { openPdfView } from '../lib/pdfPreview';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn(async () => ({
    pageCount: 3,
    pages: [],
    render: vi.fn(async () => undefined),
    getPageText: vi.fn(async () => ''),
    destroy: vi.fn()
  }))
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

function renderPage() {
  return render(
    <BrowserRouter>
      <PdfToImagesPage />
    </BrowserRouter>
  );
}

describe('PdfToImagesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['image-bytes'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('converts every page and lists the results', async () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [await makeThreePageFile()] } });

    expect(await screen.findByText('3 trang')).toBeInTheDocument();
    const convert = screen.getByRole('button', { name: /Chuyển đổi/ });
    fireEvent.click(convert);

    await waitFor(() => {
      expect(screen.getByText(/3 ảnh đã tạo/)).toBeInTheDocument();
    });
    expect(screen.getByText('page-1.png')).toBeInTheDocument();
    expect(screen.getByText('page-3.png')).toBeInTheDocument();
  });

  it('downloads all images as a zip', async () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [await makeThreePageFile()] } });
    await screen.findByText('3 trang');

    fireEvent.click(screen.getByRole('button', { name: /Chuyển đổi/ }));
    await screen.findByText(/3 ảnh đã tạo/);

    fireEvent.click(screen.getByRole('button', { name: /Tải tất cả \(ZIP\)/ }));
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('shows the JPG quality slider only in JPG mode', async () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [await makeThreePageFile()] } });
    await screen.findByText('3 trang');

    expect(screen.queryByLabelText('Chất lượng JPG')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
    expect(screen.getByLabelText('Chất lượng JPG')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(screen.queryByLabelText('Chất lượng JPG')).not.toBeInTheDocument();
  });

  it('uses the selected resolution', async () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [await makeThreePageFile()] } });
    await screen.findByText('3 trang');

    fireEvent.change(screen.getByLabelText('Độ rộng ảnh (px)'), { target: { value: '1440' } });
    fireEvent.click(screen.getByRole('button', { name: /Chuyển đổi/ }));

    await waitFor(() => {
      expect(openPdfView).toHaveBeenCalled();
    });
  });
});
