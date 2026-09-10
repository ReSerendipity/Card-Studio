/* ============================================================
 * App 应用主控：上传 → 抠图 → 合成 → 3D 查看 → 导出
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 主题切换（深/浅，localStorage 记忆） ---------------- */
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('cardstudio-theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    var btn = $('theme-toggle');
    var applyIcon = function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      btn.textContent = cur === 'dark' ? '🌙' : '☀️';
    };
    applyIcon();
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('cardstudio-theme', next); } catch (e) {}
      applyIcon();
    });
  })();

  var state = {
    files: [],           // [{name, image, canvas}]
    generated: false,
    frames: [],          // [{face, overlay}]
    bgImage: null        // 用户上传的自定义背景图（Image）
  };

  /* ---------------- 参数记忆（localStorage） ---------------- */
  var PKEY = 'cardstudio-params';
  var PARAM_IDS = ['card-name', 'card-no', 'card-rarity', 'bg-style', 'bg-color',
                   'card-font', 'card-name-color', 'card-border', 'card-corners',
                   'sl-subject', 'bg-seed', 'cutout-mode', 'model-quality'];
  function saveParams() {
    var o = {};
    PARAM_IDS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      o[id] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    try { localStorage.setItem(PKEY, JSON.stringify(o)); } catch (e) {}
  }
  function loadParams() {
    var raw = null;
    try { raw = localStorage.getItem(PKEY); } catch (e) {}
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      PARAM_IDS.forEach(function (id) {
        if (o[id] == null) return;
        var el = $(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!o[id];
        else el.value = o[id];
      });
      $('subject-val').textContent = ($('sl-subject').value) + '%';
    } catch (e) {}
  }
  PARAM_IDS.forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('change', saveParams);
  });

  /* ---------------- 上传 ---------------- */
  var dz = $('dropzone');
  var fileInput = $('file-input');
  dz.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  function addFiles(fileList) {
    var imgs = Array.prototype.slice.call(fileList).filter(function (f) {
      return f.type && f.type.indexOf('image/') === 0;
    });
    if (imgs.length === 0) { setStatus('请选择图片文件（png/jpg）。', 'err'); return; }
    var jobs = imgs.map(function (f) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () { resolve({ name: f.name, image: img }); };
          img.onerror = function () { resolve(null); };
          img.src = reader.result;
        };
        reader.readAsDataURL(f);
      });
    });
    Promise.all(jobs).then(function (items) {
      items = items.filter(Boolean);
      state.files = state.files.concat(items);
      // 按文件名排序
      state.files.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
      state.generated = false;
      state.frames = [];
      Viewer.clearFrames();
      renderFileList();
      setStatus('已载入 ' + state.files.length + ' 张视角图，点击「生成闪卡」。', 'ok');
      $('btn-generate').disabled = false;
    });
  }

  function renderFileList() {
    var box = $('file-list');
    var n = state.files.length;
    box.innerHTML = '';
    state.files.forEach(function (f, k) {
      var defAng = Math.round(360 * k / Math.max(1, n));
      var div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = '<img alt=""><button class="fi-del" title="删除这张图">✕</button>' +
        '<span class="fi-idx">' + (k + 1) + '</span>' +
        '<input type="number" class="fi-angle" min="0" max="359" value="' + defAng + '" title="该视角对应的旋转角度（0-359°），可自定义">';
      div.querySelector('img').src = f.image.src;
      box.appendChild(div);
    });
    $('btn-clear').disabled = state.files.length === 0;
  }

  // 删除单张图（事件委托）
  $('file-list').addEventListener('click', function (e) {
    var del = e.target && e.target.classList && e.target.classList.contains('fi-del');
    if (!del) return;
    var item = e.target.closest('.file-item');
    if (!item) return;
    var idx = Array.prototype.indexOf.call(item.parentNode.children, item);
    state.files.splice(idx, 1);
    state.generated = false;
    state.frames = [];
    Viewer.clearFrames();
    renderFileList();
    $('btn-generate').disabled = state.files.length === 0;
    $('btn-export-png').disabled = true;
    $('btn-export-config').disabled = true;
    setStatus('已删除第 ' + (idx + 1) + ' 张图片' + (state.files.length ? '，请重新生成。' : '，请上传新图。'), '');
  });

  // 清空全部
  $('btn-clear').addEventListener('click', function () {
    state.files = [];
    state.generated = false;
    state.frames = [];
    Viewer.clearFrames();
    renderFileList();
    $('btn-generate').disabled = true;
    $('btn-export-png').disabled = true;
    $('btn-export-config').disabled = true;
    setStatus('已清空，请上传新的视角图。', '');
  });

  // 角度被修改后，标记需要重新生成
  $('file-list').addEventListener('change', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('fi-angle')) {
      state.generated = false;
      state.frames = [];
      Viewer.clearFrames();
      $('btn-export-png').disabled = true;
      $('btn-export-config').disabled = true;
      setStatus('角度已修改，请重新点击「生成闪卡」。', '');
    }
  });

  /* ---------------- 生成 ---------------- */
  function setProgress(pct, visible) {
    var wrap = $('progress-wrap');
    if (visible) { wrap.style.display = 'flex'; } else if (!visible) { wrap.style.display = 'none'; }
    $('progress-bar').style.width = pct + '%';
    $('progress-pct').textContent = pct + '%';
  }

  $('btn-generate').addEventListener('click', generate);

  function generate() {
    if (state.files.length === 0) { setStatus('请先上传视角图。', 'err'); return; }
    var btn = $('btn-generate');
    btn.disabled = true;
    var mode = $('cutout-mode').value;
    var modelPath = $('model-quality').value;
    var card = {
      name: $('card-name').value.trim() || 'CARD',
      no: $('card-no').value.trim() || 'No.001',
      rarity: $('card-rarity').value,
      bgStyle: $('bg-style').value,
      seed: parseInt($('bg-seed').value, 10) || 42,
      bgColor: $('bg-color').value || '#4B2E7E',
      textFont: $('card-font').value || 'kai',
      nameColor: $('card-name-color').value || 'gold',
      borderStyle: $('card-border').value || 'gold',
      showCorners: $('card-corners').checked,
      bgImage: ($('bg-style').value === 'image') ? state.bgImage : null,
      subjectScale: (parseInt($('sl-subject').value, 10) || 100) / 100
    };
    // 读取每张图的自定义角度（0-359）
    var angleInputs = document.querySelectorAll('.fi-angle');
    var angles = state.files.map(function (f, idx) {
      var v = angleInputs[idx] ? parseInt(angleInputs[idx].value, 10) : NaN;
      return isNaN(v) ? 0 : Math.max(0, Math.min(359, v));
    });
    var total = state.files.length;
    setStatus('正在处理 0/' + total + ' …', '');
    setProgress(0, true);
    var frames = [];
    var chain = Promise.resolve();
    state.files.forEach(function (f, idx) {
      chain = chain.then(function () {
        setStatus('正在抠图 ' + (idx + 1) + '/' + total + '（' + f.name + '）…', '');
        return Cutout.cutout(f.image, mode, modelPath).then(function (subject) {
          setStatus('正在合成卡面 ' + (idx + 1) + '/' + total + '（角度 ' + angles[idx] + '°）…', '');
          setProgress(Math.round((idx + 1) / total * 100), true);
          var built = Compose.build({ subject: subject, name: card.name, no: card.no, rarity: card.rarity, bgStyle: card.bgStyle, seed: card.seed + idx, bgColor: card.bgColor, textFont: card.textFont, nameColor: card.nameColor, borderStyle: card.borderStyle, showCorners: card.showCorners, bgImage: card.bgImage, subjectScale: card.subjectScale });
          frames.push({ face: built.face, overlay: built.overlay, angle: angles[idx] });
        }).catch(function (e) {
          setStatus('第 ' + (idx + 1) + ' 张处理失败：' + e.message, 'err');
          throw e;
        });
      });
    });
    chain.then(function () {
      state.frames = frames;
      state.generated = true;
      Viewer.setFrames(frames);
      setProgress(100, true);
      setTimeout(function () { setProgress(0, false); }, 800);
      setStatus('生成完成：' + frames.length + ' 个视角。拖拽/滑动旋转查看，滑块调节效果，可导出。', 'ok');
      $('btn-export-png').disabled = false;
      $('btn-export-config').disabled = false;
      $('btn-snap-view').disabled = false;
      $('viewer-hint').style.display = 'none';
    }).catch(function () {
      setProgress(0, false);
      // 错误已在上层提示
    }).finally(function () {
      btn.disabled = false;
    });
  }

  /* ---------------- 滑块/自动旋转 ---------------- */
  var autoOn = false;
  function bindSlider(id, fn) {
    var el = $(id);
    el.addEventListener('input', function () { fn(parseInt(el.value, 10) / 100); });
    fn(parseInt(el.value, 10) / 100);
  }
  bindSlider('sl-gloss', function (v) { Viewer.setGloss(v); });
  bindSlider('sl-depth', function (v) { Viewer.setDepth(v); });
  bindSlider('sl-speed', function (v) { Viewer.setSpeed(v); });

  // 主体大小滑块（仅显示数值，生成时读取）
  $('sl-subject').addEventListener('input', function () {
    $('subject-val').textContent = $('sl-subject').value + '%';
  });
  $('subject-val').textContent = $('sl-subject').value + '%';

  // 角度跳转
  var jumpBtns = document.querySelectorAll('.angle-jump button[data-a]');
  Array.prototype.forEach.call(jumpBtns, function (b) {
    b.addEventListener('click', function () {
      if (state.generated) Viewer.setAngle(parseInt(b.getAttribute('data-a'), 10));
      else setStatus('请先生成闪卡，再跳转角度。', '');
    });
  });
  $('btn-angle-go').addEventListener('click', function () {
    var v = parseInt($('angle-go').value, 10);
    if (isNaN(v)) { setStatus('请输入 0-359 之间的角度。', 'err'); return; }
    if (state.generated) Viewer.setAngle(Math.max(0, Math.min(359, v)));
    else setStatus('请先生成闪卡，再跳转角度。', '');
  });

  $('btn-autorotate').addEventListener('click', function () {
    autoOn = Viewer.toggleAuto();
    this.textContent = '自动旋转：' + (autoOn ? '开' : '关');
  });

  Viewer.onAngle = function (deg, k1, k2, t) {
    $('angle-indicator').textContent = '当前角度 ' + deg + '° · 帧' + (k1 + 1) + '↔帧' + (k2 + 1) + ' 混合 ' + Math.round(t * 100) + '%';
  };

  /* ---------------- 导出 ---------------- */
  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  $('btn-export-png').addEventListener('click', function () {
    if (!state.generated) return;
    var pad = String(state.frames.length).length;
    var done = 0;
    setStatus('正在导出 ' + state.frames.length + ' 张卡面 PNG…', '');
    state.frames.forEach(function (fr, k) {
      var cv = document.createElement('canvas');
      cv.width = Compose.W; cv.height = Compose.H;
      var ctx = cv.getContext('2d');
      ctx.drawImage(fr.face, 0, 0);
      ctx.drawImage(fr.overlay, 0, 0);
      cv.toBlob(function (blob) {
        // 文件名带角度：card_0deg.png / card_90deg.png …
        downloadBlob(blob, 'card_' + fr.angle + 'deg.png');
        done++;
        if (done === state.frames.length) setStatus('已导出 ' + state.frames.length + ' 张卡面 PNG（浏览器下载）。', 'ok');
      }, 'image/png');
    });
  });

  $('btn-export-config').addEventListener('click', function () {
    var n = state.files.length;
    var angleInputs = document.querySelectorAll('.fi-angle');
    var angles = [];
    for (var k = 0; k < n; k++) {
      var v = angleInputs[k] ? parseInt(angleInputs[k].value, 10) : NaN;
      angles.push(isNaN(v) ? 0 : Math.max(0, Math.min(359, v)));
    }
    var cfg = {
      name: $('card-name').value.trim() || 'CARD',
      no: $('card-no').value.trim() || 'No.001',
      rarity: $('card-rarity').value,
      bgStyle: $('bg-style').value,
      bgColor: $('bg-color').value || '#4B2E7E',
      textFont: $('card-font').value || 'kai',
      subjectScale: (parseInt($('sl-subject').value, 10) || 100) / 100,
      seed: parseInt($('bg-seed').value, 10) || 42,
      cutoutMode: $('cutout-mode').value,
      model: $('model-quality').value,
      frames: n,
      angles: angles,
      files: state.files.map(function (f) { return f.name; })
    };
    downloadBlob(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }), 'card-config.json');
    setStatus('已导出 card-config.json。', 'ok');
  });

  /* ---------------- 背景图上传 ---------------- */
  $('bg-image').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        state.bgImage = img;
        $('bg-style').value = 'image';
        setStatus('已载入自定义背景图（' + f.name + '），生成时使用。', 'ok');
      };
      img.onerror = function () { setStatus('背景图读取失败。', 'err'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  /* ---------------- 随机骰子：换种子 ---------------- */
  $('btn-random-seed').addEventListener('click', function () {
    $('bg-seed').value = Math.floor(Math.random() * 99999);
    saveParams();
    setStatus('随机种子已换，请重新生成。', '');
  });

  /* ---------------- 复位视图 / 截图当前视角 ---------------- */
  $('btn-viewer-reset').addEventListener('click', function () {
    Viewer.resetView();
    setStatus('视图已复位（角度 0°、缩放 1x）。', '');
  });
  $('btn-snap-view').addEventListener('click', function () {
    if (!state.generated) { setStatus('请先生成闪卡。', 'err'); return; }
    Viewer.captureCurrent().then(function (blob) {
      if (!blob) { setStatus('截图失败。', 'err'); return; }
      var deg = $('angle-indicator').textContent.match(/(\d+)°/);
      downloadBlob(blob, 'card-view_' + (deg ? deg[1] : '0') + 'deg.png');
      setStatus('已导出当前 3D 视角截图。', 'ok');
    });
  });

  /* ---------------- 加载示例 ---------------- */
  $('btn-load-sample').addEventListener('click', function () {
    var samples = ['assets/samples/front.png', 'assets/samples/right.png',
                   'assets/samples/back.png', 'assets/samples/left.png'];
    var jobs = samples.map(function (p, k) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ name: p.split('/').pop(), image: img, angle: k * 90 }); };
        img.onerror = function () { resolve(null); };
        img.src = p;
      });
    });
    Promise.all(jobs).then(function (items) {
      items = items.filter(Boolean);
      state.files = items;
      state.generated = false;
      state.frames = [];
      Viewer.clearFrames();
      renderFileList();
      // 示例图角度写死 0/90/180/270
      var inputs = document.querySelectorAll('.fi-angle');
      inputs.forEach(function (inp, k) { if (items[k]) inp.value = items[k].angle; });
      $('btn-generate').disabled = false;
      setStatus('已载入 4 张示例视角图，点击「生成闪卡」体验。', 'ok');
    });
  });

  /* ---------------- 状态 ---------------- */
  function setStatus(msg, kind) {
    var el = $('status');
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  /* ---------------- 初始化 ---------------- */
  loadParams();
  Viewer.init($('viewer'));
  if (typeof ort === 'undefined') {
    setStatus('警告：onnxruntime-web 未加载（检查 src-web/vendor/ort.min.js）。可改用「透明底直通」或「色键去白底」。', 'err');
  }
})();
