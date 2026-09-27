import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataPage } from './MetadataPage';

async function createMetaPdfFile(): Promise<File> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  doc.setTitle('Giáo án');
  doc.setAuthor('Thầy Phong');
  doc.setKeywords(['toan']);
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], 'giao-an.pdf', { type: 'application/pdf' });
}

function upload(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('MetadataPage', () => {
  let metaPdf: File;

  beforeAll(async () => {
    metaPdf = await createMetaPdfFile();
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

  it('fills the form with the existing metadata after upload', async () => {
    const { container } = render(<MetadataPage />);
    upload(container, metaPdf);

    expect(await screen.findByText('1 trang')).toBeInTheDocument();
    expect(await screen.findByLabelText('Tiêu đề')).toHaveValue('Giáo án');
    expect(screen.getByLabelText('Tác giả')).toHaveValue('Thầy Phong');
    expect(screen.getByLabelText('Từ khóa')).toHaveValue('toan');
    expect(screen.getByLabelText('Chủ đề')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Lưu metadata/ })).toBeDisabled();
  });

  it('saves changed metadata and offers the download', async () => {
    const { container } = render(<MetadataPage />);
    upload(container, metaPdf);
    await screen.findByLabelText('Tiêu đề');

    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Giáo án lớp 5' } });
    const saveButton = screen.getByRole('button', { name: /Lưu metadata/ });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã lưu metadata');
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Tải xuống/ }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('clears metadata and empties the form', async () => {
    const { container } = render(<MetadataPage />);
    upload(container, metaPdf);
    await screen.findByLabelText('Tiêu đề');

    fireEvent.click(screen.getByRole('button', { name: /Xóa metadata/ }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Đã xóa metadata');
    expect(screen.getByLabelText('Tiêu đề')).toHaveValue('');
    expect(screen.getByLabelText('Tác giả')).toHaveValue('');
    expect(screen.getByLabelText('Chủ đề')).toHaveValue('');
    expect(screen.getByLabelText('Từ khóa')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Lưu metadata/ })).toBeDisabled();
  });

  it('shows an alert for unreadable files', async () => {
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });

    const { container } = render(<MetadataPage />);
    upload(container, broken);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đọc được tệp');
    expect(screen.getByText('Tải lên một tệp PDF để xem và chỉnh sửa metadata.')).toBeInTheDocument();
  });
});
