/* 定位：手动跑 4 图管线，检查 Cutout/Compose 输出 */
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception)); return r.result && r.result.value; };

  const expr = `(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const out = [];
    for (const n of names) {
      const img = new Image();
      img.src = '/assets/samples/' + n;
      await img.decode();
      let sub;
      try { sub = await window.Cutout.cutout(img, 'model', 'assets/models/modnet.onnx'); }
      catch(e) { out.push(n + ': CUTOUT THROW ' + e.message); continue; }
      let r;
      try { r = window.Compose.build({subject: sub, name:'T', no:'1', rarity:'SSR', bgStyle:'gradient', seed:1, bgColor:'#4B2E7E', textFont:'kai'}); }
      catch(e) { out.push(n + ': COMPOSE THROW ' + e.message); continue; }
      const fd = r.face.getContext('2d').getImageData(0,0,10,10).data;
      let fOK = false; for (let i=0;i<fd.length;i+=4){ if (fd[i]>0||fd[i+1]>0||fd[i+2]>0){ fOK=true; break; } }
      const od = r.overlay.getContext('2d').getImageData(0,0,10,10).data;
      let oOK = false; for (let i=3;i<od.length;i+=4){ if (od[i]>0){ oOK=true; break; } }
      out.push(n + ': sub=' + sub.width + 'x' + sub.height + ' face=' + (fOK?'OK':'EMPTY') + ' overlay=' + (oOK?'OK':'EMPTY'));
    }
    return out.join(' | ');
  })()`;
  console.log(await ev(expr));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
