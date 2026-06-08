import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractStatementText } from '@/lib/import/pdf-text';
import * as unpdfMod from 'unpdf';

// vi.mock is hoisted by vitest — applies to dynamic imports too
vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: vi.fn(async (): Promise<{ totalPages: number; text: string[] }> => ({
    totalPages: 2,
    text: ['page one', 'page two'],
  })),
}));

/** Build a Blob whose leading bytes are `leadingBytes` and whose `.size` is optionally overridden.
 *  The actual content is only the leading bytes (small allocation).
 *  We override .size via Object.defineProperty so the size-guard fires without allocating 10 MB.
 *  The slice(0,5) arrayBuffer read still returns the real bytes.
 */
function makeFile(leadingBytes: number[], size?: number): Blob {
  const arr = new Uint8Array(leadingBytes);
  const blob = new Blob([arr]);
  if (size !== undefined) {
    Object.defineProperty(blob, 'size', { value: size, writable: false, configurable: true });
  }
  return blob;
}

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

describe('extractStatementText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset extractText to default (2 pages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(unpdfMod.extractText).mockResolvedValue({ totalPages: 2, text: ['page one', 'page two'] } as any);
  });

  it('rejects non-PDF magic bytes with code NOT_PDF', async () => {
    const file = makeFile([0x00, 0x01, 0x02, 0x03, 0x04]);
    await expect(extractStatementText(file)).rejects.toMatchObject({ code: 'NOT_PDF' });
  });

  it('rejects files larger than 10 MB with code TOO_LARGE (size checked before magic)', async () => {
    // Non-PDF magic + oversized: size check happens first
    const file = makeFile([0x00, 0x01], 11 * 1024 * 1024);
    await expect(extractStatementText(file)).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  it('rejects PDF magic + size > 10 MB with code TOO_LARGE', async () => {
    const file = makeFile(PDF_MAGIC_BYTES, 11 * 1024 * 1024);
    await expect(extractStatementText(file)).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  it('rejects valid PDF with totalPages: 51 with code TOO_MANY_PAGES', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(unpdfMod.extractText).mockResolvedValueOnce({ totalPages: 51, text: [] } as any);
    const file = makeFile(PDF_MAGIC_BYTES);
    await expect(extractStatementText(file)).rejects.toMatchObject({ code: 'TOO_MANY_PAGES' });
  });

  it('resolves valid PDF with totalPages: 2 to joined page text', async () => {
    const file = makeFile(PDF_MAGIC_BYTES);
    const result = await extractStatementText(file);
    expect(result).toBe('page one\npage two');
  });
});
