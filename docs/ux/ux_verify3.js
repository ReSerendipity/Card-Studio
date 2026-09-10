/* UX 增强回归：示例加载、新个性化参数、缩放/复位 */
const fs = require('fs');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9223';
  const SHOT = 'C:/Users/Doro/card-studio/docs/ux/new';
  fs.mkdirSync(SHOT, { recursive: true });
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error('EXC: ' + (d.exception ? (d.exception.description || d.exception.value) : d.text)); } return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOT + '/' + name, Buffer.from(s.data, 'base64')); };

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 10000, 'ready');

  // 点"加载示例"
  await ev(`document.getElementById('btn-load-sample').click(); true`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 10000, 'sample');
  console.log('files loaded:', await ev(`document.querySelectorAll('.fi-angle').length`));

  // 改个性化参数：银边 + 白字 + 关角饰
  await ev(`document.getElementById('card-border').value='silver'; true`);
  await ev(`document.getElementById('card-name-color').value='white'; true`);
  await ev(`document.getElementById('card-corners').checked=false; true`);

  // 生成
  const dbg = await ev(`(() => {
    return {
      disabled: document.getElementById('btn-generate').disabled,
      status: document.getElementById('status').textContent,
      fiCount: document.querySelectorAll('.fi-angle').length
    };
  })()`);
  console.log('before gen click:', JSON.stringify(dbg));
  await ev(`document.getElementById('btn-generate').click(); true`);
  await sleep(500);
  console.log('500ms after click:', await ev(`document.getElementById('status').textContent`));
  const s0 = Date.now();
  while (Date.now() - s0 < 120000) {
    const st = await ev(`document.getElementById('status').textContent`);
    console.log('status:', st);
    if (st.indexOf('生成完成') >= 0) break;
    if (st.indexOf('失败') >= 0) throw new Error('gen failed: ' + st);
    await sleep(2000);
  }
  await sleep(500);
  await shot('gen-silver-white.png');

  // 放大模拟（滚轮）
  await ev(`(function(){ const c = document.querySelector('#viewer canvas'); const r = c.getBoundingClientRect();
    for (let i=0;i<6;i++) c.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); return true; })()`);
  await sleep(400);
  await shot('zoomed-in.png');

  // 复位
  await ev(`document.getElementById('btn-viewer-reset').click(); true`);
  await sleep(300);
  await shot('reset-view.png');

  // 180°
  await ev(`document.querySelector('.angle-jump button[data-a="180"]').click(); true`);
  await sleep(500);
  await shot('view-180.png');

  console.log('DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
