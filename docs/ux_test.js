/* UX 全面体验测试：模拟真实用户完整操作路径，收集问题 */
const fs = require('fs');
const CDP_HTTP = 'http://127.0.0.1:9222';
const DL_DIR = 'C:/Users/Doro/card-studio/docs/dl';
const SHOT_DIR = 'C:/Users/Doro/card-studio/docs/ux';
const TIMEOUT = 300000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getWsUrl() {
  const list = await (await fetch(CDP_HTTP + '/json/list')).json();
  const page = list.find(t => t.type === 'page' && t.url.indexOf('4173') >= 0);
  if (!page) throw new Error('未找到应用页面');
  return page.webSocketDebuggerUrl;
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.exceptions = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.exceptions.push(d.exception ? d.exception.description : d.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.exceptions.push('[console] ' + (msg.params.args || []).map(a => a.value || a.description || '').join(' '));
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
  async ev(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails));
    return r.result && r.result.value;
  }
  async shot(name) {
    const s = await this.send('Page.captureScreenshot', { format: 'png' });
    const p = SHOT_DIR + '/' + name;
    fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
    return p;
  }
}
async function poll(cdp, expr, timeout, desc) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await cdp.ev(expr);
    if (v) return v;
    await sleep(700);
  }
  throw new Error('轮询超时: ' + desc);
}
async function reloadPage(cdp) {
  await cdp.send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await poll(cdp, `typeof window.Viewer !== 'undefined' && !!document.getElementById('viewer')`, 10000, '页面重载就绪');
  await sleep(400);
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true }); fs.mkdirSync(DL_DIR, { recursive: true });
  const ws = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR, eventsEnabled: true });

  const report = [];
  const log = (k, v) => { console.log('[' + k + '] ' + v); report.push([k, v]); };

  // ---------- A. 首屏 ----------
  const t0 = Date.now();
  log('A1', '首屏加载完成（新页面，包含模型/JS）');
  await sleep(1500);
  const status0 = await cdp.ev(`document.getElementById('status').textContent`);
  log('A2', '初始状态提示: "' + status0 + '"');

  // ---------- B. 上传 4 张 + 默认生成 ----------
  await cdp.ev(`(async () => {
    const names = ['front.png','right.png','back.png','left.png'];
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    for (const n of names) {
      const r = await fetch('/assets/samples/' + n);
      const b = await r.blob();
      dt.items.add(new File([b], n, { type: 'image/png' }));
    }
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 4`, 10000, '文件列表渲染');
  log('B1', '上传 4 张图后文件列表项: ' + await cdp.ev(`document.querySelectorAll('.file-item').length`) +
    '，默认角度: ' + await cdp.ev(`Array.from(document.querySelectorAll('.fi-angle')).map(e=>e.value).join('/')`));
  const tGen0 = Date.now();
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  const st1 = await cdp.ev(`document.getElementById('status').textContent`);
  log('B2', '点击生成后立即提示: "' + st1 + '"');
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, TIMEOUT, 'MODNet 生成');
  log('B3', 'MODNet 4 张生成耗时: ' + ((Date.now() - tGen0) / 1000).toFixed(1) + 's，状态: ' + await cdp.ev(`document.getElementById('status').textContent`));
  await sleep(400);
  await cdp.shot('b-generated.png');

  // ---------- C. 交互体验 ----------
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 440, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 20; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900 + i * 25, y: 440, button: 'left', buttons: 1 }); await sleep(8); }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1400, y: 440, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(500);
  log('C1', '拖拽旋转后角度指示: ' + await cdp.ev(`document.getElementById('angle-indicator').textContent`));
  // 滑块
  await cdp.ev(`document.getElementById('sl-gloss').value = 100; document.getElementById('sl-gloss').dispatchEvent(new Event('input')); true`);
  await cdp.ev(`document.getElementById('sl-depth').value = 10; document.getElementById('sl-depth').dispatchEvent(new Event('input')); true`);
  await sleep(300);
  await cdp.shot('c-gloss100.png');
  // 自动旋转
  await cdp.ev(`document.getElementById('btn-autorotate').click(); true`);
  await sleep(1800);
  const angA = await cdp.ev(`document.getElementById('angle-indicator').textContent`);
  await cdp.ev(`document.getElementById('btn-autorotate').click(); true`);
  log('C2', '自动旋转开 1.8s 后角度变化: ' + angA);
  log('C3', '自动旋转按钮文案: ' + await cdp.ev(`document.getElementById('btn-autorotate').textContent`));

  // ---------- D. 单图场景 ----------
  await cdp.ev(`document.getElementById('btn-autorotate').click(); true`); // 确保关闭
  await reloadPage(cdp);
  await cdp.ev(`(async () => {
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    const r = await fetch('/assets/samples/single.png');
    const b = await r.blob();
    dt.items.add(new File([b], 'single.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 1`, 10000, '单图列表');
  const tGen1 = Date.now();
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, TIMEOUT, '单图生成');
  log('D1', '单图生成耗时: ' + ((Date.now() - tGen1) / 1000).toFixed(1) + 's，单图角度: ' + await cdp.ev(`Array.from(document.querySelectorAll('.fi-angle')).map(e=>e.value).join(',')`));
  await cdp.shot('d-single.png');

  // ---------- E. 色键模式 + 横图 ----------
  await reloadPage(cdp);
  await cdp.ev(`(() => {
    const m = document.getElementById('cutout-mode'); m.value = 'key'; m.dispatchEvent(new Event('change'));
    return true;
  })()`);
  await cdp.ev(`(async () => {
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    const r = await fetch('/assets/samples/wide.png');
    const b = await r.blob();
    dt.items.add(new File([b], 'wide.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 1`, 10000, '横图列表');
  const tGen2 = Date.now();
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, TIMEOUT, '横图色键生成');
  log('E1', '色键+横图生成耗时: ' + ((Date.now() - tGen2) / 1000).toFixed(1) + 's');
  await cdp.shot('e-wide-key.png');

  // ---------- F. 定制：背景/颜色/字体 → 重新生成 ----------
  await cdp.ev(`(() => {
    const s = document.getElementById('bg-style'); s.value = 'solid'; s.dispatchEvent(new Event('change'));
    document.getElementById('bg-color').value = '#1E88E5';
    const f = document.getElementById('card-font'); f.value = 'song'; f.dispatchEvent(new Event('change'));
    document.getElementById('card-name').value = 'TEST';
    return true;
  })()`);
  const tGen3 = Date.now();
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, TIMEOUT, '定制生成');
  log('F1', '纯色背景+宋体+蓝色 生成耗时: ' + ((Date.now() - tGen3) / 1000).toFixed(1) + 's');
  await cdp.shot('f-solid-blue.png');

  // ---------- G. 导出 ----------
  await cdp.ev(`document.getElementById('btn-export-png').click(); true`);
  await sleep(2500);
  const dlFiles = fs.readdirSync(DL_DIR);
  log('G1', '导出 PNG 后下载目录文件: ' + dlFiles.join(', '));
  const dlBefore = dlFiles.length;
  await cdp.ev(`document.getElementById('btn-export-config').click(); true`);
  await sleep(1500);
  const dlFiles2 = fs.readdirSync(DL_DIR);
  log('G2', '导出 config 后新增: ' + dlFiles2.slice(dlBefore).join(', '));

  // ---------- H. 透明直通 ----------
  await reloadPage(cdp);
  await cdp.ev(`(() => {
    const m = document.getElementById('cutout-mode'); m.value = 'keep'; m.dispatchEvent(new Event('change'));
    return true;
  })()`);
  await cdp.ev(`(async () => {
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    const r = await fetch('/assets/samples/alpha.png');
    const b = await r.blob();
    dt.items.add(new File([b], 'alpha.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 1`, 10000, '透明图列表');
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await poll(cdp, `document.getElementById('status').textContent.indexOf('生成完成') >= 0 || document.getElementById('status').textContent.indexOf('失败') >= 0`, 60000, '透明直通');
  log('H1', '透明底直通: ' + await cdp.ev(`document.getElementById('status').textContent`));
  // 用白底图测 keep 应报错提示
  await reloadPage(cdp);
  await cdp.ev(`(() => {
    const m = document.getElementById('cutout-mode'); m.value = 'keep'; m.dispatchEvent(new Event('change'));
    return true;
  })()`);
  await cdp.ev(`(async () => {
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    const r = await fetch('/assets/samples/front.png');
    const b = await r.blob();
    dt.items.add(new File([b], 'front.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await poll(cdp, `document.querySelectorAll('.fi-angle').length === 1`, 10000, '白底列表');
  await cdp.ev(`document.getElementById('btn-generate').click(); true`);
  await sleep(1500);
  log('H2', '白底图用「透明底直通」的提示: ' + await cdp.ev(`document.getElementById('status').textContent`));

  // ---------- 汇总 ----------
  log('ERR', '页面运行期间 JS 异常数: ' + cdp.exceptions.length);
  if (cdp.exceptions.length) cdp.exceptions.slice(0, 6).forEach(e => log('  ERR-DETAIL', String(e).slice(0, 200)));
  console.log('\n===== UX TEST DONE =====');
  ws.close(); process.exit(0);
})().catch(e => { console.error('UX TEST FAIL:', e.message); process.exit(2); });
