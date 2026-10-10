// Bağımlılıksız mini sunucu: cypress/fixtures/pages altındaki test sayfalarını http://localhost:5555 adresinde sunar.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = join(process.cwd(), 'cypress', 'fixtures', 'pages');
const PORT = Number(process.env.PORT ?? 5555);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
  const file = join(ROOT, path || 'index.html');
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': extname(file) === '.html' ? 'text/html; charset=utf-8' : 'text/plain' }).end(body);
  } catch {
    res.writeHead(404).end('Bulunamadı');
  }
}).listen(PORT, () => console.log(`Test sayfaları: http://localhost:${PORT}/`));
