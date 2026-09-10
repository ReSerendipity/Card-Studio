/* ============================================================
 * Cutout 抠图模块
 * 三种方式：
 *  - model : ONNX Runtime Web 跑 MODNet（U²-Net 同源人像模型）
 *  - keep  : 原图透明底直通
 *  - key   : 色键去白底（无模型降级，边缘采样 + 颜色距离）
 * 全程本地推理，无 LLM。
 * ============================================================ */
(function (global) {
  'use strict';

  var session = null;      // 复用的 InferenceSession
  var sessionPath = null;  // 当前 session 对应的模型路径
  var loading = null;      // 加载中的 Promise
  var loadingPath = null;  // 加载中的模型路径（防并发重复加载）
  var wasmPathsSet = false;

  /* 模型配置表：path → 输入边长（MODNet 256 / ISNet 1024 / U²-Net 320） */
  var MODEL_CONFIG = {
    'assets/models/modnet.onnx': { size: 256 },
    'assets/models/modnet_uint8.onnx': { size: 256 },
    'assets/models/u2netp.onnx': { size: 320 },
    'assets/models/isnet_anime.onnx': { size: 1024 }
  };
  function modelSize(path) {
    var c = MODEL_CONFIG[path];
    return c ? c.size : 256;
  }

  function ensureWasmPaths() {
    if (wasmPathsSet) return;
    wasmPathsSet = true;
    try {
      if (global.ort && global.ort.env && global.ort.env.wasm) {
        global.ort.env.wasm.wasmPaths = 'src-web/vendor/';
        global.ort.env.wasm.numThreads = 1;
      }
    } catch (e) { /* 忽略 */ }
  }

  /** 加载模型：按模型路径独立缓存，切换模型时自动重新加载 */
  function loadModel(modelPath) {
    ensureWasmPaths();
    if (session && sessionPath === modelPath) return Promise.resolve(session);
    if (loading) {
      // 另一个模型正在加载：等它完成后按需加载当前模型
      return loading.then(function () { return loadModel(modelPath); });
    }
    if (!global.ort) {
      return Promise.reject(new Error('onnxruntime-web 未加载（检查 vendor/ort.min.js）'));
    }
    loadingPath = modelPath;
    loading = global.ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm']
    }).then(function (s) {
      session = s;
      sessionPath = loadingPath;
      loading = null;
      loadingPath = null;
      return s;
    }).catch(function (e) {
      loading = null;
      loadingPath = null;
      throw e;
    });
    return loading;
  }

  function hasSession() { return !!session; }

  /** 释放模型，便于切换精度 */
  function disposeModel() {
    if (session) { try { session.release && session.release(); } catch (e) {} }
    session = null; sessionPath = null; loading = null; loadingPath = null;
  }

  /** 检查原图是否已含真实 alpha */
  function hasAlpha(image) {
    var cv = document.createElement('canvas');
    cv.width = image.naturalWidth || image.width;
    cv.height = image.naturalHeight || image.height;
    var ctx = cv.getContext('2d');
    ctx.drawImage(image, 0, 0);
    var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    for (var i = 3; i < d.length; i += 4) {
      if (d[i] < 250) return true;
    }
    return false;
  }

  /* ---------------- MODNet / ISNet 推理（输入尺寸参数化） ---------------- */
  function canvasToTensor(cv, s) {
    var ctx = cv.getContext('2d');
    var d = ctx.getImageData(0, 0, s, s).data;
    var n = s * s;
    var input = new Float32Array(3 * n);
    for (var i = 0; i < n; i++) {
      input[i] = (d[i * 4] / 255 - 0.5) / 0.5;
      input[n + i] = (d[i * 4 + 1] / 255 - 0.5) / 0.5;
      input[2 * n + i] = (d[i * 4 + 2] / 255 - 0.5) / 0.5;
    }
    return input;
  }

  function maskToCanvas(maskData, s) {
    var cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(s, s);
    for (var i = 0; i < s * s; i++) {
      var v = Math.round(Math.max(0, Math.min(1, maskData[i])) * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /** 模型抠图：输入 Image，输出透明背景 canvas */
  function cutoutWithModel(image, modelPath) {
    return loadModel(modelPath).then(function (sess) {
      var s = modelSize(modelPath);
      var cv = document.createElement('canvas');
      cv.width = s; cv.height = s;
      var ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, s, s);
      var input = canvasToTensor(cv, s);
      var inputName = sess.inputNames[0];
      var feeds = {};
      feeds[inputName] = new global.ort.Tensor('float32', input, [1, 3, s, s]);
      return sess.run(feeds).then(function (output) {
        var outName = sess.outputNames[0];
        var maskData = output[outName].data;
        var maskCv = maskToCanvas(maskData, s);
        // 把 mask 放大回原尺寸并作为 alpha 应用
        var w = image.naturalWidth || image.width;
        var h = image.naturalHeight || image.height;
        var outCv = document.createElement('canvas');
        outCv.width = w; outCv.height = h;
        var octx = outCv.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(image, 0, 0, w, h);
        octx.globalCompositeOperation = 'destination-in';
        octx.drawImage(maskCv, 0, 0, w, h);
        return outCv;
      });
    });
  }

  /* ---------------- 色键去白底 ---------------- */
  function cutoutByColorKey(image, tol) {
    var tol2 = (tol || 36) * (tol || 36);
    var cv = document.createElement('canvas');
    cv.width = image.naturalWidth || image.width;
    cv.height = image.naturalHeight || image.height;
    var ctx = cv.getContext('2d');
    ctx.drawImage(image, 0, 0);
    var imgData = ctx.getImageData(0, 0, cv.width, cv.height);
    var d = imgData.data;
    var w = cv.width, h = cv.height;
    // 从四条边采样背景色（取出现最多的"近白/近边缘"颜色）
    var samples = [];
    function sample(x, y) {
      var i = (y * w + x) * 4;
      samples.push([d[i], d[i + 1], d[i + 2]]);
    }
    var step = Math.max(4, Math.floor(w / 24));
    for (var x = 0; x < w; x += step) { sample(x, 0); sample(x, h - 1); }
    for (var y = 0; y < h; y += step) { sample(0, y); sample(w - 1, y); }
    // 聚类简化：取平均色（假设背景单一）
    var ar = 0, ag = 0, ab = 0;
    for (var s = 0; s < samples.length; s++) { ar += samples[s][0]; ag += samples[s][1]; ab += samples[s][2]; }
    ar /= samples.length; ag /= samples.length; ab /= samples.length;
    // 打 alpha
    for (var i = 0; i < d.length; i += 4) {
      var dr = d[i] - ar, dg = d[i + 1] - ag, db = d[i + 2] - ab;
      if (dr * dr + dg * dg + db * db < tol2) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return cv;
  }

  /**
   * 统一入口
   * @param {HTMLImageElement} image
   * @param {string} mode  model | keep | key
   * @param {string} modelPath 模型 URL（mode=model 时）
   * @returns {Promise<HTMLCanvasElement>}
   */
  function cutout(image, mode, modelPath) {
    mode = mode || 'model';
    if (mode === 'keep') {
      return Promise.resolve().then(function () {
        if (hasAlpha(image)) {
          var cv = document.createElement('canvas');
          cv.width = image.naturalWidth || image.width;
          cv.height = image.naturalHeight || image.height;
          cv.getContext('2d').drawImage(image, 0, 0);
          return cv;
        }
        throw new Error('该图片不含透明通道，请改用「自动抠图」或「色键去白底」');
      });
    }
    if (mode === 'key') {
      return Promise.resolve().then(function () { return cutoutByColorKey(image); });
    }
    return cutoutWithModel(image, modelPath);
  }

  global.Cutout = {
    cutout: cutout,
    loadModel: loadModel,
    disposeModel: disposeModel,
    hasSession: hasSession,
    hasAlpha: hasAlpha
  };
})(window);
