import { fireEvent, render, screen } from '@testing-library/react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NupPage } from './NupPage';

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

describe('NupPage', () => {
  let ninePage: File;

  beforeAll(async () => {
    ninePage = await createPdfFile(9, 'nine.pdf');
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

  async function renderWithNinePages(): Promise<HTMLElement> {
    const { container } = render(<NupPage />);
    upload(container, ninePage);
    await screen.findByText('9 trang');
    return container;
  }

  it('shows the sheet estimate for the default 2×2 landscape layout', async () => {
    await renderWithNinePages();

    expect(screen.getByRole('button', { name: '2×2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'Tờ ngang (A4 landscape)' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('3 tờ A4');
  });

  it('applies N-up, reports the result and downloads it', async () => {
    await renderWithNinePages();

    fireEvent.click(screen.getByRole('button', { name: /Tạo PDF N-trang/ }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('9 trang gốc → 3 tờ A4');

    fireEvent.click(screen.getByRole('button', { name: /Tải xuống/ }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('updates the estimate when switching to 1×2 portrait', async () => {
    await renderWithNinePages();

    fireEvent.click(screen.getByRole('button', { name: '1×2' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tờ ngang (A4 landscape)' }));

    expect(screen.getByRole('status')).toHaveTextContent('5 tờ A4');
  });

  it('moves aria-pressed and is-active across preset buttons', async () => {
    await renderWithNinePages();

    const oneByTwo = screen.getByRole('button', { name: '1×2' });
    const twoByTwo = screen.getByRole('button', { name: '2×2' });
    const threeByThree = screen.getByRole('button', { name: '3×3' });
    expect(twoByTwo).toHaveAttribute('aria-pressed', 'true');
    expect(twoByTwo).toHaveClass('is-active');

    fireEvent.click(oneByTwo);
    expect(oneByTwo).toHaveAttribute('aria-pressed', 'true');
    expect(oneByTwo).toHaveClass('is-active');
    expect(twoByTwo).toHaveAttribute('aria-pressed', 'false');
    expect(twoByTwo).not.toHaveClass('is-active');

    fireEvent.click(threeByThree);
    expect(threeByThree).toHaveAttribute('aria-pressed', 'true');
    expect(threeByThree).toHaveClass('is-active');
    expect(oneByTwo).toHaveAttribute('aria-pressed', 'false');
    expect(oneByTwo).not.toHaveClass('is-active');
  });
});
