const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const RECORDING_DIR = path.join(__dirname, 'recordings');

if (!fs.existsSync(RECORDING_DIR)) fs.mkdirSync(RECORDING_DIR);

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.webm': 'audio/webm',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function getLatestRecording() {
  if (!fs.existsSync(RECORDING_DIR)) return null;
  const files = fs.readdirSync(RECORDING_DIR)
    .filter((f) => f.startsWith('recording'))
    .sort()
    .reverse();
  return files[0] || null;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Upload audio
  if (req.method === 'POST' && req.url === '/upload') {
    const contentType = req.headers['content-type'] || '';
    let ext = '.webm';
    if (contentType.includes('mp4')) ext = '.mp4';
    else if (contentType.includes('ogg')) ext = '.ogg';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording-${timestamp}${ext}`;
    const filePath = path.join(RECORDING_DIR, filename);
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      fs.writeFile(filePath, Buffer.concat(chunks), (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to save' }));
          return;
        }
        console.log(`Saved: ${filename}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: filename, url: `/recordings/${filename}` }));
      });
    });
    return;
  }

  // Serve latest recording at /recording
  if (req.method === 'GET' && req.url === '/recording') {
    const latest = getLatestRecording();
    if (!latest) {
      res.writeHead(404);
      res.end('No recording yet');
      return;
    }
    serveStatic(res, path.join(RECORDING_DIR, latest));
    return;
  }

  // Serve specific recording
  if (req.method === 'GET' && req.url.startsWith('/recordings/')) {
    const file = path.basename(req.url);
    const filePath = path.join(RECORDING_DIR, file);
    serveStatic(res, filePath);
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  serveStatic(res, path.join(__dirname, filePath));
});

server.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
  console.log(`Latest recording → http://localhost:${PORT}/recording`);
});
