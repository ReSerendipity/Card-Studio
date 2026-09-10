/* 复现实验：定位卡片消失条件 */
const fs = require('fs');
const CDP_HTTP = 'http://127.0.0.1:9222';
const SHOT_DIR = 'C:/Users/Doro/card-studio/docs/ux';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getWsUrl() {
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  return list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl;
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; }
  send(method, params) { const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result && r.result.value; }
  async shot(name) { const s = await this.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOT_DIR + '/' + name, Buffer.from(s.data, 'base64')); }
}
async function poll(cdp, expr, t, d) { const s = Date.now(); while (Date.now() - s < t) { if (await cdp.ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); }

(async () => {
  const ws = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(cdp, `typeof window.Viewer !== 'undefined'`, 10000, 'ready');
  await cdp.ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) { const r = await fetch('/assets/samples/' + n); const b = await r.blob(); dt.items.add(new File([b], n, { type: 'image/png' })); }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 4`, 10000, 'files');
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 120000, 'gen');
  await sleep(800);
  await cdp.shot('r1-base-0deg.png');

  // 步骤2：光泽 100%
  await cdp.ev(`document.getElementById('sl-gloss').value = 100; document.getElementById('sl-gloss').dispatchEvent(new Event('input')); true`);
  await sleep(500);
  await cdp.shot('r2-gloss100-0deg.png');

  // 步骤3：旋转到 90°
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 440, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900 + i * 25, y: 440, button: 'left', buttons: 1 }); await sleep(8); }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1150, y: 440, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(600);
  const a1 = await cdp.ev(`document.getElementById('angle-indicator').textContent`);
  console.log('angle after drag:', a1);
  await cdp.shot('r3-rotated-gloss100.png');

  // 步骤4：景深调 10
  await cdp.ev(`document.getElementById('sl-depth').value = 10; document.getElementById('sl-depth').dispatchEvent(new Event('input')); true`);
  await sleep(500);
  await cdp.shot('r4-depth10.png');

  // 步骤5：gloss 回 55
  await cdp.ev(`document.getElementById('sl-gloss').value = 55; document.getElementById('sl-gloss').dispatchEvent(new Event('input')); true`);
  await sleep(500);
  await cdp.shot('r5-gloss55-rotated.png');

  // 步骤6：回到 0°（gloss 55）
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1150, y: 440, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1150 - i * 25, y: 440, button: 'left', buttons: 1 }); await sleep(8); }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 900, y: 440, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(600);
  console.log('angle back:', await cdp.ev(`document.getElementById('angle-indicator').textContent`));
  await cdp.shot('r6-back0deg.png');

  console.log('REPRO DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
