// Dedicated concept preview: serves only this artifact, never the repository or live APIs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const page = new URL('./concepts.html', import.meta.url);
createServer(async (req, res) => {
  if (req.method !== 'GET' || !['/', '/concepts.html'].includes(req.url?.split('?')[0])) {
    res.writeHead(404); res.end('Not found'); return;
  }
  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(await readFile(page));
  } catch { res.writeHead(500); res.end('Concept file unavailable'); }
}).listen(4175, '127.0.0.1', () => console.log('Concept preview: http://127.0.0.1:4175'));
