// 本機開發伺服器 — 模擬 Vercel routing
// - GET /          → public/index.html
// - GET /style.css → public/style.css(及其他靜態檔)
// - GET /api/foo   → 動態載入 api/foo.js,執行其 default export handler
//
// 使用方式:
//   node dev-server.js
//
// 部署到 Vercel 時不會用到本檔,Vercel 會直接服務 public/ 與 api/

import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function makeResWrapper(res) {
  let statusCode = 200;
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    },
    end(payload) {
      res.statusCode = statusCode;
      res.end(payload);
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  console.log(`${req.method} ${pathname}`);

  // /api/* → 動態載入 handler
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace(/^\/api\//, '').replace(/\.js$/, '').split('/')[0];
    const apiPath = path.join(__dirname, 'api', `${apiName}.js`);
    try {
      // 加 timestamp query 避開 Node module cache,讓修改 API 不必重啟伺服器
      const moduleUrl = `${pathToFileURL(apiPath).href}?t=${Date.now()}`;
      const mod = await import(moduleUrl);
      if (typeof mod.default !== 'function') {
        res.statusCode = 500;
        res.end(`api/${apiName}.js 缺少 default export handler`);
        return;
      }
      const body = await readBody(req);
      const wrapReq = { method: req.method, query: Object.fromEntries(url.searchParams), body };
      const wrapRes = makeResWrapper(res);
      await mod.default(wrapReq, wrapRes);
    } catch (e) {
      console.error('Handler 錯誤:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'INTERNAL', message: e.message }));
    }
    return;
  }

  // 靜態檔 ← public/
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, 'public', filePath);
  try {
    const content = await fs.readFile(fullPath);
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`> Ready! Available at http://localhost:${PORT}`);
});
