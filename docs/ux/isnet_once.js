/* 只测 ISNet ImageNet 预处理后的输出 */
(async () => {
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result);}};
  const send=(method,params)=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params:params||{}}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception.description);return r.result&&r.result.value;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});
  await sleep(2500);
  await ev(`(async()=>{while(typeof ort==='undefined')await new Promise(r=>setTimeout(r,300));return true;})()`);
  await ev(`(async()=>{const r=await fetch('/assets/samples/front.png');const b=await r.blob();window._img=await createImageBitmap(b);})()`);
  const t0=Date.now();
  const stat = await ev(`(async()=>{
    const sess = await ort.InferenceSession.create('assets/models/isnet_anime.onnx',{executionProviders:['wasm']});
    const s=1024; const cv=document.createElement('canvas');cv.width=s;cv.height=s;
    const ctx=cv.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(window._img,0,0,s,s);
    const d=ctx.getImageData(0,0,s,s).data; const n=s*s; const input=new Float32Array(3*n);
    for(let i=0;i<n;i++){
      // BGR：R/B 通道互换
      input[i]=(d[i*4+2]/255-0.485)/0.229;
      input[n+i]=(d[i*4+1]/255-0.456)/0.224;
      input[2*n+i]=(d[i*4]/255-0.406)/0.225;
    }
    const feeds={};feeds[sess.inputNames[0]]=new ort.Tensor('float32',input,[1,3,s,s]);
    const out=await sess.run(feeds);
    const od=out[sess.outputNames[0]].data;
    let mn=1e9,mx=-1e9,sum=0;
    for(let i=0;i<od.length;i++){if(od[i]<mn)mn=od[i];if(od[i]>mx)mx=od[i];sum+=od[i];}
    return {min:+mn.toFixed(3),max:+mx.toFixed(3),mean:+(sum/od.length).toFixed(3)};
  })()`);
  console.log('ISNet ImageNet:', JSON.stringify(stat), (Date.now()-t0)+'ms');
  process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
