/* ============================================================
 * Compose 合成模块
 * 用 Canvas2D 把 抠图主体 合成为标准卡面：
 *  - face    : 背景 + 主体（768×1024）
 *  - overlay : 边框 + 文字 + 稀有度（透明底，作 Three.js 前景视差层）
 * 背景为程序化生成（渐变/星空/纯色），文字为烫金排版。
 * ============================================================ */
(function (global) {
  'use strict';

  var W = 768, H = 1024;

  /* 确定性随机（mulberry32） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeCanvas() {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    return cv;
  }

  /* ---------------- 背景 ---------------- */
  function shade(hex, factor) {
    // 把 hex 颜色按 factor（0~1）压暗，返回 css 颜色
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = Math.round(r * factor); g = Math.round(g * factor); b = Math.round(b * factor);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function paintBackground(ctx, style, seed, bgColor, bgImage) {
    // 用户上传自定义背景图优先
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, W, H);
      return;
    }
    var rnd = mulberry32(seed || 42);
    if (style === 'stars') {
      ctx.fillStyle = '#0E1220'; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 240; i++) {
        var x = rnd() * W, y = rnd() * H, r = 0.4 + rnd() * 1.4;
        var a = 0.25 + rnd() * 0.65;
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (var s = 0; s < 5; s++) {
        var sx = rnd() * W, sy = rnd() * H, sr = 60 + rnd() * 160;
        var sg = ctx.createRadialGradient(sx, sy, 5, sx, sy, sr);
        sg.addColorStop(0, 'rgba(138,107,209,0.18)'); sg.addColorStop(1, 'rgba(138,107,209,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      }
    } else if (style === 'solid') {
      ctx.fillStyle = bgColor || '#2A1B4D'; ctx.fillRect(0, 0, W, H);
    } else { // gradient：以所选颜色生成渐变
      var base = bgColor || '#4B2E7E';
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, shade(base, 1.0));
      g.addColorStop(0.55, shade(base, 0.72));
      g.addColorStop(1, shade(base, 0.38));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var rg = ctx.createRadialGradient(W * 0.3, H * 0.22, 40, W * 0.3, H * 0.22, 460);
      rg.addColorStop(0, 'rgba(255,255,255,0.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- 主体（保持宽高比，居中，支持缩放） ---------------- */
  function paintSubject(ctx, subject, areaX, areaY, areaW, areaH, scale) {
    scale = scale || 1;
    var sw = subject.width, sh = subject.height;
    if (!sw || !sh) return;
    var fit = Math.min(areaW / sw, areaH / sh);
    var dw = sw * fit * scale, dh = sh * fit * scale;
    var dx = areaX + (areaW - dw) / 2;
    var dy = areaY + (areaH - dh) / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(subject, dx, dy, dw, dh);
  }

  /* ---------------- 烫金文字 ---------------- */
  function paintGoldText(ctx, text, x, y, size, font, align, alpha) {
    if (!text) return;
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + (font || 'Georgia, "SimSun", serif');
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.strokeStyle = 'rgba(35,25,15,0.9)';
    ctx.strokeText(text, x, y);
    var g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#FFF8D0');
    g.addColorStop(0.3, '#F6D463');
    g.addColorStop(0.55, '#C9962E');
    g.addColorStop(0.8, '#F7E9A0');
    g.addColorStop(1, '#9A6E1A');
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 0.32 * (alpha == null ? 1 : alpha);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.strokeText(text, x - 1, y - 2);
    ctx.restore();
  }

  /* ---------------- 边框 + 角饰（overlay） ---------------- */
  function paintFrame(ctx, borderStyle, showCorners) {
    if (borderStyle === 'none') return;
    var main = 'rgba(246,212,99,0.9)';        // 金
    var sub = 'rgba(255,255,255,0.28)';
    var corner = 'rgba(246,212,99,0.95)';
    if (borderStyle === 'silver') {
      main = 'rgba(212,220,232,0.9)'; sub = 'rgba(255,255,255,0.4)'; corner = 'rgba(212,220,232,0.9)';
    } else if (borderStyle === 'rose') {
      main = 'rgba(232,178,168,0.9)'; sub = 'rgba(255,255,255,0.35)'; corner = 'rgba(232,178,168,0.95)';
    } else if (borderStyle === 'plain') {
      main = 'rgba(255,255,255,0.55)'; sub = 'rgba(255,255,255,0.2)'; corner = null;
    }
    ctx.save();
    var r = 36;
    ctx.strokeStyle = main;
    ctx.lineWidth = 5;
    roundRectPath(ctx, 22, 22, W - 44, H - 44, r);
    ctx.stroke();
    ctx.strokeStyle = sub;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 34, 34, W - 68, H - 68, r - 10);
    ctx.stroke();
    if (showCorners && corner) {
      var corners = [[22, 22], [W - 22 - 44, 22], [22, H - 22 - 44], [W - 22 - 44, H - 22 - 44]];
      for (var i = 0; i < corners.length; i++) {
        var cx = corners[i][0], cy = corners[i][1];
        var g = ctx.createLinearGradient(cx, cy, cx + 44, cy + 44);
        g.addColorStop(0, corner); g.addColorStop(1, corner.replace(/[\d.]+\)$/, '0.15)'));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 44, cy); ctx.lineTo(cx + 44, cy + 14);
        ctx.lineTo(cx + 14, cy + 14); ctx.lineTo(cx + 14, cy + 44); ctx.lineTo(cx, cy + 44); ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 稀有度徽章 ---------------- */
  function paintRarity(ctx, rarity) {
    if (!rarity) return;
    ctx.save();
    var bw = 104, bh = 42, bx = W - 46 - bw, by = 52;
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, '#FFF0B8'); g.addColorStop(0.5, '#E3B53C'); g.addColorStop(1, '#A87B1E');
    ctx.fillStyle = g;
    roundRectPath(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,42,10,0.7)'; ctx.lineWidth = 2;
    roundRectPath(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = '#3A2A08';
    ctx.font = '800 20px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(rarity, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
  }

  /* 字体栈映射 */
  function fontStack(f) {
    switch (f) {
      case 'song': return '"SimSun", "宋体", serif';
      case 'hei': return '"Microsoft YaHei", "PingFang SC", sans-serif';
      case 'fangsong': return '"FangSong", "仿宋", serif';
      case 'serif': return 'Georgia, "Times New Roman", serif';
      case 'kai':
      default: return '"STKaiti", "KaiTi", "楷体", serif';
    }
  }

  /* 卡名字色：gold=烫金，white=纯白，purple=淡紫，dark=深墨 */
  function paintTextColored(ctx, text, x, y, size, font, align, colorMode, alpha) {
    if (!text) return;
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + (font || 'Georgia, "SimSun", serif');
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineJoin = 'round';
    var fill, stroke;
    if (colorMode === 'white') {
      fill = '#FFFFFF'; stroke = 'rgba(20,20,30,0.85)';
    } else if (colorMode === 'purple') {
      fill = '#D8C8FF'; stroke = 'rgba(40,20,80,0.85)';
    } else if (colorMode === 'dark') {
      fill = '#2A2038'; stroke = 'rgba(255,255,255,0.6)';
    } else {
      // gold：走烫金渐变
      paintGoldText(ctx, text, x, y, size, font, align, alpha);
      ctx.restore();
      return;
    }
    ctx.lineWidth = Math.max(3, size * 0.12);
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ---------------- 主入口 ---------------- */
  /**
   * @param {object} p
   * @param {HTMLCanvasElement} p.subject  抠图后的透明主体
   * @param {string} p.name 卡名
   * @param {string} p.no 编号
   * @param {string} p.rarity 稀有度
   * @param {string} p.bgStyle 背景样式
   * @param {number} p.seed 随机种子
   * @param {string} [p.bgColor] 背景主色（gradient/solid 使用）
   * @param {string} [p.textFont] 卡名字体（kai/song/hei/fangsong/serif）
   * @param {number} [p.subjectScale] 主体缩放（0.5~1.5，默认 1）
   * @returns {{face:HTMLCanvasElement, overlay:HTMLCanvasElement}}
   */
  function build(p) {
    var face = makeCanvas();
    var fctx = face.getContext('2d');
    paintBackground(fctx, p.bgStyle || 'gradient-a', p.seed || 42, p.bgColor, p.bgImage);

    // 主体：置于中部，区域尽可能大，按图片宽高比自适应（保持完整不裁切），支持手动缩放
    paintSubject(fctx, p.subject, 64, 180, W - 128, H - 300, p.subjectScale);

    var overlay = makeCanvas();
    var octx = overlay.getContext('2d');
    paintFrame(octx, p.borderStyle || 'gold', p.showCorners !== false);
    paintRarity(octx, p.rarity);

    // 卡名（顶部）
    var nameSize = 52;
    if (p.name && p.name.length > 6) nameSize = Math.max(34, Math.floor(340 / p.name.length));
    paintTextColored(octx, p.name, W / 2, 132, nameSize, fontStack(p.textFont), 'center', p.nameColor || 'gold');

    // 编号（右下）
    paintGoldText(octx, p.no, W - 60, H - 72, 30, 'Georgia, "Microsoft YaHei", sans-serif', 'right', 0.95);

    // 底部小字
    paintGoldText(octx, 'ART COLLECTION', W / 2, H - 40, 20, 'Arial, sans-serif', 'center', 0.55);

    return { face: face, overlay: overlay };
  }

  global.Compose = { build: build, W: W, H: H };
})(window);
