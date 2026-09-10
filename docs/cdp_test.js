/* CDP 端到端测试 v2：自定义角度 + 自定义背景/字体 + 模拟拖拽旋转 */
const fs = require('fs');

const CDP_HTTP = 'http://127.0.0.1:9222';
const SHOT = process.argv[2] || 'C:/Users/Doro/card-studio/docs/shot3.png';
const TIMEOUT_MS = 240000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWsUrl() {
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const page = list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0);
  if (!page) throw new Error('未找到应用页面，请确认服务器已启动');
  return page.webSocketDebuggerUrl;
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evalExpr(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails));
    return r.result && r.result.value;
  }
}

async function poll(cdp, expr, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await cdp.evalExpr(expr);
    if (v) return v;
    await sleep(800);
  }
  throw new Error('轮询超时: ' + expr);
}

(async () => {
  const ws = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  console.log('[1] 注入 4 张示例图 + 自定义角度 0/100/200/300 …');
  await cdp.evalExpr(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) {
      const r = await fetch('/assets/samples/' + n);
      const b = await r.blob();
      dt.items.add(new File([b], n, { type: 'image/png' }));
    }
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 4`, 10000);
  await cdp.evalExpr(`(() => {
    const v = [0, 100, 200, 300];
    document.querySelectorAll('.fi-angle').forEach((el, i) => { el.value = v[i]; el.dispatchEvent(new Event('change', {bubbles:true})); });
    return true;
  })()`);
  console.log('    角度输入:', await cdp.evalExpr(`Array.from(document.querySelectorAll('.fi-angle')).map(e=>e.value).join(',')`));

  console.log('[2] 自定义背景颜色/字体：红色渐变 + 黑体 …');
  await cdp.evalExpr(`(() => {
    const s = document.getElementById('bg-style'); s.value = 'custom'; s.dispatchEvent(new Event('change'));
    document.getElementById('bg-color').value = '#C0392B';
    const f = document.getElementById('card-font'); f.value = 'hei'; f.dispatchEvent(new Event('change'));
    document.getElementById('card-name').value = 'LUMI';
    return true;
  })()`);

  console.log('[3] 生成闪卡 …');
  await cdp.evalExpr(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, TIMEOUT_MS);
  const status = await cdp.evalExpr(`document.getElementById('status').textContent`);
  console.log('    状态:', status);
  if (status.indexOf('生成完成') < 0) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    console.log('    失败截图:', SHOT); process.exit(1);
  }

  console.log('[4] 模拟拖拽旋转（mouse 拖 480px 右移）…');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 440, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900 + i * 40, y: 440, button: 'left', buttons: 1 });
    await sleep(16);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1380, y: 440, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(600);
  const angleText = await cdp.evalExpr(`document.getElementById('angle-indicator').textContent`);
  console.log('    旋转后:', angleText);

  // 读取合成结果的关键状态
  const canvasCount = await cdp.evalExpr(`document.querySelectorAll('#viewer canvas').length`);
  const bgSel = await cdp.evalExpr(`document.getElementById('bg-style').value`);
  const fontSel = await cdp.evalExpr(`document.getElementById('card-font').value`);
  console.log('[5] viewer canvas:', canvasCount, '| bgStyle:', bgSel, '| font:', fontSel);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
  console.log('[6] 截图已保存:', SHOT);
  console.log('TEST PASS');
  ws.close(); process.exit(0);
})().catch(e => { console.error('TEST FAIL:', e.message); process.exit(2); });
