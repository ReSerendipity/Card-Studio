/* 导出验证 v3：真实鼠标手势点击导出按钮 */
(async () => {
  const fs = require('fs');
  const DL = 'C:/Users/Doro/card-studio/docs/dl';
  fs.mkdirSync(DL, { recursive: true });
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('EXC'); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };

  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  // 重载页面，确保干净状态
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined' && !!document.getElementById('btn-export-png')`, 10000, 'page ready');
  // 准备：上传 + 生成（色键模式快速）
  await ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const m = document.getElementById('cutout-mode'); m.value = 'key'; m.dispatchEvent(new Event('change'));
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) { const r = await fetch('/assets/samples/' + n); const b = await r.blob(); dt.items.add(new File([b], n, { type: 'image/png' })); }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true;
  })()`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 10000, 'files');
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 60000, 'gen');
  await sleep(300);

  // 真实鼠标点击「导出卡面 PNG」按钮
  const rect = await ev(`(function(){ const r = document.getElementById('btn-export-png').getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2}); })()`);
  const rc = JSON.parse(rect);
  console.log('export btn at', rc.x, rc.y);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc.x, y: rc.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(3500);
  console.log('after PNG export:', fs.readdirSync(DL).join(','));

  // config 导出
  const rect2 = await ev(`(function(){ const r = document.getElementById('btn-export-config').getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2}); })()`);
  const rc2 = JSON.parse(rect2);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc2.x, y: rc2.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc2.x, y: rc2.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(2500);
  console.log('after config export:', fs.readdirSync(DL).join(','));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
