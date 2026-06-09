// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractStatementText, MAX_BYTES } from '@/lib/import/pdf-text';

describe('PDF guards (magic-byte + size, before parsing)', () => {
  it('rejects a non-PDF (wrong magic bytes) with code NOT_PDF', async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])]); // PNG header, small
    await expect(extractStatementText(png)).rejects.toMatchObject({ code: 'NOT_PDF' });
  });

  it('rejects an oversized file BEFORE parsing with code TOO_LARGE', async () => {
    // size is checked first, so magic bytes are irrelevant here; keep it minimal-cost.
    const huge = new Blob([new Uint8Array(MAX_BYTES + 1)]);
    await expect(extractStatementText(huge)).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });
});
