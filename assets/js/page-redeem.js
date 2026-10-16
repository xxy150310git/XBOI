/* ============================================================
   道具兑换页
   兑换前必须登录，点兑换时还要再输一次密码确认
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var db = XBOI.db;
  var auth = XBOI.auth;

  var me = null;        // 当前登录成员在成员表里的那一行
  var items = [];       // 可兑换道具

  ui.markNav();
  if (db.isDemo()) ui.$('#demoNotice').hidden = false;

  // ------------------------------------------------------------
  //  复制兑换码
  // ------------------------------------------------------------

  function copyText(text) {
    // file:// 下 navigator.clipboard 常被拦，所以留一条兜底路径
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        ui.toast('兑换码已复制', 'ok');
      }).catch(function () { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var okFlag = false;
    try { okFlag = document.execCommand('copy'); } catch (e) { okFlag = false; }
    document.body.removeChild(ta);
    ui.toast(okFlag ? '兑换码已复制' : '复制失败，请手动选中复制', okFlag ? 'ok' : 'err');
  }

  // ------------------------------------------------------------
  //  道具列表
  // ------------------------------------------------------------

  function renderItems() {
    var box = ui.$('#itemGrid');
    if (!items.length) { ui.empty(box, '暂时没有可兑换的道具'); return; }

    var enabled = !!(me && me.status === 'active');

    box.innerHTML = items.map(function (it) {
      return '<div class="item-card">' +
        '<div class="item-ico">' + (it.icon || XBOI.items.icon(it.code)) + '</div>' +
        '<div class="item-body">' +
          '<div class="item-head">' +
            '<h3>' + ui.esc(it.name) + '</h3>' +
            '<span class="price">' + it.cost + '<small>X 币</small></span>' +
          '</div>' +
          '<p>' + ui.esc(it.description) + '</p>' +
          '<div class="item-foot">' +
            '<span class="muted">兑换码有效期 ' + (it.valid_days || 90) + ' 天</span>' +
            '<button class="btn" data-redeem="' + ui.esc(it.code) + '"' + (enabled ? '' : ' disabled') +
              '>兑换</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    ui.$$('[data-redeem]', box).forEach(function (b) {
      b.addEventListener('click', function () { doRedeem(b.getAttribute('data-redeem')); });
    });
  }

  // ------------------------------------------------------------
  //  兑换
  // ------------------------------------------------------------

  function doRedeem(itemCode) {
    if (!me) { auth.openLogin(); return; }

    var item = null;
    items.forEach(function (x) { if (x.code === itemCode) item = x; });
    if (!item) return;

    if (Number(me.balance) < Number(item.cost)) {
      ui.toast('X 币不够啦，还差 ' + (item.cost - me.balance) + ' 币', 'err');
      return;
    }

    auth.confirmPassword(
      '确认兑换「' + item.name + '」',
      '这次会扣掉 ' + item.cost + ' X 币，再输一次密码确认是你本人。'
    ).then(function (password) {
      if (!password) return;   // 取消了

      var btns = ui.$$('[data-redeem]');
      btns.forEach(function (b) { b.disabled = true; });

      return db.redeem(itemCode, password).then(function (r) {
        ui.toast('兑换成功，兑换码 ' + r.out_code, 'ok');
        showCodeCard(r, item);
        return refresh(true);
      }).catch(function (err) {
        ui.toast(err.message, 'err');
      }).then(function () {
        btns.forEach(function (b) { b.disabled = false; });
        renderItems();
      });
    });
  }

  // 兑换成功后把兑换码高亮显示出来
  function showCodeCard(r, item) {
    var host = ui.$('#freshBox');
    var el = document.createElement('div');
    el.className = 'ticket ticket-fresh';
    el.style.marginTop = '14px';
    el.innerHTML =
      '<div class="ticket-left">' +
        '<div class="ticket-label">兑换成功，把这张码发给管理员核销</div>' +
        '<div class="ticket-item">' + ui.esc(r.out_item_name || item.name) + '</div>' +
        '<div class="ticket-code">' + ui.esc(r.out_code) + '</div>' +
        '<div class="ticket-meta">有效期至 ' + ui.fmtDay(r.out_expires_at) +
          ' · 剩余 X 币 ' + ui.fmtNum(r.out_balance) + '</div>' +
      '</div>' +
      '<div class="ticket-right">' +
        '<button class="btn sm" data-copy="' + ui.esc(r.out_code) + '">复制兑换码</button>' +
      '</div>';
    host.appendChild(el);

    ui.$$('[data-copy]', el).forEach(function (b) {
      b.addEventListener('click', function () { copyText(b.getAttribute('data-copy')); });
    });

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ------------------------------------------------------------
  //  我的兑换码
  // ------------------------------------------------------------

  var STATUS_TEXT = { unused: '未使用', used: '已使用', expired: '已过期' };
  var STATUS_CLASS = { unused: 'tag-green', used: 'tag-gray', expired: 'tag-red' };

  function renderCodes(list) {
    var box = ui.$('#codeBox');
    if (!list.length) { ui.empty(box, '还没有兑换过道具'); return; }

    box.innerHTML = list.map(function (r) {
      var st = r.display_status || 'unused';
      return '<div class="ticket' + (st === 'used' ? ' ticket-done' : '') + '">' +
        '<div class="ticket-left">' +
          '<div class="ticket-item">' + ui.esc(r.item_name) + '</div>' +
          '<div class="ticket-code">' + ui.esc(r.code) + '</div>' +
          '<div class="ticket-meta">兑换于 ' + ui.fmtTime(r.created_at) +
            ' · 有效期至 ' + ui.fmtDay(r.expires_at) +
            (r.used_at ? ' · 核销于 ' + ui.fmtTime(r.used_at) : '') +
            ' · 消耗 ' + ui.fmtNum(r.cost) + ' X 币</div>' +
        '</div>' +
        '<div class="ticket-right">' +
          '<span class="tag ' + (STATUS_CLASS[st] || 'tag-gray') + '">' + (STATUS_TEXT[st] || st) + '</span>' +
          (st === 'unused'
            ? '<button class="btn ghost sm" data-copy="' + ui.esc(r.code) + '">复制</button>'
            : '') +
        '</div>' +
      '</div>';
    }).join('');

    ui.$$('[data-copy]', box).forEach(function (b) {
      b.addEventListener('click', function () { copyText(b.getAttribute('data-copy')); });
    });
  }

  // ------------------------------------------------------------
  //  账户区域
  // ------------------------------------------------------------

  function renderNotLoggedIn() {
    ui.$('#whoBox').innerHTML =
      '<div class="notice info" style="margin-bottom:0">' +
        '还没有登录。点右上角的<b>登录</b>，用洛谷用户名和密码进来就能兑换啦。' +
      '</div>' +
      '<div style="margin-top:14px">' +
        '<button class="btn" type="button" id="goLogin">去登录</button>' +
      '</div>';
    ui.$('#goLogin').addEventListener('click', function () { auth.openLogin(); });
    renderItems();
    ui.empty(ui.$('#codeBox'), '登录后这里会显示你兑换过的道具与兑换码。');
  }

  function renderWho() {
    ui.$('#whoBox').innerHTML =
      '<div class="account">' +
        '<div class="avatar">' + ui.esc(String(me.luogu_name).slice(0, 1).toUpperCase()) + '</div>' +
        '<div class="who">' +
          '<h2>' + ui.esc(me.luogu_name) + '</h2>' +
          '<div class="sub">' + (me.display_name ? ui.esc(me.display_name) + ' · ' : '') +
            ui.colorTag(me.color) + ' · ' + (ui.MEMBER_STATUS[me.status] || me.status) + '</div>' +
        '</div>' +
        '<div class="balance"><div class="k">可用 X 币</div>' +
          '<div class="v">' + ui.fmtNum(me.balance) + '</div></div>' +
      '</div>' +
      (auth.me() && auth.me().out_is_default
        ? '<div class="notice warn" style="margin:14px 0 0">你还在用初始密码 123456，' +
          '点右上角头像就能改掉。</div>'
        : '');
  }

  function refresh(silent) {
    if (!auth.me()) { me = null; renderNotLoggedIn(); return Promise.resolve(); }
    return db.findMember(auth.me().out_luogu_name).then(function (fresh) {
      if (fresh) me = fresh;
      if (!me) { renderNotLoggedIn(); return null; }
      renderWho();
      renderItems();
      return db.getRedemptions(me.id);
    }).then(function (list) {
      if (list === null || list === undefined) return;
      renderCodes(list || []);
      if (!silent) ui.toast('已载入 ' + me.luogu_name, 'ok');
    });
  }

  // ------------------------------------------------------------
  //  启动
  // ------------------------------------------------------------

  db.listItems().then(function (list) {
    items = list || [];
    renderItems();
  }).catch(function (err) {
    ui.$('#itemGrid').innerHTML = '<div class="notice danger">道具读取失败：' + ui.esc(err.message) + '</div>';
  });

  auth.ready(function () {
    ui.$('#freshBox').innerHTML = '';
    refresh(true);
  });

  // 登录、退出、改密码后同步刷新
  auth.onChange(function () {
    ui.$('#freshBox').innerHTML = '';
    refresh(true);
  });
})();
