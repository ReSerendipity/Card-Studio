/* 检查 WebGL context 状态 */
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('EXC'); return r.result && r.result.value; };

  const out = await ev(`(function(){
    var cv = document.querySelector('#viewer canvas');
    var res = { found: !!cv };
    if (!cv) return JSON.stringify(res);
    var gl = cv.getContext('webgl2') || cv.getContext('webgl');
    res.isContextLost = gl.isContextLost();
    res.width = cv.width; res.height = cv.height;
    var buf = new Uint8Array(4);
    try { gl.readPixels(Math.floor(cv.width/2), Math.floor(cv.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); res.pixel = [buf[0], buf[1], buf[2], buf[3]]; }
    catch(e) { res.readErr = e.message; }
    return JSON.stringify(res);
  })()`);
  console.log(out);
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
