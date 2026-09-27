import { openPdfView } from './pdfPreview';

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface ExtractedText {
  pages: ExtractedPageText[];
  fullText: string;
}

/** Extracts text per page using pdf.js getTextContent (client-side only). */
export async function extractText(bytes: Uint8Array): Promise<ExtractedText> {
  const view = await openPdfView(bytes);
  const pages: { pageNumber: number; text: string }[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= view.pageCount; pageNumber += 1) {
      const text = await view.getPageText(pageNumber);
      pages.push({ pageNumber, text });
    }
  } finally {
    view.destroy();
  }

  return {
    pages,
    fullText: pages.map((page) => page.text).join('\n\n──────────\n\n')
  };
}

export function textFileName(base: string): string {
  return `${base.replace(/\.pdf$/i, '')}.txt`;
}
