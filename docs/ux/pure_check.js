/* pure 模式回归：纯图直通不抠图 */
const fs = require('fs');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9224';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception.text); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(500); } throw new Error('timeout: ' + d); };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 8000, 'ready');

  // 加载示例
  await ev(`document.getElementById('btn-load-sample').click(); true`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 8000, 'sample');

  // 切 pure
  await ev(`document.getElementById('bg-style').value='pure'; true`);
  const t0 = Date.now();
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 30000, 'pure gen');
  const dt = Date.now() - t0;
  console.log('pure gen took', dt, 'ms (should be fast, no model)');
  console.log('status:', await ev(`document.getElementById('status').textContent`));
  console.log('errors:', errors.length, errors.slice(0, 3));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
