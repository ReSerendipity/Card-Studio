/* 主题截图：初始态 + 生成后（暗色主题）
 *
 * 运行前置：
 *   1. 启动开发服务器：node src-web/server.js   （默认 http://127.0.0.1:4173）
 *   2. 以 CDP 远程调试模式启动 Chromium 系浏览器，并打开一个指向 4173 页面的标签：
 *      msedge.exe --remote-debugging-port=9222 --user-data-dir=%TEMP%\\cs-cdp http://127.0.0.1:4173/
 *      （chrome.exe 参数相同）
 *   3. node docs/ux/theme_shot.js
 * 可用覆盖：--shot-dir=DIR / --cdp-port=N 或环境变量 CS_SHOT_DIR / CS_CDP_PORT
 */
const fs = require('fs');
const path = require('path');
const arg = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:' + (arg('cdp-port') || process.env.CS_CDP_PORT || '9222');
  const SHOT = path.resolve(__dirname, arg('shot-dir') || process.env.CS_SHOT_DIR || 'theme-shots');
  fs.mkdirSync(SHOT, { recursive: true });
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('EXC'); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOT, name), Buffer.from(s.data, 'base64')); };

  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 10000, 'ready');
  await shot('01-initial.png');

  // 上传+生成
  await ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) { const r = await fetch('/assets/samples/' + n); const b = await r.blob(); dt.items.add(new File([b], n, { type: 'image/png' })); }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true;
  })()`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 10000, 'files');
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 60000, 'gen');
  await sleep(500);
  await shot('02-generated.png');
  console.log('THEME SHOTS DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
