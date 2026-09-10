/* 导出验证 v4：监听 downloadProgress state */
(async () => {
  const fs = require('fs');
  const DL = 'C:/Users/Doro/card-studio/docs/dl';
  fs.mkdirSync(DL, { recursive: true });
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const progress = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else if (m.method === 'Browser.downloadWillBegin') progress.push('WILLBEGIN ' + JSON.stringify(m.params));
    else if (m.method === 'Browser.downloadProgress') progress.push('PROGRESS ' + m.params.state + ' ' + m.params.receivedBytes + '/' + m.params.totalBytes);
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('EXC'); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };

  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 10000, 'ready');
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

  const rc = JSON.parse(await ev(`(function(){ const r = document.getElementById('btn-export-png').getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2}); })()`));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc.x, y: rc.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc.x, y: rc.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(4000);
  console.log('events:', progress.join(' || '));
  console.log('files:', fs.readdirSync(DL).join(','));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
