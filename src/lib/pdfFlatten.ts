import { PDFDocument } from 'pdf-lib';

export async function flattenPdf(sourceBytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  try {
    const form = pdf.getForm();
    form.flatten();
  } catch {
    // No interactive form present; saving will re-serialize standard structures
  }
  return await pdf.save();
}
