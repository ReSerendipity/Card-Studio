/* 对比 4 个模型对同一图的 mask 输出 */
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
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception.text + ' | ' + (r.exceptionDetails.exception.description||'')); return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await sleep(2500);
  await ev(`(async()=>{ while(typeof window.Cutout==='undefined'||typeof ort==='undefined') await new Promise(r=>setTimeout(r,300)); return true; })()`);

  // 加载一张示例图
  await ev(`(async()=>{
    const r = await fetch('/assets/samples/front.png');
    const b = await r.blob();
    window._testImg = await createImageBitmap(b);
    return true;
  })()`);

  const models = [
    ['ISNet [−1,1]', 'assets/models/isnet_anime.onnx', 'pm11'],
  ];
  for (const [name, path, norm] of models) {
    await ev(`window._norm = '${norm}'; true`);
    const t0 = Date.now();
    try {
      const stat = await ev(`(async()=>{
        const sess = await Cutout.loadModel('${path}');
        const s = { 'assets/models/modnet.onnx':256,'assets/models/modnet_uint8.onnx':256,'assets/models/u2netp.onnx':320,'assets/models/isnet_anime.onnx':1024 }['${path}'] || 256;
        const cv = document.createElement('canvas'); cv.width=s; cv.height=s;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(window._testImg,0,0,s,s);
        const d = ctx.getImageData(0,0,s,s).data;
        const n=s*s, input=new Float32Array(3*n);
        // 试两种预处理：当前 [-1,1] vs ISNet 标准 [0,1]
        const norm = window._norm === '01';
        for (let i=0;i<n;i++){
          const r=norm?d[i*4]/255:(d[i*4]/255-0.5)/0.5;
          const g=norm?d[i*4+1]/255:(d[i*4+1]/255-0.5)/0.5;
          const b=norm?d[i*4+2]/255:(d[i*4+2]/255-0.5)/0.5;
          input[i]=r; input[n+i]=g; input[2*n+i]=b;
        }
        const feeds={}; feeds[sess.inputNames[0]]=new ort.Tensor('float32',input,[1,3,s,s]);
        const out = await sess.run(feeds);
        const od = out[sess.outputNames[0]].data;
        let mn=1e9,mx=-1e9,sum=0;
        for (let i=0;i<od.length;i++){ if(od[i]<mn)mn=od[i]; if(od[i]>mx)mx=od[i]; sum+=od[i]; }
        return { outShape: out[sess.outputNames[0]].dims, min: +mn.toFixed(3), max: +mx.toFixed(3), mean: +(sum/od.length).toFixed(3) };
      })()`);
      console.log(name.padEnd(14), JSON.stringify(stat));
    } catch (e) {
      console.log(name.padEnd(14), 'FAIL', e.message.slice(0,120));
    }
  }
  console.log('errors:', errors.length, errors.slice(0,3));
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
