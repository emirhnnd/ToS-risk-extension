import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import manifestFn from '../../manifest.config';
// @ts-expect-error: .mjs betiği (tip bildirimi yok)
import { recordingKey, startServer } from '../../scripts/serve-fixtures.mjs';

type Manifest = { host_permissions: string[]; content_scripts: { all_frames?: boolean }[]; name: string };
const manifest = (mode: string) => (manifestFn as unknown as (env: { mode: string; command: string }) => Manifest)({ mode, command: 'build' });

describe('manifest: test izinleri normal build\'e sızmaz', () => {
  it('normal build yalnızca Google LLM uç noktasına izin verir, çerçevelere girmez', () => {
    const m = manifest('production');
    expect(m.host_permissions).toEqual(['https://generativelanguage.googleapis.com/*']);
    expect(m.content_scripts[0]!.all_frames).toBeUndefined();
  });
  it('e2e build yalnızca yerel test sunucusuna gider (Google\'a değil)', () => {
    const m = manifest('e2e');
    expect(m.host_permissions).toEqual(['http://localhost:5555/*']);
    expect(m.content_scripts[0]!.all_frames).toBe(true);
    expect(m.name).toContain('E2E');
  });
});

describe('E2E test sunucusu (LLM vekili)', () => {
  const PORT = 5599;
  const base = `http://localhost:${PORT}`;
  let dir: string;
  let server: Server;
  const body = JSON.stringify({ contents: [{ parts: [{ text: 'merhaba' }] }] });
  const post = (model: string, b = body) => fetch(`${base}/e2e-llm/v1beta/models/${model}:generateContent`, { method: 'POST', body: b });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-'));
    server = await startServer({ port: PORT, mode: 'replay', recordingsDir: dir, log: () => {} });
  });
  afterAll(() => {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('replay modunda kaydı olmayan istek Gemini\'ye gitmez, açıklamalı 503 döner', async () => {
    const res = await post('m1');
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toContain('kayıtlı LLM yanıtı yok');
  });

  it('kayıtlı yanıt varsa onu döndürür (ağ çağrısı yok)', async () => {
    const response = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
    writeFileSync(join(dir, `${recordingKey('m2', body)}.json`), JSON.stringify({ model: 'm2', status: 200, response }));
    const res = await post('m2');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-llm-source')).toBe('recording');
    expect(await res.text()).toBe(response);
  });

  it('son LLM isteğini gösterir (Cypress: gizli metin gönderilmedi mi?)', async () => {
    await post('m1');
    const last = await (await fetch(`${base}/e2e-llm/last`)).json();
    expect(last.model).toBe('m1');
    expect(last.body.contents[0].parts[0].text).toBe('merhaba');
  });

  it('kayıt anahtarı modele ve gövdeye bağlı', () => {
    expect(recordingKey('a', body)).not.toBe(recordingKey('b', body));
    expect(recordingKey('a', body)).not.toBe(recordingKey('a', body + ' '));
    expect(recordingKey('a', body)).toBe(recordingKey('a', body));
  });

  it('dizin dışına çıkma (path traversal) engellenir', async () => {
    const res = await fetch(`${base}/..%2f..%2fpackage.json`);
    expect([403, 404]).toContain(res.status);
    expect(await res.text()).not.toContain('"devDependencies"');
  });
});
