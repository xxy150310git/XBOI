/* ============================================================
   公共界面工具：转义、格式化、提示条、标签页等
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.ui = (function () {

  // 分类中文名
  var CATEGORY = {
    contest:  '比赛奖励',
    training: '周训练',
    penalty:  '违规处罚',
    reward:   '额外奖励',
    exchange: '道具兑换',
    manual:   '手动调整',
    join:     '入队发放',
    leave:    '退队清零'
  };

  // 比赛类型中文名
  var CONTEST_TYPE = {
    entry:  '入门赛',
    week:   '周赛',
    month:  '月赛',
    member: '成员赛'
  };

  // 比赛状态中文名
  var CONTEST_STATUS = {
    planned:  '待举办',
    running:  '进行中',
    finished: '已结束'
  };

  // 成员状态中文名
  var MEMBER_STATUS = {
    active:  '在队',
    left:    '已退队',
    removed: '已移出'
  };

  // 名字颜色 → 标签样式
  var COLOR_TAG = {
    '红名': 'tag-red',
    '橙名': 'tag-orange',
    '紫名': 'tag-purple',
    '蓝名': 'tag-blue',
    '绿名': 'tag-green',
    '灰名': 'tag-gray',
    '棕名': 'tag-brown'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // 把用户输入转义后再拼进 HTML，避免标签注入
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // X 币数量：正数带加号，负数用真正负号
  function fmtCoin(n) {
    n = Number(n) || 0;
    if (n > 0) return '+' + n;
    if (n < 0) return '\u2212' + Math.abs(n);
    return '0';
  }

  // X 币数量：不带符号
  function fmtNum(n) {
    return String(Number(n) || 0);
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // ISO 时间 → 2026-04-20 12:00
  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // ISO 时间 → 2026-04-20
  function fmtDay(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // 名字颜色标签
  function colorTag(color, extra) {
    var cls = COLOR_TAG[color] || 'tag-gray';
    return '<span class="tag ' + cls + '">' + esc(color || '灰名') + '</span>' + (extra || '');
  }

  // 右下角轻提示
  function toast(msg, kind) {
    var wrap = $('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }, 2600);
  }

  // 顶部导航高亮当前页
  function markNav() {
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav a').forEach(function (a) {
      var target = a.getAttribute('href');
      if (target === here) a.classList.add('active');
    });
  }

  // 载入中占位
  function loading(el, text) {
    el.innerHTML = '<div class="spinner"></div>' +
      (text ? '<div class="empty" style="padding-top:0">' + esc(text) + '</div>' : '');
  }

  function empty(el, text) {
    el.innerHTML = '<div class="empty">' + esc(text || '暂无数据') + '</div>';
  }

  // 简易标签页绑定
  function bindTabs(tabsSel, panelsSel) {
    var btns = $$(tabsSel + ' button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var key = b.getAttribute('data-tab');
        $$(panelsSel).forEach(function (p) {
          p.classList.toggle('on', p.getAttribute('data-panel') === key);
        });
      });
    });
  }

  return {
    $: $, $$: $$,
    esc: esc,
    fmtCoin: fmtCoin,
    fmtNum: fmtNum,
    fmtTime: fmtTime,
    fmtDay: fmtDay,
    colorTag: colorTag,
    toast: toast,
    markNav: markNav,
    loading: loading,
    empty: empty,
    bindTabs: bindTabs,
    CATEGORY: CATEGORY,
    CONTEST_TYPE: CONTEST_TYPE,
    CONTEST_STATUS: CONTEST_STATUS,
    MEMBER_STATUS: MEMBER_STATUS,
    COLOR_TAG: COLOR_TAG
  };
})();
