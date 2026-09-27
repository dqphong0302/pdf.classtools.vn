import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropPage } from './CropPage';

vi.mock('../lib/pdfPreview', () => ({
  openPdfView: vi.fn().mockRejectedValue(new Error('no preview'))
}));

async function createPdfFile(pages: number, name: string): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${name} ${index + 1}`, { x: 20, y: 200, size: 24, font });
  }
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], name, { type: 'application/pdf' });
}

function upload(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

function setMargin(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('CropPage', () => {
  let twoPage: File;

  beforeAll(async () => {
    twoPage = await createPdfFile(2, 'two.pdf');
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

  async function renderWithTwoPages(): Promise<HTMLElement> {
    const { container } = render(<CropPage />);
    upload(container, twoPage);
    await screen.findByText('2 trang');
    return container;
  }

  it('crops with the default 10 mm margins, reports the result and downloads it', async () => {
    await renderWithTwoPages();

    expect(screen.getByRole('button', { name: 'Cắt mép' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cắt mép' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã cắt 2 trang');

    fireEvent.click(screen.getByRole('button', { name: /Tải xuống/ }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('warns when pages are too small to crop', async () => {
    await renderWithTwoPages();

    setMargin('Lề trên (mm)', '150');
    fireEvent.click(screen.getByRole('button', { name: 'Cắt mép' }));

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('2 trang quá nhỏ, bỏ qua');
    expect(screen.getByRole('status')).toHaveTextContent('Đã cắt 0 trang');
  });

  it('disables the crop button when every margin is 0', async () => {
    await renderWithTwoPages();

    const button = screen.getByRole('button', { name: 'Cắt mép' });
    expect(button).toBeEnabled();

    setMargin('Lề trên (mm)', '0');
    setMargin('Lề phải (mm)', '0');
    setMargin('Lề dưới (mm)', '0');
    setMargin('Lề trái (mm)', '0');

    expect(button).toBeDisabled();
  });

  it('restores the original margins and file on reset', async () => {
    await renderWithTwoPages();

    setMargin('Lề trên (mm)', '25');
    fireEvent.click(screen.getByRole('button', { name: 'Cắt mép' }));
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Lề trên (mm)')).toHaveValue(10);
    expect(screen.getByLabelText('Lề phải (mm)')).toHaveValue(10);
    expect(screen.getByLabelText('Lề dưới (mm)')).toHaveValue(10);
    expect(screen.getByLabelText('Lề trái (mm)')).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'Cắt mép' })).toBeEnabled();
  });
});
