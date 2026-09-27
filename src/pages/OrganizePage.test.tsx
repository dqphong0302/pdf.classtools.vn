import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizePage } from './OrganizePage';

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

function upload(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

function badgeNumbers(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.thumb-card__badge')).map((badge) => badge.textContent ?? '');
}

describe('OrganizePage', () => {
  let fivePage: File;

  beforeAll(async () => {
    fivePage = await createPdfFile(5, 'five.pdf');
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

  async function renderWithFivePages() {
    const { container } = render(<OrganizePage />);
    upload(container, fivePage);
    await screen.findByText('Trang 1');
    return container;
  }

  it('shows one card per page with original badges and disables actions initially', async () => {
    const container = await renderWithFivePages();

    expect(container.querySelectorAll('.thumb-card')).toHaveLength(5);
    expect(badgeNumbers(container)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByText('5 trang')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đặt lại' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xoay trái trang 2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Di chuyển trang 1 lên trên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Di chuyển trang 5 xuống dưới' })).toBeDisabled();
  });

  it('rotates page 2, applies the change and downloads the result', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Xoay phải trang 2' }));
    expect(await screen.findByText(/đã xoay 1/)).toBeInTheDocument();

    const apply = screen.getByRole('button', { name: 'Áp dụng thay đổi' });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã lưu: 5 trang');
    expect(badgeNumbers(container)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('deletes page 1 and applies to re-render four cards', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa trang 1' }));
    expect(container.querySelector('.thumb-card')).toHaveClass('org-card--deleted');
    expect(await screen.findByText(/đã xóa 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 4 trang');
    expect(container.querySelectorAll('.thumb-card')).toHaveLength(4);
    expect(badgeNumbers(container)).toEqual(['2', '3', '4', '5']);
    expect(container.querySelector('.thumb-card')).not.toHaveClass('org-card--deleted');
  });

  it('reorders pages with move down and applies the new page order', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Di chuyển trang 1 xuống dưới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Di chuyển trang 1 xuống dưới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 5 trang');
    expect(badgeNumbers(container)).toEqual(['2', '3', '1', '4', '5']);
  });

  it('reverses the working order and applies it', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Đảo ngược' }));
    expect(badgeNumbers(container)).toEqual(['5', '4', '3', '2', '1']);
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 5 trang');
    expect(badgeNumbers(container)).toEqual(['5', '4', '3', '2', '1']);
  });

  it('duplicates page 2 into an adjacent card and applies the extra page', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Nhân đôi trang 2' }));

    expect(await screen.findByText('6 trang')).toBeInTheDocument();
    expect(container.querySelectorAll('.thumb-card')).toHaveLength(6);
    expect(badgeNumbers(container)).toEqual(['1', '2', '6', '3', '4', '5']);
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 6 trang');
    expect(badgeNumbers(container)).toEqual(['1', '2', '6', '3', '4', '5']);
  });

  it('inserts a blank page after the first page and applies it', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Chèn trang trắng' }));

    expect(await screen.findByText('6 trang')).toBeInTheDocument();
    expect(container.querySelectorAll('.thumb-card')).toHaveLength(6);
    expect(badgeNumbers(container)).toEqual(['1', '6', '2', '3', '4', '5']);
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 6 trang');
    expect(badgeNumbers(container)).toEqual(['1', '6', '2', '3', '4', '5']);
  });

  it('applies rotation, deletion and reordering together, then resets to the original file', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Xoay phải trang 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 5 trang');

    fireEvent.click(screen.getByRole('button', { name: 'Xóa trang 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 4 trang');
    expect(badgeNumbers(container)).toEqual(['2', '3', '4', '5']);

    const moveDown = () => screen.getByRole('button', { name: 'Di chuyển trang 2 xuống dưới' });
    fireEvent.click(moveDown());
    fireEvent.click(moveDown());
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu: 4 trang');
    expect(badgeNumbers(container)).toEqual(['3', '4', '2', '5']);

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(container.querySelectorAll('.thumb-card')).toHaveLength(5);
    expect(badgeNumbers(container)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByText('5 trang')).toBeInTheDocument();
    expect(screen.queryByText(/đã xoay/)).not.toBeInTheDocument();
    expect(screen.queryByText(/đã xóa/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeDisabled();
  });

  it('restores the original grid and zero counters when reset before applying', async () => {
    const container = await renderWithFivePages();

    fireEvent.click(screen.getByRole('button', { name: 'Xoay phải trang 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa trang 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Di chuyển trang 1 xuống dưới' }));

    expect(await screen.findByText(/đã xoay 1/)).toBeInTheDocument();
    expect(screen.getByText(/đã xóa 1/)).toBeInTheDocument();
    expect(container.querySelector('.thumb-card--deleted, .org-card--deleted')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));

    expect(container.querySelectorAll('.thumb-card')).toHaveLength(5);
    expect(badgeNumbers(container)).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByText('5 trang')).toBeInTheDocument();
    expect(screen.queryByText(/đã xoay/)).not.toBeInTheDocument();
    expect(screen.queryByText(/đã xóa/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeDisabled();
  });

  it('shows a friendly alert for unreadable files', async () => {
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });
    const { container } = render(<OrganizePage />);
    upload(container, broken);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đọc được tệp');
    expect(container.querySelector('.thumb-card')).toBeNull();
    expect(screen.getByText('Tải lên một tệp PDF để bắt đầu sắp xếp trang.')).toBeInTheDocument();
  });
});
