import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('../dist/client/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function createProductionServer(root = clientRoot, backendPort = 4317) {
  return http.createServer(async (req, res) => {
    // Same-origin browser access only; reject DNS rebinding and unsolicited cross-origin requests.
    if (!['localhost:4173', '127.0.0.1:4173'].includes(req.headers.host)
      || (req.headers.origin && !['http://localhost:4173', 'http://127.0.0.1:4173'].includes(req.headers.origin))) {
      res.writeHead(403); res.end('Local access only'); return;
    }
    const rawPath = (req.url || '/').split('?')[0];
    if (rawPath === '/health' || rawPath === '/api' || rawPath.startsWith('/api/')) {
      const headers = { ...req.headers, host: `127.0.0.1:${backendPort}` };
      const upstream = http.request({ hostname: '127.0.0.1', port: backendPort, method: req.method, path: req.url, headers }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
        response.on('error', () => res.destroy());
      });
      upstream.setTimeout(120000, () => upstream.destroy());
      upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('Backend unavailable'); } else res.destroy(); });
      req.on('aborted', () => upstream.destroy()); res.on('close', () => upstream.destroy());
      req.pipe(upstream); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    try {
      const decoded = decodeURIComponent(rawPath);
      if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..')) { res.writeHead(400); res.end(); return; }
      const resolvedRoot = await realpath(root);
      let target = path.resolve(resolvedRoot, '.' + decoded);
      const inside = p => p === resolvedRoot || p.startsWith(resolvedRoot + path.sep);
      if (!inside(target)) { res.writeHead(403); res.end(); return; }
      let info;
      try { info = await stat(target); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      if (!info?.isFile()) {
        // SPA routes return index; missing assets must stay 404.
        if (path.extname(decoded)) { res.writeHead(404); res.end(); return; }
        target = path.join(resolvedRoot, 'index.html'); info = await stat(target);
      }
      target = await realpath(target);
      if (!inside(target)) { res.writeHead(403); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'content-length': info.size, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(target).on('error', () => res.destroy()).pipe(res);
    } catch (error) { res.writeHead(error instanceof URIError ? 400 : 500); res.end('Unable to serve frontend'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createProductionServer();
  server.on('error', error => { console.error(error.message); process.exit(1); });
  server.listen(4173, '127.0.0.1', () => console.log('Live Desktop frontend: http://localhost:4173'));
}
