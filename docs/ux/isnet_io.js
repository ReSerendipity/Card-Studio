/* 打印 ISNet 模型 IO 详情 */
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
  const io = await ev(`(async()=>{
    const sess = await ort.InferenceSession.create('assets/models/isnet_anime.onnx',{executionProviders:['wasm']});
    return {
      inputNames: sess.inputNames,
      outputNames: sess.outputNames,
      inputMetadata: sess.inputMetadata,
      outputMetadata: sess.outputMetadata
    };
  })()`);
  console.log(JSON.stringify(io, null, 2));
  process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
