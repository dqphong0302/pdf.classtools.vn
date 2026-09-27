import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagesToPdfPage } from './ImagesToPdfPage';

const TINY_PNG_BYTES = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DwnwEAAMIByR/6d1AAAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0)
);

function pngFile(name: string): File {
  const copy = new Uint8Array(TINY_PNG_BYTES);
  return new File([copy], name, { type: 'image/png' });
}

function renderPage() {
  return render(
    <BrowserRouter>
      <ImagesToPdfPage />
    </BrowserRouter>
  );
}

describe('ImagesToPdfPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('adds images and creates a PDF with one page per image', async () => {
    renderPage();
    const input = screen.getByLabelText('Chọn ảnh (PNG/JPG)');
    fireEvent.change(input, { target: { files: [pngFile('a.png'), pngFile('b.png')] } });

    expect(await screen.findByText('a.png')).toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
    expect(screen.getByText('2 ảnh')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tạo PDF/ }));
    await waitFor(() => {
      expect(screen.getByText(/Đã tạo PDF 2 trang/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('reorders images with move buttons', async () => {
    renderPage();
    const input = screen.getByLabelText('Chọn ảnh (PNG/JPG)');
    fireEvent.change(input, { target: { files: [pngFile('first.png'), pngFile('second.png')] } });
    await screen.findByText('first.png');

    const upSecond = screen.getByRole('button', { name: 'Đưa second.png lên trên' });
    expect(upSecond).toBeEnabled();
    fireEvent.click(upSecond);

    const items = screen.getAllByRole('button', { name: /Đưa .* (lên trên|xuống dưới)/ });
    // After reorder, second.png is first so its up button is disabled.
    const secondUp = screen.getByRole('button', { name: 'Đưa second.png lên trên' });
    expect(secondUp).toBeDisabled();
    expect(items.length).toBe(4);
  });

  it('removes an image from the list', async () => {
    renderPage();
    const input = screen.getByLabelText('Chọn ảnh (PNG/JPG)');
    fireEvent.change(input, { target: { files: [pngFile('keep.png'), pngFile('drop.png')] } });
    await screen.findByText('keep.png');

    fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh drop.png' }));
    expect(screen.queryByText('drop.png')).not.toBeInTheDocument();
    expect(screen.getByText('1 ảnh')).toBeInTheDocument();
  });

  it('disables create without images and shows a hint', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Tạo PDF/ })).toBeDisabled();
    expect(screen.getByText('Chưa có ảnh nào. Hãy chọn ảnh để bắt đầu.')).toBeInTheDocument();
  });
});
