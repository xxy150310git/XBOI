/* ============================================================
   主题设置
   这个脚本放在 <head> 里，页面还没渲染就把保存好的主题套上，避免刷新闪烁。
   设置只存在当前浏览器（localStorage），不会影响别人看到的配色。
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.theme = (function () {

  var HUE_KEY = 'xboi_theme_hue';
  var BG_KEY  = 'xboi_bg_image';
  var DEFAULT_HUE = 200;          // 天依蓝
  var MAX_SIDE = 1600;            // 背景图压缩后的最长边
  var JPEG_QUALITY = 0.82;

  var hue = DEFAULT_HUE;
  var bgImage = null;
  var styleEl = null;

  // ------------------------------------------------------------
  //  读写本地设置
  // ------------------------------------------------------------

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try {
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
      return true;
    } catch (e) {
      return false;   // 多半是图片太大，配额不够
    }
  }

  // ------------------------------------------------------------
  //  由色相推出一整套配色
  // ------------------------------------------------------------

  function hsl(h, s, l) {
    var hh = ((Math.round(h) % 360) + 360) % 360;
    return 'hsl(' + hh + ' ' + s + '% ' + l + '%)';
  }

  // 底纹跟着主色走，不然换个颜色还飘着蓝色音符会很出戏
  function texture(h) {
    var stroke = hsl(h, 100, 70);
    var star = hsl(h + 130, 100, 83);
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='210' height='210' viewBox='0 0 210 210'>"
      + "<g fill='none' stroke='" + stroke + "' stroke-opacity='.13' stroke-width='1.4' stroke-linecap='round'>"
      + "<path d='M46 132V78l26-6v54'/>"
      + "<ellipse cx='39.5' cy='132' rx='6.5' ry='5.2'/>"
      + "<ellipse cx='65.5' cy='125' rx='6.5' ry='5.2'/></g>"
      + "<path d='M154 44l2.6 6.9L163 53l-6.4 2.6L154 62l-2.6-6.4L145 53l6.4-2.1z' fill='" + star + "' fill-opacity='.18'/>"
      + "<path d='M28 184l1.7 4.6 4.6 1.7-4.6 1.7L28 196l-1.7-4.6-4.6-1.7 4.6-1.7z' fill='" + stroke + "' fill-opacity='.15'/>"
      + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function buildCss() {
    var h = hue;
    var out = ':root {\n'
      + '  --ty-blue: ' + hsl(h, 100, 70) + ';\n'
      + '  --ty-blue-deep: ' + hsl(h - 1, 66, 51) + ';\n'
      + '  --ty-blue-dark: ' + hsl(h + 1, 70, 36) + ';\n'
      + '  --ty-sky: ' + hsl(h - 4, 84, 81) + ';\n'
      + '  --ty-cyan: ' + hsl(h - 11, 78, 75) + ';\n'
      + '  --ty-pink: ' + hsl(h + 130, 100, 83) + ';\n'
      + '  --ty-pink-deep: ' + hsl(h + 132, 62, 66) + ';\n'
      + '  --ty-lilac: ' + hsl(h + 55, 76, 84) + ';\n'
      + '  --bg: ' + hsl(h, 100, 97) + ';\n'
      + '  --line: ' + hsl(h, 58, 90) + ';\n'
      + '  --line-soft: ' + hsl(h, 70, 95) + ';\n'
      + '  --note-texture: ' + texture(h) + ';\n'
      + '  --shadow: 0 6px 24px hsla(' + h + ', 66%, 51%, .12);\n'
      + '  --shadow-lg: 0 16px 44px hsla(' + h + ', 66%, 51%, .20);\n'
      + '}\n';

    if (bgImage) {
      // 自定义背景：上面压一层白色薄纱，保证卡片和文字还看得清
      out += 'body {\n'
        + '  background-image: linear-gradient(rgba(255,255,255,.80), rgba(255,255,255,.84)), url("' + bgImage + '");\n'
        + '  background-size: auto, cover;\n'
        + '  background-position: center, center;\n'
        + '  background-repeat: repeat, no-repeat;\n'
        + '  background-attachment: fixed, fixed;\n'
        + '}\n';
    }
    return out;
  }

  function ensureStyleEl() {
    if (styleEl && styleEl.parentNode) return styleEl;
    styleEl = document.getElementById('xboiTheme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'xboiTheme';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    return styleEl;
  }

  function apply() {
    ensureStyleEl().textContent = buildCss();
  }

  // ------------------------------------------------------------
  //  颜色工具
  // ------------------------------------------------------------

  function hexToHue(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return DEFAULT_HUE;
    var v = m[1];
    var r = parseInt(v.slice(0, 2), 16) / 255;
    var g = parseInt(v.slice(2, 4), 16) / 255;
    var b = parseInt(v.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return DEFAULT_HUE;
    var hh;
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh = Math.round(hh * 60);
    if (hh < 0) hh += 360;
    return hh;
  }

  function hueToHex(h) {
    function c(n) {
      var k = (n + h / 30) % 12;
      var v = 0.7 - 0.4 * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
      return Math.round(255 * v).toString(16).padStart(2, '0');
    }
    return '#' + c(0) + c(8) + c(4);
  }

  // ------------------------------------------------------------
  //  对外：设置接口
  // ------------------------------------------------------------

  function setHue(h, remember) {
    hue = ((Math.round(h) % 360) + 360) % 360;
    if (remember !== false) writeStore(HUE_KEY, String(hue));
    apply();
    syncPanel();
  }

  function setBg(dataUrl, remember) {
    bgImage = dataUrl || null;
    if (remember !== false) {
      var okFlag = writeStore(BG_KEY, bgImage);
      if (!okFlag && bgImage) {
        notify('背景图存不下了，换一张小一点的图片试试', 'err');
        bgImage = null;
        writeStore(BG_KEY, null);
      }
    }
    apply();
    syncPanel();
  }

  function resetAll() {
    hue = DEFAULT_HUE;
    bgImage = null;
    writeStore(HUE_KEY, null);
    writeStore(BG_KEY, null);
    apply();
    syncPanel();
    notify('已恢复默认主题', 'ok');
  }

  function notify(msg, kind) {
    if (XBOI.ui && XBOI.ui.toast) XBOI.ui.toast(msg, kind);
  }

  // 把图片压到合适的尺寸再存，不然 localStorage 塞不下
  function compress(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        var ctx2d = cv.getContext('2d');
        ctx2d.fillStyle = '#ffffff';
        ctx2d.fillRect(0, 0, cv.width, cv.height);
        ctx2d.drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = function () { notify('这张图片读不出来，换一张试试', 'err'); };
      img.src = reader.result;
    };
    reader.onerror = function () { notify('读取文件失败', 'err'); };
    reader.readAsDataURL(file);
  }

  // ------------------------------------------------------------
  //  面板
  // ------------------------------------------------------------

  var PRESETS = [
    { name: '天依蓝', hue: 200 },
    { name: '薄荷绿', hue: 165 },
    { name: '樱花粉', hue: 335 },
    { name: '薰衣草', hue: 265 },
    { name: '日落橙', hue: 25 },
    { name: '柠檬黄', hue: 48 },
    { name: '晴空青', hue: 185 },
    { name: '深海蓝', hue: 218 }
  ];

  function buildButton() {
    var bar = document.querySelector('.topbar-inner');
    if (!bar || document.querySelector('.theme-slot')) return;

    var slot = document.createElement('div');
    slot.className = 'theme-slot';
    slot.innerHTML =
      '<button class="theme-btn" type="button" id="themeBtn" title="主题设置" aria-label="主题设置">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/>' +
          '<circle cx="7.6" cy="11.4" r="1.2" fill="currentColor" stroke="none"/>' +
          '<circle cx="10.4" cy="7.4" r="1.2" fill="currentColor" stroke="none"/>' +
          '<circle cx="15.2" cy="8.4" r="1.2" fill="currentColor" stroke="none"/>' +
        '</svg>' +
      '</button>';
    bar.appendChild(slot);

    document.getElementById('themeBtn').addEventListener('click', openPanel);
  }

  function buildModal() {
    if (document.getElementById('themeModal')) return;
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.id = 'themeModal';
    mask.hidden = true;
    mask.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<button class="modal-x" type="button" data-close aria-label="关闭">\u00d7</button>' +
        '<h2 class="modal-title">主题设置</h2>' +
        '<p class="modal-sub">选一个主色，整站配色会跟着它的色相走；背景图只保存在你自己的浏览器里。</p>' +

        '<h3 class="modal-h3">主题色</h3>' +
        '<div class="swatches" id="themeSwatches"></div>' +
        '<div class="field" style="margin-top:14px">' +
          '<label>或者自己取一个颜色</label>' +
          '<input type="color" id="themeColor" value="#66ccff">' +
        '</div>' +

        '<h3 class="modal-h3">背景图片</h3>' +
        '<div class="bg-preview" id="bgPreview"></div>' +
        '<div class="auth-actions" style="margin-top:12px">' +
          '<button class="btn ghost" type="button" id="bgPick">选择图片</button>' +
          '<button class="btn ghost" type="button" id="bgClear">恢复默认</button>' +
        '</div>' +
        '<input type="file" id="bgFile" accept="image/*" hidden>' +

        '<hr class="modal-hr">' +
        '<button class="btn ghost" type="button" id="themeReset" style="width:100%">恢复默认主题</button>' +
      '</div>';
    document.body.appendChild(mask);

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-close')) closePanel();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !mask.hidden) closePanel();
    });

    // 色板
    var wrap = document.getElementById('themeSwatches');
    wrap.innerHTML = PRESETS.map(function (p) {
      return '<button class="swatch" type="button" data-hue="' + p.hue + '" title="' + p.name + '">' +
        '<span style="background:' + hsl(p.hue, 100, 70) + '"></span></button>';
    }).join('');

    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.swatch') : null;
      if (!btn) return;
      setHue(parseInt(btn.getAttribute('data-hue'), 10));
    });

    document.getElementById('themeColor').addEventListener('input', function () {
      setHue(hexToHue(this.value));
    });

    document.getElementById('bgPick').addEventListener('click', function () {
      document.getElementById('bgFile').click();
    });

    document.getElementById('bgFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { notify('请选择图片文件', 'err'); return; }
      compress(f, function (dataUrl) {
        setBg(dataUrl);
        notify('背景图换好了', 'ok');
      });
      this.value = '';
    });

    document.getElementById('bgClear').addEventListener('click', function () {
      if (!bgImage) { notify('现在用的就是默认背景'); return; }
      setBg(null);
      notify('已恢复默认背景', 'ok');
    });

    document.getElementById('themeReset').addEventListener('click', resetAll);
  }

  function syncPanel() {
    var colorInput = document.getElementById('themeColor');
    if (colorInput) colorInput.value = hueToHex(hue);

    var wrap = document.getElementById('themeSwatches');
    if (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll('.swatch'), function (b) {
        var h = parseInt(b.getAttribute('data-hue'), 10);
        b.classList.toggle('on', h === hue);
      });
    }

    var prev = document.getElementById('bgPreview');
    if (prev) {
      if (bgImage) {
        prev.innerHTML = '<img src="' + bgImage + '" alt="背景预览">';
        prev.classList.add('has-img');
      } else {
        prev.textContent = '还没有设置背景图';
        prev.classList.remove('has-img');
      }
    }
  }

  function openPanel() {
    buildModal();
    syncPanel();
    document.getElementById('themeModal').hidden = false;
  }

  function closePanel() {
    var m = document.getElementById('themeModal');
    if (m) m.hidden = true;
  }

  // ------------------------------------------------------------
  //  启动：先把主题套上，等 DOM 好了再挂按钮
  // ------------------------------------------------------------

  var savedHue = parseInt(readStore(HUE_KEY), 10);
  hue = isNaN(savedHue) ? DEFAULT_HUE : ((savedHue % 360) + 360) % 360;
  bgImage = readStore(BG_KEY) || null;
  apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildButton);
  } else {
    buildButton();
  }

  return {
    setHue: setHue,
    setBg: setBg,
    resetAll: resetAll,
    currentHue: function () { return hue; },
    hasBg: function () { return !!bgImage; },
    open: openPanel
  };
})();
