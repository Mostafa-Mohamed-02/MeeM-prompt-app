import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = path.join(__dirname, '..', 'inputs');
const PORT = process.env.INPUTS_PORT ? Number(process.env.INPUTS_PORT) : 4002;

async function ensureInputsDir() {
  try {
    await fs.mkdir(INPUTS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create inputs dir', e);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function dataUrlToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;
  const mime = matches[1];
  const base64 = matches[2];
  const buf = Buffer.from(base64, 'base64');
  return { buf, mime };
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'POST' && url.pathname === '/save') {
      const body = await parseBody(req);
      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid json' }));
        return;
      }

      const { dataUrl, filename } = payload;
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing dataUrl' }));
        return;
      }

      const parsed = dataUrlToBuffer(dataUrl);
      if (!parsed) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid dataUrl' }));
        return;
      }

      await ensureInputsDir();
      const ext = parsed.mime.split('/')[1] || 'jpg';
      const safeName = (filename || 'input').replace(/[^a-zA-Z0-9-_\.]/g, '_');
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName}.${ext}`;
      const outPath = path.join(INPUTS_DIR, unique);
      await fs.writeFile(outPath, parsed.buf);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ filename: unique, url: `/api/inputs/${unique}` }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/list') {
      await ensureInputsDir();
      const files = await fs.readdir(INPUTS_DIR);
      const items = await Promise.all(files.map(async (f) => {
        const stat = await fs.stat(path.join(INPUTS_DIR, f));
        return { name: f, mtime: stat.mtimeMs };
      }));
      items.sort((a,b) => b.mtime - a.mtime);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(items.map(i => ({ filename: i.name, url: `/api/inputs/${i.name}` }))));
      return;
    }

    // serve files
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const name = decodeURIComponent(url.pathname.replace('/files/', ''));
      const filePath = path.join(INPUTS_DIR, name);
      try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(name).slice(1);
        let contentType = 'application/octet-stream';
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'webp') contentType = 'image/webp';
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(data);
      } catch (e) {
        res.statusCode = 404;
        res.end('Not found');
      }
      return;
    }

    // fallback
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    console.error('inputs-server error', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'internal error' }));
  }
});

server.listen(PORT, () => {
  console.log(`inputs-server listening on http://localhost:${PORT}`);
  console.log(`Serving inputs at /files/<filename> and list at /list`);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
