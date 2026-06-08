export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PAGES = 50;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export type ImportErrorCode = 'NOT_PDF' | 'TOO_LARGE' | 'TOO_MANY_PAGES' | 'EXTRACT_FAILED';
export class ImportError extends Error {
  constructor(public code: ImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ImportError';
  }
}

async function hasPdfMagic(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer());
  return PDF_MAGIC.every((b, i) => head[i] === b);
}

/**
 * Extract plain text from a statement PDF, entirely on-device.
 * Validates magic bytes + size BEFORE loading the parser, then page count after.
 * unpdf is lazy-imported so PDF.js stays out of the core bundle (D9).
 */
export async function extractStatementText(file: Blob): Promise<string> {
  if (file.size > MAX_BYTES) throw new ImportError('TOO_LARGE');
  if (!(await hasPdfMagic(file))) throw new ImportError('NOT_PDF');

  const { getDocumentProxy, extractText } = await import('unpdf'); // lazy — D9
  let pages: string[];
  let totalPages: number;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(data);
    const res = await extractText(pdf); // default: per-page string[]
    totalPages = res.totalPages;
    pages = Array.isArray(res.text) ? res.text : [res.text];
  } catch (e) {
    throw new ImportError('EXTRACT_FAILED', (e as Error)?.message);
  }
  if (totalPages > MAX_PAGES) throw new ImportError('TOO_MANY_PAGES');
  return pages.join('\n');
}
