import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProductionServer } from '../scripts/serve-production.mjs';

test('production frontend serves built files, confines paths, and proxies API bodies', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'live-desktop-server-'));
  await writeFile(path.join(root, 'index.html'), '<html>Live Desktop</html>');
  await writeFile(path.join(root, 'app.js'), 'export default 1;');
  const backend = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => body += chunk);
    req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ method: req.method, url: req.url, body })); });
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const server = createProductionServer(root, backend.address().port);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (url, headers = {}, method = 'GET', body = '') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers: { host: 'localhost:4173', ...headers } }, res => {
      let result = ''; res.on('data', chunk => result += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: result }));
    }); req.on('error', reject); req.end(body);
  });
  try {
    assert.match((await request('/')).body, /Live Desktop/);
    assert.match((await request('/settings')).body, /Live Desktop/);
    assert.equal((await request('/app.js')).headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal((await request('/app.js', {}, 'HEAD')).body, '');
    assert.equal((await request('/missing.js')).status, 404);
    assert.equal((await request('/%2e%2e/private')).status, 400);
    assert.equal((await request('/%5c..%5cprivate')).status, 400);
    assert.equal((await request('/%invalid')).status, 400);
    assert.equal((await request('/', { host: 'attacker.example:4173' })).status, 403);
    assert.equal((await request('/api/action', { origin: 'https://attacker.example' }, 'POST')).status, 403);
    const proxied = await request('/api/action?q=1', { 'content-type': 'application/json' }, 'POST', '{"value":2}');
    assert.deepEqual(JSON.parse(proxied.body), { method: 'POST', url: '/api/action?q=1', body: '{"value":2}' });
    assert.equal((await request('/health')).status, 200);
    await new Promise(resolve => backend.close(resolve));
    assert.equal((await request('/api/action')).status, 502);
  } finally {
    server.closeAllConnections(); backend.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); backend.close();
    await rm(root, { recursive: true, force: true });
  }
});
