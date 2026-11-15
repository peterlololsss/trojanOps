import { describe, expect, it } from 'vitest';
import { uploadErrorMessage } from '@/lib/documents/upload-error';

describe('document upload errors', () => {
  it('keeps a readable API error message', async () => {
    const response = Response.json({ code: 'forbidden', message: 'Only the club president can upload documents.' }, { status: 403 });
    expect(await uploadErrorMessage(response)).toBe('Only the club president can upload documents.');
  });

  const malformed = [
    { message: { reason: 'invalid' } }, { message: ['invalid'] }, { message: 403 },
    { message: false }, { message: null }, { message: '' }, { message: '  ' },
    {}, null, ['invalid'], 'invalid',
  ];
  for (const body of malformed) {
    it(`uses a renderable fallback for ${JSON.stringify(body)}`, async () => {
      const response = Response.json(body, { status: 422 });
      expect(await uploadErrorMessage(response)).toBe('Upload failed (422). Try again or ask your club president for help.');
    });
  }

  it('handles a non-JSON proxy response', async () => {
    const response = new Response('<html>Bad gateway</html>', { status: 502 });
    expect(await uploadErrorMessage(response)).toBe('Upload failed (502). Try again or ask your club president for help.');
  });

  it('handles an empty error response', async () => {
    const response = new Response(null, { status: 500 });
    expect(await uploadErrorMessage(response)).toBe('Upload failed (500). Try again or ask your club president for help.');
  });
});
