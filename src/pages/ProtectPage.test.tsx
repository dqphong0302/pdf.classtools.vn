import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptPdf, encryptPdf } from '../lib/wasmQpdf';
import { ProtectPage } from './ProtectPage';

vi.mock('../lib/wasmQpdf', () => ({
  encryptPdf: vi.fn(async () => new Uint8Array([9, 9])),
  decryptPdf: vi.fn(async () => new Uint8Array([7, 7]))
}));

vi.mock('../lib/pdfOps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pdfOps')>();
  return {
    ...actual,
    getPdfPageCount: vi.fn(async () => {
      if (pageCountBehavior === 'encrypted') throw new actual.EncryptedPdfError();
      if (pageCountBehavior === 'unreadable') throw new Error('PDF_LOAD_FAILED:mock');
      return 1;
    })
  };
});

let pageCountBehavior: 'ok' | 'encrypted' | 'unreadable' = 'ok';

async function createPdfFile(name: string): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([200, 300]);
  page.drawText('demo', { x: 20, y: 200, size: 24, font });
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], name, { type: 'application/pdf' });
}

function upload(container: HTMLElement, files: File[]): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('ProtectPage', () => {
  let pdfFile: File;

  beforeAll(async () => {
    pdfFile = await createPdfFile('demo.pdf');
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(encryptPdf).mockImplementation(async () => new Uint8Array([9, 9]));
    vi.mocked(decryptPdf).mockImplementation(async () => new Uint8Array([7, 7]));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    pageCountBehavior = 'ok';
    vi.restoreAllMocks();
  });

  it('switches between the encrypt and decrypt tabs', async () => {
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);
    await screen.findByText(/^demo\.pdf ·/);

    const encryptTab = screen.getByRole('button', { name: 'Đặt mật khẩu' });
    const decryptTab = screen.getByRole('button', { name: 'Mở khóa' });
    expect(encryptTab).toHaveAttribute('aria-pressed', 'true');
    expect(decryptTab).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(decryptTab);
    expect(decryptTab).toHaveAttribute('aria-pressed', 'true');
    expect(encryptTab).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Mật khẩu (tùy chọn)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu để mở tệp')).not.toBeInTheDocument();

    fireEvent.click(encryptTab);
    expect(encryptTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Mật khẩu (tùy chọn)')).not.toBeInTheDocument();
  });

  it('encrypts once both passwords reach 4 characters and downloads the result', async () => {
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);
    await screen.findByText(/^demo\.pdf ·/);

    const applyButton = screen.getByRole('button', { name: 'Mã hóa & tải xuống' });
    expect(applyButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Mật khẩu để mở tệp'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu chủ (quyền hạn)'), { target: { value: '12' } });
    expect(applyButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Mật khẩu để mở tệp'), { target: { value: 'abcd' } });
    expect(applyButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Mật khẩu chủ (quyền hạn)'), { target: { value: '1234' } });
    expect(applyButton).toBeEnabled();

    fireEvent.click(applyButton);

    expect(await screen.findByRole('status')).toHaveTextContent('Đã đặt mật khẩu cho tệp PDF.');
    expect(encryptPdf).toHaveBeenCalledWith(expect.any(Uint8Array), { user: 'abcd', owner: '1234' }, '256');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('passes strength 128 when the AES-128 option is selected', async () => {
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);
    await screen.findByText(/^demo\.pdf ·/);

    fireEvent.click(screen.getByRole('button', { name: 'AES-128' }));
    expect(screen.getByRole('button', { name: 'AES-128' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'AES-256' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.change(screen.getByLabelText('Mật khẩu để mở tệp'), { target: { value: 'abcd' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu chủ (quyền hạn)'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mã hóa & tải xuống' }));

    await screen.findByRole('status');
    expect(encryptPdf).toHaveBeenCalledWith(expect.any(Uint8Array), { user: 'abcd', owner: '1234' }, '128');
  });

  it('shows a friendly alert when the password is wrong during decrypt', async () => {
    vi.mocked(decryptPdf).mockRejectedValueOnce(new Error('QPDF_FAILED:3'));
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);
    await screen.findByText(/^demo\.pdf ·/);

    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa' }));
    fireEvent.change(screen.getByLabelText('Mật khẩu (tùy chọn)'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa & tải xuống' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sai mật khẩu hoặc tệp không thể mở khóa.');
    expect(decryptPdf).toHaveBeenCalledWith(expect.any(Uint8Array), 'wrong');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('decrypts with the optional password and downloads the result', async () => {
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);
    await screen.findByText(/^demo\.pdf ·/);

    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa & tải xuống' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Đã mở khóa tệp PDF.');
    expect(decryptPdf).toHaveBeenCalledWith(expect.any(Uint8Array), '');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('detects encrypted files and switches to the unlock tab', async () => {
    pageCountBehavior = 'encrypted';
    const { container } = render(<ProtectPage />);
    upload(container, [pdfFile]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tệp đang được bảo vệ — chuyển sang tab Mở khóa.');
    expect(await screen.findByText('Được bảo vệ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở khóa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Đặt mật khẩu' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Mở khóa & tải xuống' })).toBeEnabled();
  });

  it('alerts when the uploaded file cannot be read', async () => {
    pageCountBehavior = 'unreadable';
    const broken = new File([new TextEncoder().encode('not a real pdf')], 'broken.pdf', {
      type: 'application/pdf'
    });
    const { container } = render(<ProtectPage />);
    upload(container, [broken]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không đọc được tệp: broken.pdf.');
    expect(screen.getByRole('button', { name: 'Mã hóa & tải xuống' })).toBeDisabled();
  });
});
