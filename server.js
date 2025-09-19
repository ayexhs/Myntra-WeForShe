const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;

/**
 * Very small SSE + relay server.
 * - POST /sync { kind, user, payload } → broadcast to all clients as JSON
 * - GET /events?userId=... → Server-Sent Events stream
 */

/** @type {Set<import('http').ServerResponse>} */
const clients = new Set();

function sendCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function broadcast(data) {
  const str = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(clients)) {
    try { res.write(str); } catch { clients.delete(res); }
  }
}

function serveStaticFile(filePath, res) {
  const extname = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

const server = http.createServer((req, res) => {
  sendCORS(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204; res.end(); return;
  }

  if (req.method === 'GET' && req.url.startsWith('/events')) {
    // Establish SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/sync') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const { kind, user, payload } = parsed || {};
        const envelope = { type: payload?.type || kind, senderId: user?.id, ...payload, ts: Date.now() };
        broadcast(envelope);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400; res.end('Bad JSON');
      }
    });
    return;
  }

  // Serve static files
  if (req.method === 'GET') {
    let filePath = '.' + req.url;
    if (filePath === './') {
      filePath = './index.html';
    }
    serveStaticFile(filePath, res);
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SSE relay running on http://localhost:${PORT}`);
});


