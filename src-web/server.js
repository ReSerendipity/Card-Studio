// Card Studio 本地静态服务器（零依赖，Node 原生 http）
// 用法：node server.js  然后浏览器打开 http://127.0.0.1:4173
const http = require('http');
const fs = require('fs');
const path = require('path');

// 服务根目录 = 项目根（card-studio/）
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.onnx': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/src-web/index.html';
    const fp = path.normalize(path.join(ROOT, urlPath));
    if (!fp.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(fp, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      const isStatic = ['.html', '.js', '.css', '.json'].indexOf(ext) >= 0;
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream'
      };
      if (isStatic) {
        // 页面/脚本/样式禁用缓存，保证每次改动即时生效（修复"看不到新版"问题）
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
      } else {
        headers['Cache-Control'] = 'public, max-age=3600';
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

const PORT = process.env.PORT || 4173;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // 端口已被占：多半是已经有一个 Card Studio 在跑
    // 探测一下能否访问，能通就友好提示，不要 crash
    http.get('http://127.0.0.1:' + PORT + '/', (res) => {
      console.log('');
      console.log('端口 ' + PORT + ' 已被占用——Card Studio 看起来已经在运行了。');
      console.log('直接打开浏览器访问：http://127.0.0.1:' + PORT + '/');
      console.log('（无需重复启动。如要重启，关掉之前的命令行窗口再试。）');
      process.exit(0);
    }).on('error', () => {
      console.error('端口 ' + PORT + ' 被其他程序占用，无法启动。');
      console.error('请先关闭占用该端口的程序，或用 set PORT=xxxx 后重试。');
      process.exit(1);
    });
    return;
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Card Studio 已启动：http://127.0.0.1:' + PORT);
  console.log('按 Ctrl+C 停止服务');
});
