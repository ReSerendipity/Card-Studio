/* 调试2：旋转到 130°（k1=1）读帧采样 + 截图 */
const fs = require('fs');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };

  await ev(`document.getElementById('btn-autorotate').textContent.indexOf('开') >= 0 ? document.getElementById('btn-autorotate').click() : null; true`);
  await ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) { const r = await fetch('/assets/samples/' + n); const b = await r.blob(); dt.items.add(new File([b], n, { type: 'image/png' })); }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true;
  })()`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 10000, 'files');
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 120000, 'gen');
  await sleep(400);

  // 拖到 ~135°
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 440, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 15; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900 + i * 30, y: 440, button: 'left', buttons: 1 }); await sleep(10); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1350, y: 440, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(700);
  console.log('at ~135deg:', await ev(`window.Viewer.__dbg()`));
  console.log('angle:', await ev(`document.getElementById('angle-indicator').textContent`));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Doro/card-studio/docs/ux/d135.png', Buffer.from(shot.data, 'base64'));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
