/* 导出下载诊断 v2：先建目录，记录 downloadProgress state */
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
    else if (m.method === 'Browser.downloadProgress') progress.push(m.params.state + ':' + m.params.receivedBytes + '/' + m.params.totalBytes);
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('EXC'); return r.result && r.result.value; };

  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await ev(`(function(){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['hello world'], {type:'text/plain'}));
    a.download = 'test_dl.txt';
    document.body.appendChild(a); a.click();
    return 'clicked';
  })()`);
  await new Promise(r => setTimeout(r, 3000));
  console.log('progress:', progress.join(' | '));
  console.log('files:', fs.readdirSync(DL).join(','));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
