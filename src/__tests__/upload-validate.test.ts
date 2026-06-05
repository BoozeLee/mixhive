/**
 * @jest-environment node
 */

import { POST } from '../app/api/upload/validate/route';
import type { NextRequest } from 'next/server';

function makeFile(name: string, type: string, size: number) {
  return { name, type, size } as unknown as File;
}

function makeReq(file: { name: string; type: string; size: number } | null) {
  return {
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }),
    formData: async () => ({ get: (key: string) => (key === 'file' ? file : null) }),
  } as unknown as NextRequest;
}

describe('/api/upload/validate POST', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeReq(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const res = await POST(makeReq(makeFile('virus.exe', 'application/octet-stream', 1000)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/Unsupported file type/);
  });

  it('returns 400 when audio file exceeds 100 MB', async () => {
    const res = await POST(makeReq(makeFile('huge.mp3', 'audio/mpeg', 101 * 1024 * 1024)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/too large/);
    expect(body.category).toBe('audio');
  });

  it('returns 200 for a valid mp3 under the size cap', async () => {
    const res = await POST(makeReq(makeFile('mix.mp3', 'audio/mpeg', 50 * 1024 * 1024)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.category).toBe('audio');
    expect(body.type).toBe('audio/mpeg');
  });

  it('returns 200 for a valid image/jpeg under the size cap', async () => {
    const res = await POST(makeReq(makeFile('artwork.jpg', 'image/jpeg', 2 * 1024 * 1024)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.category).toBe('image');
  });
});
