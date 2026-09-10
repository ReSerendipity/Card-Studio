/* 综合回归 v2：180° 可见性、进度条、主体缩放、角度导出名、u2netp 模型 */
const fs = require('fs');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9222';
  const SHOT = 'C:/Users/Doro/card-studio/docs/ux/final2';
  fs.mkdirSync(SHOT, { recursive: true });
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const dls = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else if (m.method === 'Browser.downloadWillBegin') dls.push(m.params.suggestedFilename);
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error('EXC: ' + (d.exception ? (d.exception.description || d.exception.value) : d.text)); } return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return; await sleep(600); } throw new Error('timeout ' + d); };
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOT + '/' + name, Buffer.from(s.data, 'base64')); };

  await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: 'C:/Users/Doro/card-studio/docs/dl', eventsEnabled: true });
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 10000, 'ready');

  // 上传 4 图 + 生成（MODNet）
  await ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) { const r = await fetch('/assets/samples/' + n); const b = await r.blob(); dt.items.add(new File([b], n, { type: 'image/png' })); }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true;
  })()`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 10000, 'files');
  await ev(`document.getElementById('btn-generate').click(); true`);
  // 进度条可见性检查
  await sleep(200);
  console.log('progress visible during gen:', await ev(`document.getElementById('progress-wrap').style.display`));
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 60000, 'gen');
  await sleep(300);

  // 180° 跳转（用新按钮）
  await ev(`document.querySelector('.angle-jump button[data-a="180"]').click(); true`);
  await sleep(600);
  console.log('angle after 180 jump:', await ev(`document.getElementById('angle-indicator').textContent`));
  await shot('jump-180.png');

  // 90/270 跳转
  await ev(`document.querySelector('.angle-jump button[data-a="90"]').click(); true`);
  await sleep(400);
  await shot('jump-90.png');
  await ev(`document.querySelector('.angle-jump button[data-a="270"]').click(); true`);
  await sleep(400);
  await shot('jump-270.png');

  // 键盘旋转
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); true`);
  await sleep(300);
  console.log('after ArrowRight:', await ev(`document.getElementById('angle-indicator').textContent`));

  // 主体缩放 130% 重新生成
  await ev(`document.getElementById('sl-subject').value = 130; document.getElementById('sl-subject').dispatchEvent(new Event('input')); true`);
  console.log('subject val:', await ev(`document.getElementById('subject-val').textContent`));
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 60000, 'gen2');
  await sleep(400);
  await shot('subject-130.png');

  // 角度导出文件名
  await ev(`document.getElementById('btn-export-png').click(); true`);
  await sleep(2500);
  console.log('export suggested files:', dls.join(', '));

  // u2netp 模型生成（改模型重生成）
  await ev(`document.getElementById('model-quality').value = 'assets/models/u2netp.onnx'; true`);
  await ev(`document.getElementById('btn-generate').click(); true`);
  const u2Start = Date.now();
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, 90000, 'u2netp gen');
  console.log('u2netp gen:', ((Date.now() - u2Start) / 1000).toFixed(1) + 's |', await ev(`document.getElementById('status').textContent`));
  await sleep(400);
  await shot('u2netp.png');

  console.log('REGRESSION v2 DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(2); });
