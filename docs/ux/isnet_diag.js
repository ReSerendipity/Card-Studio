/* 诊断 ISNet：打印输入输出 shape/类型，试 4 种预处理 */
(async () => {
  const CDP = 'http://127.0.0.1:9224';
  const list = await (await fetch(CDP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result);}};
  const send=(method,params)=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params:params||{}}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception.description||r.exceptionDetails.exception.text);return r.result&&r.result.value;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});
  await sleep(2500);
  await ev(`(async()=>{while(typeof ort==='undefined')await new Promise(r=>setTimeout(r,300));return true;})()`);

  // 打印模型 IO
  const io = await ev(`(async()=>{
    const sess = await ort.InferenceSession.create('assets/models/isnet_anime.onnx',{executionProviders:['wasm']});
    return { in: sess.inputNames, out: sess.outputNames, inMeta: sess.inputMetadata, outMeta: sess.outputMetadata };
  })()`);
  console.log('IO:', JSON.stringify(io, null, 2));

  // 加载测试图
  await ev(`(async()=>{
    const r=await fetch('/assets/samples/front.png'); const b=await r.blob();
    window._img = await createImageBitmap(b);
  })()`);

  // 4 种预处理
  const presets = {
    '[-1,1] RGB': (d,i,n)=>[(d[i*4]/255-0.5)/0.5,(d[i*4+1]/255-0.5)/0.5,(d[i*4+2]/255-0.5)/0.5],
    '[0,1] RGB': (d,i,n)=>[d[i*4]/255,d[i*4+1]/255,d[i*4+2]/255],
    'ImageNet RGB': (d,i,n)=>[(d[i*4]/255-0.485)/0.229,(d[i*4+1]/255-0.456)/0.224,(d[i*4+2]/255-0.406)/0.225],
    'ImageNet BGR': (d,i,n)=>[(d[i*4+2]/255-0.485)/0.229,(d[i*4+1]/255-0.456)/0.224,(d[i*4]/255-0.406)/0.225],
  };
  for (const [name, fn] of Object.entries(presets)) {
    const stat = await ev(`(async()=>{
      const sess = await ort.InferenceSession.create('assets/models/isnet_anime.onnx',{executionProviders:['wasm']});
      const s=1024; const cv=document.createElement('canvas'); cv.width=s;cv.height=s;
      const ctx=cv.getContext('2d'); ctx.imageSmoothingQuality='high';
      ctx.drawImage(window._img,0,0,s,s);
      const d=ctx.getImageData(0,0,s,s).data;
      const n=s*s, input=new Float32Array(3*n);
      const fn = ${fn.toString()};
      for(let i=0;i<n;i++){const [r,g,b]=fn(d,i,n);input[i]=r;input[n+i]=g;input[2*n+i]=b;}
      const feeds={}; feeds[sess.inputNames[0]]=new ort.Tensor('float32',input,[1,3,s,s]);
      const out=await sess.run(feeds);
      const od=out[sess.outputNames[0]].data;
      let mn=1e9,mx=-1e9,sum=0;
      for(let i=0;i<od.length;i++){if(od[i]<mn)mn=od[i];if(od[i]>mx)mx=od[i];sum+=od[i];}
      return {min:+mn.toFixed(3),max:+mx.toFixed(3),mean:+(sum/od.length).toFixed(3)};
    })()`);
    console.log(name.padEnd(16), JSON.stringify(stat));
  }
  process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
