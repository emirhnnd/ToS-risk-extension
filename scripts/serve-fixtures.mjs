// Bağımlılıksız mini test sunucusu (http://localhost:5555)
//
//  /                     cypress/fixtures/pages altındaki test sayfaları
//  POST /e2e-llm/...       E2E build'inin LLM isteği. Gerçek anahtar burada, .env'den eklenir;
//                        uzantıya hiç girmez. Yanıtlar cypress/fixtures/llm/ altına kaydedilir.
//  GET  /e2e-llm/last      Son LLM isteğinin gövdesi (Cypress: "gizli metin LLM'e gitmedi mi?")
//
// LLM_MODE:
//   auto   (varsayılan) kayıt varsa onu döndürür, yoksa Gemini'yi çağırıp kaydeder
//   replay yalnızca kayıttan; kayıt yoksa hata (video ve tekrarlanabilir koşu)
//   live   her seferinde Gemini (kaydetmez)
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const PAGES = join(process.cwd(), 'cypress', 'fixtures', 'pages');
const GOOGLE = 'https://generativelanguage.googleapis.com';
const MODES = ['auto', 'replay', 'live'];

function readEnvKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (!existsSync('.env')) return '';
  const m = readFileSync('.env', 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\r\n]*)"?/m);
  return m ? m[1].trim() : '';
}

/** Kayıt anahtarı: model + istek gövdesi (aynı sayfa + aynı prompt → aynı kayıt) */
export function recordingKey(model, body) {
  return createHash('sha256').update(model + '\n' + body).digest('hex').slice(0, 20);
}

const json = (res, status, obj) =>
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export function startServer({
  port = Number(process.env.PORT ?? 5555),
  mode = process.env.LLM_MODE ?? 'auto',
  recordingsDir = process.env.LLM_RECORDINGS ?? join(process.cwd(), 'cypress', 'fixtures', 'llm'),
  log = console.log,
} = {}) {
  const RECORDINGS = recordingsDir;
  if (!MODES.includes(mode)) throw new Error(`LLM_MODE geçersiz: ${mode} (${MODES.join(' | ')})`);
  let last = null;

  async function handleLlm(req, res, path) {
    // path: v1beta/models/<model>:generateContent
    const m = path.match(/^v1beta\/models\/([^/:]+):generateContent$/);
    if (req.method !== 'POST' || !m) return json(res, 404, { error: { message: 'Bilinmeyen LLM yolu' } });
    const model = decodeURIComponent(m[1]);
    const body = await readBody(req);
    last = { model, at: new Date().toISOString(), body: JSON.parse(body) };
    const key = recordingKey(model, body);
    const file = join(RECORDINGS, `${key}.json`);

    if (mode !== 'live' && existsSync(file)) {
      const rec = JSON.parse(readFileSync(file, 'utf8'));
      log(`[llm] kayıttan (${key}) · ${model}`);
      return res.writeHead(rec.status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Llm-Source': 'recording' }).end(rec.response);
    }
    if (mode === 'replay') {
      log(`[llm] kayıt yok (${key}) · replay modunda Gemini çağrılmaz`);
      return json(res, 503, { error: { message: `E2E: bu istek için kayıtlı LLM yanıtı yok (${key}). Önce "npm run e2e" ile kaydedin.` } });
    }
    const apiKey = readEnvKey();
    if (!apiKey) return json(res, 401, { error: { message: 'E2E sunucusu: .env içinde GEMINI_API_KEY yok.' } });

    log(`[llm] Gemini çağrılıyor · ${model} …`);
    const upstream = await fetch(`${GOOGLE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body,
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => ({ ok: false, status: 502, text: async () => JSON.stringify({ error: { message: `E2E sunucusu Gemini'ye ulaşamadı: ${e.message}` } }) }));
    const text = await upstream.text();
    // Yalnızca başarılı yanıtlar kaydedilir; hata (kota vb.) bir dahaki koşuda yeniden denenir.
    if (upstream.status === 200 && mode === 'auto') {
      mkdirSync(RECORDINGS, { recursive: true });
      writeFileSync(file, JSON.stringify({ model, recorded_at: new Date().toISOString(), status: 200, response: text }, null, 2));
      log(`[llm] kaydedildi → cypress/fixtures/llm/${key}.json`);
    } else log(`[llm] Gemini yanıtı: HTTP ${upstream.status}`);
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Llm-Source': 'gemini' }).end(text);
  }

  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (urlPath === '/e2e-llm/last') return json(res, last ? 200 : 404, last ?? { error: 'Henüz LLM isteği yok' });
      if (urlPath.startsWith('/e2e-llm/')) return await handleLlm(req, res, urlPath.slice('/e2e-llm/'.length));

      const path = normalize(urlPath).replace(/^([/\\])+/, '');
      const file = join(PAGES, path || 'index.html');
      if (!file.startsWith(PAGES)) return res.writeHead(403).end();
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': extname(file) === '.html' ? 'text/html; charset=utf-8' : 'text/plain' }).end(body);
    } catch (e) {
      if (e && e.code === 'ENOENT') return res.writeHead(404).end('Bulunamadı');
      log('[sunucu] hata: ' + (e && e.message));
      if (!res.headersSent) json(res, 500, { error: { message: String(e && e.message) } });
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      log(`Test sayfaları: http://localhost:${port}/  (LLM_MODE=${mode})`);
      resolve(server);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((e) => {
    console.error(e.code === 'EADDRINUSE' ? 'Port 5555 kullanımda: başka bir "npm run fixtures" açık olabilir.' : e.message);
    process.exit(1);
  });
}
