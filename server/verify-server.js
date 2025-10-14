const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.VERIFY_PORT ? Number(process.env.VERIFY_PORT) : 4001;

function doHeadCheck(targetUrl, timeout = 3000) {
  return new Promise((resolve) => {
    try {
      const parsed = url.parse(targetUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'HEAD',
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        timeout,
        headers: { 'User-Agent': 'MeeM-Prompt-Verify/1.0' }
      };
      const req = lib.request(options, (res) => {
        resolve({ alive: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, contentType: res.headers['content-type'] || null });
      });
      req.on('error', () => resolve({ alive: false }));
      req.on('timeout', () => { req.abort(); resolve({ alive: false }); });
      req.end();
    } catch (e) {
      resolve({ alive: false });
    }
  });
}

const server = http.createServer(async (req, res) => {
  const q = url.parse(req.url, true).query;
  const target = q.url || q.u;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (!target) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'missing url parameter' }));
    return;
  }
  // basic sanitization
  if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'invalid url parameter, must start with http/https' }));
    return;
  }
  const result = await doHeadCheck(target, 4000);
  res.statusCode = 200;
  res.end(JSON.stringify(result));
});

server.listen(PORT, () => {
  console.log(`verify-server listening on http://localhost:${PORT}`);
});

// Allow graceful shutdown
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
