import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('native host: assets, proxy, confinement, and upstream failures', { timeout: 40000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'live-desktop-native-'));
  const client = path.join(root, 'frontend/dist/client');
  await mkdir(client, { recursive: true });
  await writeFile(path.join(client, 'index.html'), '<html>Live Desktop</html>');
  await writeFile(path.join(client, 'app.js'), 'export default 1;');
  await mkdir(path.join(client, 'assets'));
  await writeFile(path.join(client, 'assets/index-AbCd1234.js'), 'export default 1;');
  await writeFile(path.join(root, 'secret.txt'), 'outside');
  // A junction works without Windows Developer Mode and tests canonical path confinement.
  await symlink(root, path.join(client, 'escape'), 'junction');
  const backend = http.createServer((req, res) => {
    if (req.url === '/api/redirect') { res.writeHead(302, { location: 'http://attacker.invalid', 'set-cookie': ['one=1', 'two=2'] }); res.end(); return; }
    if (req.url === '/api/stream') { res.write('first'); setTimeout(() => res.end('second'), 60); return; }
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ method: req.method, url: req.url, body, profile: req.headers['x-profile-id'], authorization: req.headers.authorization, host: req.headers.host })); });
  });
  await new Promise((resolve, reject) => { backend.once('error', reject); backend.listen(4317, '127.0.0.1', resolve); });
  const child = spawn(path.resolve('native/build/Release/live-desktop-host.exe'), ['--root', root], { windowsHide: true });
  let errors = ''; child.stderr.on('data', c => errors += c); child.on('error', e => errors += e.message);
  const request = (url, headers = {}, method = 'GET', body = '') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 4173, path: url, method, headers: { host: 'localhost:4173', ...headers } }, res => {
      let result = ''; res.on('data', c => result += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: result })); res.on('error', reject);
    }); req.on('error', reject); req.end(body);
  });
  const raw = data => new Promise((resolve, reject) => {
    const socket = net.connect(4173, '127.0.0.1', () => socket.write(data)); let result = '';
    socket.on('data', c => result += c); socket.on('end', () => resolve(result)); socket.on('error', reject);
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { ready = (await request('/_live/ready')).body === 'live-desktop-host/1'; } catch {} if (ready) break; await delay(50); }
    assert.ok(ready, errors || 'Native host did not start');
    await t.test('static files, SPA routes, MIME, HEAD, and missing assets', async () => {
      assert.match((await request('/')).body, /Live Desktop/);
      assert.match((await request('/settings')).body, /Live Desktop/);
      assert.equal((await request('/app.js')).headers['content-type'], 'text/javascript; charset=utf-8');
      const head = await request('/app.js', {}, 'HEAD'); assert.equal(head.body, ''); assert.equal(head.headers['content-length'], '17');
      assert.equal((await request('/missing.js')).status, 404);
      assert.equal((await request('/', {}, 'POST')).status, 405);
    });
    await t.test('rejects encoded traversal, Windows paths, invalid encodings, and junction escape', async () => {
      for (const url of ['/%2e%2e/secret.txt', '/%5c..%5csecret.txt', '/%invalid', '/app.js:secret', '/foo./app.js', '/foo%00']) assert.equal((await request(url)).status, 400, url);
      assert.equal((await request('/escape/secret.txt')).status, 403);
    });
    await t.test('revalidates stable files and caches only hashed build assets', async () => {
      const asset = await request('/app.js');
      assert.equal(asset.headers['cache-control'], 'no-cache');
      const cached = await request('/app.js', { 'if-none-match': asset.headers.etag });
      assert.equal(cached.status, 304); assert.equal(cached.body, '');
      assert.equal((await request('/app.js', { 'if-none-match': '"other", ' + asset.headers.etag })).status, 304);
      assert.equal((await request('/assets/index-AbCd1234.js')).headers['cache-control'], 'public, max-age=31536000, immutable');
      assert.equal((await request('/')).headers['cache-control'], 'no-cache');
      await writeFile(path.join(client, 'app.js'), 'export default 22;');
      assert.equal((await request('/app.js', { 'if-none-match': asset.headers.etag })).status, 200);
    });
    await t.test('enforces Host and Origin before proxying', async () => {
      assert.equal((await request('/', { host: 'attacker.example:4173' })).status, 403);
      assert.equal((await request('/api/action', { origin: 'https://attacker.example' }, 'POST')).status, 403);
      assert.equal((await request('/', { origin: '' })).status, 403);
    });
    await t.test('forwards API methods, query, JSON body, profile, and authorization', async () => {
      const result = await request('/api/action?q=%2F&x=2', { 'content-type': 'application/json', 'x-profile-id': 'test', authorization: 'Bearer test', 'content-length': 11 }, 'POST', '{"value":2}');
      assert.deepEqual(JSON.parse(result.body), { method: 'POST', url: '/api/action?q=%2F&x=2', body: '{"value":2}', profile: 'test', authorization: 'Bearer test', host: '127.0.0.1:4317' });
      assert.equal((await request('/health')).status, 200);
    });
    await t.test('decodes chunked request bodies and streams upstream responses', async () => {
      const result = await raw('POST /api/chunk HTTP/1.1\r\nHost: localhost:4173\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n');
      assert.match(result, /"body":"abcde"/);
      assert.equal((await request('/api/stream')).body, 'firstsecond');
    });
    await t.test('returns redirects and multiple cookies without following or sharing them', async () => {
      const result = await request('/api/redirect'); assert.equal(result.status, 302);
      assert.equal(result.headers.location, 'http://attacker.invalid'); assert.deepEqual(result.headers['set-cookie'], ['one=1', 'two=2']);
    });
    await t.test('rejects ambiguous framing, oversized requests, and absolute request targets', async () => {
      for (const headers of ['Content-Length: 1\r\nTransfer-Encoding: chunked', 'Content-Length: 1\r\nContent-Length: 1', 'Host: localhost:4173', 'Transfer-Encoding: gzip']) {
        assert.match(await raw(`POST /api/action HTTP/1.1\r\nHost: localhost:4173\r\n${headers}\r\n\r\n`), /HTTP\/1.1 400/);
      }
      assert.match(await raw('POST /api/action HTTP/1.1\r\nHost: localhost:4173\r\nContent-Length: 16777217\r\n\r\n'), /HTTP\/1.1 413/);
      assert.match(await raw('GET http://attacker.invalid/ HTTP/1.1\r\nHost: localhost:4173\r\n\r\n'), /HTTP\/1.1 400/);
    });
    await t.test('reports unavailable backend while native host remains ready', async () => {
      await new Promise(resolve => backend.close(resolve));
      assert.equal((await request('/api/action')).status, 502);
      assert.equal((await request('/_live/ready')).status, 200);
    });
  } finally {
    child.kill(); if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    backend.closeAllConnections(); backend.close();
    await rm(root, { recursive: true, force: true });
  }
});
