// Local preview server. No packages or installation needed beyond Node.js.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/preview.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.on('error', err => { console.error(err.message); process.exitCode = 1; });
// Let the OS choose a free port, so multiple previews can run without conflicts.
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/preview.html`;
  console.log(`Preview: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
  if (process.platform === 'win32') {
    const browser = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}' -WindowStyle Hidden`], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log('Open the preview URL above in your browser.'));
  }
});
