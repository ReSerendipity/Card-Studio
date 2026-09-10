/* ============================================================
 * Viewer 多视角 3D 查看器（Three.js）
 *  - N 张卡面纹理分布在 360°，水平拖拽连续旋转
 *  - 当前角度落在相邻两帧之间时，用离屏 canvas 做 alpha 混合
 *  - 卡面(face)与文字层(overlay)分离，overlay 前移产生景深视差
 *  - 光泽为绘制在卡面 overlay 上的高光带（跟随角度扫过卡面）
 * ============================================================ */
(function (global) {
  'use strict';

  var container, scene, camera, renderer;
  var group, faceMesh, overlayMesh;
  var mixFaceCv, mixOverlayCv, faceTex, overlayTex;
  var frames = [];          // [{face:canvas, overlay:canvas, angle:number}]
  var texW = 384, texH = 512;

  var dragging = false, lastX = 0, velX = 0, lastMoveT = 0;
  var autoRotate = false, speed = 0.6;   // 弧度/秒
  var depth = 0.25, gloss = 0.55;
  var onAngle = null;
  var running = false;

  function init(el) {
    container = el;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    group = new THREE.Group();
    scene.add(group);

    var geo = new THREE.PlaneGeometry(3.1, 4.14);
    // 双面渲染：旋转到背面视角时卡片仍可见（关键修复）
    faceMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: false, side: THREE.DoubleSide }));
    faceMesh.visible = false;           // 未生成时隐藏（避免白色空卡面）
    group.add(faceMesh);

    overlayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 4.14),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    overlayMesh.position.z = depth;
    overlayMesh.visible = false;        // 未生成时隐藏
    group.add(overlayMesh);

    // 混合用离屏 canvas
    mixFaceCv = document.createElement('canvas');
    mixFaceCv.width = texW; mixFaceCv.height = texH;
    mixOverlayCv = document.createElement('canvas');
    mixOverlayCv.width = texW; mixOverlayCv.height = texH;

    // 交互（pointer 事件，同时覆盖鼠标/触摸）
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    var canvasEl = renderer.domElement;
    canvasEl.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastMoveT = performance.now();
      velX = 0; canvasEl.style.cursor = 'grabbing';
      canvasEl.setPointerCapture && canvasEl.setPointerCapture(e.pointerId);
    });
    canvasEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var now = performance.now();
      var dt = Math.max(1, now - lastMoveT);
      velX = dx / dt;               // 像素/毫秒 → 用于惯性
      group.rotation.y += dx * 0.006;
      lastX = e.clientX; lastMoveT = now;
    });
    canvasEl.addEventListener('pointerup', function () { dragging = false; canvasEl.style.cursor = 'grab'; });
    canvasEl.addEventListener('pointerleave', function () { dragging = false; });

    // 键盘 ←/→ 旋转（每格 6°）
    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { group.rotation.y -= 6 * Math.PI / 180; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { group.rotation.y += 6 * Math.PI / 180; e.preventDefault(); }
    });

    // 视口尺寸
    resize();
    window.addEventListener('resize', resize);

    running = true;
    loop();
  }

  /** 直接跳转到指定角度（0-359） */
  function setAngle(deg) {
    group.rotation.y = ((deg % 360) + 360) % 360 * Math.PI / 180;
    paintMix();
  }

  /** 微调角度（键盘用，单位：度） */
  function nudge(deltaDeg) {
    group.rotation.y += deltaDeg * Math.PI / 180;
  }

  function resize() {
    if (!container || !renderer) return;
    var w = container.clientWidth || 640;
    var h = container.clientHeight || 480;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** 设置 N 视角帧（合成好的 canvas 数组，每项 {face, overlay, angle}，angle 为 0~359） */
  function setFrames(list) {
    frames = (list || []).slice().sort(function (a, b) { return a.angle - b.angle; });
    if (frames.length === 0) return;
    // 预建纹理
    faceTex = new THREE.CanvasTexture(mixFaceCv);
    overlayTex = new THREE.CanvasTexture(mixOverlayCv);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    overlayTex.colorSpace = THREE.SRGBColorSpace;
    faceMesh.material.map = faceTex;
    overlayMesh.material.map = overlayTex;
    faceMesh.material.needsUpdate = true;
    overlayMesh.material.needsUpdate = true;
    faceMesh.visible = true;
    overlayMesh.visible = true;
    group.rotation.y = 0;
    paintMix();
  }

  /** 任意角度分布：找当前角度所在的相邻帧区间（环形） */
  function pairFor(deg) {
    var n = frames.length;
    if (n === 0) return null;
    if (n === 1) return { k1: 0, k2: 0, t: 0 };
    var j = -1;
    for (var i = 0; i < n; i++) {
      var right = (i === n - 1) ? frames[0].angle + 360 : frames[i + 1].angle;
      if (frames[i].angle <= deg && deg < right) { j = i; break; }
    }
    if (j === -1) j = n - 1;   // deg < 最小角度 → 落在最后一个区间（环绕）
    var k1 = j, k2 = (j + 1) % n;
    var left = frames[j].angle;
    var right2 = (j === n - 1) ? frames[0].angle + 360 : frames[j + 1].angle;
    var span = right2 - left;
    var t = span <= 0 ? 0 : Math.min(1, Math.max(0, (deg - left) / span));
    return { k1: k1, k2: k2, t: t };
  }

  /** 当前角度 → 相邻两帧 → 离屏混合 */
  function paintMix() {
    var n = frames.length;
    if (n === 0) return;
    var deg = ((group.rotation.y * 180 / Math.PI) % 360 + 360) % 360;
    var pair = pairFor(deg);
    if (!pair) return;
    var k1 = pair.k1, k2 = pair.k2, t = pair.t;

    var fc1 = mixFaceCv.getContext('2d');
    fc1.globalAlpha = 1;
    fc1.clearRect(0, 0, texW, texH);
    fc1.drawImage(frames[k1].face, 0, 0, texW, texH);
    fc1.globalAlpha = t;
    fc1.drawImage(frames[k2].face, 0, 0, texW, texH);
    faceTex.needsUpdate = true;

    var oc1 = mixOverlayCv.getContext('2d');
    oc1.globalAlpha = 1;
    oc1.clearRect(0, 0, texW, texH);
    oc1.drawImage(frames[k1].overlay, 0, 0, texW, texH);
    oc1.globalAlpha = t;
    oc1.drawImage(frames[k2].overlay, 0, 0, texW, texH);

    // 光泽：卡面高光带，位置随角度平移（真实绘制在 overlay 层上）
    if (gloss > 0.01) {
      oc1.globalAlpha = 1;
      var sweep = ((deg % 360) / 360) * texW * 2.2 - texW * 0.6;
      var gg = oc1.createLinearGradient(sweep - texW * 0.28, 0, sweep + texW * 0.28, texH);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.5, 'rgba(255,255,255,' + (0.5 * gloss).toFixed(3) + ')');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      oc1.fillStyle = gg;
      oc1.fillRect(0, 0, texW, texH);
    }
    overlayTex.needsUpdate = true;

    if (onAngle) onAngle(Math.round(deg), k1, k2, t);
  }

  function clearFrames() {
    frames = [];
    if (faceMesh.material.map) { faceMesh.material.map = null; faceMesh.material.needsUpdate = true; }
    if (overlayMesh.material.map) { overlayMesh.material.map = null; overlayMesh.material.needsUpdate = true; }
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    if (autoRotate && !dragging) {
      group.rotation.y += speed * (1 / 60);
    } else if (!dragging && Math.abs(velX) > 0.05) {
      // 惯性
      group.rotation.y += velX * 0.006;
      velX *= 0.94;
      if (Math.abs(velX) < 0.05) velX = 0;
    }
    paintMix();
    renderer.render(scene, camera);
  }

  function setDepth(v) {
    depth = v;
    if (overlayMesh) overlayMesh.position.z = v * 0.45;
  }
  function setGloss(v) { gloss = v; }
  function setSpeed(v) { speed = v * 3; }  // 0~1 → 0~3 弧度/秒
  function toggleAuto() {
    autoRotate = !autoRotate;
    if (autoRotate) velX = 0;
    return autoRotate;
  }

  global.Viewer = {
    init: init, resize: resize,
    setFrames: setFrames, clearFrames: clearFrames,
    setDepth: setDepth, setGloss: setGloss, setSpeed: setSpeed,
    toggleAuto: toggleAuto, setAngle: setAngle, nudge: nudge,
    set onAngle(fn) { onAngle = fn; }
  };
})(window);
