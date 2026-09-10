/* 全身体检：真实走一遍所有功能路径，捕获 console 错误 */
const fs = require('fs');
(async () => {
  const CDP_HTTP = 'http://127.0.0.1:9224';
  const SHOT = 'C:/Users/Doro/card-studio/docs/ux/full';
  fs.mkdirSync(SHOT, { recursive: true });
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const errors = []; const logs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') { errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { logs.push(m.params.args.map(a => a.value || a.description || '').join(' ')); }
  };
  const send = (method, params) => new Promise((r, j) => { const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error('EXC: ' + (d.exception ? (d.exception.description || d.exception.value) : d.text)); } return r.result && r.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const poll = async (expr, t, d) => { const s = Date.now(); while (Date.now() - s < t) { if (await ev(expr)) return true; await sleep(600); } throw new Error('timeout: ' + d); };
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOT + '/' + name, Buffer.from(s.data, 'base64')); console.log('  shot', name); };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: 'C:/Users/Doro/card-studio/docs/dl', eventsEnabled: true });

  console.log('=== 1. 加载页面 ===');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined' && typeof window.Compose !== 'undefined'`, 10000, 'libs ready');
  console.log('libs loaded');

  console.log('=== 2. 加载示例 + 生成（默认参数）===');
  await ev(`document.getElementById('btn-load-sample').click(); true`);
  await poll(`document.querySelectorAll('.fi-angle').length === 4`, 8000, 'sample files');
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 90000, 'gen');
  await sleep(400);
  await shot('01-default.png');

  console.log('=== 3. 个性化参数：玫瑰金+紫字+关角饰 ===');
  await ev(`document.getElementById('card-border').value='rose'; true`);
  await ev(`document.getElementById('card-name-color').value='purple'; true`);
  await ev(`document.getElementById('card-corners').checked=false; true`);
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 90000, 'gen2');
  await sleep(400);
  await shot('02-rose-purple.png');

  console.log('=== 4. 无边框+白字 ===');
  await ev(`document.getElementById('card-border').value='none'; true`);
  await ev(`document.getElementById('card-name-color').value='white'; true`);
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 90000, 'gen3');
  await sleep(400);
  await shot('03-none-white.png');

  console.log('=== 5. 星空背景+金边框恢复 ===');
  await ev(`document.getElementById('card-border').value='gold'; true`);
  await ev(`document.getElementById('card-name-color').value='gold'; true`);
  await ev(`document.getElementById('card-corners').checked=true; true`);
  await ev(`document.getElementById('bg-style').value='stars'; true`);
  await ev(`document.getElementById('btn-generate').click(); true`);
  await poll(`document.getElementById('status').textContent.indexOf('生成完成') >= 0`, 90000, 'gen4');
  await sleep(400);
  await shot('04-stars.png');

  console.log('=== 6. 查看器交互：角度跳转/键盘/自动旋转 ===');
  await ev(`document.querySelector('.angle-jump button[data-a="90"]').click(); true`);
  await sleep(400);
  await shot('05-angle-90.png');
  await ev(`document.querySelector('.angle-jump button[data-a="180"]').click(); true`);
  await sleep(400);
  await shot('06-angle-180.png');
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'})); true`);
  await sleep(200);
  console.log('  angle after ArrowRight:', await ev(`document.getElementById('angle-indicator').textContent`));
  await ev(`document.getElementById('btn-autorotate').click(); true`);
  await sleep(1500);
  await ev(`document.getElementById('btn-autorotate').click(); true`); // 关
  await shot('07-autorotate.png');

  console.log('=== 7. 滚轮缩放 + 复位 ===');
  await ev(`(function(){const c=document.querySelector('#viewer canvas');const r=c.getBoundingClientRect();
    for(let i=0;i<5;i++)c.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));return true;})()`);
  await sleep(300);
  await shot('08-zoomed.png');
  await ev(`document.getElementById('btn-viewer-reset').click(); true`);
  await sleep(200);
  await shot('09-reset.png');

  console.log('=== 8. 滑块：光泽/景深/转速 ===');
  await ev(`(function(){const s=document.getElementById('sl-gloss');s.value=90;s.dispatchEvent(new Event('input'));
    const d=document.getElementById('sl-depth');d.value=80;d.dispatchEvent(new Event('input'));return true;})()`);
  await sleep(300);
  await shot('10-sliders.png');

  console.log('=== 9. 导出按钮状态 ===');
  console.log('  png btn disabled:', await ev(`document.getElementById('btn-export-png').disabled`));
  console.log('  json btn disabled:', await ev(`document.getElementById('btn-export-config').disabled`));
  console.log('  snap btn disabled:', await ev(`document.getElementById('btn-snap-view').disabled`));

  console.log('=== 10. 主题切换 ===');
  await ev(`document.getElementById('theme-toggle').click(); true`);
  await sleep(300);
  await shot('11-light-theme.png');
  await ev(`document.getElementById('theme-toggle').click(); true`);
  await sleep(300);

  console.log('=== 11. 刷新后参数记忆 ===');
  const savedName = await ev(`document.getElementById('card-name').value`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(`typeof window.Viewer !== 'undefined'`, 8000, 'reload');
  const afterReloadName = await ev(`document.getElementById('card-name').value`);
  const afterReloadBorder = await ev(`document.getElementById('card-border').value`);
  console.log('  card-name before reload:', savedName, 'after:', afterReloadName);
  console.log('  border after reload:', afterReloadBorder);

  console.log('=== 12. 清空 ===');
  await ev(`document.getElementById('btn-clear').click(); true`);
  await sleep(300);
  console.log('  files after clear:', await ev(`document.querySelectorAll('.fi-angle').length`));

  console.log('=== 错误汇总 ===');
  console.log('  exceptions:', errors.length, errors.slice(0,5));
  console.log('  console errors:', logs.length, logs.slice(0,5));
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
